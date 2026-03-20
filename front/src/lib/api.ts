import type { GenerationResult, HistoryItem, UserProfile } from '../types';

type GenerateParams = {
  file: File;
  targetJson: string;
  userId?: string;
  selectedSheet?: string;
};

type BackendGenerateResponse = {
  generation_id: string | null;
  mode: 'guest' | 'authorized';
  parsed_file: {
    file_name: string;
    file_type: string;
    columns: string[];
    rows: Record<string, unknown>[];
    sheets: Array<{
      name: string;
      columns: string[];
      rows: Record<string, unknown>[];
    }>;
    warnings: string[];
  };
  mappings: Array<{
    source: string | null;
    target: string;
    confidence: 'high' | 'medium' | 'low' | 'none';
    reason: string;
  }>;
  generated_typescript: string;
  preview: Record<string, unknown>[];
  warnings: string[];
};

type BackendHistoryResponse = {
  items: Array<{
    id: string;
    user_id: string;
    file_name: string;
    file_type: string;
    target_json: Record<string, unknown>;
    mappings: Array<{
      source: string | null;
      target: string;
      confidence: 'high' | 'medium' | 'low' | 'none';
      reason: string;
    }>;
    generated_typescript: string;
    preview: Record<string, unknown>[];
    warnings: string[];
    created_at: string;
  }>;
};

type AuthParams = {
  email: string;
  password: string;
  name?: string;
};

type BackendUserProfile = {
  id: string;
  name: string;
  email: string;
};

const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8000';
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const GENERATE_REQUEST_TIMEOUT_MS = 60_000;

function resolveApiBaseUrl(): string {
  const envBaseUrl = (import.meta.env as ImportMetaEnv & { VITE_BACKEND_URL?: string }).VITE_BACKEND_URL?.trim();
  if (envBaseUrl) {
    return envBaseUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && (window.electronAPI || window.location.protocol === 'file:')) {
    return DEFAULT_BACKEND_URL;
  }

  return '';
}

function buildApiUrl(path: string): string {
  return `${resolveApiBaseUrl()}${path}`;
}

function parseConfidence(value: 'high' | 'medium' | 'low' | 'none'): 'high' | 'medium' | 'low' | 'none' {
  return value;
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail = payload && typeof payload.detail === 'string' ? payload.detail : `Request failed: ${response.status}`;
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Backend did not respond within ${Math.round(timeoutMs / 1000)} seconds. Start the API server and try again.`);
    }
    throw new Error('Backend is unavailable. Start `uvicorn app:app --host 0.0.0.0 --port 8000` and try again.');
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function postJson<T>(path: string, payload: Record<string, unknown>, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): Promise<T> {
  const response = await fetchWithTimeout(
    buildApiUrl(path),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    timeoutMs
  );
  return parseJson<T>(response);
}

export async function registerWithBackend({ email, password, name }: AuthParams): Promise<UserProfile> {
  return postJson<BackendUserProfile>('/api/auth/register', {
    email,
    password,
    name,
  });
}

export async function loginWithBackend({ email, password }: AuthParams): Promise<UserProfile> {
  return postJson<BackendUserProfile>('/api/auth/login', {
    email,
    password,
  });
}

export async function generateFromBackend({ file, targetJson, userId, selectedSheet }: GenerateParams): Promise<GenerationResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('target_json', targetJson);
  if (userId) {
    formData.append('user_id', userId);
  }
  if (selectedSheet) {
    formData.append('selected_sheet', selectedSheet);
  }

  const response = await fetchWithTimeout(
    buildApiUrl('/api/generate'),
    {
      method: 'POST',
      body: formData,
    },
    GENERATE_REQUEST_TIMEOUT_MS
  );

  const payload = await parseJson<BackendGenerateResponse>(response);
  return {
    generationId: payload.generation_id,
    parsedFile: {
      fileName: payload.parsed_file.file_name,
      extension: payload.parsed_file.file_type,
      columns: payload.parsed_file.columns,
      rows: payload.parsed_file.rows,
      sheets: payload.parsed_file.sheets ?? [],
      warnings: payload.parsed_file.warnings,
    },
    code: payload.generated_typescript,
    mappings: payload.mappings.map((item) => ({
      source: item.source ?? 'not found',
      target: item.target,
      confidence: parseConfidence(item.confidence),
      reason: item.reason,
    })),
    preview: payload.preview,
    warnings: payload.warnings,
  };
}

export async function fetchHistory(userId: string): Promise<HistoryItem[]> {
  const response = await fetchWithTimeout(
    buildApiUrl(`/api/history/${encodeURIComponent(userId)}`),
    {
      method: 'GET',
    },
    DEFAULT_REQUEST_TIMEOUT_MS
  );
  const payload = await parseJson<BackendHistoryResponse>(response);
  return payload.items.map((item) => ({
    id: item.id,
    createdAt: item.created_at,
    fileName: item.file_name,
    schema: JSON.stringify(item.target_json, null, 2),
    code: item.generated_typescript,
    mappings: item.mappings.map((mapping) => ({
      source: mapping.source ?? 'not found',
      target: mapping.target,
      confidence: parseConfidence(mapping.confidence),
      reason: mapping.reason,
    })),
    preview: item.preview,
    warnings: item.warnings,
  }));
}
