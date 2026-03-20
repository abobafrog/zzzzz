from __future__ import annotations

import os
import shutil
import sqlite3
import time
from pathlib import Path
from typing import Any

PROJECT_DIR = Path(__file__).resolve().parent
RUNTIME_DIR = PROJECT_DIR / '.runtime'
DB_PATH = RUNTIME_DIR / 'history.db'
BASE_DIR = RUNTIME_DIR / 'storage'
UPLOAD_DIR = BASE_DIR / 'uploads'
GUEST_DIR = UPLOAD_DIR / 'guest'
AUTH_DIR = UPLOAD_DIR / 'authorized'
GUEST_TTL_SECONDS = 60 * 60 * 24



def ensure_dirs() -> None:
    for path in [BASE_DIR, UPLOAD_DIR, GUEST_DIR, AUTH_DIR]:
        path.mkdir(parents=True, exist_ok=True)



def init_db() -> None:
    ensure_dirs()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            '''
            CREATE TABLE IF NOT EXISTS generations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_type TEXT NOT NULL,
                target_json TEXT NOT NULL,
                mappings_json TEXT NOT NULL,
                generated_typescript TEXT NOT NULL,
                preview_json TEXT NOT NULL,
                warnings_json TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            '''
        )
        conn.commit()



def save_upload(content: bytes, filename: str, mode: str, user_id: str | None = None) -> Path:
    ensure_dirs()
    safe_name = filename.replace('/', '_').replace('\\', '_')
    owner_folder = f'user_{user_id}' if mode == 'authorized' and user_id else f'guest_{int(time.time())}'
    base = AUTH_DIR if mode == 'authorized' else GUEST_DIR
    target_dir = base / owner_folder
    target_dir.mkdir(parents=True, exist_ok=True)
    path = target_dir / safe_name
    path.write_bytes(content)
    return path



def save_generation(
    user_id: str,
    file_name: str,
    file_path: str,
    file_type: str,
    target_json: str,
    mappings_json: str,
    generated_typescript: str,
    preview_json: str,
    warnings_json: str,
) -> int:
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.execute(
            '''
            INSERT INTO generations (
                user_id, file_name, file_path, file_type, target_json,
                mappings_json, generated_typescript, preview_json, warnings_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                user_id,
                file_name,
                file_path,
                file_type,
                target_json,
                mappings_json,
                generated_typescript,
                preview_json,
                warnings_json,
            ),
        )
        conn.commit()
        return int(cur.lastrowid)



def get_history(user_id: str, limit: int | None = None) -> list[dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        query = '''
            SELECT
                id,
                user_id,
                file_name,
                file_type,
                target_json,
                mappings_json,
                generated_typescript,
                preview_json,
                warnings_json,
                created_at
            FROM generations
            WHERE user_id = ?
            ORDER BY id DESC
        '''
        params: tuple[Any, ...] = (user_id,)
        if limit is not None:
            query += '\nLIMIT ?'
            params = (user_id, limit)
        rows = conn.execute(query, params).fetchall()
        return [dict(row) for row in rows]


def get_generation_by_id(entry_id: int) -> dict[str, Any] | None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            '''
            SELECT
                id,
                user_id,
                file_name,
                file_type,
                target_json,
                mappings_json,
                generated_typescript,
                preview_json,
                warnings_json,
                created_at
            FROM generations
            WHERE id = ?
            ''',
            (entry_id,),
        ).fetchone()
        return dict(row) if row else None



def cleanup_expired_guest_files() -> None:
    ensure_dirs()
    now = time.time()
    for item in GUEST_DIR.glob('*'):
        try:
            if now - item.stat().st_mtime > GUEST_TTL_SECONDS:
                if item.is_dir():
                    shutil.rmtree(item, ignore_errors=True)
                else:
                    item.unlink(missing_ok=True)
        except FileNotFoundError:
            continue


def cleanup_guest_files(ttl_hours: int = 24, dry_run: bool = False) -> dict[str, Any]:
    ensure_dirs()
    now = time.time()
    ttl_seconds = ttl_hours * 60 * 60
    removed: list[str] = []

    for item in GUEST_DIR.glob('*'):
        try:
            if now - item.stat().st_mtime <= ttl_seconds:
                continue
            removed.append(str(item))
            if dry_run:
                continue
            if item.is_dir():
                shutil.rmtree(item, ignore_errors=True)
            else:
                item.unlink(missing_ok=True)
        except FileNotFoundError:
            continue

    return {'dry_run': dry_run, 'ttl_hours': ttl_hours, 'removed': removed, 'count': len(removed)}



def delete_file(path: str) -> None:
    try:
        os.remove(path)
    except FileNotFoundError:
        pass
