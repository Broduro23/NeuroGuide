#Running on colab is highly recommended for easier testing
from pathlib import Path
import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModelForSequenceClassification

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "safety_classification"



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

