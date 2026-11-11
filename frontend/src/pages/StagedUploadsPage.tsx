import React, { useEffect, useState } from 'react';
import {
  Camera,
  Clock,
  CheckCircle,
  Trash2,
  Loader2,
  Smartphone,
  BookOpen,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { StagedReceiptItem } from '../types';

const API_BASE = '/api/v1';

async function listStagedReceipts(): Promise<StagedReceiptItem[]> {
  const res = await fetch(`${API_BASE}/ocr/staging`);
  if (!res.ok) throw new Error('Failed to fetch staged receipts');
  return res.json();
}

async function processStagedReceipt(id: number): Promise<any> {
  const res = await fetch(`${API_BASE}/ocr/staging/${id}/process`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Processing failed');
  }
  return res.json();
}

async function deleteStagedReceipt(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/ocr/staging/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete staged receipt');
}

interface StagedUploadsPageProps {
  onProcessed: (result: any, imageUrl: string, filename?: string) => void;
}

export const StagedUploadsPage: React.FC<StagedUploadsPageProps> = ({ onProcessed }) => {
  const [items, setItems] = useState<StagedReceiptItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listStagedReceipts();
      setItems(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load staged receipts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleProcess = async (item: StagedReceiptItem) => {
    setProcessingId(item.id);
    try {
      const result = await processStagedReceipt(item.id);
      onProcessed(result, item.preview_url || '', item.filename);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (e: any) {
      alert(`Processing failed: ${e.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this staged receipt? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await deleteStagedReceipt(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e: any) {
      alert(`Delete failed: ${e.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const pendingItems = items.filter(i => i.status === 'PENDING');
  const processedItems = items.filter(i => i.status !== 'PENDING');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Mobile Staged Uploads</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Images uploaded from mobile devices appear here before OCR processing. 
              Available on all devices instantly.
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3 py-2 bg-white border border-gray-300 hover:border-blue-400 text-gray-700 hover:text-blue-700 text-xs font-semibold rounded-xl shadow-sm transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* How-to info banner */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start space-x-3">
        <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-blue-800">
          <strong>How to upload from mobile:</strong> Send a POST request to{' '}
          <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">/api/v1/ocr/staging</code> with your 
          image files and optional <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">book_number</code>. 
          The image will appear here immediately — even before OCR runs — and will be visible on all devices (mobile and laptop).
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p className="text-sm">Loading staged uploads...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm">
          <Smartphone className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-semibold text-gray-600">No staged uploads</p>
          <p className="text-xs text-gray-400 mt-1">
            Upload images from your mobile to see them here, ready to process.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending items */}
          {pendingItems.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Clock className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-gray-800">
                  Pending OCR ({pendingItems.length})
                </h3>
                <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                  Awaiting Processing
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:border-blue-300 transition-colors"
                  >
                    {/* Preview thumbnail */}
                    <div className="relative h-40 bg-gray-100">
                      {item.preview_url ? (
                        <img
                          src={item.preview_url}
                          alt={item.filename}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-300">
                          <Camera className="w-10 h-10" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                          Pending
                        </span>
                      </div>
                      {item.book_number && (
                        <div className="absolute top-2 right-2">
                          <span className="bg-black/60 text-white text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center space-x-1">
                            <BookOpen className="w-2.5 h-2.5" />
                            <span>Book #{item.book_number}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <p className="text-xs font-semibold text-gray-800 truncate" title={item.filename}>
                        {item.filename}
                      </p>
                      <div className="flex items-center justify-between mt-1 text-[11px] text-gray-500">
                        <span>{item.device_label || 'Mobile Device'}</span>
                        <span>{(item.file_size / 1024).toFixed(0)} KB</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(item.created_at).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="px-3 pb-3 flex items-center space-x-2">
                      <button
                        onClick={() => handleProcess(item)}
                        disabled={processingId === item.id}
                        className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-60 transition-colors"
                      >
                        {processingId === item.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Running OCR...</span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-3.5 h-3.5" />
                            <span>Run OCR</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 disabled:opacity-50 transition-colors"
                        title="Remove this staged image"
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Already processed items */}
          {processedItems.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-gray-800">
                  Already Processed ({processedItems.length})
                </h3>
                <span className="text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                  Moved to Receipts
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {processedItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-gray-50 rounded-xl border border-gray-200 shadow-sm overflow-hidden opacity-70"
                  >
                    <div className="relative h-32 bg-gray-100">
                      {item.preview_url ? (
                        <img
                          src={item.preview_url}
                          alt={item.filename}
                          className="w-full h-full object-cover grayscale"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-300">
                          <Camera className="w-8 h-8" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                          Processed
                        </span>
                      </div>
                    </div>
                    <div className="p-3 flex items-center justify-between">
                      <p className="text-xs text-gray-600 truncate flex-1">{item.filename}</p>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="ml-2 p-1 text-gray-400 hover:text-red-600 rounded"
                        title="Remove from staged list"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
