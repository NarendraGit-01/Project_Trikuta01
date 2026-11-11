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
  BookOpen
} from 'lucide-react';
import { listReceipts, fetchBooksSummary, updateReceipt } from '../services/api';
import { ReceiptListItem, BooksSummaryResponse, BookFolderItem } from '../types';

interface ReceiptListPageProps {
  onSelectReceipt: (receiptId: number) => void;
  onNewScan: () => void;
}

export const ReceiptListPage: React.FC<ReceiptListPageProps> = ({ onSelectReceipt, onNewScan }) => {
  const [receipts, setReceipts] = useState<ReceiptListItem[]>([]);
  const [booksSummary, setBooksSummary] = useState<BooksSummaryResponse | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>(''); // '' = All, or book_number, or '__UNASSIGNED__'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Quick edit book number modal state
  const [editingReceipt, setEditingReceipt] = useState<{
    id: number;
    receipt_no: string;
    current_book: string;
  } | null>(null);
  const [newBookValue, setNewBookValue] = useState('');
  const [isUpdatingBook, setIsUpdatingBook] = useState(false);

  const loadData = async (activeFolder = selectedFolder) => {
    setLoading(true);
    try {
      const [listData, summaryData] = await Promise.all([
        listReceipts({
          q: searchQuery || undefined,
          status: statusFilter || undefined,
          book_number: activeFolder || undefined,
          limit: 100,
        }),
        fetchBooksSummary().catch(() => null),
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
  }, [selectedFolder, statusFilter]);

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

  // Compute label for currently viewing folder
  const getSelectedFolderLabel = () => {
    if (!selectedFolder) return 'All Receipts (అన్ని రసీదులు)';
    if (selectedFolder === '__UNASSIGNED__') return 'Unassigned (పుస్తకం లేనివి)';
    return `Book #${selectedFolder}`;
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

        <div className="flex items-center space-x-2">
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

            <button
              type="submit"
              className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-xl"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* ── RECEIPTS TABLE ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Table Subheader */}
        <div className="px-5 py-3.5 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-gray-700">
              {getSelectedFolderLabel()}
            </span>
            <span className="text-[11px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
              {receipts.length} {receipts.length === 1 ? 'receipt' : 'receipts'}
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
        ) : receipts.length === 0 ? (
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
                  <th className="py-3 px-4">Receipt #</th>
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
                {receipts.map((r) => {
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
                    <tr key={r.id} className="hover:bg-amber-50/40 transition-colors">
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
                        <button
                          onClick={() => onSelectReceipt(r.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 inline-flex items-center space-x-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review</span>
                        </button>
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
