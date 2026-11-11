from pathlib import Path

import torch
import torch.nn as nn
from transformers import AutoModel, AutoTokenizer
from .developmental_domains import DEVELOPMENTAL_LABELS, SUITABILITY_LABELS


# ==========================================================
# PATH CONFIGURATION
# ==========================================================

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "dev_assessment"
CHECKPOINT_PATH = MODEL_PATH / "dev_assessment.pth"

MAX_LENGTH = 160
TOKEN_STRIDE = 32
WINDOW_BATCH_SIZE = 8
DOMAIN_THRESHOLD = 0.5


# ==========================================================
# LABEL CONFIGURATION
# Keep this order identical to the order used during training.
# ==========================================================

# ==========================================================
# DEVICE CONFIGURATION
# ==========================================================

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# ==========================================================
# MULTI-TASK MODEL ARCHITECTURE
#
# This architecture must match the model used to train the
# updated checkpoint. If the training notebook uses different
# layer names, pooling, or dropout, update this class to match.
# ==========================================================

class DevelopmentalAssessmentModel(nn.Module):
    def __init__(
        self,
        model_name="bert-base-uncased",
        num_domains=len(DEVELOPMENTAL_LABELS),
        num_suitability_classes=len(SUITABILITY_LABELS),
        dropout_rate=0.3,
    ):
        super().__init__()

        self.bert = AutoModel.from_pretrained(model_name)
        hidden_size = self.bert.config.hidden_size

        self.dropout = nn.Dropout(dropout_rate)

        # The trained checkpoint uses these head names.
        self.domain_head = nn.Linear(
            hidden_size,
            num_domains,
        )

        self.suitability_head = nn.Linear(
            hidden_size,
            num_suitability_classes,
        )

    def forward(self, input_ids, attention_mask):
        outputs = self.bert(
            input_ids=input_ids,
            attention_mask=attention_mask,
        )

        # bert-base-uncased provides a pooled [CLS] representation.
        pooled_output = outputs.pooler_output
        pooled_output = self.dropout(pooled_output)

        domain_logits = self.domain_head(pooled_output)
        suitability_logits = self.suitability_head(pooled_output)

        return {
            "domain_logits": domain_logits,
            "suitability_logits": suitability_logits,
        }


# ==========================================================
# LOAD TOKENIZER
# The updated tokenizer files should be stored in MODEL_PATH.
# ==========================================================

tokenizer = AutoTokenizer.from_pretrained(str(MODEL_PATH))


# ==========================================================
# INITIALIZE MODEL AND LOAD TRAINED WEIGHTS
# ==========================================================

model = DevelopmentalAssessmentModel(
    model_name="bert-base-uncased",
    num_domains=len(DEVELOPMENTAL_LABELS),
    num_suitability_classes=len(SUITABILITY_LABELS),
)

checkpoint = torch.load(
    CHECKPOINT_PATH,
    map_location="cpu",
    weights_only=True,
)

# Support a raw state_dict or common checkpoint wrappers.
if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
    state_dict = checkpoint["model_state_dict"]
elif isinstance(checkpoint, dict) and "state_dict" in checkpoint:
    state_dict = checkpoint["state_dict"]
else:
    state_dict = checkpoint

# Handle checkpoints saved from torch.nn.DataParallel.
state_dict = {
    key.removeprefix("module."): value
    for key, value in state_dict.items()
}

model.load_state_dict(state_dict, strict=True)
model.to(DEVICE)
model.eval()


# ==========================================================
# DEVELOPMENTAL ASSESSMENT PREDICTION
# ==========================================================

def predict_developmental_assessment(text):
    """
    Predicts:
      1. Probabilities for the 21 developmental domains.
      2. The three-class developmental suitability outcome.

    Returns a dictionary suitable for use by the Django API.
    """

    if not isinstance(text, str) or not text.strip():
        raise ValueError("Text cannot be empty.")

    inputs = tokenizer(
        text,
        max_length=MAX_LENGTH,
        padding="max_length",
        truncation=True,
        stride=TOKEN_STRIDE,
        return_overflowing_tokens=True,
        return_tensors="pt",
    )

    input_ids = inputs["input_ids"]
    attention_mask = inputs["attention_mask"]
    window_count = input_ids.shape[0]
    domain_probability_sum = torch.zeros(len(DEVELOPMENTAL_LABELS))
    suitability_probability_sum = torch.zeros(len(SUITABILITY_LABELS))
    with torch.inference_mode():
        for start in range(0, window_count, WINDOW_BATCH_SIZE):
            end = start + WINDOW_BATCH_SIZE
            outputs = model(
                input_ids=input_ids[start:end].to(DEVICE),
                attention_mask=attention_mask[start:end].to(DEVICE),
            )

            # Average overlapping-window probabilities so long transcripts
            # are assessed beyond their opening 160 tokens.
            domain_probability_sum += torch.sigmoid(
                outputs["domain_logits"]
            ).sum(dim=0).cpu()
            suitability_probability_sum += torch.softmax(
                outputs["suitability_logits"],
                dim=1,
            ).sum(dim=0).cpu()

    domain_probabilities = domain_probability_sum / window_count
    suitability_probabilities = suitability_probability_sum / window_count

    domain_scores = {
        label: round(float(probability), 4)
        for label, probability in zip(
            DEVELOPMENTAL_LABELS,
            domain_probabilities.cpu().tolist(),
        )
    }

    identified_domains = [
        label
        for label, probability in domain_scores.items()
        if probability >= DOMAIN_THRESHOLD
    ]

    suitability_scores = {
        label: round(float(probability), 4)
        for label, probability in zip(
            SUITABILITY_LABELS,
            suitability_probabilities.cpu().tolist(),
        )
    }

    suitability_index = int(
        torch.argmax(suitability_probabilities).item()
    )

    return {
        "developmental_domains": identified_domains,
        "domain_probabilities": domain_scores,
        "suitability": SUITABILITY_LABELS[suitability_index],
        "suitability_probabilities": suitability_scores,
    }


# Backwards-compatible function name for existing endpoint imports.
# The returned structure is now the updated multi-task result.
def predict_developmental_probabilities(text):
    return predict_developmental_assessment(text)
