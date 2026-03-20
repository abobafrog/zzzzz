# MVP backend на Python

Минимальный бэкенд для генератора маппинга из CSV/XLS/XLSX в target JSON с генерацией TypeScript.

## Что умеет

- принимает `csv`, `xlsx`, `xls`
- разбирает файл во внутренний формат
- принимает `target JSON`
- сопоставляет колонки без LLM
- генерирует TypeScript по шаблону
- строит preview по первым 2–3 строкам
- сохраняет историю для авторизованного пользователя
- хранит файлы гостя временно с TTL

## Структура

- `app.py` — точка входа FastAPI
- `routes.py` — API endpoints
- `parsers.py` — разбор файлов и target JSON
- `matcher.py` — сопоставление полей
- `generator.py` — генерация TypeScript и preview
- `storage.py` — SQLite + файловое хранение
- `requirements.txt` — зависимости

## Запуск

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload
```

## Эндпоинты

### `POST /api/generate`

`multipart/form-data`:

- `file`: файл `csv/xlsx/xls`
- `target_json`: JSON-строка
- `user_id`: optional, если есть — считаем пользователя авторизованным
- `keep_guest_file`: optional boolean, по умолчанию `false`

Пример cURL:

```bash
curl -X POST "http://127.0.0.1:8000/api/generate" \
  -F 'file=@./example.csv' \
  -F 'target_json={"customerName":"","amount":0,"createdAt":""}' \
  -F 'user_id=user-123'
```

### `GET /api/history/{user_id}`

Возвращает историю генераций пользователя.

## Логика маппинга

1. normalized exact match
2. contains match
3. token overlap
4. similarity fallback
5. warning, если колонка не найдена

## Ограничения MVP

- берется только первый лист Excel
- preview строится только по первым 3 строкам
- сложный semantic mapping не реализован
- auth упрощен до передачи `user_id`
- TypeScript шаблон статический
