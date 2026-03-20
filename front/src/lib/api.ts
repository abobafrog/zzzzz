import type { GenerationResult, HistoryItem } from '../types';

type GenerateParams = {
  file: File;
  targetJson: string;
  userId?: string;
};

type BackendGenerateResponse = {
  generation_id: string | null;
  mode: 'guest' | 'authorized';
  parsed_file: {
    file_name: string;
    file_type: string;
    columns: string[];
    rows: Record<string, unknown>[];
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

function normalizeConfidence(value: 'high' | 'medium' | 'low' | 'none'): 'high' | 'medium' | 'low' {
  return value === 'none' ? 'low' : value;
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail = payload && typeof payload.detail === 'string' ? payload.detail : `Request failed: ${response.status}`;
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export async function generateFromBackend({ file, targetJson, userId }: GenerateParams): Promise<GenerationResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('target_json', targetJson);
  if (userId) {
    formData.append('user_id', userId);
  }

  const response = await fetch('/api/generate', {
    method: 'POST',
    body: formData,
  });

  const payload = await parseJson<BackendGenerateResponse>(response);
  return {
    generationId: payload.generation_id,
    parsedFile: {
      fileName: payload.parsed_file.file_name,
      extension: payload.parsed_file.file_type,
      columns: payload.parsed_file.columns,
      rows: payload.parsed_file.rows,
      warnings: payload.parsed_file.warnings,
    },
    code: payload.generated_typescript,
    mappings: payload.mappings.map((item) => ({
      source: item.source ?? 'not found',
      target: item.target,
      confidence: normalizeConfidence(item.confidence),
      reason: item.reason,
    })),
    preview: payload.preview,
    warnings: payload.warnings,
  };
}

export async function fetchHistory(userId: string): Promise<HistoryItem[]> {
  const response = await fetch(`/api/history/${encodeURIComponent(userId)}`);
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
      confidence: normalizeConfidence(mapping.confidence),
      reason: mapping.reason,
    })),
    preview: item.preview,
    warnings: item.warnings,
  }));
}
