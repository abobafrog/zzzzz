import { Check, Copy, Download, FileSpreadsheet, History, Info, LockKeyhole, LogOut, Sparkles, TriangleAlert, Upload, WandSparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import * as XLSX from 'xlsx';
import { generateFromBackend } from '../lib/api';
import type { GenerationResult, HistoryItem, ParsedFileInfo, UserProfile } from '../types';
import { VibeBackground } from './VibeBackground';

type Props = {
  profile: UserProfile;
  history: HistoryItem[];
  onLogout: () => void;
  onSaveHistory: () => Promise<void>;
};

const defaultSchema = `{
  "customerName": "",
  "amount": 0,
  "createdAt": ""
}`;

const defaultCode = `// Generated TypeScript will appear here\nexport function transform(row: any) {\n  return {};\n}`;

async function parseFile(file: File): Promise<ParsedFileInfo> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'unknown';

  if (extension === 'csv') {
    const text = await file.text();
    const [headerLine, ...dataLines] = text.split(/\r?\n/).filter(Boolean);
    const columns = headerLine.split(',').map((item) => item.trim());
    const rows = dataLines.slice(0, 8).map((line) => {
      const cells = line.split(',');
      return Object.fromEntries(columns.map((column, index) => [column, cells[index] ?? '']));
    });
    return {
      fileName: file.name,
      extension,
      columns,
      rows,
      warnings: rows.length === 0 ? ['В файле нет строк данных.'] : []
    };
  }

  if (extension === 'xlsx' || extension === 'xls') {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    const columns = Object.keys(json[0] ?? {});
    return {
      fileName: file.name,
      extension,
      columns,
      rows: json.slice(0, 8).map((row) => row as Record<string, string | number | boolean | null>),
      warnings: workbook.SheetNames.length > 1 ? [`Использован только первый лист: ${sheetName}`] : []
    };
  }

  if (extension === 'pdf' || extension === 'docx') {
    return {
      fileName: file.name,
      extension,
      columns: [],
      rows: [],
      warnings: ['Документ загружен. Таблицу из PDF/DOCX попробуем прочитать через backend parser при генерации.']
    };
  }

  return {
    fileName: file.name,
    extension,
    columns: [],
    rows: [],
    warnings: ['Поддерживаются CSV, XLSX, XLS, PDF и DOCX.']
  };
}

