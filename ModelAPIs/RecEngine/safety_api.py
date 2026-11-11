#Running on colab is highly recommended for easier testing
from pathlib import Path
import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModelForSequenceClassification

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "safety_classification" # when loading model change path to Broduro23/Bert_Safety_Classification 



# 1. Load the Tokenizer from your saved folder
# Create a folder in colab and add the tokenizer json files to it
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)

# 2. Initialize the blank base architecture
model = AutoModelForSequenceClassification.from_pretrained(
    "bert-base-uncased",
    num_labels=2
)

# 3. Inject your trained weights into the architecture
# map_location ensures it loads on a CPU if a GPU is unavailable
model.load_state_dict(
    torch.load(MODEL_PATH / "bertsafety_classification.pth", map_location=torch.device('cpu'))
)
model.eval()

# 4. Create a function to process new text
def predict_safety(text):
    # Tokenize the input exactly like you did in training
    inputs = tokenizer(
        text,
        max_length=128,
        padding="max_length",
        truncation=True,
        return_tensors="pt" # Return PyTorch tensors ('pt') instead of NumPy ('np')
    )

    # Run the model without tracking gradients
    with torch.no_grad():
        outputs = model(**inputs)

    # Convert raw logits to percentages
    probabilities = F.softmax(outputs.logits, dim=-1)
    predicted_class = torch.argmax(probabilities, dim=-1).item()
    confidence = probabilities[0][predicted_class].item()

    labels = ["Safe", "Unsafe"]
    return labels[predicted_class], confidence


def predict_safety_for_full_text(text):
    """Check every transcript token despite the model's 128-token limit."""
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Text cannot be empty.")

    token_ids = tokenizer.encode(text, add_special_tokens=False)
    chunk_size = 126
    step_size = 96
    confidences = []

    for offset in range(0, len(token_ids), step_size):
        chunk = tokenizer.decode(
            token_ids[offset:offset + chunk_size],
            skip_special_tokens=True,
        )
        label, confidence = predict_safety(chunk)
        if label.strip().lower() == "unsafe":
            return "Unsafe", confidence
        if label.strip().lower() != "safe":
            raise ValueError("Safety model returned an unknown label.")
        confidences.append(confidence)

    return "Safe", min(confidences, default=0.0)

