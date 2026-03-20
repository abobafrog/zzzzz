from __future__ import annotations

import json

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from generator import build_preview, generate_typescript
from matcher import map_fields
from parsers import ParseError, infer_target_fields, parse_file
from storage import cleanup_expired_guest_files, get_history, save_generation, save_upload

router = APIRouter()


@router.post('/generate')
async def generate(
    file: UploadFile = File(...),
    target_json: str = Form(...),
    user_id: str | None = Form(default=None),
    keep_guest_file: bool = Form(default=False),
) -> dict:
    cleanup_expired_guest_files()

    filename = file.filename or 'uploaded_file'
    file_bytes = await file.read()
    mode = 'authorized' if user_id else 'guest'

    try:
        saved_path = save_upload(file_bytes, filename, mode=mode, user_id=user_id)
        parsed = parse_file(saved_path, filename)
        target_fields, target_payload = infer_target_fields(target_json)
        mappings, mapping_warnings = map_fields(parsed.columns, target_fields)
        ts_code = generate_typescript(target_fields, mappings)
        preview = build_preview(parsed.rows, target_fields, mappings)
        all_warnings = parsed.warnings + mapping_warnings

        generation_id = None
        if user_id:
            generation_id = save_generation(
                user_id=user_id,
                file_name=parsed.file_name,
                file_path=str(saved_path),
                file_type=parsed.file_type,
                target_json=json.dumps(target_payload, ensure_ascii=False),
                mappings_json=json.dumps([m.model_dump() for m in mappings], ensure_ascii=False),
                generated_typescript=ts_code,
                preview_json=json.dumps(preview, ensure_ascii=False),
                warnings_json=json.dumps(all_warnings, ensure_ascii=False),
            )
        elif not keep_guest_file:
            saved_path.unlink(missing_ok=True)

        return {
            'generation_id': generation_id,
            'mode': mode,
            'parsed_file': parsed.model_dump(),
            'target_fields': [field.model_dump() for field in target_fields],
            'mappings': [m.model_dump() for m in mappings],
            'generated_typescript': ts_code,
            'preview': preview,
            'warnings': all_warnings,
        }
    except ParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f'Unexpected error: {exc}') from exc


@router.get('/history/{user_id}')
def history(user_id: str) -> dict:
    items = get_history(user_id)
    normalized = []
    for item in items:
        normalized.append(
            {
                'id': str(item['id']),
                'user_id': item['user_id'],
                'file_name': item['file_name'],
                'file_type': item['file_type'],
                'target_json': json.loads(item['target_json']),
                'mappings': json.loads(item['mappings_json']),
                'generated_typescript': item['generated_typescript'],
                'preview': json.loads(item['preview_json']),
                'warnings': json.loads(item['warnings_json']),
                'created_at': item['created_at'],
            }
        )
    return {'items': normalized}
