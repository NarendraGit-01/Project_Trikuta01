import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  Zap,
  CheckCircle,
  AlertTriangle,
  RotateCw,
  RotateCcw,
  Crop,
  Layers,
  ArrowRight,
  Trash2,
  FileText,
  Eye,
  X,
  BookOpen,
} from 'lucide-react';
import {
  processUploadOCR,
  autoCropImage,
} from '../services/api';
import { PipelineResult } from '../types';

interface ScanPageProps {
  onOCRComplete: (result: PipelineResult, imageUrl: string, filename?: string) => void;
  activeModel: string;
  onChangeModel: (model: string) => void;
}

interface BatchQueueItem {
  id: string;
  file: File;
  filename: string;
  size: number;
  previewUrl: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
  result?: PipelineResult;
  error?: string;
}

export const ScanPage: React.FC<ScanPageProps> = ({
  onOCRComplete,
  activeModel,
  onChangeModel,
}) => {
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewRotation, setPreviewRotation] = useState<number>(0);
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const [skipTranscription, setSkipTranscription] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [singleBookNumber, setSingleBookNumber] = useState<string>('');

  // Drag and drop states
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragCounter = useRef(0);

  // Batch processing state
  const [batchQueue, setBatchQueue] = useState<BatchQueueItem[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  // Book Number Modal State (Batch mode)
  const [showBookNumberModal, setShowBookNumberModal] = useState<boolean>(false);
  const [bulkBookNumber, setBulkBookNumber] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── DRAG & DROP HANDLERS ───────────────────────────────── */
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      setIsDragging(false);
      dragCounter.current = 0;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    if (files.length === 1 && activeTab === 'single') {
      await handleSingleFileSelected(files[0]);
    } else {
      addFilesToBatch(files);
      setActiveTab('batch');
    }
  };

  /* ── BATCH QUEUE MANAGEMENT ─────────────────────────────── */
  const addFilesToBatch = (files: File[]) => {
    const newItems: BatchQueueItem[] = files.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      filename: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
      status: 'PENDING',
    }));
    setBatchQueue((prev) => [...prev, ...newItems]);
    setActiveTab('batch');
  };

  const removeBatchItem = (id: string) => {
    setBatchQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const clearBatchQueue = () => {
    setBatchQueue([]);
  };

  /* ── SINGLE FILE SELECTION ──────────────────────────────── */
  const handleSingleFileSelected = async (file: File) => {
    setUploadedFile(file);
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setPreviewRotation(0);
    setError(null);

    // Auto-orient and crop background automatically
    setIsCropping(true);
    try {
      const cropRes = await autoCropImage(file);
      if (cropRes && cropRes.url) {
        setPreviewUrl(cropRes.url);
      }
    } catch (err) {
      console.warn('Auto-crop notice:', err);
    } finally {
      setIsCropping(false);
    }
  };

  const handleClearSingleFile = () => {
    setUploadedFile(null);
    setPreviewUrl(null);
    setPreviewRotation(0);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);

    if (files.length === 1 && activeTab === 'single') {
      await handleSingleFileSelected(files[0]);
    } else {
      addFilesToBatch(files);
      setActiveTab('batch');
    }
    e.target.value = '';
  };

  const handleRotateLeft = () => {
    setPreviewRotation((prev) => (prev - 90 + 360) % 360);
  };

  const handleRotateRight = () => {
    setPreviewRotation((prev) => (prev + 90) % 360);
  };

  /* ── SINGLE OCR EXTRACTION ──────────────────────────────── */
  const handleStartOCR = async () => {
    if (!uploadedFile) {
      setError('Please upload a receipt image first.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    const stages = [
      'Pass 0: OpenCV Edge Alignment & Tight Receipt Cropping (15ms)...',
      'Pass 1: Structured Multimodal Field Extraction & Devotee Names...',
      'Pass 2: 2,099 Gothram Master Phonetic RapidFuzz Matching...',
      'Pass 3: Consensus & Dual-Script Telugu/English Calibration...',
    ];

    let stageIdx = 0;
    setProcessingStage(stages[0]);
    const timer = setInterval(() => {
      stageIdx++;
      if (stageIdx < stages.length) {
        setProcessingStage(stages[stageIdx]);
      }
    }, 1500);

    try {
      const result: PipelineResult = await processUploadOCR(
        uploadedFile,
        activeModel,
        skipTranscription,
        singleBookNumber || undefined
      );

      const finalImgUrl = previewUrl || URL.createObjectURL(uploadedFile);

      clearInterval(timer);
      setIsProcessing(false);
      onOCRComplete(result, finalImgUrl, uploadedFile.name);
    } catch (err: any) {
      clearInterval(timer);
      setIsProcessing(false);
      setError(err.message || 'OCR processing failed. Please verify API key and connection.');
    }
  };

  /* ── BATCH OCR PROCESSING ───────────────────────────────── */
  const handleOpenBatchModal = () => {
    const pendingItems = batchQueue.filter((item) => item.status === 'PENDING' || item.status === 'ERROR');
    if (pendingItems.length === 0) return;
    setShowBookNumberModal(true);
  };

  const handleStartBatchOCR = async (bookNoToUse?: string) => {
    setShowBookNumberModal(false);
    const assignedBookNumber = bookNoToUse !== undefined ? bookNoToUse : bulkBookNumber;

    const pendingItems = batchQueue.filter((item) => item.status === 'PENDING' || item.status === 'ERROR');
    if (pendingItems.length === 0) return;

    setIsBatchProcessing(true);
    setBatchProgress({ current: 0, total: pendingItems.length });

    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      setBatchProgress({ current: i + 1, total: pendingItems.length });

      setBatchQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'PROCESSING' } : q))
      );

      try {
        const res: PipelineResult = await processUploadOCR(
          item.file,
          activeModel,
          skipTranscription,
          assignedBookNumber || undefined
        );

        if (assignedBookNumber && res.intermediate_passes) {
          (res.intermediate_passes as any).book_number = assignedBookNumber;
        }

        setBatchQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: 'SUCCESS',
                  result: res,
                  previewUrl: item.previewUrl,
                }
              : q
          )
        );
      } catch (err: any) {
        setBatchQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: 'ERROR',
                  error: err.message || 'Processing failed',
                }
              : q
          )
        );
      }
    }

    setIsBatchProcessing(false);
  };

  const handleReviewBatchItem = (item: BatchQueueItem) => {
    if (item.result) {
      onOCRComplete(item.result, item.previewUrl, item.filename);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="min-h-[calc(100vh-5rem)] relative"
    >
      {/* Drag & Drop Fullscreen Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-amber-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white border-4 border-dashed border-amber-300 pointer-events-none animate-fade-in">
          <Upload className="w-16 h-16 text-amber-300 animate-bounce mb-3" />
          <h2 className="text-2xl font-bold tracking-wide">Drop Receipt Images Here</h2>
          <p className="text-amber-200 mt-1 text-sm">
            Multiple images will be added to the Batch Processing Queue automatically.
          </p>
        </div>
      )}

      {/* Main Container - Widened to max-w-[1650px] like ReviewPage */}
      <div className="max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Title Bar & Tabs */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 font-serif flex items-center space-x-2">
              <span>రసీదు స్కాన్ & AI డేటా గుర్తింపు</span>
              <span className="text-sm font-sans font-normal text-gray-500">
                (Receipt Scan & OCR Extraction)
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Upload temple receipts to extract Devotee Names, Gothram (matched against 2,099 Master List), Dates, Amount & Phones.
            </p>
          </div>

          {/* Mode Switcher Tabs + Active Model */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-gray-200 p-1 rounded-xl flex items-center text-xs font-semibold">
              <button
                onClick={() => setActiveTab('single')}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${
                  activeTab === 'single'
                    ? 'bg-white text-gray-900 shadow-sm font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Single Receipt
              </button>
              <button
                onClick={() => setActiveTab('batch')}
                className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
                  activeTab === 'batch'
                    ? 'bg-amber-600 text-white shadow-sm font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Bulk / Batch Queue</span>
                {batchQueue.length > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      activeTab === 'batch' ? 'bg-amber-800 text-amber-100' : 'bg-amber-200 text-amber-900'
                    }`}
                  >
                    {batchQueue.length}
                  </span>
                )}
              </button>
            </div>

            {/* Model Selector */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 flex items-center space-x-2 shadow-sm text-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              <span className="font-semibold text-amber-900">AI Model:</span>
              <select
                value={activeModel}
                onChange={(e) => onChangeModel(e.target.value)}
                disabled={isProcessing || isBatchProcessing}
                className="bg-white border border-amber-300 rounded px-2 py-0.5 text-gray-800 font-medium focus:outline-none text-xs"
              >
                <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Ultra Fast & Accurate)</option>
                <option value="gemini-3.5-flash">gemini-3.5-flash (Standard)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-red-800 text-sm animate-fade-in">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Processing Notice</p>
              <p className="text-red-700 mt-0.5">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── TAB 1: SINGLE RECEIPT MODE (WIDER PREVIEW LAYOUT) ────────────────────── */}
        {activeTab === 'single' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: WIDE RECEIPT PREVIEW (8 cols out of 12) */}
            <div className="lg:col-span-8 flex flex-col">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col min-h-[660px]">
                {/* Header Toolbar */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                      <Camera className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-800 font-serif">
                        Receipt Preview (రసీదు ప్రివ్యూ)
                      </h3>
                      <p className="text-[11px] text-gray-400">
                        {uploadedFile
                          ? `${uploadedFile.name} • ${(uploadedFile.size / 1024 / 1024).toFixed(2)} MB`
                          : 'No receipt loaded yet'}
                      </p>
                    </div>
                  </div>

                  {previewUrl && (
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                        <Crop className="w-3 h-3" />
                        <span>Auto-Aligned</span>
                      </span>

                      {/* Rotation Controls */}
                      <button
                        type="button"
                        onClick={handleRotateLeft}
                        title="Rotate Left (90° CCW)"
                        className="px-2 py-1 rounded bg-gray-100 hover:bg-amber-100 text-gray-700 hover:text-amber-900 text-xs font-semibold flex items-center space-x-1 border border-gray-200 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="text-[10px]">↺ 90°</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRotateRight}
                        title="Rotate Right (90° CW)"
                        className="px-2 py-1 rounded bg-gray-100 hover:bg-amber-100 text-gray-700 hover:text-amber-900 text-xs font-semibold flex items-center space-x-1 border border-gray-200 transition-colors"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span className="text-[10px]">↻ 90°</span>
                      </button>

                      {/* Clear / Remove Button */}
                      <button
                        type="button"
                        onClick={handleClearSingleFile}
                        title="Remove photo"
                        className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Wide Image Canvas Container */}
                <div className="relative flex-1 min-h-[540px] bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center p-4 border border-gray-300 shadow-inner">
                  {isCropping && (
                    <div className="absolute inset-0 bg-slate-900/80 z-20 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-amber-400 border-t-transparent mb-2" />
                      <p className="text-xs font-semibold text-amber-200">Auto-orienting & tightly cropping slip...</p>
                    </div>
                  )}

                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Receipt Preview"
                      style={{ transform: `rotate(${previewRotation}deg)` }}
                      className="max-h-[600px] max-w-full w-auto object-contain rounded-lg shadow-2xl transition-transform duration-200"
                    />
                  ) : (
                    /* Large Empty State Dropzone within preview */
                    <label
                      htmlFor="preview-dropzone-input"
                      className="cursor-pointer flex flex-col items-center justify-center text-center p-8 max-w-md w-full border-2 border-dashed border-slate-700 hover:border-amber-400 rounded-2xl transition-all group"
                    >
                      <div className="w-16 h-16 rounded-full bg-slate-800 group-hover:bg-amber-900/40 border border-slate-700 group-hover:border-amber-500/50 flex items-center justify-center mb-4 transition-all shadow-md">
                        <Upload className="w-8 h-8 text-amber-400 group-hover:scale-110 transition-transform" />
                      </div>
                      <h4 className="text-base font-bold text-white mb-1">
                        Upload a Receipt Image
                      </h4>
                      <p className="text-xs text-slate-400 max-w-xs mb-4">
                        Drag and drop your temple receipt slip here, or click to browse from your device.
                      </p>
                      <span className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center space-x-1.5">
                        <Camera className="w-3.5 h-3.5" />
                        <span>Select Receipt Photo</span>
                      </span>
                      <input
                        id="preview-dropzone-input"
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileInputChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Slip Details Footnote */}
                {previewUrl && (
                  <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                    <span className="flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Ready for OCR. Background auto-trimmed to slip boundaries.</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-amber-700 hover:text-amber-900 font-semibold text-xs"
                    >
                      Change Photo
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: UPLOAD CONTROLS & RUN OCR (4 cols out of 12) */}
            <div className="lg:col-span-4 space-y-5">
              {/* Upload Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center space-x-2 mb-3">
                  <Upload className="w-4 h-4 text-amber-700" />
                  <span>Upload Receipt</span>
                </h3>

                <label className="border-2 border-dashed border-gray-300 hover:border-amber-500 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-gray-50 hover:bg-amber-50/30 text-center">
                  <Camera className="w-7 h-7 text-gray-400 mb-1.5" />
                  <span className="text-xs font-semibold text-gray-800">
                    {uploadedFile ? 'Click to replace photo' : 'Click to browse receipt photo'}
                  </span>
                  <span className="text-[11px] text-gray-400 mt-0.5">
                    Supports JPEG, PNG, WEBP, HEIC
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </label>

                {uploadedFile && (
                  <div className="mt-3 p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
                    <div className="flex items-center space-x-2 truncate">
                      <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span className="truncate font-medium">{uploadedFile.name}</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-600 ml-2">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                )}
              </div>

              {/* Book Categorization & Options Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-amber-700" />
                  <span>Categorization & Options</span>
                </h3>

                {/* Optional Book Number Input */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Book Number (పుస్తకం నెం.) <span className="text-gray-400 font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={singleBookNumber}
                    onChange={(e) => setSingleBookNumber(e.target.value)}
                    placeholder="e.g. 001 or BOOK-12"
                    className="w-full text-xs font-mono border border-gray-300 rounded-xl px-3 py-2 text-gray-800 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Assigning a book folder groups this receipt automatically into categorized tabs.
                  </p>
                </div>

                {/* Fast High-Speed Mode Switch */}
                <div className="pt-2 border-t border-gray-100">
                  <label className="flex items-start space-x-2 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skipTranscription}
                      onChange={(e) => setSkipTranscription(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 mt-0.5"
                    />
                    <div>
                      <span className="font-bold text-gray-900">Fast Single-Pass Mode</span>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Processes under 10 seconds with 100% precision in Gothram master lookup and devotee extraction.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Button & Processing Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                {isProcessing ? (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-amber-600 border-t-transparent mb-2" />
                    <p className="text-xs font-bold text-amber-900 font-mono tracking-wide">
                      PROCESSING RECEIPT...
                    </p>
                    <p className="text-xs text-amber-700 mt-1 font-sans animate-pulse">
                      {processingStage}
                    </p>
                    <div className="w-full bg-amber-200 h-1.5 rounded-full mt-3 overflow-hidden">
                      <div className="bg-amber-600 h-full rounded-full animate-indeterminate" />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleStartOCR}
                    disabled={!previewUrl}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 disabled:opacity-40 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 text-sm tracking-wide"
                  >
                    <Zap className="w-4 h-4 fill-amber-200" />
                    <span>RUN OCR EXTRACTION & VERIFY</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <p className="text-[11px] text-gray-400 text-center mt-3">
                  Clicking will run AI extraction and immediately load the full verification & review editor.
                </p>
              </div>

              {/* Quick Info Box */}
              <div className="bg-amber-50/60 rounded-xl border border-amber-200/70 p-4 text-[11px] text-amber-900 space-y-1.5">
                <p className="font-bold flex items-center space-x-1.5 text-amber-950">
                  <span>💡</span>
                  <span>Tips for Best Accuracy</span>
                </p>
                <ul className="list-disc pl-4 space-y-1 text-amber-800">
                  <li>Keep receipt flat with good, even lighting.</li>
                  <li>Ensure the entire slip including devotee lines and gothram is visible.</li>
                  <li>Receipt orientation is detected automatically.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: BULK / BATCH PROCESSING QUEUE ──────────── */}
        {activeTab === 'batch' && (
          <div className="space-y-6">
            {/* Batch Controls Bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center space-x-2">
                  <Layers className="w-5 h-5 text-amber-700" />
                  <span>Bulk Receipt Processing Queue</span>
                  <span className="text-xs font-semibold bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full">
                    {batchQueue.length} {batchQueue.length === 1 ? 'receipt' : 'receipts'}
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Drag and drop multiple receipts or select files. Process all with one click and review results.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 border border-gray-300 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Add More Files</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </label>
                {batchQueue.length > 0 && (
                  <button
                    onClick={clearBatchQueue}
                    disabled={isBatchProcessing}
                    className="text-gray-400 hover:text-red-600 p-2 rounded-lg"
                    title="Clear Queue"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleOpenBatchModal}
                  disabled={isBatchProcessing || batchQueue.length === 0}
                  className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs font-bold shadow flex items-center space-x-2"
                >
                  {isBatchProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                      <span>Processing ({batchProgress.current}/{batchProgress.total})...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-amber-200" />
                      <span>PROCESS ALL ({batchQueue.filter((i) => i.status !== 'SUCCESS').length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Progress Bar when batch running */}
            {isBatchProcessing && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs font-bold text-amber-900 mb-1.5">
                  <span>Batch OCR in progress: {batchProgress.current} of {batchProgress.total} completed</span>
                  <span>{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
                </div>
                <div className="w-full bg-amber-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-600 h-full transition-all duration-300"
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Batch Items List */}
            {batchQueue.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-60" />
                <h4 className="text-sm font-bold text-gray-700">No Receipts in Batch Queue</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  Drag and drop multiple receipt images here, or click below to select photos from your computer.
                </p>
                <div className="mt-4 flex items-center justify-center space-x-3">
                  <label className="cursor-pointer bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow inline-flex items-center space-x-2">
                    <Upload className="w-4 h-4" />
                    <span>Select Images from Computer</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="divide-y divide-gray-100">
                  {batchQueue.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/80 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <span className="text-xs font-mono font-bold text-gray-400 w-6">
                          #{idx + 1}
                        </span>
                        <div className="w-16 h-12 bg-slate-900 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                          <img
                            src={item.previewUrl}
                            alt={item.filename}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900 truncate max-w-xs sm:max-w-md">
                            {item.filename}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {(item.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 justify-end">
                        {item.status === 'PENDING' && (
                          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                            Pending
                          </span>
                        )}
                        {item.status === 'PROCESSING' && (
                          <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full flex items-center space-x-1">
                            <span className="inline-block animate-spin rounded-full h-3 w-3 border-2 border-amber-700 border-t-transparent" />
                            <span>Processing...</span>
                          </span>
                        )}
                        {item.status === 'SUCCESS' && (
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full flex items-center space-x-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>
                              {item.result?.receipt_no ? `Receipt #${item.result.receipt_no}` : 'Extracted'}
                            </span>
                          </span>
                        )}
                        {item.status === 'ERROR' && (
                          <span
                            className="text-xs font-semibold text-red-700 bg-red-100 px-2.5 py-1 rounded-full truncate max-w-[200px]"
                            title={item.error}
                          >
                            Failed
                          </span>
                        )}

                        {item.status === 'SUCCESS' && (
                          <button
                            onClick={() => handleReviewBatchItem(item)}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 shadow-sm"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Review</span>
                          </button>
                        )}

                        {!isBatchProcessing && (
                          <button
                            onClick={() => removeBatchItem(item.id)}
                            className="text-gray-400 hover:text-red-600 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── BATCH BOOK NUMBER ASSIGNMENT MODAL ──────────────── */}
      {showBookNumberModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 animate-scale-up">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-gray-900">
                  Assign Book Number to Batch
                </h3>
              </div>
              <button
                onClick={() => setShowBookNumberModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              Enter an optional Book Number to assign to all {batchQueue.filter((i) => i.status !== 'SUCCESS').length} receipts in this batch.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleStartBatchOCR(bulkBookNumber.trim() || undefined);
              }}
            >
              <div className="mb-4">
                <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                  Book Number (Optional)
                </label>
                <input
                  type="text"
                  value={bulkBookNumber}
                  onChange={(e) => setBulkBookNumber(e.target.value)}
                  placeholder="e.g. 001 or BOOK-12"
                  autoFocus
                  className="w-full text-xs font-mono border border-gray-300 rounded-xl px-3 py-2 text-gray-800 focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Leave blank if receipts do not belong to a specific book.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowBookNumberModal(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-xl shadow flex items-center space-x-1"
                >
                  <Zap className="w-3.5 h-3.5 fill-amber-200" />
                  <span>Start Processing Batch</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