export function Workspace({ profile, history, onLogout, onSaveHistory }: Props) {
  const [schema, setSchema] = useState(defaultSchema);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedFile, setParsedFile] = useState<ParsedFileInfo | null>(null);
  const [result, setResult] = useState<GenerationResult>({ code: defaultCode, mappings: [], preview: [], warnings: [] });
  const [busy, setBusy] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [copied, setCopied] = useState(false);

  const isGuest = Boolean(profile.skipped);
  const hasGeneratedResult = result.code !== defaultCode;
  const fileSummary = useMemo(() => {
    if (!parsedFile) return 'Файл ещё не загружен';
    if (parsedFile.extension === 'pdf' || parsedFile.extension === 'docx') {
      return `${parsedFile.fileName} · документ загружен`;
    }
    return `${parsedFile.fileName} · ${parsedFile.columns.length} колонок · ${parsedFile.rows.length} preview rows`;
  }, [parsedFile]);

  const handleSelectedFile = async (file: File) => {
    setSelectedFile(file);
    const parsed = await parseFile(file);
    setParsedFile(parsed);
    setSaveMessage('');
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleSelectedFile(file);
  };

  const onDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(true);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!dragActive) {
      setDragActive(true);
    }
  };

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragActive(false);
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await handleSelectedFile(file);
  };

  const onGenerate = async () => {
    if (!selectedFile) {
      setResult({
        code: defaultCode,
        mappings: [],
        preview: [],
        warnings: ['Сначала загрузи CSV, XLSX, XLS, PDF или DOCX.'],
      });
      return;
    }

    setBusy(true);
    try {
      const generated = await generateFromBackend({
        file: selectedFile,
        targetJson: schema,
        userId: isGuest ? undefined : profile.id,
      });

      setParsedFile(generated.parsedFile ?? parsedFile);
      setResult(generated);

      if (!isGuest) {
        await onSaveHistory();
        if (generated.generationId) {
          setActiveHistoryId(generated.generationId);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось выполнить генерацию.';
      setResult({
        code: defaultCode,
        mappings: [],
        preview: [],
        warnings: [message],
      });
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async () => {
    if (window.electronAPI) {
      const saved = await window.electronAPI.saveGeneratedFile({
        code: result.code,
        suggestedName: (parsedFile?.fileName?.split('.')?.[0] ?? 'parser') + '.ts'
      });
      if (!saved.canceled && saved.filePath) {
        setSaveMessage(`Файл сохранён: ${saved.filePath}`);
      }
      return;
    }

    const blob = new Blob([result.code], { type: 'text/typescript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'parser.ts';
    a.click();
    URL.revokeObjectURL(url);
    setSaveMessage('Файл скачан через браузер.');
  };

  const onCopyCode = async () => {
    if (!result.code) return;
    try {
      await navigator.clipboard.writeText(result.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div
      className="workspace-stage"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <VibeBackground className="workspace-scene" baseScale={1.08} energy={0.26} lite />
      <div className="workspace-overlay" />

      <div className="workspace-shell">
        <aside className="sidebar glass-card">
          <div className="sidebar-top">
            <div>
              <div className="eyebrow">Session</div>
              <h2>{isGuest ? 'Guest mode' : profile.name}</h2>
              <p className="subtle-text">{isGuest ? 'История генераций не сохраняется.' : profile.email}</p>
            </div>
            <button className="icon-btn" onClick={onLogout} title="Выйти" type="button">
              <LogOut size={16} />
            </button>
          </div>

          {isGuest && (
            <button className="secondary-btn guest-auth-btn" onClick={onLogout} type="button">
              <LockKeyhole size={16} /> Войти / зарегистрироваться
            </button>
          )}

          <section className="generator-panel">
            <div className="panel-title">
              <Sparkles size={16} /> Генерация
            </div>

            <label className={dragActive ? 'upload-zone drag-active' : 'upload-zone'}>
              <input accept=".csv,.xlsx,.xls,.pdf,.docx" hidden onChange={onFileChange} type="file" />
              <Upload size={18} />
              <strong>Загрузить CSV/XLSX/PDF/DOCX</strong>
              <span>{fileSummary}</span>
            </label>

            <div className="field-block">
              <div className="field-caption">Target JSON</div>
              <textarea className="editor-area" onChange={(e) => setSchema(e.target.value)} value={schema} />
            </div>

            <button className="primary-btn" disabled={busy} onClick={onGenerate} type="button">
              <WandSparkles size={16} /> {busy ? 'Генерируем...' : 'Сгенерировать'}
            </button>

            <button
              className={hasGeneratedResult ? 'download-btn ready' : 'download-btn'}
              disabled={!hasGeneratedResult}
              onClick={onDownload}
              type="button"
            >
              <Download size={16} /> Скачать .ts
            </button>
          </section>

          {!isGuest && (
            <section className="history-panel">
              <div className="panel-title">
                <History size={16} /> История генераций
              </div>
              <div className="history-list">
                {history.length === 0 && <div className="empty-card">Пока пусто. Первая генерация появится здесь.</div>}
                {history.map((item) => (
                  <button
                    className={item.id === activeHistoryId ? 'history-item active' : 'history-item'}
                    key={item.id}
                    onClick={() => {
                      setActiveHistoryId(item.id);
                      setSchema(item.schema);
                      setResult({
                        code: item.code,
                        mappings: item.mappings,
                        preview: item.preview,
                        warnings: item.warnings,
                      });
                    }}
                    type="button"
                  >
                    <strong>{item.fileName}</strong>
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </aside>

        <main className="viewer-area glass-card">
          <div className="viewer-toolbar">
            <div>
              <div className="eyebrow">Generated output</div>
              <h2>Код и просмотр результата</h2>
            </div>
          </div>

          <div className="viewer-grid">
            <section className="viewer-pane">
              <div className="pane-header">
                <FileSpreadsheet size={16} /> Preview файла
              </div>
              <div className="data-grid-wrap">
                {parsedFile?.rows?.length ? (
                  <table className="data-grid">
                    <thead>
                      <tr>
                        {parsedFile.columns.map((column) => (
                          <th key={column}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedFile.rows.map((row, index) => (
                        <tr key={index}>
                          {parsedFile.columns.map((column) => (
                            <td key={`${index}-${column}`}>{String(row[column] ?? '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-card">После загрузки тут покажется содержимое файла.</div>
                )}
              </div>
            </section>

            <section className="viewer-pane">
              <div className="pane-header pane-header-with-action">
                <span className="pane-header-label">
                  <Sparkles size={16} /> Generated TypeScript
                </span>
                <button className="icon-btn copy-code-btn" onClick={onCopyCode} title="Скопировать код" type="button">
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <pre className="code-pane">{result.code}</pre>
            </section>
          </div>

          <div className="insight-grid">
            {!isGuest && (
              <section className="insight-card">
                <div className="pane-header"><Info size={16} /> Mapping</div>
                {result.mappings.length === 0 ? (
                <div className="empty-card compact">После генерации тут будут сопоставления полей.</div>
              ) : (
                <div className="mapping-list">
                  {result.mappings.map((mapping) => (
                    <div className="mapping-item" key={mapping.target}>
                      <div>
                        <strong>{mapping.target}</strong>
                        <span>{mapping.source}</span>
                      </div>
                      <span className={`confidence ${mapping.confidence}`}>{mapping.confidence}</span>
                    </div>
                  ))}
                </div>
                )}
              </section>
            )}

            <section className="insight-card">
              <div className="pane-header"><Sparkles size={16} /> Preview JSON</div>
              <pre className="preview-pane">{JSON.stringify(result.preview, null, 2)}</pre>
            </section>

            <section className="insight-card">
              <div className="pane-header"><TriangleAlert size={16} /> Warnings</div>
              <div className="warning-list">
                {[...result.warnings, saveMessage].filter(Boolean).map((warning, index) => (
                  <div className="warning-item" key={index}>{warning}</div>
                ))}
                {[...result.warnings, saveMessage].filter(Boolean).length === 0 && <div className="empty-card compact">Пока без предупреждений.</div>}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
