from transformers import AutoModelForCausalLM, AutoTokenizer
import torch, os

# Point to local folder
model_dir = os.path.join(os.getcwd(), "Meta-Llama-3.1-8B-Instruct", "original")

print("⏳ Loading LLaMA 3.1 locally...")
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B-Instruct", use_fast=False)

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B-Instruct",
    torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
    device_map="auto",
    local_files_only=True,
    cache_dir=model_dir
)

prompt = "Explain deep learning in one line."
inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

print("🧠 Generating...")
outputs = model.generate(**inputs, max_new_tokens=60)
print("\n💬", tokenizer.decode(outputs[0], skip_special_tokens=True))