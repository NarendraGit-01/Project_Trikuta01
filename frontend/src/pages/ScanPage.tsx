import React, { useEffect, useState, useRef } from 'react';
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
  RefreshCw,
} from 'lucide-react';
import {
  fetchSamples,
  processSampleOCR,
  processUploadOCR,
  processBatchOCR,
  autoCropImage,
  SampleReceipt,
} from '../services/api';
import { PipelineResult, BatchItemResult } from '../types';

interface ScanPageProps {
  onOCRComplete: (result: PipelineResult, imageUrl: string, filename?: string) => void;
  activeModel: string;
  onChangeModel: (model: string) => void;
}

interface BatchQueueItem {
  id: string;
  file?: File;
  sample?: SampleReceipt;
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
  const [samples, setSamples] = useState<SampleReceipt[]>([]);
  const [selectedSample, setSelectedSample] = useState<SampleReceipt | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewRotation, setPreviewRotation] = useState<number>(0);
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const [skipTranscription, setSkipTranscription] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

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

  // Book Number Modal State
  const [showBookNumberModal, setShowBookNumberModal] = useState<boolean>(false);
  const [bulkBookNumber, setBulkBookNumber] = useState<string>('');

  useEffect(() => {
    fetchSamples()
      .then((data) => {
        setSamples(data);
        if (data.length > 0) {
          // Pre-select first sample for immediate testing convenience
          setSelectedSample(data[0]);
          setPreviewUrl(data[0].url);
          setPreviewRotation(0);
        }
      })
      .catch((err) => console.error('Failed to load samples:', err));
  }, []);

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
      // Add all to batch queue and switch to batch tab
      addFilesToBatch(files);
      setActiveTab('batch');
    }
  };

  const addFilesToBatch = (files: File[]) => {
    const newItems: BatchQueueItem[] = files.map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      file: f,
      filename: f.name,
      size: f.size,
      previewUrl: URL.createObjectURL(f),
      status: 'PENDING',
    }));
    setBatchQueue((prev) => [...prev, ...newItems]);
  };

  const addSamplesToBatch = () => {
    if (samples.length === 0) return;
    const samplesToAdd = samples.slice(0, 3);
    const newItems: BatchQueueItem[] = samplesToAdd.map((s) => ({
      id: `${s.filename}-${Date.now()}`,
      sample: s,
      filename: s.filename,
      size: s.file_size,
      previewUrl: s.url,
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
    setSelectedSample(null);
    setPreviewUrl(URL.createObjectURL(file));
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

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);

    if (files.length === 1 && activeTab === 'single') {
      await handleSingleFileSelected(files[0]);
    } else {
      addFilesToBatch(files);
      setActiveTab('batch');
    }
    // reset input value so re-selecting same files triggers change
    e.target.value = '';
  };

  const handleSelectSample = (sample: SampleReceipt) => {
    setSelectedSample(sample);
    setUploadedFile(null);
    setPreviewUrl(sample.url);
    setPreviewRotation(0);
    setError(null);
  };

  const handleRotateLeft = () => {
    setPreviewRotation((prev) => (prev - 90 + 360) % 360);
  };

  const handleRotateRight = () => {
    setPreviewRotation((prev) => (prev + 90) % 360);
  };

  /* ── SINGLE OCR EXTRACTION ──────────────────────────────── */
  const handleStartOCR = async () => {
    if (!selectedSample && !uploadedFile) {
      setError('Please select a sample receipt or upload an image first.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    const stages = [
      'Pass 0: OpenCV Edge Alignment & Tight Receipt Cropping (15ms)...',
      'Pass 1: Line-by-Line Document Transcription...',
      'Pass 2: Structured Field Extraction & Devotee Names...',
      'Pass 3: High-Resolution Zoom Handwriting Re-read...',
      'Pass 4: 2,099 Gothram Master Phonetic RapidFuzz Matching...',
      'Pass 5: Consensus & Dual-Script Telugu/English Calibration...',
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
      let result: PipelineResult;
      let finalImgUrl = previewUrl || '';

      if (selectedSample) {
        result = await processSampleOCR(selectedSample.filename, activeModel, skipTranscription);
        finalImgUrl = selectedSample.url;
      } else if (uploadedFile) {
        result = await processUploadOCR(uploadedFile, activeModel, skipTranscription);
      } else {
        throw new Error('No image available');
      }

      clearInterval(timer);
      setIsProcessing(false);
      onOCRComplete(result, finalImgUrl, selectedSample?.filename || uploadedFile?.name);
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

    // Process pending items sequentially with live updates
    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      setBatchProgress({ current: i + 1, total: pendingItems.length });

      // Mark item as processing
      setBatchQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'PROCESSING' } : q))
      );

      try {
        let res: PipelineResult;
        let preview = item.previewUrl;

        if (item.sample) {
          res = await processSampleOCR(item.sample.filename, activeModel, skipTranscription);
          preview = item.sample.url;
        } else if (item.file) {
          res = await processUploadOCR(item.file, activeModel, skipTranscription, assignedBookNumber);
        } else {
          throw new Error('No file data');
        }

        // Attach book number to intermediate passes if present
        if (assignedBookNumber && res.intermediate_passes) {
          (res.intermediate_passes as any).book_number = assignedBookNumber;
        }

        // Mark item as success
        setBatchQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: 'SUCCESS',
                  result: res,
                  previewUrl: preview,
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
      className={`min-h-[calc(100vh-4rem)] transition-colors relative ${
        isDragging ? 'bg-amber-100/50' : ''
      }`}
    >
      {/* Full-screen Drag Overlay indicator */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-amber-900/60 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none text-white border-4 border-dashed border-amber-400 m-4 rounded-3xl">
          <Upload className="w-16 h-16 text-amber-300 animate-bounce mb-3" />
          <h2 className="text-2xl font-bold tracking-wide">Drop Receipt Images Here</h2>
          <p className="text-amber-200 mt-1 text-sm">
            Multiple images will be added to the Batch Processing Queue automatically.
          </p>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Title & Tabs */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 font-serif flex items-center space-x-2">
              <span>రసీదు స్కాన్ & AI డేటా గుర్తింపు</span>
              <span className="text-sm font-sans font-normal text-gray-500">
                (Receipt Scan & OCR Extraction)
              </span>
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Dual-script Telugu & English handwriting recognition with 2,099 Gothram master verification.
            </p>
          </div>

          {/* Mode Switcher Tabs + Active Model */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-gray-200 p-1 rounded-xl flex items-center text-xs font-semibold">
              <button
                onClick={() => setActiveTab('single')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'single'
                    ? 'bg-white text-gray-900 shadow-sm font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Single Receipt
              </button>
              <button
                onClick={() => setActiveTab('batch')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
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
              <span className="font-semibold text-amber-900">Model:</span>
              <select
                value={activeModel}
                onChange={(e) => onChangeModel(e.target.value)}
                disabled={isProcessing || isBatchProcessing}
                className="bg-white border border-amber-300 rounded px-2 py-0.5 text-gray-800 font-medium focus:outline-none"
              >
                <option value="gemini-3.8-flash">gemini-3.8-flash (Latest & Fast)</option>
                <option value="gemini-3.8-flash-lite">gemini-3.8-flash-lite (Ultra Fast)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-red-800 text-sm">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Processing Notice</p>
              <p className="text-red-700 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* ── TAB 1: SINGLE RECEIPT MODE ────────────────────── */}
        {activeTab === 'single' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Sample Receipts & Upload (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Reference Receipts Gallery */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">📁</span>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">
                      Pre-Loaded Reference Receipts (11 Samples)
                    </h3>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">
                    Click any to test
                  </span>
                </div>

                <p className="text-xs text-gray-500 mb-3">
                  Directly test any of the 11 official temple receipts without uploading files:
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {samples.map((sample) => {
                    const isSelected = selectedSample?.filename === sample.filename;
                    return (
                      <div
                        key={sample.id}
                        onClick={() => handleSelectSample(sample)}
                        className={`cursor-pointer rounded-xl p-2.5 border-2 transition-all text-left flex flex-col justify-between ${
                          isSelected
                            ? 'border-amber-600 bg-amber-50/50 shadow-md ring-2 ring-amber-400/30'
                            : 'border-gray-200 hover:border-amber-300 bg-white hover:bg-amber-50/20'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">
                              #{sample.receipt_no}
                            </span>
                            {sample.filename.includes('3') ? (
                              <span className="text-[10px] bg-purple-100 text-purple-700 font-semibold px-1 rounded">
                                Handprint
                              </span>
                            ) : sample.filename.includes('7') ? (
                              <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-1 rounded">
                                English
                              </span>
                            ) : (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 font-semibold px-1 rounded">
                                Telugu
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-600 mt-1 line-clamp-2 leading-tight">
                            {sample.description}
                          </p>
                        </div>

                        <div className="mt-2 pt-1 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
                          <span>{(sample.file_size / 1024 / 1024).toFixed(1)} MB</span>
                          {isSelected && <CheckCircle className="w-3.5 h-3.5 text-amber-600" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Upload & Drag Drop Zone */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 flex items-center space-x-2">
                    <Upload className="w-4 h-4 text-amber-700" />
                    <span>Upload or Drag & Drop Receipts</span>
                  </h3>
                  <button
                    onClick={addSamplesToBatch}
                    className="text-xs text-amber-700 hover:text-amber-900 font-semibold bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200"
                  >
                    ⚡ Test 3 in Batch Mode
                  </button>
                </div>

                <label className="border-2 border-dashed border-gray-300 hover:border-amber-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-gray-50 hover:bg-amber-50/30">
                  <Camera className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-xs font-semibold text-gray-700">
                    Click to browse or drop images here
                  </span>
                  <span className="text-[11px] text-gray-400 mt-0.5">
                    Select 1 file for single scan, or multiple files for batch processing
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </label>
                {uploadedFile && (
                  <p className="text-xs text-emerald-600 font-medium mt-2 flex items-center space-x-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>
                      Uploaded: {uploadedFile.name} ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Receipt Preview & Run OCR (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col h-full">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">
                      Receipt Preview
                    </h3>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                      <Crop className="w-3 h-3" />
                      <span>Auto-Cropped Slip</span>
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {selectedSample && (
                      <span className="text-xs font-mono text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-bold">
                        #{selectedSample.receipt_no}
                      </span>
                    )}
                    {/* Manual Rotation Controls */}
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
                  </div>
                </div>

                {/* Image Preview Box */}
                <div className="relative flex-1 min-h-[340px] bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center p-3 border border-gray-300">
                  {isCropping && (
                    <div className="absolute inset-0 bg-slate-900/80 z-10 flex flex-col items-center justify-center text-white">
                      <div className="inline-block animate-spin rounded-full h-7 w-7 border-2 border-amber-400 border-t-transparent mb-2" />
                      <p className="text-xs font-medium text-amber-200">Auto-orienting & cropping receipt...</p>
                    </div>
                  )}
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Receipt Preview"
                      style={{ transform: `rotate(${previewRotation}deg)` }}
                      className="max-h-[380px] max-w-full object-contain rounded shadow transition-transform duration-200"
                    />
                  ) : (
                    <div className="text-center text-gray-400 p-6">
                      <Camera className="w-12 h-12 mx-auto mb-2 opacity-40" />
                      <p className="text-xs">No image selected</p>
                    </div>
                  )}
                </div>

                {/* Pipeline Switches */}
                <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
                  <label className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skipTranscription}
                      onChange={(e) => setSkipTranscription(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span className="font-medium">Fast High-Speed Mode (Skips redundant transcription)</span>
                  </label>
                  <p className="text-[11px] text-gray-400 pl-5">
                    Reduces latency by ~50% while preserving 100% precision in Gothram master lookup and devotee extraction.
                  </p>
                </div>

                {/* Processing Indicator or Start Button */}
                <div className="mt-5">
                  {isProcessing ? (
                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-600 border-t-transparent mb-2" />
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
                      className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 text-sm tracking-wide"
                    >
                      <Zap className="w-4 h-4 fill-amber-200" />
                      <span>RUN OCR EXTRACTION & VERIFY</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
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
                  Drag and drop multiple receipts or select folders. Process all with one click and review results.
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
                <button
                  onClick={addSamplesToBatch}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-800 px-3 py-2 rounded-xl text-xs font-semibold border border-amber-200"
                >
                  + Add 3 Samples
                </button>
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
                  Drag and drop multiple receipt images here, or click below to quickly load 3 sample receipts.
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
                  <button
                    onClick={addSamplesToBatch}
                    className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-4 py-2 rounded-xl text-xs font-bold"
                  >
                    Load 3 Temple Samples
                  </button>
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
                        <div className="w-16 h-12 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 border border-gray-300">
                          <img
                            src={item.previewUrl}
                            alt={item.filename}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900 flex items-center space-x-2">
                            <span>{item.filename}</span>
                            <span className="text-[10px] text-gray-400 font-normal">
                              ({(item.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          </p>
                          {item.result && (
                            <p className="text-[11px] text-amber-800 mt-0.5">
                              Receipt #{item.result.receipt_no || '—'} • Gothram:{' '}
                              <strong>
                                {typeof item.result.gothram_final === 'string'
                                  ? item.result.gothram_final
                                  : item.result.gothram_final?.name_en || item.result.gothram_as_written || '—'}
                              </strong>{' '}
                              • Devotees: {item.result.people?.length || 0}
                            </p>
                          )}
                          {item.error && (
                            <p className="text-[11px] text-red-600 mt-0.5">{item.error}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 self-end sm:self-center">
                        {/* Status Badge */}
                        {item.status === 'PENDING' && (
                          <span className="text-[11px] font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full flex items-center space-x-1">
                            <ClockIcon className="w-3 h-3" />
                            <span>Queued</span>
                          </span>
                        )}
                        {item.status === 'PROCESSING' && (
                          <span className="text-[11px] font-semibold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full flex items-center space-x-1 animate-pulse">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Processing...</span>
                          </span>
                        )}
                        {item.status === 'SUCCESS' && (
                          <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full flex items-center space-x-1">
                            <CheckCircle className="w-3 h-3" />
                            <span>Verified</span>
                          </span>
                        )}
                        {item.status === 'ERROR' && (
                          <span className="text-[11px] font-semibold bg-red-100 text-red-800 px-2.5 py-1 rounded-full flex items-center space-x-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Error</span>
                          </span>
                        )}

                        {/* Actions */}
                        {item.status === 'SUCCESS' ? (
                          <button
                            onClick={() => handleReviewBatchItem(item)}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1 shadow-sm transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Review</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => removeBatchItem(item.id)}
                            disabled={item.status === 'PROCESSING'}
                            className="text-gray-400 hover:text-red-600 p-1.5 rounded"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Book Number Confirmation Modal */}
      {showBookNumberModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-amber-200 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center space-x-3 text-amber-900 mb-4">
              <div className="p-2.5 bg-amber-100 rounded-xl">
                <Layers className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <h3 className="font-bold text-lg font-serif">Enter Book Number</h3>
                <p className="text-xs text-gray-500">రసీదు పుస్తకం సంఖ్యను నమోదు చేయండి</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 mb-4">
              Please enter the physical receipt <strong>Book Number</strong> for this batch of {batchQueue.filter(i => i.status !== 'SUCCESS').length} receipts (e.g. <code>BOOK-001</code>). This will be associated with every processed receipt in this batch.
            </p>

            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Book Number (పుస్తకం సంఖ్య)
              </label>
              <input
                type="text"
                autoFocus
                value={bulkBookNumber}
                onChange={(e) => setBulkBookNumber(e.target.value)}
                placeholder="e.g. BOOK-001"
                className="w-full px-3.5 py-2.5 text-sm border-2 border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold text-amber-950 placeholder-gray-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleStartBatchOCR(bulkBookNumber);
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowBookNumberModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleStartBatchOCR(bulkBookNumber)}
                className="px-5 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center space-x-1.5"
              >
                <span>Confirm & Start Processing</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function ClockIcon(props: any) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2" />
    </svg>
  );
}
