#Running on colab is highly recommended for easier testing
import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# 1. Load the Tokenizer from your saved folder
# Create a folder in colab and add the tokenizer json files to it
tokenizer = AutoTokenizer.from_pretrained("./bert_safety_tokenizer")

# 2. Initialize the blank base architecture
model = AutoModelForSequenceClassification.from_pretrained(
    "bert-base-uncased",
    num_labels=2
)

# 3. Inject your trained weights into the architecture
# map_location ensures it loads on a CPU if a GPU is unavailable
model.load_state_dict(
    torch.load("bertsafety_classifcation.pth", map_location=torch.device('cpu'))
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

# Test the pipeline
test_text = "This guy is a fucking idiot." # Enter the test text here and out put will be printed on console
result, confidence = predict_safety(test_text)

print(f"Text: '{test_text}'")
print(f"Classification: {result}")
print(f"Confidence: {confidence * 100:.2f}%")