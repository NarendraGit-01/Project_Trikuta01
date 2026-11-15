import React, { useEffect, useState } from 'react';
import {
  Search,
  FileText,
  CheckCircle,
  AlertTriangle,
  Clock,
  Eye,
  Download,
  Folder,
  FolderOpen,
  FolderArchive,
  Layers,
  Edit2,
  X,
  Check,
  RotateCcw,
  BookOpen,
  Trash2,
  ArchiveRestore,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { listReceipts, fetchBooksSummary, updateReceipt, deleteReceiptPermanent, batchDeleteReceiptsPermanent } from '../services/api';
import { ReceiptListItem, BooksSummaryResponse, BookFolderItem } from '../types';

const API_BASE = '/api/v1';

async function archiveReceipt(id: number, reason = 'Deleted by user'): Promise<void> {
  const res = await fetch(`${API_BASE}/receipts/${id}?reason=${encodeURIComponent(reason)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to archive receipt');
}

async function restoreReceipt(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/receipts/${id}/restore`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to restore receipt');
}

interface ReceiptListPageProps {
  selectedYear?: number | null;
  onSelectYear?: (year: number | null) => void;
  onSelectReceipt: (receiptId: number) => void;
  onNewScan: () => void;
}

export const ReceiptListPage: React.FC<ReceiptListPageProps> = ({ selectedYear, onSelectYear, onSelectReceipt, onNewScan }) => {
  const [receipts, setReceipts] = useState<ReceiptListItem[]>([]);
  const [booksSummary, setBooksSummary] = useState<BooksSummaryResponse | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>(''); // '' = All, or book_number, or '__UNASSIGNED__'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivingId, setArchivingId] = useState<number | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [permanentDeletingId, setPermanentDeletingId] = useState<number | null>(null);
  const [isBatchActionLoading, setIsBatchActionLoading] = useState(false);

  // Sorting and multi-selection
  const [sortBy, setSortBy] = useState<'id_desc' | 'receipt_no_asc' | 'receipt_no_desc' | 'date_desc'>('id_desc');
  const [selectedArchivedIds, setSelectedArchivedIds] = useState<Set<number>>(new Set());

  // Clear selections when switching between active and archived views
  useEffect(() => {
    setSelectedArchivedIds(new Set());
  }, [showArchived]);

  // Derived sorted receipts list
  const sortedReceipts = React.useMemo(() => {
    const list = [...receipts];
    if (sortBy === 'receipt_no_asc') {
      list.sort((a, b) => {
        const numA = parseInt(a.receipt_no.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.receipt_no.replace(/\D/g, ''), 10) || 0;
        if (numA !== numB) return numA - numB;
        return a.receipt_no.localeCompare(b.receipt_no);
      });
    } else if (sortBy === 'receipt_no_desc') {
      list.sort((a, b) => {
        const numA = parseInt(a.receipt_no.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.receipt_no.replace(/\D/g, ''), 10) || 0;
        if (numA !== numB) return numB - numA;
        return b.receipt_no.localeCompare(a.receipt_no);
      });
    } else if (sortBy === 'date_desc') {
      list.sort((a, b) => (b.receipt_date || '').localeCompare(a.receipt_date || ''));
    } else {
      list.sort((a, b) => b.id - a.id);
    }
    return list;
  }, [receipts, sortBy]);

  // Quick edit book number modal state
  const [editingReceipt, setEditingReceipt] = useState<{
    id: number;
    receipt_no: string;
    current_book: string;
  } | null>(null);
  const [newBookValue, setNewBookValue] = useState('');
  const [isUpdatingBook, setIsUpdatingBook] = useState(false);

  const loadData = async (activeFolder = selectedFolder, reloadSummary = false) => {
    setLoading(true);
    try {
      const shouldFetchSummary = reloadSummary || !booksSummary;
      const [listData, summaryData] = await Promise.all([
        listReceipts({
          q: searchQuery || undefined,
          status: statusFilter || undefined,
          book_number: activeFolder || undefined,
          receipt_year: selectedYear,
          archived_only: showArchived,
          limit: 100,
        }),
        shouldFetchSummary ? fetchBooksSummary(selectedYear).catch(() => null) : Promise.resolve(null),
      ]);
      setReceipts(listData);
      if (summaryData) {
        setBooksSummary(summaryData);
      }
    } catch (err) {
      console.error('Error loading receipts list or book summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedFolder);
  }, [selectedFolder, statusFilter, showArchived, selectedYear]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData(selectedFolder);
  };

  const handleSelectFolder = (bookNo: string) => {
    const nextFolder = selectedFolder === bookNo ? '' : bookNo;
    setSelectedFolder(nextFolder);
  };

  const handleExportExcel = (bookNo?: string) => {
    const params = new URLSearchParams();
    if (statusFilter) params.append('status_filter', statusFilter);
    if (selectedYear) params.append('receipt_year', String(selectedYear));
    if (bookNo) {
      params.append('book_number', bookNo);
    } else if (selectedFolder) {
      params.append('book_number', selectedFolder);
    }
    const url = `/api/v1/receipts/export/excel?${params.toString()}`;
    window.open(url, '_blank');
  };

  const handleOpenEditBook = (r: ReceiptListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingReceipt({
      id: r.id,
      receipt_no: r.receipt_no,
      current_book: r.book_number || '',
    });
    setNewBookValue(r.book_number || '');
  };

  const handleSaveBookNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReceipt) return;
    setIsUpdatingBook(true);
    try {
      const trimmed = newBookValue.trim();
      await updateReceipt(editingReceipt.id, {
        book_number: trimmed || null,
      });
      setEditingReceipt(null);
      await loadData(selectedFolder);
    } catch (err: any) {
      alert(`Failed to update book number: ${err.message || 'Unknown error'}`);
    } finally {
      setIsUpdatingBook(false);
    }
  };

  const handleArchive = async (r: ReceiptListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Archive receipt #${r.receipt_no}? It will be moved to the archive and can be restored later.`)) return;
    setArchivingId(r.id);
    try {
      await archiveReceipt(r.id);
      await loadData(selectedFolder);
    } catch (err: any) {
      alert(`Failed to archive: ${err.message || 'Unknown error'}`);
    } finally {
      setArchivingId(null);
    }
  };

  const handleRestore = async (r: ReceiptListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setRestoringId(r.id);
    try {
      await restoreReceipt(r.id);
      await loadData(selectedFolder);
    } catch (err: any) {
      alert(`Failed to restore: ${err.message || 'Unknown error'}`);
    } finally {
      setRestoringId(null);
    }
  };

  const handleBatchPermanentDelete = async () => {
    if (selectedArchivedIds.size === 0) return;
    const count = selectedArchivedIds.size;
    if (
      !confirm(
        `Are you sure you want to PERMANENTLY delete ${count} archived receipts? This action cannot be undone and will permanently remove them from the database.`
      )
    ) {
      return;
    }
    setIsBatchActionLoading(true);
    try {
      await batchDeleteReceiptsPermanent(Array.from(selectedArchivedIds));
      setSelectedArchivedIds(new Set());
      await loadData(selectedFolder, true);
    } catch (err: any) {
      alert(`Failed to permanently delete receipts: ${err.message || 'Unknown error'}`);
    } finally {
      setIsBatchActionLoading(false);
    }
  };

  const handleSinglePermanentDelete = async (r: ReceiptListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !confirm(
        `Are you sure you want to PERMANENTLY delete receipt #${r.receipt_no}? This will permanently remove it from the database.`
      )
    ) {
      return;
    }
    setPermanentDeletingId(r.id);
    try {
      await deleteReceiptPermanent(r.id);
      setSelectedArchivedIds((prev) => {
        const next = new Set(prev);
        next.delete(r.id);
        return next;
      });
      await loadData(selectedFolder, true);
    } catch (err: any) {
      alert(`Failed to delete receipt: ${err.message || 'Unknown error'}`);
    } finally {
      setPermanentDeletingId(null);
    }
  };

  const handleBatchRestore = async () => {
    if (selectedArchivedIds.size === 0) return;
    setIsBatchActionLoading(true);
    try {
      const ids = Array.from(selectedArchivedIds);
      for (const id of ids) {
        await restoreReceipt(id).catch(() => {});
      }
      setSelectedArchivedIds(new Set());
      await loadData(selectedFolder, true);
    } catch (err: any) {
      alert(`Failed to restore receipts: ${err.message || 'Unknown error'}`);
    } finally {
      setIsBatchActionLoading(false);
    }
  };

  // Compute label for currently viewing folder
  const getSelectedFolderLabel = () => {
    const archiveSuffix = showArchived ? ' — Archive' : '';
    if (!selectedFolder) return `All Receipts (అన్ని రసీదులు)${archiveSuffix}`;
    if (selectedFolder === '__UNASSIGNED__') return `Unassigned (పుస్తకం లేనివి)${archiveSuffix}`;
    return `Book #${selectedFolder}${archiveSuffix}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 font-serif">
            రసీదుల జాబితా (Temple Receipts Database)
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Categorized by book numbers. Filter by folders, edit book assignments, and export individual or overall Excel workbooks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Compact English Year Filter */}
          <div className="flex items-center space-x-1.5 bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 shadow-xs text-xs">
            <span className="font-semibold text-gray-600 text-[11px]">Year:</span>
            <select
              value={selectedYear ?? ''}
              onChange={(e) => onSelectYear && onSelectYear(e.target.value ? Number(e.target.value) : null)}
              className="font-mono font-bold text-gray-900 bg-transparent focus:outline-none cursor-pointer text-xs"
              title="Filter receipts by Year"
            >
              <option value="">All Years</option>
              <option value="2027">2027</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>

          <button
            onClick={() => setShowArchived(a => !a)}
            className={`px-3.5 py-2 font-bold text-xs rounded-xl shadow transition-colors flex items-center space-x-1.5 ${
              showArchived
                ? 'bg-slate-700 hover:bg-slate-800 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
            }`}
            title={showArchived ? 'Back to active receipts' : 'View archived/deleted receipts'}
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>{showArchived ? '← Back to Active' : 'View Archive'}</span>
            {!showArchived && (booksSummary as any)?.archived_count ? (
              <span className="bg-slate-700 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {(booksSummary as any).archived_count}
              </span>
            ) : null}
          </button>
          {selectedFolder && (
            <button
              onClick={() => handleExportExcel(selectedFolder)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center space-x-1.5"
              title="Download Excel specifically for the selected folder"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export {selectedFolder === '__UNASSIGNED__' ? 'Unassigned' : `Book #${selectedFolder}`}</span>
            </button>
          )}
          <button
            onClick={() => handleExportExcel('')}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center space-x-1.5"
            title="Download consolidated Excel workbook with all receipts across all books"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export All to Excel</span>
          </button>
          <button
            onClick={onNewScan}
            className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center space-x-1.5"
          >
            <span>+ Scan New Receipt</span>
          </button>
        </div>
      </div>

      {/* ── CATEGORIZED BOOK FOLDERS SECTION ─────────────────── */}
      <div className="mb-6 bg-gradient-to-br from-amber-50/70 via-white to-amber-100/30 p-5 rounded-2xl border border-amber-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-amber-600 text-white rounded-lg shadow-sm">
              <Folder className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-950">
                పుస్తకాల వారీగా రసీదులు (Receipts by Book Folders)
              </h3>
              <p className="text-[11px] text-amber-800/80">
                Click any folder to filter receipts or click its Excel icon to export that book individually.
              </p>
            </div>
          </div>

          {selectedFolder && (
            <button
              onClick={() => setSelectedFolder('')}
              className="text-xs font-semibold text-amber-800 hover:text-amber-950 flex items-center space-x-1 bg-amber-200/60 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Show All Folders</span>
            </button>
          )}
        </div>

        {/* Folders Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {/* Card: All Folders */}
          <div
            onClick={() => setSelectedFolder('')}
            className={`cursor-pointer rounded-xl p-3.5 border transition-all relative ${
              selectedFolder === ''
                ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-500/50'
                : 'bg-white hover:bg-amber-50/60 text-gray-800 border-gray-200 shadow-sm hover:border-amber-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div
                  className={`p-2 rounded-lg ${
                    selectedFolder === '' ? 'bg-amber-700/80 text-amber-100' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold font-serif leading-tight">All Receipts</h4>
                  <p className={`text-[10px] ${selectedFolder === '' ? 'text-amber-100' : 'text-gray-500'}`}>
                    మొత్తం రసీదులు
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleExportExcel('');
                }}
                className={`p-1.5 rounded-lg text-[10px] flex items-center space-x-1 font-semibold transition-colors ${
                  selectedFolder === ''
                    ? 'bg-amber-700 hover:bg-amber-800 text-white'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
                title="Download consolidated Excel for all books"
              >
                <Download className="w-3 h-3" />
                <span>Excel</span>
              </button>
            </div>

            <div className="mt-3 pt-2.5 border-t border-current/10 flex items-center justify-between text-[11px]">
              <span className="font-bold text-xs">
                {booksSummary?.total_all ?? receipts.length} <span className="font-normal text-[10px] opacity-80">Total</span>
              </span>
              <div className="flex items-center space-x-1.5 text-[10px]">
                <span
                  className={`px-1.5 py-0.5 rounded font-semibold ${
                    selectedFolder === ''
                      ? 'bg-emerald-900/40 text-emerald-100'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  ✓ {booksSummary?.processed_all ?? 0}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded font-semibold ${
                    selectedFolder === '' ? 'bg-amber-900/40 text-amber-100' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  ⏳ {booksSummary?.pending_all ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* Book Folders */}
          {booksSummary?.folders?.map((folder) => {
            const isSelected = selectedFolder === folder.book_number;
            const isUnassigned = folder.book_number === '__UNASSIGNED__';

            return (
              <div
                key={folder.book_number}
                onClick={() => handleSelectFolder(folder.book_number)}
                className={`cursor-pointer rounded-xl p-3.5 border transition-all relative ${
                  isSelected
                    ? 'bg-amber-600 text-white border-amber-700 shadow-md ring-2 ring-amber-500/50'
                    : isUnassigned
                    ? 'bg-white hover:bg-slate-50 text-gray-800 border-dashed border-gray-300 shadow-sm hover:border-gray-400'
                    : 'bg-white hover:bg-amber-50/60 text-gray-800 border-gray-200 shadow-sm hover:border-amber-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div
                      className={`p-2 rounded-lg ${
                        isSelected
                          ? 'bg-amber-700/80 text-amber-100'
                          : isUnassigned
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isUnassigned ? (
                        <FolderOpen className="w-4 h-4" />
                      ) : (
                        <Folder className="w-4 h-4 fill-current/20" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold leading-tight font-mono">
                        {isUnassigned ? 'Unassigned' : `Book #${folder.book_number}`}
                      </h4>
                      <p className={`text-[10px] ${isSelected ? 'text-amber-100' : 'text-gray-400'}`}>
                        {isUnassigned ? 'పుస్తకం లేనివి' : `పుస్తకం నెం. ${folder.book_number}`}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportExcel(folder.book_number);
                    }}
                    className={`p-1.5 rounded-lg text-[10px] flex items-center space-x-1 font-semibold transition-colors ${
                      isSelected
                        ? 'bg-amber-700 hover:bg-amber-800 text-white'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                    title={`Download Excel specifically for Book #${folder.book_number}`}
                  >
                    <Download className="w-3 h-3" />
                    <span>Excel</span>
                  </button>
                </div>

                <div className="mt-3 pt-2.5 border-t border-current/10 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-xs">
                    {folder.total} <span className="font-normal text-[10px] opacity-80">Receipts</span>
                  </span>
                  <div className="flex items-center space-x-1.5 text-[10px]">
                    <span
                      className={`px-1.5 py-0.5 rounded font-semibold ${
                        isSelected
                          ? 'bg-emerald-900/40 text-emerald-100'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                      title={`${folder.processed} Processed & Confirmed`}
                    >
                      ✓ {folder.processed}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-semibold ${
                        isSelected
                          ? 'bg-amber-900/40 text-amber-100'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                      title={`${folder.pending} Pending Review`}
                    >
                      ⏳ {folder.pending}
                    </span>
                  </div>
                </div>

                {isSelected && (
                  <div className="absolute top-2 right-14">
                    <span className="bg-amber-800 text-amber-200 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                      Selected
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── SEARCH & FILTERS BAR ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm mb-6">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by receipt #, devotee name, mobile number, or gothram..."
              className="w-full pl-9 pr-4 py-2 text-xs border border-gray-300 rounded-xl text-gray-800 focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            {/* Active Folder Badge if filtered */}
            {selectedFolder && (
              <div className="flex items-center space-x-1 bg-amber-100 text-amber-900 px-3 py-1.5 rounded-xl text-xs font-semibold border border-amber-200">
                <span>Folder: {selectedFolder === '__UNASSIGNED__' ? 'Unassigned' : `Book #${selectedFolder}`}</span>
                <button
                  type="button"
                  onClick={() => setSelectedFolder('')}
                  className="hover:text-amber-950 p-0.5 rounded"
                  title="Remove folder filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-gray-300 rounded-xl px-3 py-2 text-gray-700 bg-white"
            >
              <option value="">All Statuses</option>
              <option value="CONFIRMED">Confirmed Only</option>
              <option value="PENDING_VERIFICATION">Pending Verification</option>
              <option value="INCOMPLETE">Incomplete Only</option>
            </select>

            {/* Sort Dropdown */}
            <div className="flex items-center space-x-1.5 bg-gray-50 border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs text-gray-800 bg-transparent focus:outline-none font-semibold cursor-pointer"
                title="Sort receipt list"
              >
                <option value="id_desc">Newest First (ID ↓)</option>
                <option value="receipt_no_asc">Receipt # (1 → 9999) ↑</option>
                <option value="receipt_no_desc">Receipt # (9999 → 1) ↓</option>
                <option value="date_desc">Date (Newest First)</option>
              </select>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-xl"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* ── BATCH ACTIONS TOOLBAR FOR ARCHIVE ────────────────── */}
      {showArchived && selectedArchivedIds.size > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center space-x-2.5 text-xs text-red-950">
            <div className="p-1.5 bg-red-100 text-red-700 rounded-lg">
              <FolderArchive className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm block">
                {selectedArchivedIds.size} రసీదులు ఎంపిక చేయబడ్డాయి ({selectedArchivedIds.size} Receipts Selected)
              </span>
              <span className="text-[11px] text-red-700">
                You can permanently delete these receipts from database or restore them to active receipts.
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleBatchRestore}
              disabled={isBatchActionLoading}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <ArchiveRestore className="w-3.5 h-3.5" />
              <span>Restore Selected ({selectedArchivedIds.size})</span>
            </button>
            <button
              type="button"
              onClick={handleBatchPermanentDelete}
              disabled={isBatchActionLoading}
              className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Permanently Delete ({selectedArchivedIds.size}) / శాశ్వతంగా తొలగించండి</span>
            </button>
          </div>
        </div>
      )}

      {/* ── RECEIPTS TABLE ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Table Subheader */}
        <div className="px-5 py-3.5 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-gray-700">
              {getSelectedFolderLabel()}
            </span>
            <span className="text-[11px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
              {sortedReceipts.length} {sortedReceipts.length === 1 ? 'receipt' : 'receipts'}
            </span>
          </div>
          {selectedFolder && (
            <span className="text-[11px] text-gray-500">
              Showing receipts strictly assigned to this book folder.
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 text-xs">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-amber-600 border-t-transparent mb-2" />
            <p>Loading receipts...</p>
          </div>
        ) : sortedReceipts.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-xs">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="font-semibold text-gray-600">No receipts found in this folder</p>
            <p className="mt-1">Change your search query or select another book folder.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  {showArchived && (
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={sortedReceipts.length > 0 && selectedArchivedIds.size === sortedReceipts.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedArchivedIds(new Set(sortedReceipts.map((r) => r.id)));
                          } else {
                            setSelectedArchivedIds(new Set());
                          }
                        }}
                        className="rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                        title="Select all archived receipts"
                      />
                    </th>
                  )}
                  <th
                    className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                    onClick={() => setSortBy(prev => prev === 'receipt_no_asc' ? 'receipt_no_desc' : 'receipt_no_asc')}
                    title="Click to sort by Receipt Number"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Receipt #</span>
                      {sortBy === 'receipt_no_asc' && <ArrowUp className="w-3.5 h-3.5 text-amber-700" />}
                      {sortBy === 'receipt_no_desc' && <ArrowDown className="w-3.5 h-3.5 text-amber-700" />}
                      {sortBy !== 'receipt_no_asc' && sortBy !== 'receipt_no_desc' && <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />}
                    </div>
                  </th>
                  <th className="py-3 px-4">Book # (Folder)</th>
                  <th className="py-3 px-4">Devotee Name</th>
                  <th className="py-3 px-4">Gothram (గోత్రం)</th>
                  <th className="py-3 px-4">Abhishekam Period</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedReceipts.map((r) => {
                  let badge = (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                      <Clock className="w-3 h-3" />
                      <span>Pending Verification</span>
                    </span>
                  );
                  if (r.status === 'CONFIRMED') {
                    badge = (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        <CheckCircle className="w-3 h-3" />
                        <span>Confirmed</span>
                      </span>
                    );
                  } else if (r.status === 'INCOMPLETE') {
                    badge = (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Incomplete</span>
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-amber-50/40 transition-colors ${
                        selectedArchivedIds.has(r.id) ? 'bg-red-50/60' : ''
                      }`}
                    >
                      {showArchived && (
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedArchivedIds.has(r.id)}
                            onChange={(e) => {
                              setSelectedArchivedIds((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) {
                                  next.add(r.id);
                                } else {
                                  next.delete(r.id);
                                }
                                return next;
                              });
                            }}
                            className="rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">
                        #{r.receipt_no}
                      </td>
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center space-x-1.5 group">
                          {r.book_number ? (
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-amber-100/70 text-amber-900 border border-amber-200">
                              Book #{r.book_number}
                            </span>
                          ) : (
                            <span className="text-gray-400 font-normal italic text-[11px]">
                              Unassigned
                            </span>
                          )}
                          <button
                            onClick={(e) => handleOpenEditBook(r, e)}
                            className="p-1 rounded text-gray-400 hover:text-amber-800 hover:bg-amber-100 transition-colors opacity-70 group-hover:opacity-100"
                            title="Quick Move to another Book Folder"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-900 font-medium">
                        {r.primary_devotee || <span className="text-gray-400 italic">Not recorded</span>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-800">{r.gothram_en || '—'}</div>
                        {r.gothram_te && (
                          <div className="text-[11px] text-gray-500 font-telugu">{r.gothram_te}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-gray-600">
                        {r.abhishekam_from ? `${r.abhishekam_from} to ${r.abhishekam_to}` : '—'}
                      </td>
                      <td className="py-3 px-4">{badge}</td>
                      <td className="py-3 px-4 text-gray-500 font-mono text-[11px]">
                        {r.receipt_date || r.created_at?.slice(0, 10)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center space-x-1 justify-end">
                          {!r.is_archived && (
                            <>
                              <button
                                onClick={() => onSelectReceipt(r.id)}
                                className="px-2.5 py-1 text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 inline-flex items-center space-x-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Review</span>
                              </button>
                              <button
                                onClick={(e) => handleArchive(r, e)}
                                disabled={archivingId === r.id}
                                className="px-2 py-1 text-xs font-semibold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 inline-flex items-center space-x-1 disabled:opacity-50 cursor-pointer"
                                title="Archive (soft delete) this receipt"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {r.is_archived && (
                            <>
                              <button
                                onClick={(e) => handleRestore(r, e)}
                                disabled={restoringId === r.id || isBatchActionLoading}
                                className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 inline-flex items-center space-x-1 disabled:opacity-50 cursor-pointer"
                                title="Restore this receipt from archive"
                              >
                                <ArchiveRestore className="w-3.5 h-3.5" />
                                <span>Restore</span>
                              </button>
                              <button
                                onClick={(e) => handleSinglePermanentDelete(r, e)}
                                disabled={permanentDeletingId === r.id || isBatchActionLoading}
                                className="px-2 py-1 text-xs font-semibold text-red-700 hover:text-red-900 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 inline-flex items-center space-x-1 disabled:opacity-50 cursor-pointer"
                                title="Permanently delete from database"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── QUICK REASSIGN BOOK NUMBER MODAL ─────────────────── */}
      {editingReceipt && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 animate-scale-up">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                  <Folder className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-gray-900">
                  Move Receipt #{editingReceipt.receipt_no}
                </h3>
              </div>
              <button
                onClick={() => setEditingReceipt(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              Enter or select a Book Number to immediately transfer this receipt into that categorized folder.
            </p>

            <form onSubmit={handleSaveBookNumber}>
              <div className="mb-4">
                <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                  Book Number
                </label>
                <input
                  type="text"
                  value={newBookValue}
                  onChange={(e) => setNewBookValue(e.target.value)}
                  placeholder="e.g. 001 or BOOK-12"
                  list="existing-books-list"
                  autoFocus
                  className="w-full text-xs font-mono border border-gray-300 rounded-xl px-3 py-2 text-gray-800 focus:ring-2 focus:ring-amber-500"
                />
                <datalist id="existing-books-list">
                  {booksSummary?.folders
                    ?.filter((f) => f.book_number !== '__UNASSIGNED__')
                    .map((f) => (
                      <option key={f.book_number} value={f.book_number} />
                    ))}
                </datalist>
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Leave empty to mark as Unassigned.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingReceipt(null)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingBook}
                  className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-xl shadow disabled:opacity-50 flex items-center space-x-1"
                >
                  {isUpdatingBook ? (
                    <span>Moving...</span>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Move to Folder</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
