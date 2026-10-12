from pathlib import Path

import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "dev_assessment"

MAX_LENGTH = 128

DEVELOPMENTAL_LABELS = [
    
    "number_identification",
    "number_size_discrimination",
    "letter_alphabet_knowledge",
    "phonological_awareness",
    "expressive_language",
    "receptive_language",
    "fine_motor",
    "mental_flexibility",
    "working_memory",
    "inhibition",
    "approaches_to_learning_play",
    "social_competence",
    "relationship_skills",
    "interpersonal_conflict_resolution",
    "prosocial_behaviour",
    "social_cognition",
    "theory_of_mind",
    "empathy",
    "emotion_knowledge",
    "self_regulation",
]

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Load tokenizer
tokenizer = AutoTokenizer.from_pretrained(
    str(MODEL_PATH)
)

# Initialize BERT with 21 output labels
model = AutoModelForSequenceClassification.from_pretrained(
    "bert-base-uncased",
    num_labels=len(DEVELOPMENTAL_LABELS),
    problem_type="multi_label_classification",
)

# Load your trained model weights
checkpoint_path = MODEL_PATH / "dev_assessment.pth"

state_dict = torch.load(
    checkpoint_path,
    map_location="cpu",
    weights_only=True,
)

# Support checkpoints saved as either a state dictionary
# or a dictionary containing the state dictionary.
if "state_dict" in state_dict:
    state_dict = state_dict["state_dict"]

model.load_state_dict(state_dict)

model.to(DEVICE)
model.eval()


def predict_developmental_probabilities(text):
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Text cannot be empty.")

    inputs = tokenizer(
        text,
        max_length=MAX_LENGTH,
        padding="max_length",
        truncation=True,
        return_tensors="pt",
    )

    inputs = {
        key: value.to(DEVICE)
        for key, value in inputs.items()
    }

    with torch.inference_mode():
        outputs = model(**inputs)
        probabilities = torch.sigmoid(outputs.logits)[0].cpu().tolist()

    return {
        label: round(float(probability), 4)
        for label, probability in zip(
            DEVELOPMENTAL_LABELS,
            probabilities,
        )
    }