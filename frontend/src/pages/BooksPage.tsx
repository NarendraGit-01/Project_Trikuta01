import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  CheckCircle,
  Clock,
  Download,
  Edit2,
  Printer,
  ChevronRight,
  ArrowLeft,
  Search,
  Plus,
  X,
  AlertTriangle,
  Flame,
  Package,
  Layers,
  Sparkles,
  BookOpen
} from 'lucide-react';
import {
  fetchBooksSummary,
  listReceipts,
  listDetailedReceipts,
  renameBook,
  getExportExcelUrl,
  updateReceipt
} from '../services/api';
import { BooksSummaryResponse, BookFolderItem, ReceiptListItem, Receipt } from '../types';

interface BooksPageProps {
  selectedYear: number | null;
  onSelectYear?: (year: number | null) => void;
  onSelectReceipt: (receiptId: number) => void;
  onNewScanForBook: (bookNumber: string) => void;
}

export const BooksPage: React.FC<BooksPageProps> = ({
  selectedYear,
  onSelectYear,
  onSelectReceipt,
  onNewScanForBook,
}) => {
  const [summary, setSummary] = useState<BooksSummaryResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [activeBook, setActiveBook] = useState<string | null>(null);

  // Receipts inside active book folder
  const [bookReceipts, setBookReceipts] = useState<ReceiptListItem[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [receiptSearch, setReceiptSearch] = useState('');

  // Rename Book Modal State
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [bookToRename, setBookToRename] = useState<string>('');
  const [newBookNumber, setNewBookNumber] = useState<string>('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // Edit individual receipt's book assignment modal
  const [editingReceipt, setEditingReceipt] = useState<{ id: number; receipt_no: string; current_book: string } | null>(null);
  const [newReceiptBookValue, setNewReceiptBookValue] = useState('');
  const [isUpdatingReceiptBook, setIsUpdatingReceiptBook] = useState(false);

  // Load book summary when selectedYear changes
  useEffect(() => {
    loadSummary();
  }, [selectedYear]);

  // Load receipts when activeBook changes
  useEffect(() => {
    if (activeBook) {
      loadBookReceipts(activeBook);
    } else {
      setBookReceipts([]);
    }
  }, [activeBook, selectedYear]);

  const loadSummary = async () => {
    setLoadingSummary(true);
    try {
      const data = await fetchBooksSummary(selectedYear);
      setSummary(data);
    } catch (err) {
      console.error('Failed to load books summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadBookReceipts = async (bookNum: string) => {
    setLoadingReceipts(true);
    try {
      const data = await listReceipts({
        book_number: bookNum,
        receipt_year: selectedYear,
        limit: 200,
      });
      setBookReceipts(data);
    } catch (err) {
      console.error('Failed to load receipts for book:', err);
    } finally {
      setLoadingReceipts(false);
    }
  };

  // ── Rename Book Handlers ──────────────────────────────────────────
  const handleOpenRename = (bookNum: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setBookToRename(bookNum);
    setNewBookNumber(bookNum === '__UNASSIGNED__' ? '' : bookNum);
    setRenameError(null);
    setRenameModalOpen(true);
  };

  const handleSaveRename = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBookNumber.trim();
    if (!trimmed) {
      setRenameError('Book number cannot be empty.');
      return;
    }
    setIsRenaming(true);
    setRenameError(null);
    try {
      await renameBook(bookToRename, trimmed, selectedYear);
      setRenameModalOpen(false);
      await loadSummary();
      if (activeBook === bookToRename) {
        setActiveBook(trimmed);
      }
    } catch (err: any) {
      setRenameError(err.message || 'Failed to rename book');
    } finally {
      setIsRenaming(false);
    }
  };

  // ── Edit Single Receipt Book Assignment Handlers ──────────────────
  const handleOpenEditReceiptBook = (r: ReceiptListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingReceipt({
      id: r.id,
      receipt_no: r.receipt_no,
      current_book: r.book_number || '',
    });
    setNewReceiptBookValue(r.book_number || '');
  };

  const handleSaveReceiptBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReceipt) return;
    setIsUpdatingReceiptBook(true);
    try {
      const trimmed = newReceiptBookValue.trim();
      await updateReceipt(editingReceipt.id, {
        book_number: trimmed || null,
      });
      setEditingReceipt(null);
      await loadSummary();
      if (activeBook) {
        await loadBookReceipts(activeBook);
      }
    } catch (err: any) {
      alert(`Failed to update book assignment: ${err.message || 'Unknown error'}`);
    } finally {
      setIsUpdatingReceiptBook(false);
    }
  };

  // ── Export Handlers ───────────────────────────────────────────────
  const handleExportSankalpamExcel = (bookNum: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const url = getExportExcelUrl({
      bookNumber: bookNum,
      receiptYear: selectedYear,
      exportType: 'sankalpam',
    });
    window.open(url, '_blank');
  };

  const handleExportDispatchExcel = (bookNum: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const url = getExportExcelUrl({
      bookNumber: bookNum,
      receiptYear: selectedYear,
      exportType: 'dispatch',
    });
    window.open(url, '_blank');
  };

  const handleExportAllExcel = (bookNum: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const url = getExportExcelUrl({
      bookNumber: bookNum,
      receiptYear: selectedYear,
      exportType: 'all',
    });
    window.open(url, '_blank');
  };

  // ── Print Postal Labels for Book ──────────────────────────────────
  const handlePrintLabels = async (bookNum: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const receipts = await listDetailedReceipts({
        book_number: bookNum,
        receipt_year: selectedYear,
        limit: 200,
      });

      const withAddress = receipts.filter(r => (r.address_te || r.address_en || '').trim().length > 0);
      if (withAddress.length === 0) {
        alert(`No devotees with addresses found in Book #${bookNum} to print labels.`);
        return;
      }

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Please allow popups to print dispatch labels.');
        return;
      }

      const labelCards = withAddress.map(r => {
        const devoteeTe = r.persons?.map(p => `${p.surname_te || ''} ${p.given_name_te || ''}`.trim()).filter(Boolean).join(', ') || '';
        const devoteeEn = r.persons?.map(p => `${p.surname_en || ''} ${p.given_name_en || ''}`.trim()).filter(Boolean).join(', ') || 'Devotee';
        const primaryPhone = r.phones?.find(p => p.is_primary)?.number || r.phones?.[0]?.number || '';
        const addrTe = r.address_te || '';
        const addrEn = r.address_en || '';

        return `
          <div class="label-card">
            <div class="header">
              <span class="temple">శ్రీ త్రికోటేశ్వర స్వామి దేవస్థానం, కోటప్పకొండ</span>
              <span class="receipt-tag">Bk #${r.book_number || bookNum} • #${r.receipt_no}</span>
            </div>
            <div class="to-label">TO / ప్రతి:</div>
            <div class="devotee-name">${devoteeTe || devoteeEn}</div>
            ${devoteeTe && devoteeEn ? `<div class="devotee-sub">${devoteeEn}</div>` : ''}
            <div class="address-box">${addrTe || addrEn}</div>
            <div class="footer-meta">
              <span>PIN: <b>${r.pincode || '—'}</b></span>
              ${primaryPhone ? `<span>Ph: <b>${primaryPhone}</b></span>` : ''}
            </div>
            <div class="prasad-stamp">★ శ్రీ స్వామి వారి నిత్య పూజా ప్రసాదం ★</div>
          </div>
        `;
      }).join('');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Postal Dispatch Labels - Book #${bookNum} (${selectedYear || 'All'})</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            body {
              font-family: 'Segoe UI', Arial, sans-serif;
              margin: 0;
              padding: 0;
              background: #fff;
              color: #111;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              grid-auto-rows: 44mm;
              gap: 4mm;
            }
            .label-card {
              border: 1px dashed #777;
              border-radius: 6px;
              padding: 8px 10px;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              page-break-inside: avoid;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 1px solid #ddd;
              padding-bottom: 3px;
              font-size: 9px;
            }
            .temple { font-weight: bold; color: #854d0e; }
            .receipt-tag { font-family: monospace; font-weight: bold; }
            .to-label { font-size: 8px; color: #555; font-weight: bold; margin-top: 2px; }
            .devotee-name { font-size: 11px; font-weight: bold; color: #000; }
            .devotee-sub { font-size: 9px; color: #444; }
            .address-box { font-size: 9.5px; line-height: 1.25; color: #222; margin-top: 2px; max-height: 38px; overflow: hidden; }
            .footer-meta { display: flex; justify-content: space-between; font-size: 9px; margin-top: 3px; border-top: 1px solid #eee; padding-top: 2px; }
            .prasad-stamp { text-align: center; font-size: 8px; font-weight: bold; color: #b45309; }
          </style>
        </head>
        <body>
          <div class="grid">${labelCards}</div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err: any) {
      alert(`Failed to prepare dispatch labels: ${err.message || 'Unknown error'}`);
    }
  };

  const filteredReceipts = bookReceipts.filter(r => {
    if (!receiptSearch.trim()) return true;
    const q = receiptSearch.toLowerCase();
    return (
      (r.receipt_no && r.receipt_no.toLowerCase().includes(q)) ||
      (r.primary_devotee && r.primary_devotee.toLowerCase().includes(q)) ||
      (r.gothram_en && r.gothram_en.toLowerCase().includes(q)) ||
      (r.gothram_te && r.gothram_te.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ── TOP HEADER & YEAR CONTEXT ───────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-amber-700 text-white rounded-xl shadow">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 font-serif flex items-center space-x-2">
                <span>పుస్తకాల ఫోల్డర్లు (Receipt Book Folders)</span>
                <span className="text-xs bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full font-mono font-bold">
                  {selectedYear ? `Year ${selectedYear}` : 'All Years'}
                </span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Each annual receipt book categorized as a folder. Edit book numbers and download specialized Excel workbooks for Pooja Sankalpam and Dispatch.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Compact English Year Filter */}
          <div className="flex items-center space-x-1.5 bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 shadow-xs text-xs">
            <span className="font-semibold text-gray-600 text-[11px]">Year:</span>
            <select
              value={selectedYear ?? ''}
              onChange={(e) => onSelectYear && onSelectYear(e.target.value ? Number(e.target.value) : null)}
              className="font-mono font-bold text-gray-900 bg-transparent focus:outline-none cursor-pointer text-xs"
              title="Filter books by Year"
            >
              <option value="">All Years</option>
              <option value="2027">2027</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>

          <button
            onClick={() => handleExportAllExcel('')}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center space-x-1.5"
            title="Download consolidated Excel workbook with all receipts across all books"
          >
            <Download className="w-4 h-4" />
            <span>Export Consolidated Excel</span>
          </button>
        </div>
      </div>

      {/* ── AGGREGATE SUMMARY COUNTERS ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Books</div>
          <div className="text-2xl font-bold text-gray-900 mt-1 font-mono">
            {summary?.folders?.length || 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Receipts</div>
          <div className="text-2xl font-bold text-amber-700 mt-1 font-mono">
            {summary?.total_all || 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Confirmed (పూర్తయినవి)</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
            {summary?.processed_all || 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending (పరిశీలనలో)</div>
          <div className="text-2xl font-bold text-amber-600 mt-1 font-mono">
            {summary?.pending_all || 0}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT: EITHER FOLDER GRID OR INSIDE FOLDER ────────── */}
      {!activeBook ? (
        /* ── 1. BOOK FOLDERS GRID VIEW ────────────────────────────── */
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900 font-serif flex items-center space-x-2">
              <span>All Receipt Books ({summary?.folders?.length || 0} Folders)</span>
            </h3>
            <span className="text-xs text-gray-500">
              Click any book folder to view its receipts and devotee details.
            </span>
          </div>

          {loadingSummary ? (
            <div className="p-16 text-center text-gray-400">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-amber-600 border-t-transparent mb-2" />
              <p className="text-xs">Loading receipt book folders...</p>
            </div>
          ) : !summary?.folders || summary.folders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
              <Folder className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="font-semibold text-gray-700 text-sm">No receipt books found for {selectedYear || 'this selection'}</p>
              <p className="text-xs text-gray-400 mt-1">Scan new receipts or select another year from the top navigation bar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {summary.folders.map((folder) => {
                const isUnassigned = folder.book_number === '__UNASSIGNED__';
                const percentConfirmed = folder.total > 0 ? Math.round((folder.processed / folder.total) * 100) : 0;

                return (
                  <div
                    key={folder.book_number}
                    onClick={() => setActiveBook(folder.book_number)}
                    className="bg-white hover:bg-amber-50/40 rounded-2xl border-2 border-amber-200/90 hover:border-amber-400 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between cursor-pointer group relative overflow-hidden"
                  >
                    {/* Top Folder Tab Header */}
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2.5 rounded-xl shadow-sm ${
                            isUnassigned
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-amber-100 text-amber-900 group-hover:bg-amber-600 group-hover:text-white transition-colors'
                          }`}>
                            <Folder className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <h4 className="text-base font-bold text-gray-900 font-mono tracking-tight group-hover:text-amber-800 transition-colors">
                                {folder.display_name}
                              </h4>
                              {!isUnassigned && (
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenRename(folder.book_number, e)}
                                  className="p-1 text-gray-400 hover:text-amber-800 hover:bg-amber-100 rounded-md transition-colors opacity-70 group-hover:opacity-100"
                                  title="Rename Book Number"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <span className="text-[11px] text-gray-500 font-telugu">
                              {isUnassigned ? 'పుస్తకం లేని రసీదులు' : `పుస్తకం సంఖ్య: ${folder.book_number}`}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                            {folder.total} {folder.total === 1 ? 'Receipt' : 'Receipts'}
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[11px] font-mono text-gray-600 mb-1">
                          <span className="flex items-center space-x-1 text-emerald-700 font-semibold">
                            <CheckCircle className="w-3 h-3" />
                            <span>{folder.processed} Confirmed</span>
                          </span>
                          <span className="flex items-center space-x-1 text-amber-700 font-semibold">
                            <Clock className="w-3 h-3" />
                            <span>{folder.pending} Pending</span>
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${percentConfirmed}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons for Book Folder */}
                    <div className="mt-5 pt-3.5 border-t border-gray-100 grid grid-cols-3 gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleExportSankalpamExcel(folder.book_number, e)}
                        className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[10.5px] font-bold flex flex-col items-center justify-center transition-colors shadow-xs"
                        title="Download Sankalpam Namavali Excel (Gothram & Devotee Names in Telugu)"
                      >
                        <Flame className="w-3.5 h-3.5 text-amber-700 mb-0.5" />
                        <span>Sankalpam</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleExportDispatchExcel(folder.book_number, e)}
                        className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-[10.5px] font-bold flex flex-col items-center justify-center transition-colors shadow-xs"
                        title="Download Dispatch Postal Excel (Addresses, PIN & Mobile)"
                      >
                        <Package className="w-3.5 h-3.5 text-emerald-700 mb-0.5" />
                        <span>Dispatch</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handlePrintLabels(folder.book_number, e)}
                        className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-[10.5px] font-bold flex flex-col items-center justify-center transition-colors shadow-xs"
                        title="Print 12-per-page A4 Postal Address Stickers"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-700 mb-0.5" />
                        <span>Labels</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── 2. INSIDE BOOK FOLDER VIEW (Drill-Down Receipts Table) ── */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          {/* Breadcrumb & Navigation Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-gray-200 mb-6">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setActiveBook(null)}
                className="p-2 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-700 transition-colors"
                title="Back to all book folders"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-xl font-bold text-gray-900 font-serif">
                    {activeBook === '__UNASSIGNED__' ? 'Unassigned Receipts (పుస్తకం లేనివి)' : `Book #${activeBook}`}
                  </h3>
                  <span className="text-xs font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full">
                    {bookReceipts.length} Receipts
                  </span>
                  {activeBook !== '__UNASSIGNED__' && (
                    <button
                      type="button"
                      onClick={() => handleOpenRename(activeBook)}
                      className="p-1 text-gray-400 hover:text-amber-800 hover:bg-amber-100 rounded-md transition-colors"
                      title="Rename Book Number"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Receipts contained inside this specific book. Click "Review" on any receipt to verify details.
                </p>
              </div>
            </div>

            {/* Book Folder Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleExportSankalpamExcel(activeBook)}
                className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
                title="Download Sankalpam Namavali Excel"
              >
                <Flame className="w-3.5 h-3.5 text-amber-700" />
                <span>Sankalpam Excel</span>
              </button>

              <button
                onClick={() => handleExportDispatchExcel(activeBook)}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
                title="Download Postal Dispatch Excel"
              >
                <Package className="w-3.5 h-3.5 text-emerald-700" />
                <span>Dispatch Excel</span>
              </button>

              <button
                onClick={() => handlePrintLabels(activeBook)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
                title="Print 12-per-page A4 Postal Stickers"
              >
                <Printer className="w-3.5 h-3.5 text-slate-700" />
                <span>Print Labels</span>
              </button>

              <button
                onClick={() => onNewScanForBook(activeBook === '__UNASSIGNED__' ? '' : activeBook)}
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Scan Receipt to this Book</span>
              </button>
            </div>
          </div>

          {/* Search Bar within Folder */}
          <div className="mb-4">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search receipt #, devotee name, or gothram in this book..."
                value={receiptSearch}
                onChange={(e) => setReceiptSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Receipts Table */}
          {loadingReceipts ? (
            <div className="p-12 text-center text-gray-400">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-amber-600 border-t-transparent mb-2" />
              <p className="text-xs">Loading receipts in Book #{activeBook}...</p>
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="font-semibold text-gray-600 text-xs">No receipts matched in Book #{activeBook}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Receipt #</th>
                    <th className="py-3 px-4">Book #</th>
                    <th className="py-3 px-4">Devotee Name</th>
                    <th className="py-3 px-4">Gothram (గోత్రం)</th>
                    <th className="py-3 px-4">Abhishekam Period</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredReceipts.map((r) => {
                    let badge = (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                        <Clock className="w-3 h-3" />
                        <span>Pending</span>
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
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-amber-100/70 text-amber-900 border border-amber-200">
                              Book #{r.book_number || activeBook}
                            </span>
                            <button
                              onClick={(e) => handleOpenEditReceiptBook(r, e)}
                              className="p-1 rounded text-gray-400 hover:text-amber-800 hover:bg-amber-100 transition-colors opacity-70 group-hover:opacity-100"
                              title="Move this receipt to another book"
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
                            className="px-3 py-1 text-xs font-semibold text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 rounded-lg border border-amber-300 inline-flex items-center space-x-1 shadow-xs transition-colors"
                          >
                            <span>Review & Verify →</span>
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
      )}

      {/* ── RENAME BOOK MODAL ───────────────────────────────────────── */}
      {renameModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <Folder className="w-5 h-5 text-amber-700" />
                <h4 className="text-base font-bold text-gray-900">
                  పుస్తకం పేరు మార్చండి (Rename Book)
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setRenameModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRename} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Current Book Number:
                </label>
                <div className="font-mono text-sm font-bold text-gray-800 bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
                  {bookToRename === '__UNASSIGNED__' ? 'Unassigned' : `Book #${bookToRename}`}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  New Book Number / Name:
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. 005, 005-A, 101"
                  value={newBookNumber}
                  onChange={(e) => setNewBookNumber(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono font-bold"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  This will rename the book assignment across all receipts in this book {selectedYear ? `for year ${selectedYear}` : ''}.
                </p>
              </div>

              {renameError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {renameError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setRenameModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRenaming}
                  className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-lg shadow disabled:opacity-50"
                >
                  {isRenaming ? 'Saving...' : 'Save Book Name'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT INDIVIDUAL RECEIPT BOOK MODAL ───────────────────────── */}
      {editingReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <h4 className="text-sm font-bold text-gray-900">
                Move Receipt #{editingReceipt.receipt_no} to Book
              </h4>
              <button
                type="button"
                onClick={() => setEditingReceipt(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveReceiptBook} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Assign to Book Number:
                </label>
                <input
                  type="text"
                  placeholder="e.g. 005, 01, 154 (or leave blank for unassigned)"
                  value={newReceiptBookValue}
                  onChange={(e) => setNewReceiptBookValue(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingReceipt(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingReceiptBook}
                  className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-lg shadow disabled:opacity-50"
                >
                  {isUpdatingReceiptBook ? 'Updating...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
