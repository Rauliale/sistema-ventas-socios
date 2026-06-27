import sys
from PyPDF2 import PdfReader

try:
    reader = PdfReader("Sistema de Gestión de Ventas.pdf")
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    with open("pdf_output.txt", "w", encoding="utf-8") as f:
        f.write(text)
except Exception as e:
    print(f"Error: {e}")
