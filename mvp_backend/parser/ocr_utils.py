from __future__ import annotations

from pathlib import Path
from typing import Iterable

import fitz
import pytesseract
from PIL import Image


def image_to_text(image: Image.Image, lang: str = "rus+eng") -> str:
    text = pytesseract.image_to_string(image, lang=lang)
    return "\n".join(line.rstrip() for line in text.splitlines()).strip()



def pdf_pages_to_images(pdf_path: str | Path, dpi: int = 200) -> list[Image.Image]:
    doc = fitz.open(str(pdf_path))
    images: list[Image.Image] = []
    scale = dpi / 72.0

    for page in doc:
        matrix = fitz.Matrix(scale, scale)
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        mode = "RGB"
        image = Image.frombytes(mode, [pix.width, pix.height], pix.samples)
        images.append(image)

    return images



def images_to_text(images: Iterable[Image.Image], lang: str = "rus+eng") -> str:
    parts = []
    for image in images:
        part = image_to_text(image, lang=lang)
        if part:
            parts.append(part)
    return "\n\n".join(parts).strip()
