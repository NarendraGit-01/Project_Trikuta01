import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Plus,
  CheckCheck,
} from 'lucide-react';
import {
  processUploadOCR,
  autoCropImage,
  listStagedReceipts,
  uploadStagedReceipts,
  updateStagedReceiptImage,
  deleteStagedReceipt,
  processStagedReceiptOCR,
} from '../services/api';
import { PipelineResult } from '../types';
import { ManualCropper } from '../components/ManualCropper';
import {
  StoredReceiptItem,
  getAllStoredReceipts,
  addStoredReceipts,
  updateStoredReceipt,
  deleteStoredReceipt,
  deleteStoredReceipts,
  clearAllStoredReceipts,
} from '../services/receiptStore';

async function compressImageForUpload(file: File): Promise<File> {
  // Keep smaller files as-is; downscale huge phone photos (> 1.5 MB) to stay well below Vercel's 4.5 MB cap
  if (file.size <= 1.5 * 1024 * 1024) return file;
  return new Promise<File>((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const maxDim = 2400;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (Math.max(w, h) > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob && blob.size < file.size) {
            const baseName = file.name.replace(/\.[^.]+$/, '') || 'receipt';
            resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }));
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        0.88
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

async function resolveItemBlob(item: StoredReceiptItem): Promise<Blob> {
  if (item.blob) return item.blob;
  const fetchUrl = item.imageUrl || item.previewUrl;
  if (!fetchUrl) {
    throw new Error('Receipt image source is missing');
  }
  const res = await fetch(fetchUrl);
  if (!res.ok) {
    throw new Error(`Could not fetch receipt image (HTTP ${res.status})`);
  }
  return res.blob();
}

interface ScanPageProps {
  onOCRComplete: (
    result: PipelineResult,
    imageUrl: string,
    filename?: string,
    storedReceiptId?: string
  ) => void;
  activeModel: string;
  onChangeModel: (model: string) => void;
}

export const ScanPage: React.FC<ScanPageProps> = ({
  onOCRComplete,
  activeModel,
  onChangeModel,
}) => {
  // Master queue loaded from persistent IndexedDB
  const [receipts, setReceipts] = useState<StoredReceiptItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoadingStore, setIsLoadingStore] = useState<boolean>(true);

  // Active book number for new uploads & filtering
  const [activeBookNumber, setActiveBookNumber] = useState<string>('');
  const [selectedBookFilter, setSelectedBookFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'SUCCESS' | 'ERROR'>('ALL');

  // Book Number Confirmation Modal on Upload
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [showBookModal, setShowBookModal] = useState<boolean>(false);
  const [modalBookNumber, setModalBookNumber] = useState<string>('');

  // OCR Execution States
  const [isProcessingSingle, setIsProcessingSingle] = useState<boolean>(false);
  const [singleStage, setSingleStage] = useState<string>('');
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const [isManualCropMode, setIsManualCropMode] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [skipTranscription, setSkipTranscription] = useState<boolean>(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Drag and drop states
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  /* ── 1. LOAD SHARED CLOUD QUEUE + LOCAL CACHE ───────────── */
  const loadStoredQueue = async () => {
    setIsLoadingStore(true);
    try {
      const [localItems, cloudItems] = await Promise.all([
        getAllStoredReceipts().catch(() => [] as StoredReceiptItem[]),
        listStagedReceipts().catch(() => null),
      ]);

      // Clean up any already-reviewed local cache entries
      const reviewedIds = localItems
        .filter((r) => r.reviewed || r.savedReceiptId !== undefined)
        .map((r) => r.id);
      if (reviewedIds.length > 0) {
        await deleteStoredReceipts(reviewedIds).catch(() => {});
      }
      const activeLocal = localItems.filter((r) => !r.reviewed && r.savedReceiptId === undefined);
      const localMap = new Map(activeLocal.map((item) => [item.id, item]));

      const merged: StoredReceiptItem[] = [];
      if (cloudItems !== null) {
        for (const c of cloudItems) {
          const key = `staged_${c.id}`;
          const cached = localMap.get(key);
          merged.push({
            id: key,
            stagedId: c.id,
            filename: c.filename,
            fileSize: c.file_size,
            blob: cached?.blob,
            originalBlob: cached?.originalBlob,
            previewUrl: cached?.blob ? cached.previewUrl : c.preview_url || c.image_url,
            imageUrl: c.image_url,
            bookNumber: c.book_number || undefined,
            deviceLabel: c.device_label || undefined,
            uploadedAt: new Date(c.created_at).getTime() || Date.now(),
            rotation: cached?.rotation || 0,
            status: cached?.result ? 'SUCCESS' : cached?.status === 'ERROR' ? 'ERROR' : 'PENDING',
            result: cached?.result,
            error: cached?.error,
          });
        }
        // Keep any purely local offline receipts (not yet synced to cloud)
        for (const loc of activeLocal) {
          if (!loc.stagedId && !loc.id.startsWith('staged_')) {
            merged.push(loc);
          }
        }
      } else {
        // Offline fallback if cloud endpoint unreachable
        merged.push(...activeLocal);
      }

      setReceipts(merged);
      if (merged.length > 0 && (!selectedId || !merged.some((m) => m.id === selectedId))) {
        setSelectedId(merged[0].id);
      }
    } catch (err: any) {
      console.error('Error loading receipt queue:', err);
    } finally {
      setIsLoadingStore(false);
    }
  };

  useEffect(() => {
    loadStoredQueue();
  }, []);

  useEffect(() => {
    setIsManualCropMode(false);
  }, [selectedId]);

  /* ── 2. DERIVED ACTIVE RECEIPT & FILTERED LIST ───────────── */
  // Available distinct book numbers
  const distinctBooks = useMemo(() => {
    const set = new Set<string>();
    receipts.forEach((r) => {
      if (r.bookNumber && r.bookNumber.trim()) {
        set.add(r.bookNumber.trim());
      }
    });
    return Array.from(set).sort();
  }, [receipts]);

  // Filtered queue (never show receipts already saved/finalized)
  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (r.reviewed || r.savedReceiptId !== undefined) return false;
      if (selectedBookFilter !== 'ALL') {
        if ((r.bookNumber || '').trim() !== selectedBookFilter) return false;
      }
      if (statusFilter !== 'ALL') {
        if (r.status !== statusFilter) return false;
      }
      return true;
    });
  }, [receipts, selectedBookFilter, statusFilter]);

  // Active selected item
  const selectedReceipt = useMemo(() => {
    if (!selectedId) return filteredReceipts[0] || receipts[0] || null;
    return receipts.find((r) => r.id === selectedId) || filteredReceipts[0] || receipts[0] || null;
  }, [receipts, selectedId, filteredReceipts]);

  // Index of active receipt in filtered queue
  const activeIndex = useMemo(() => {
    if (!selectedReceipt) return -1;
    return filteredReceipts.findIndex((r) => r.id === selectedReceipt.id);
  }, [filteredReceipts, selectedReceipt]);

  /* ── 3. FILE INGESTION (WITH POPUP FOR BOOK NUMBER) ──────── */
  const promptBookNumberAndIngest = (files: File[]) => {
    setPendingFiles(files);
    setModalBookNumber(activeBookNumber || '');
    setShowBookModal(true);
  };

  const handleConfirmBookNumber = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pendingFiles || pendingFiles.length === 0) return;
    const bookNo = modalBookNumber.trim();
    if (bookNo) {
      setActiveBookNumber(bookNo);
    }
    const filesToUpload = pendingFiles;
    setShowBookModal(false);
    setPendingFiles(null);
    await ingestFiles(filesToUpload, bookNo);
  };

  const handleSkipBookNumber = async () => {
    if (!pendingFiles || pendingFiles.length === 0) return;
    const filesToUpload = pendingFiles;
    setShowBookModal(false);
    setPendingFiles(null);
    await ingestFiles(filesToUpload, '');
  };

  const handleCancelBookModal = () => {
    setShowBookModal(false);
    setPendingFiles(null);
  };

  const ingestFiles = async (files: File[], bookNumberToAssign?: string) => {
    if (files.length === 0) return;
    setErrorNotice(null);

    const bookNo = (bookNumberToAssign !== undefined ? bookNumberToAssign : activeBookNumber).trim();
    const isMobile =
      typeof window !== 'undefined' &&
      (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768);
    const deviceLabel = isMobile ? 'Mobile' : 'PC';

    setUploadProgress({ current: 0, total: files.length });
    const uploadedItems: StoredReceiptItem[] = [];
    const offlineFallbackItems: StoredReceiptItem[] = [];

    for (let i = 0; i < files.length; i++) {
      setUploadProgress({ current: i + 1, total: files.length });
      const rawFile = files[i];
      const compressed = await compressImageForUpload(rawFile);

      try {
        const cloudRes = await uploadStagedReceipts([compressed], bookNo, deviceLabel);
        for (const c of cloudRes) {
          const item: StoredReceiptItem = {
            id: `staged_${c.id}`,
            stagedId: c.id,
            filename: c.filename,
            fileSize: c.file_size,
            blob: compressed,
            originalBlob: rawFile,
            previewUrl: URL.createObjectURL(compressed),
            imageUrl: c.image_url,
            bookNumber: c.book_number || undefined,
            deviceLabel: c.device_label || deviceLabel,
            uploadedAt: new Date(c.created_at).getTime() || Date.now() + i,
            rotation: 0,
            status: 'PENDING',
          };
          uploadedItems.push(item);
          setReceipts((prev) => [...prev, item]);
          await addStoredReceipts([item]).catch(() => {});
        }
      } catch (err: any) {
        console.warn('Cloud staging upload failed for', rawFile.name, err);
        setErrorNotice(
          `Cloud sync warning (${rawFile.name}): ${err.message || 'Saved locally only'}`
        );
        const localItem: StoredReceiptItem = {
          id: `rec_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
          filename: rawFile.name,
          fileSize: compressed.size,
          blob: compressed,
          originalBlob: rawFile,
          previewUrl: URL.createObjectURL(compressed),
          bookNumber: bookNo || undefined,
          deviceLabel,
          uploadedAt: Date.now() + i,
          rotation: 0,
          status: 'PENDING',
        };
        offlineFallbackItems.push(localItem);
        setReceipts((prev) => [...prev, localItem]);
        await addStoredReceipts([localItem]).catch(() => {});
      }
    }

    setUploadProgress(null);
    const firstAdded = uploadedItems[0] || offlineFallbackItems[0];
    if (firstAdded) {
      setSelectedId(firstAdded.id);
    }
  };

  /* ── 4. DRAG & DROP HANDLERS ────────────────────────────── */
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
    promptBookNumberAndIngest(files);
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    e.target.value = '';
    promptBookNumberAndIngest(files);
  };

  /* ── 5. ITEM CONTROLS (ROTATE, DELETE, SELECT) ───────────── */
  const handleRotate = async (delta: number) => {
    if (!selectedReceipt) return;
    const newRot = (selectedReceipt.rotation + delta + 360) % 360;
    setReceipts((prev) =>
      prev.map((r) => (r.id === selectedReceipt.id ? { ...r, rotation: newRot } : r))
    );
    await updateStoredReceipt(selectedReceipt.id, { rotation: newRot });
  };

  const handleDeleteItem = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const target = receipts.find((r) => r.id === id);
      if (target?.stagedId) {
        await deleteStagedReceipt(target.stagedId).catch(() => {});
      }
      await deleteStoredReceipt(id);
      const remaining = receipts.filter((r) => r.id !== id);
      setReceipts(remaining);
      if (selectedId === id) {
        setSelectedId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: any) {
      console.error('Failed to delete item:', err);
    }
  };

  const handleClearCompleted = async () => {
    const completed = receipts.filter((r) => r.status === 'SUCCESS' || r.reviewed);
    const completedIds = completed.map((r) => r.id);
    if (completedIds.length === 0) return;
    if (!window.confirm(`Clear ${completedIds.length} extracted receipts from the queue?`)) return;

    try {
      await Promise.all(
        completed
          .filter((r) => r.stagedId)
          .map((r) => deleteStagedReceipt(r.stagedId!).catch(() => {}))
      );
      await deleteStoredReceipts(completedIds);
      const remaining = receipts.filter((r) => !completedIds.includes(r.id));
      setReceipts(remaining);
      if (selectedId && completedIds.includes(selectedId)) {
        setSelectedId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: any) {
      console.error('Failed to clear completed items:', err);
    }
  };

  const handleClearAll = async () => {
    if (receipts.length === 0) return;
    if (!window.confirm(`Are you sure you want to remove all ${receipts.length} receipts from the shared queue?`)) return;

    try {
      await Promise.all(
        receipts
          .filter((r) => r.stagedId)
          .map((r) => deleteStagedReceipt(r.stagedId!).catch(() => {}))
      );
      await clearAllStoredReceipts();
      setReceipts([]);
      setSelectedId(null);
    } catch (err: any) {
      console.error('Failed to clear all receipts:', err);
    }
  };

  const handlePrevReceipt = () => {
    if (activeIndex > 0) {
      setSelectedId(filteredReceipts[activeIndex - 1].id);
    }
  };

  const handleNextReceipt = () => {
    if (activeIndex >= 0 && activeIndex < filteredReceipts.length - 1) {
      setSelectedId(filteredReceipts[activeIndex + 1].id);
    }
  };

  /* ── 6. CROP ACTIVE RECEIPT (MANUAL & AUTO) ─────────────── */
  const saveCroppedBlobForSelected = async (croppedBlob: Blob) => {
    if (!selectedReceipt) return;
    setIsCropping(true);
    try {
      const origBlob = selectedReceipt.originalBlob || selectedReceipt.blob;
      let newPreviewUrl = URL.createObjectURL(croppedBlob);
      let newImageUrl = selectedReceipt.imageUrl;

      if (selectedReceipt.stagedId) {
        const cropFile = new File([croppedBlob], selectedReceipt.filename, {
          type: croppedBlob.type || 'image/jpeg',
        });
        const updatedCloud = await updateStagedReceiptImage(selectedReceipt.stagedId, cropFile);
        newImageUrl = `${updatedCloud.image_url}?t=${Date.now()}`;
      }

      const updatedItem: StoredReceiptItem = {
        ...selectedReceipt,
        blob: croppedBlob,
        originalBlob: origBlob,
        fileSize: croppedBlob.size,
        previewUrl: newPreviewUrl,
        imageUrl: newImageUrl,
        rotation: 0,
        status: 'PENDING',
        result: undefined,
        error: undefined,
      };
      setReceipts((prev) => prev.map((r) => (r.id === selectedReceipt.id ? updatedItem : r)));
      await addStoredReceipts([updatedItem]).catch(() => {});
    } catch (err: any) {
      setErrorNotice(err.message || 'Could not save cropped image');
    } finally {
      setIsCropping(false);
    }
  };

  const handleApplyManualCrop = async (croppedBlob: Blob) => {
    setIsManualCropMode(false);
    await saveCroppedBlobForSelected(croppedBlob);
  };

  const handleResetToOriginal = async () => {
    if (!selectedReceipt?.originalBlob) return;
    const orig = selectedReceipt.originalBlob;
    const origUrl = URL.createObjectURL(orig);
    setIsManualCropMode(false);
    if (selectedReceipt.stagedId) {
      const origFile = new File([orig], selectedReceipt.filename, { type: orig.type || 'image/jpeg' });
      await updateStagedReceiptImage(selectedReceipt.stagedId, origFile).catch(() => {});
    }
    const updatedItem: StoredReceiptItem = {
      ...selectedReceipt,
      blob: orig,
      originalBlob: undefined,
      fileSize: orig.size,
      previewUrl: origUrl,
      rotation: 0,
      status: 'PENDING',
      result: undefined,
      error: undefined,
    };
    setReceipts((prev) => prev.map((r) => (r.id === selectedReceipt.id ? updatedItem : r)));
    await addStoredReceipts([updatedItem]).catch(() => {});
  };

  const handleAutoCropSelected = async () => {
    if (!selectedReceipt) return;
    setIsCropping(true);
    try {
      const srcBlob = await resolveItemBlob(selectedReceipt);
      const file = new File([srcBlob], selectedReceipt.filename, {
        type: srcBlob.type || 'image/jpeg',
      });
      const cropRes = await autoCropImage(file);
      if (cropRes && cropRes.url) {
        const res = await fetch(cropRes.url);
        const croppedBlob = await res.blob();
        await saveCroppedBlobForSelected(croppedBlob);
      }
    } catch (err) {
      console.warn('Auto-crop notice:', err);
    } finally {
      setIsCropping(false);
    }
  };

  /* ── 7. RUN OCR (SINGLE RECEIPT) ────────────────────────── */
  const handleRunOCRForReceipt = async (item: StoredReceiptItem, autoNavigateToReview = true) => {
    setIsProcessingSingle(true);
    setErrorNotice(null);

    const stages = [
      'Pass 0: OpenCV Edge Alignment & Tight Receipt Cropping...',
      'Pass 1: Structured Multimodal Field Extraction & Devotee Names...',
      'Pass 2: 2,099 Gothram Master Phonetic RapidFuzz Matching...',
      'Pass 3: Consensus & Dual-Script Telugu/English Calibration...',
    ];

    let stageIdx = 0;
    setSingleStage(stages[0]);
    const timer = setInterval(() => {
      stageIdx++;
      if (stageIdx < stages.length) {
        setSingleStage(stages[stageIdx]);
      }
    }, 1500);

    // Update status to PROCESSING
    setReceipts((prev) =>
      prev.map((r) => (r.id === item.id ? { ...r, status: 'PROCESSING', error: undefined } : r))
    );
    await updateStoredReceipt(item.id, { status: 'PROCESSING', error: undefined });

    try {
      const normRot = ((item.rotation % 360) + 360) % 360;
      let result: PipelineResult;

      if (item.stagedId && normRot === 0) {
        // Fast server-side OCR directly from cloud storage
        result = await processStagedReceiptOCR(item.stagedId, activeModel, skipTranscription);
      } else {
        const srcBlob = await resolveItemBlob(item);
        let uploadBlob = srcBlob;
        if (normRot !== 0) {
          uploadBlob = await new Promise<Blob>((resolve) => {
            const imgUrl = URL.createObjectURL(srcBlob);
            const img = new Image();
            img.onload = () => {
              const swap = normRot === 90 || normRot === 270;
              const cw = swap ? img.naturalHeight : img.naturalWidth;
              const ch = swap ? img.naturalWidth : img.naturalHeight;
              const canvas = document.createElement('canvas');
              canvas.width = cw;
              canvas.height = ch;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.translate(cw / 2, ch / 2);
                ctx.rotate((normRot * Math.PI) / 180);
                ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
                canvas.toBlob(
                  (b) => {
                    URL.revokeObjectURL(imgUrl);
                    resolve(b || srcBlob);
                  },
                  'image/jpeg',
                  0.95
                );
              } else {
                URL.revokeObjectURL(imgUrl);
                resolve(srcBlob);
              }
            };
            img.onerror = () => {
              URL.revokeObjectURL(imgUrl);
              resolve(srcBlob);
            };
            img.src = imgUrl;
          });
        }

        const file = new File([uploadBlob], item.filename, {
          type: uploadBlob.type || 'image/jpeg',
        });

        if (item.stagedId) {
          await updateStagedReceiptImage(item.stagedId, file).catch(() => {});
          result = await processStagedReceiptOCR(item.stagedId, activeModel, skipTranscription);
        } else {
          result = await processUploadOCR(
            file,
            activeModel,
            skipTranscription,
            item.bookNumber || undefined
          );
        }
      }

      clearInterval(timer);
      setIsProcessingSingle(false);

      const updatedItem: StoredReceiptItem = {
        ...item,
        status: 'SUCCESS',
        result,
        error: undefined,
      };
      setReceipts((prev) => prev.map((r) => (r.id === item.id ? updatedItem : r)));
      await addStoredReceipts([updatedItem]).catch(() => {});

      if (autoNavigateToReview) {
        const finalUrl =
          item.previewUrl || item.imageUrl || (item.blob ? URL.createObjectURL(item.blob) : '');
        onOCRComplete(result, finalUrl, item.filename, item.id);
      }
    } catch (err: any) {
      clearInterval(timer);
      setIsProcessingSingle(false);
      const errMsg = err.message || 'OCR processing failed. Please verify API key and connection.';
      setErrorNotice(errMsg);

      const errItem: StoredReceiptItem = { ...item, status: 'ERROR', error: errMsg };
      setReceipts((prev) => prev.map((r) => (r.id === item.id ? errItem : r)));
      await addStoredReceipts([errItem]).catch(() => {});
    }
  };

  /* ── 8. RUN BATCH OCR (ALL PENDING IN QUEUE) ─────────────── */
  const handleRunBatchOCR = async () => {
    const pendingItems = filteredReceipts.filter(
      (r) => r.status === 'PENDING' || r.status === 'ERROR'
    );
    if (pendingItems.length === 0) {
      alert('No pending receipts to process in the current view.');
      return;
    }

    setIsBatchProcessing(true);
    setBatchProgress({ current: 0, total: pendingItems.length });

    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      setBatchProgress({ current: i + 1, total: pendingItems.length });
      setSelectedId(item.id);

      // Run OCR without auto-navigating away so batch can continue uninterrupted
      await handleRunOCRForReceipt(item, false);
    }

    setIsBatchProcessing(false);
  };

  /* ── 9. VIEW / REVIEW PROCESSED RECEIPT ──────────────────── */
  const handleOpenReview = (item: StoredReceiptItem) => {
    if (item.result) {
      const finalUrl =
        item.previewUrl || item.imageUrl || (item.blob ? URL.createObjectURL(item.blob) : '');
      onOCRComplete(item.result, finalUrl, item.filename, item.id);
    }
  };

  // Status statistics for header
  const stats = useMemo(() => {
    const total = receipts.length;
    const pending = receipts.filter((r) => r.status === 'PENDING').length;
    const processing = receipts.filter((r) => r.status === 'PROCESSING').length;
    const success = receipts.filter((r) => r.status === 'SUCCESS').length;
    const errors = receipts.filter((r) => r.status === 'ERROR').length;
    return { total, pending, processing, success, errors };
  }, [receipts]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="min-h-[calc(100vh-5rem)] relative"
    >
      {/* ── BOOK NUMBER CONFIRMATION MODAL ── */}
      {showBookModal && pendingFiles && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 font-serif">
                    Assign Book Number
                  </h3>
                  <p className="text-xs text-gray-500 font-telugu">పుస్తకం సంఖ్య నమోదు చేయండి</p>
                </div>
              </div>
              <button
                onClick={handleCancelBookModal}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900">
              <span className="font-bold">{pendingFiles.length} receipt{pendingFiles.length !== 1 ? 's' : ''} selected. </span>
              All these receipts will be grouped under this book folder for easy tracking.
            </div>

            <form onSubmit={handleConfirmBookNumber} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Book Number (పుస్తకం నెంబరు)
                </label>
                <input
                  type="text"
                  autoFocus
                  value={modalBookNumber}
                  onChange={(e) => setModalBookNumber(e.target.value)}
                  placeholder="e.g. 01, 02, or BOOK-12"
                  className="w-full text-sm font-mono font-bold border-2 border-amber-400 rounded-xl px-3.5 py-2.5 text-gray-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Quick suggestions if other books exist */}
              {distinctBooks.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold text-gray-500 block mb-1">
                    Or select an existing book:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {distinctBooks.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setModalBookNumber(b)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-mono font-bold border transition-colors ${
                          modalBookNumber === b
                            ? 'bg-amber-700 text-white border-amber-700'
                            : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        Book {b}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end space-x-2.5 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCancelBookModal}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSkipBookNumber}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
                >
                  Skip Book #
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-bold rounded-xl shadow transition-all"
                >
                  Continue & Add ({pendingFiles.length})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drag & Drop Fullscreen Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-amber-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white border-4 border-dashed border-amber-300 pointer-events-none animate-fade-in">
          <Upload className="w-16 h-16 text-amber-300 animate-bounce mb-3" />
          <h2 className="text-2xl font-bold tracking-wide">Drop Receipt Images Here</h2>
          <p className="text-amber-200 mt-1 text-sm">
            Select 50+ receipts at once. They will be saved to your local workspace automatically.
          </p>
        </div>
      )}

      {/* Main Container - max-w-[1650px] like ReviewPage */}
      <div className="max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* Top Control Bar */}
        <div className="mb-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          {/* Title & Queue Stats */}
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-bold text-gray-900 font-serif flex items-center space-x-2">
                <span>రసీదు స్కాన్ & AI డేటా గుర్తింపు</span>
                <span className="text-xs font-sans font-normal text-gray-500">
                  (Scan & OCR Workstation)
                </span>
              </h2>

              {/* Persistent Queue Count Badge */}
              <span className="bg-amber-100 text-amber-900 font-bold px-2.5 py-0.5 rounded-full text-xs border border-amber-300">
                {stats.total} Receipts Loaded
              </span>
            </div>

            {/* Quick Metrics */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1.5 font-medium">
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span>{stats.pending} Pending</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-emerald-700">{stats.success} Ready to Review</span>
              </span>
              {stats.errors > 0 && (
                <>
                  <span>•</span>
                  <span className="flex items-center space-x-1 text-red-600">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span>{stats.errors} Failed</span>
                  </span>
                </>
              )}
              <span>•</span>
              <span className="text-emerald-700 text-[11px] font-medium">
                {uploadProgress
                  ? `Uploading ${uploadProgress.current}/${uploadProgress.total} to shared cloud queue...`
                  : 'Cloud-synced across Mobile & PC'}
              </span>
            </div>
          </div>

          {/* Action Tools & Book Assignation */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Active Book Assignment Input */}
            <div className="flex items-center space-x-1.5 bg-gray-50 border border-gray-300 rounded-xl px-2.5 py-1.5">
              <BookOpen className="w-3.5 h-3.5 text-amber-700" />
              <label className="text-[11px] font-bold text-gray-600 uppercase">Book #:</label>
              <input
                type="text"
                value={activeBookNumber}
                onChange={(e) => setActiveBookNumber(e.target.value)}
                placeholder="e.g. 01 or B-12"
                className="w-24 text-xs font-mono font-bold text-gray-900 bg-white border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Hidden File Input with MULTIPLE=true */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {/* Multi-Select Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Receipts (Multi-Select)</span>
            </button>

            {/* Batch OCR Execution */}
            <button
              onClick={handleRunBatchOCR}
              disabled={isBatchProcessing || isProcessingSingle || stats.pending === 0}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <Zap className="w-3.5 h-3.5 fill-emerald-200" />
              <span>
                {isBatchProcessing
                  ? `Processing ${batchProgress.current}/${batchProgress.total}...`
                  : `Run OCR on All Pending (${stats.pending})`}
              </span>
            </button>

            {/* AI Model Selector */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5 flex items-center space-x-1.5 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              <select
                value={activeModel}
                onChange={(e) => onChangeModel(e.target.value)}
                disabled={isProcessingSingle || isBatchProcessing}
                className="bg-white border border-amber-300 rounded px-1.5 py-0.5 text-gray-800 font-medium text-xs focus:outline-none"
              >
                <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Fast)</option>
                <option value="gemini-3.5-flash">gemini-3.5-flash</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorNotice && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3 text-red-800 text-xs animate-fade-in">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">Notice: </span>
              <span>{errorNotice}</span>
            </div>
            <button onClick={() => setErrorNotice(null)} className="text-red-400 hover:text-red-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── WORKSPACE GRID: WIDE PREVIEW (8 COLS) + QUEUE SIDEBAR (4 COLS) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ════════ LEFT COLUMN: WIDE ACTIVE RECEIPT PREVIEW (8 COLS) ════════ */}
          <div className="lg:col-span-8 flex flex-col space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col min-h-[680px]">
              {/* Preview Header & Controls */}
              <div className="flex flex-wrap items-center justify-between pb-3 border-b border-gray-100 gap-2 mb-4">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 font-serif flex items-center space-x-2">
                      <span>Receipt Preview</span>
                      {selectedReceipt?.bookNumber && (
                        <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-mono font-bold px-2 py-0.2 rounded-full">
                          Book: {selectedReceipt.bookNumber}
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-gray-400">
                      {selectedReceipt
                        ? `${selectedReceipt.filename} • ${(selectedReceipt.fileSize / 1024 / 1024).toFixed(2)} MB`
                        : 'No receipt selected'}
                    </p>
                  </div>
                </div>

                {selectedReceipt && (
                  <div className="flex items-center space-x-2">
                    {/* Navigation: Prev / Next Receipt */}
                    <div className="flex items-center space-x-1 border border-gray-200 rounded-lg p-0.5 bg-gray-50 text-xs">
                      <button
                        onClick={handlePrevReceipt}
                        disabled={activeIndex <= 0}
                        title="Previous Receipt"
                        className="p-1 rounded hover:bg-white disabled:opacity-30 text-gray-600"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="px-1 text-[11px] font-mono font-bold text-gray-700">
                        {activeIndex + 1} / {filteredReceipts.length}
                      </span>
                      <button
                        onClick={handleNextReceipt}
                        disabled={activeIndex >= filteredReceipts.length - 1}
                        title="Next Receipt"
                        className="p-1 rounded hover:bg-white disabled:opacity-30 text-gray-600"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Manual Interactive Crop Toggle */}
                    <button
                      type="button"
                      onClick={() => setIsManualCropMode((v) => !v)}
                      disabled={isCropping || isProcessingSingle}
                      title="Manually draw & adjust crop box around the receipt slip"
                      className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center space-x-1 border transition-colors ${
                        isManualCropMode
                          ? 'bg-amber-700 text-white border-amber-700'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                      }`}
                    >
                      <Crop className="w-3.5 h-3.5" />
                      <span className="text-[10px]">Manual Crop</span>
                    </button>

                    {/* Auto-Crop Button */}
                    <button
                      type="button"
                      onClick={handleAutoCropSelected}
                      disabled={isCropping || isManualCropMode || isProcessingSingle}
                      title="Auto-detect slip edges & crop background"
                      className="px-2 py-1 rounded bg-gray-100 hover:bg-amber-100 text-gray-700 hover:text-amber-900 disabled:opacity-40 text-xs font-semibold flex items-center space-x-1 border border-gray-200 transition-colors"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span className="text-[10px]">Auto-Crop</span>
                    </button>

                    {/* Restore Original Photo (shown after cropping) */}
                    {selectedReceipt.originalBlob && (
                      <button
                        type="button"
                        onClick={handleResetToOriginal}
                        disabled={isCropping || isProcessingSingle}
                        title="Restore original uncropped photo"
                        className="px-2 py-1 rounded bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-700 text-xs font-semibold flex items-center space-x-1 border border-gray-200 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span className="text-[10px]">Reset</span>
                      </button>
                    )}

                    {/* Rotation Controls */}
                    <button
                      type="button"
                      onClick={() => handleRotate(-90)}
                      title="Rotate Left (90° CCW)"
                      className="px-2 py-1 rounded bg-gray-100 hover:bg-amber-100 text-gray-700 hover:text-amber-900 text-xs font-semibold flex items-center space-x-1 border border-gray-200 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span className="text-[10px]">↺ 90°</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRotate(90)}
                      title="Rotate Right (90° CW)"
                      className="px-2 py-1 rounded bg-gray-100 hover:bg-amber-100 text-gray-700 hover:text-amber-900 text-xs font-semibold flex items-center space-x-1 border border-gray-200 transition-colors"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span className="text-[10px]">↻ 90°</span>
                    </button>

                    {/* Delete Item */}
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(selectedReceipt.id)}
                      title="Delete this receipt photo"
                      className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Wide Image Canvas Container */}
              <div className="relative flex-1 min-h-[550px] bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center p-4 border border-gray-300 shadow-inner">
                {isCropping && (
                  <div className="absolute inset-0 bg-slate-900/80 z-20 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-amber-400 border-t-transparent mb-2" />
                    <p className="text-xs font-semibold text-amber-200">Auto-orienting & tightly cropping slip...</p>
                  </div>
                )}

                {selectedReceipt ? (
                  isManualCropMode && (selectedReceipt.imageUrl || selectedReceipt.previewUrl) ? (
                    <ManualCropper
                      imageUrl={selectedReceipt.imageUrl || selectedReceipt.previewUrl || ''}
                      rotation={selectedReceipt.rotation}
                      onApplyCrop={handleApplyManualCrop}
                      onCancel={() => setIsManualCropMode(false)}
                    />
                  ) : (
                    <img
                      src={selectedReceipt.previewUrl || selectedReceipt.imageUrl}
                      alt={selectedReceipt.filename}
                      style={{ transform: `rotate(${selectedReceipt.rotation}deg)` }}
                      className="max-h-[580px] max-w-full w-auto object-contain rounded-lg shadow-2xl transition-transform duration-200"
                    />
                  )
                ) : (
                  /* Empty Queue Dropzone */
                  <label
                    htmlFor="wide-preview-dropzone-input"
                    className="cursor-pointer flex flex-col items-center justify-center text-center p-8 max-w-md w-full border-2 border-dashed border-slate-700 hover:border-amber-400 rounded-2xl transition-all group"
                  >
                    <div className="w-16 h-16 rounded-full bg-slate-800 group-hover:bg-amber-900/40 border border-slate-700 group-hover:border-amber-500/50 flex items-center justify-center mb-4 transition-all shadow-md">
                      <Upload className="w-8 h-8 text-amber-400 group-hover:scale-110 transition-transform" />
                    </div>
                    <h4 className="text-base font-bold text-white mb-1">
                      Upload Receipts to Get Started
                    </h4>
                    <p className="text-xs text-slate-400 max-w-xs mb-4">
                      Drag & drop up to 50 receipts at once, or click to multi-select files.
                    </p>
                    <span className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center space-x-1.5">
                      <Camera className="w-3.5 h-3.5" />
                      <span>Select Receipts (Multi-Select)</span>
                    </span>
                    <input
                      id="wide-preview-dropzone-input"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Bottom Action Footer for Selected Receipt */}
              {selectedReceipt && (
                <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center space-x-2 text-xs">
                    {selectedReceipt.status === 'PENDING' && (
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-semibold flex items-center space-x-1 border border-slate-200">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        <span>Ready for OCR</span>
                      </span>
                    )}
                    {selectedReceipt.status === 'PROCESSING' && (
                      <span className="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full font-semibold flex items-center space-x-1.5 border border-amber-300">
                        <div className="inline-block animate-spin rounded-full h-3 w-3 border-2 border-amber-700 border-t-transparent" />
                        <span>Running AI Extraction...</span>
                      </span>
                    )}
                    {selectedReceipt.status === 'SUCCESS' && (
                      <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-bold flex items-center space-x-1 border border-emerald-300">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>OCR Extracted • Ready for Review</span>
                      </span>
                    )}
                    {selectedReceipt.status === 'ERROR' && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                        <span className="bg-red-100 text-red-800 px-2.5 py-1 rounded-full font-bold flex items-center space-x-1 border border-red-300">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                          <span>Extraction Failed</span>
                        </span>
                        {selectedReceipt.error && (
                          <span className="text-[11px] text-red-700 max-w-sm truncate" title={selectedReceipt.error}>
                            ({selectedReceipt.error})
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Primary Action Button */}
                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    {selectedReceipt.status === 'SUCCESS' ? (
                      <button
                        onClick={() => handleOpenReview(selectedReceipt)}
                        className="w-full sm:w-auto px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center space-x-1.5 transition-all"
                      >
                        <Eye className="w-4 h-4" />
                        <span>REVIEW & VERIFY EXTRACTION →</span>
                      </button>
                    ) : selectedReceipt.status === 'ERROR' ? (
                      <button
                        onClick={() => handleRunOCRForReceipt(selectedReceipt, true)}
                        disabled={isProcessingSingle || isBatchProcessing}
                        className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center space-x-1.5 transition-all"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>RETRY OCR EXTRACTION</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRunOCRForReceipt(selectedReceipt, true)}
                        disabled={isProcessingSingle || isBatchProcessing}
                        className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center space-x-1.5 transition-all"
                      >
                        <Zap className="w-4 h-4 fill-amber-200" />
                        <span>
                          {isProcessingSingle ? 'PROCESSING RECEIPT...' : 'RUN OCR ON THIS RECEIPT'}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ════════ RIGHT COLUMN: PERSISTENT QUEUE & BOOK MANAGER (4 COLS) ════════ */}
          <div className="lg:col-span-4 flex flex-col space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col min-h-[680px]">
              {/* Queue Header & Filters */}
              <div className="pb-3 border-b border-gray-100 mb-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Layers className="w-4 h-4 text-amber-700" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                      Receipt Queue ({filteredReceipts.length})
                    </h3>
                  </div>

                  {/* Clear & Sync Actions */}
                  <div className="flex items-center space-x-2 text-[11px]">
                    <button
                      type="button"
                      onClick={loadStoredQueue}
                      disabled={isLoadingStore}
                      className="flex items-center space-x-1 text-amber-700 hover:text-amber-900 font-semibold px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 border border-amber-200"
                      title="Refresh shared queue from Mobile / Cloud"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingStore ? 'animate-spin' : ''}`} />
                      <span>Sync</span>
                    </button>
                    {stats.success > 0 && (
                      <button
                        onClick={handleClearCompleted}
                        className="text-gray-500 hover:text-amber-800 font-semibold"
                        title="Clear completed receipts from queue"
                      >
                        Clear Completed
                      </button>
                    )}
                    {receipts.length > 0 && (
                      <button
                        onClick={handleClearAll}
                        className="text-gray-400 hover:text-red-600"
                        title="Clear all receipts"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                {/* Book Filter Chips */}
                {distinctBooks.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Book:</span>
                    <button
                      onClick={() => setSelectedBookFilter('ALL')}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors ${
                        selectedBookFilter === 'ALL'
                          ? 'bg-amber-700 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      All ({receipts.length})
                    </button>
                    {distinctBooks.map((b) => {
                      const count = receipts.filter((r) => r.bookNumber === b).length;
                      return (
                        <button
                          key={b}
                          onClick={() => setSelectedBookFilter(b)}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors ${
                            selectedBookFilter === b
                              ? 'bg-amber-700 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          Book {b} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Status Filter Tabs */}
                <div className="flex items-center justify-between bg-gray-100 p-0.5 rounded-lg text-[10px] font-semibold text-gray-600">
                  <button
                    onClick={() => setStatusFilter('ALL')}
                    className={`flex-1 py-1 rounded text-center transition-all ${
                      statusFilter === 'ALL' ? 'bg-white text-gray-900 shadow-sm font-bold' : ''
                    }`}
                  >
                    All ({receipts.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('PENDING')}
                    className={`flex-1 py-1 rounded text-center transition-all ${
                      statusFilter === 'PENDING' ? 'bg-white text-gray-900 shadow-sm font-bold' : ''
                    }`}
                  >
                    Pending ({stats.pending})
                  </button>
                  <button
                    onClick={() => setStatusFilter('SUCCESS')}
                    className={`flex-1 py-1 rounded text-center transition-all ${
                      statusFilter === 'SUCCESS' ? 'bg-white text-emerald-700 shadow-sm font-bold' : ''
                    }`}
                  >
                    Ready ({stats.success})
                  </button>
                </div>
              </div>

              {/* Scrollable Receipt Queue List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[520px]">
                {filteredReceipts.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <Layers className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-gray-600">No receipts in this filter</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Drag & drop images or click "Add Receipts" to add up to 50 receipts per book.
                    </p>
                  </div>
                ) : (
                  filteredReceipts.map((item, idx) => {
                    const isSelected = selectedReceipt?.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center space-x-2.5 ${
                          isSelected
                            ? 'bg-amber-50/80 border-amber-400 ring-1 ring-amber-400 shadow-sm'
                            : 'bg-white border-gray-200 hover:border-amber-300 hover:bg-gray-50'
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="w-14 h-14 rounded-lg bg-slate-900 flex-shrink-0 overflow-hidden flex items-center justify-center border border-gray-200">
                          <img
                            src={item.previewUrl}
                            alt=""
                            style={{ transform: `rotate(${item.rotation}deg)` }}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Metadata */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-800 truncate">
                              #{idx + 1}. {item.filename}
                            </span>
                            {/* Delete Button */}
                            <button
                              onClick={(e) => handleDeleteItem(item.id, e)}
                              className="text-gray-400 hover:text-red-600 p-0.5 rounded"
                              title="Delete photo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center space-x-1.5 mt-0.5 text-[10px] text-gray-500">
                            {item.bookNumber && (
                              <span className="font-mono bg-gray-100 text-gray-700 px-1.5 py-0.2 rounded font-semibold">
                                B:{item.bookNumber}
                              </span>
                            )}
                            {item.deviceLabel && (
                              <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
                                {item.deviceLabel}
                              </span>
                            )}
                            <span>{(item.fileSize / 1024 / 1024).toFixed(1)} MB</span>
                          </div>

                          {/* Status Badge */}
                          <div className="mt-1 flex items-center justify-between">
                            {item.status === 'PENDING' && (
                              <span className="text-[10px] text-gray-500 flex items-center space-x-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                <span>Pending</span>
                              </span>
                            )}
                            {item.status === 'PROCESSING' && (
                              <span className="text-[10px] text-amber-700 font-semibold flex items-center space-x-1 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span>OCR running...</span>
                              </span>
                            )}
                            {item.status === 'SUCCESS' && (
                              <span className="text-[10px] text-emerald-700 font-bold flex items-center space-x-1">
                                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Extracted</span>
                              </span>
                            )}
                            {item.status === 'ERROR' && (
                              <span className="text-[10px] text-red-600 font-bold flex items-center space-x-1">
                                <AlertTriangle className="w-3 h-3 text-red-500" />
                                <span>Error</span>
                              </span>
                            )}

                            {item.status === 'SUCCESS' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenReview(item);
                                }}
                                className="text-[10px] text-amber-800 hover:text-amber-950 font-bold underline"
                              >
                                Review →
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Multi-Select Add Strip */}
              <div className="pt-3 border-t border-gray-100 mt-2">
                <input
                  ref={addMoreInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <button
                  onClick={() => addMoreInputRef.current?.click()}
                  className="w-full py-2 bg-gray-50 hover:bg-amber-50 border border-dashed border-gray-300 hover:border-amber-400 rounded-xl text-xs font-semibold text-gray-700 hover:text-amber-900 flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-700" />
                  <span>Add More Receipts (Multi-Select)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
