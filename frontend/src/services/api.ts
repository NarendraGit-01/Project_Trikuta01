import { BooksSummaryResponse, GothramSearchItem, PipelineResult, QualityAssessment, Receipt, ReceiptListItem, StagedReceiptItem } from '../types';

const API_BASE = '/api/v1';

export interface SampleReceipt {
  id: string;
  filename: string;
  receipt_no: string;
  description: string;
  features: string[];
  file_size: number;
  url: string;
  raw_url?: string;
  available: boolean;
}

export async function fetchSamples(): Promise<SampleReceipt[]> {
  const res = await fetch(`${API_BASE}/ocr/samples`);
  if (!res.ok) {
    throw new Error(`Failed to load samples: ${res.statusText}`);
  }
  return res.json();
}

export async function processSampleOCR(
  sampleFilename: string,
  modelName: string = 'gemini-3.8-flash',
  skipTranscription: boolean = false
): Promise<PipelineResult> {
  const res = await fetch(`${API_BASE}/ocr/process-sample`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sample_filename: sampleFilename,
      model_name: modelName,
      skip_transcription: skipTranscription,
    }),
  });

  if (!res.ok) {
    let errorDetail = '';
    try {
      const errorData = await res.json();
      errorDetail = typeof errorData.detail === 'object'
        ? errorData.detail.message || JSON.stringify(errorData.detail)
        : errorData.detail || '';
    } catch {
      errorDetail = await res.text().catch(() => '');
    }
    throw new Error(errorDetail || `OCR failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function processUploadOCR(
  file: File,
  modelName: string = 'gemini-3.8-flash',
  skipTranscription: boolean = true,
  bookNumber?: string
): Promise<PipelineResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('model_name', modelName);
  formData.append('skip_transcription', String(skipTranscription));
  if (bookNumber && bookNumber.trim()) {
    formData.append('book_number', bookNumber.trim());
  }

  const res = await fetch(`${API_BASE}/ocr/process-upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    let errorDetail = '';
    try {
      const errorData = await res.json();
      if (res.status === 409) {
        const d = errorData.detail || errorData;
        const msg = typeof d === 'string'
          ? d
          : d.message || `Receipt #${d.receipt_no} was already uploaded (Status: ${d.status}).`;
        throw new Error(`DUPLICATE: ${msg}`);
      }
      errorDetail = typeof errorData.detail === 'object'
        ? errorData.detail.message || JSON.stringify(errorData.detail)
        : errorData.detail || '';
    } catch (parseErr: any) {
      if (parseErr.message && parseErr.message.startsWith('DUPLICATE:')) throw parseErr;
      errorDetail = await res.text().catch(() => '');
    }
    throw new Error(errorDetail || `OCR request failed with HTTP ${res.status}: ${res.statusText || 'Server Error'}`);
  }
  return res.json();
}

export interface BatchItemResult {
  filename: string;
  status: 'SUCCESS' | 'ERROR';
  result?: PipelineResult;
  error?: string;
  stored_path?: string;
  preview_url?: string;
}

export async function processBatchOCR(
  files: File[],
  modelName: string = 'gemini-3.5-flash-lite',
  skipTranscription: boolean = true,
  bookNumber?: string
): Promise<BatchItemResult[]> {
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));
  formData.append('model_name', modelName);
  formData.append('skip_transcription', String(skipTranscription));
  if (bookNumber && bookNumber.trim()) {
    formData.append('book_number', bookNumber.trim());
  }

  const res = await fetch(`${API_BASE}/ocr/process-batch`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || 'Batch OCR processing failed');
  }
  return res.json();
}

export async function checkImageQuality(file: File): Promise<{
  quality: QualityAssessment;
  heuristic_rotation: number;
}> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/ocr/quality-check`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error('Quality check failed');
  }
  return res.json();
}

export async function autoCropImage(file: File): Promise<{
  url: string;
  rotation_applied: number;
  crop_box: number[];
  width: number;
  height: number;
}> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/ocr/auto-crop`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error('Auto-crop failed');
  }
  return res.json();
}

export async function searchGothrams(query: string): Promise<GothramSearchItem[]> {
  if (!query || query.trim().length === 0) return [];
  const res = await fetch(`${API_BASE}/gothrams/search?q=${encodeURIComponent(query.trim())}&limit=15`);
  if (!res.ok) return [];
  return res.json();
}

export interface PincodeDetails {
  pincode: string;
  post_office: string;
  taluk: string;
  district_en: string;
  district_te: string;
  state: string;
}

export async function resolvePincode(pincode: string): Promise<PincodeDetails | null> {
  const clean = pincode.replace(/\D/g, '');
  if (clean.length !== 6) return null;
  try {
    const res = await fetch(`${API_BASE}/ocr/resolve-pincode?pincode=${encodeURIComponent(clean)}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchBooksSummary(): Promise<BooksSummaryResponse> {
  const res = await fetch(`${API_BASE}/receipts/books/summary`);
  if (!res.ok) {
    throw new Error('Failed to fetch book summary');
  }
  return res.json();
}

export async function listReceipts(params?: {
  q?: string;
  status?: string;
  book_number?: string;
  archived_only?: boolean;
  skip?: number;
  limit?: number;
}): Promise<ReceiptListItem[]> {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.status) query.set('status_filter', params.status);
  if (params?.book_number) query.set('book_number', params.book_number);
  if (params?.archived_only) query.set('archived_only', 'true');
  if (params?.skip) query.set('skip', String(params.skip));
  if (params?.limit) query.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/receipts?${query.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to fetch receipts');
  }
  return res.json();
}

export async function getReceipt(id: number): Promise<Receipt> {
  const res = await fetch(`${API_BASE}/receipts/${id}`);
  if (!res.ok) {
    throw new Error('Receipt not found');
  }
  return res.json();
}

export async function createReceipt(data: any): Promise<Receipt> {
  const res = await fetch(`${API_BASE}/receipts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to save receipt');
  }
  return res.json();
}

export async function updateReceipt(id: number, data: any): Promise<Receipt> {
  const res = await fetch(`${API_BASE}/receipts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to update receipt');
  }
  return res.json();
}

export async function confirmReceipt(id: number): Promise<Receipt> {
  const res = await fetch(`${API_BASE}/receipts/${id}/confirm`, {
    method: 'POST',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detailMsg = err.detail?.validation_errors ? err.detail.validation_errors.join('; ') : err.detail;
    throw new Error(detailMsg || 'Confirmation failed');
  }
  return res.json();
}

export async function saveIncompleteReceipt(id: number): Promise<Receipt> {
  const res = await fetch(`${API_BASE}/receipts/${id}/save-incomplete`, {
    method: 'POST',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to save incomplete status');
  }
  return res.json();
}
