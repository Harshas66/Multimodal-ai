import os
from dotenv import load_dotenv

load_dotenv()
print("HF_TOKEN from .env:", os.getenv("HF_TOKEN"))