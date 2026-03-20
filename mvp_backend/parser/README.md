# DOCX/PDF parser with OCR fallback

Небольшой Python-модуль для распознавания DOCX/PDF.

Что делает:
- DOCX: читает текст и таблицы напрямую, без OCR
- PDF: сначала пробует вытащить текст и таблицы напрямую
- PDF: если текстового слоя нет или он слишком плохой, включает OCR fallback

## Установка

```bash
pip install -r requirements.txt
```

Для OCR нужен системный Tesseract.

### Arch Linux
```bash
sudo pacman -S tesseract tesseract-data-rus tesseract-data-eng poppler
```

### Ubuntu/Debian
```bash
sudo apt-get install tesseract-ocr tesseract-ocr-rus tesseract-ocr-eng poppler-utils
```

## Использование

```python
from document_parser import parse_document

result = parse_document("sample.pdf")
print(result)
```

## Формат результата

```json
{
  "file_name": "sample.pdf",
  "file_type": "pdf",
  "content_type": "table",
  "columns": ["ФИО клиента", "Сумма руб", "Дата заявки"],
  "rows": [
    {
      "ФИО клиента": "Иванов Иван",
      "Сумма руб": "120000",
      "Дата заявки": "01.01.2025"
    }
  ],
  "text": "",
  "blocks": [],
  "warnings": []
}
```

## Важная оговорка

Для DOCX OCR почти никогда не нужен: это zip/xml-формат, его лучше читать напрямую.
OCR здесь используется только для PDF fallback.
