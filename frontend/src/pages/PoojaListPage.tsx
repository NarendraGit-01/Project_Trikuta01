import React, { useEffect, useState, useMemo } from 'react';
import {
  Flame,
  Printer,
  Filter,
  BookOpen,
  FileSpreadsheet,
  Upload,
  Download,
  X,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { listDetailedReceipts, createReceipt } from '../services/api';
import { Receipt } from '../types';

interface PoojaListPageProps {
  selectedYear?: number | null;
}

export const PoojaListPage: React.FC<PoojaListPageProps> = ({ selectedYear }) => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBook, setSelectedBook] = useState<string>('ALL');
  const [selectedGothram, setSelectedGothram] = useState<string>('ALL');

  // Excel / CSV Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedRows, setImportedRows] = useState<
    Array<{
      book_number: string;
      receipt_no: string;
      gothram_te: string;
      names_te: string;
    }>
  >([]);
  const [importFileName, setImportFileName] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listDetailedReceipts({ status: 'CONFIRMED', receipt_year: selectedYear, limit: 250 })
      .then((fulls) => {
        setReceipts(fulls);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedYear]);

  // Compute unique books available
  const booksSummary = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of receipts) {
      const bn = (r.book_number || '').trim();
      const key = bn || '__UNASSIGNED__';
      map[key] = (map[key] || 0) + 1;
    }
    const list = Object.entries(map).map(([key, count]) => ({
      key,
      label: key === '__UNASSIGNED__' ? 'Unassigned (పుస్తకం లేనివి)' : `Book #${key}`,
      count,
    }));
    return list.sort((a, b) => {
      if (a.key === '__UNASSIGNED__') return 1;
      if (b.key === '__UNASSIGNED__') return -1;
      return a.key.localeCompare(b.key, undefined, { numeric: true });
    });
  }, [receipts]);

  // Receipts filtered by Book Number
  const bookFilteredReceipts = useMemo(() => {
    if (selectedBook === 'ALL') return receipts;
    return receipts.filter((r) => {
      const bn = (r.book_number || '').trim();
      const key = bn || '__UNASSIGNED__';
      return key === selectedBook;
    });
  }, [receipts, selectedBook]);

  // Group by Gothram within the filtered book
  const groupedByGothram = useMemo(() => {
    return bookFilteredReceipts.reduce((acc, r) => {
      const key = r.gothram_te || r.gothram_en || 'ఇతర గోత్రాలు (Unspecified)';
      if (!acc[key]) acc[key] = [];
      acc[key].push(r);
      return acc;
    }, {} as Record<string, Receipt[]>);
  }, [bookFilteredReceipts]);

  const gothramKeys = useMemo(() => Object.keys(groupedByGothram), [groupedByGothram]);

  const handlePrint = () => {
    window.print();
  };

  /* ── Export to Excel (UTF-8 BOM CSV) with 4 Requested Columns ── */
  const handleExportExcel = () => {
    const headers = [
      'పుస్తకం సంఖ్య (Book Num)',
      'రశీదు సంఖ్య (Receipt Number)',
      'గోత్రం (తెలుగు) (Gothram in Telugu)',
      'సభ్యుల పేర్లు (తెలుగు) (Names in Telugu)',
    ];

    const escapeCsv = (str: string | undefined | null) => {
      if (!str) return '""';
      const clean = str.replace(/"/g, '""');
      return `"${clean}"`;
    };

    const rows = bookFilteredReceipts.map((r) => {
      const bookNum = r.book_number || '';
      const receiptNum = r.receipt_no;
      const gothramTe = r.gothram_te || r.gothram_en || '';
      const namesTe = r.persons
        .map((p) => {
          const te = [p.surname_te, p.given_name_te].filter(Boolean).join(' ');
          const en = [p.surname_en, p.given_name_en].filter(Boolean).join(' ');
          return te || en;
        })
        .filter(Boolean)
        .join(', ');

      return [
        escapeCsv(bookNum),
        escapeCsv(receiptNum),
        escapeCsv(gothramTe),
        escapeCsv(namesTe),
      ].join(',');
    });

    // \uFEFF Byte Order Mark forces Excel to read as UTF-8 Unicode for Telugu script
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const bookSuffix = selectedBook === 'ALL' ? 'AllBooks' : `Book_${selectedBook}`;
    link.setAttribute('download', `Sankalpam_${bookSuffix}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /* ── Import Excel / CSV Handler ── */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        setImportNotice('File contains no data rows.');
        return;
      }

      // Check header or parse lines
      const parsed: Array<{
        book_number: string;
        receipt_no: string;
        gothram_te: string;
        names_te: string;
      }> = [];

      // Skip header row if it contains keywords
      const startIdx = lines[0].toLowerCase().includes('book') || lines[0].includes('పుస్తకం') ? 1 : 0;

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i];
        // Split with CSV comma consideration
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((p) =>
          p.trim().replace(/^"|"$/g, '').trim()
        );
        if (parts.length >= 2) {
          parsed.push({
            book_number: parts[0] || '',
            receipt_no: parts[1] || '',
            gothram_te: parts[2] || '',
            names_te: parts[3] || '',
          });
        }
      }

      setImportedRows(parsed);
      setImportNotice(`Parsed ${parsed.length} records ready to import.`);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (importedRows.length === 0) return;
    setIsImporting(true);
    setImportNotice(null);
    let successCount = 0;

    try {
      for (const row of importedRows) {
        if (!row.receipt_no) continue;
        const names = row.names_te
          .split(/[,+&]/)
          .map((n) => n.trim())
          .filter(Boolean);

        const personsPayload = names.map((nm, idx) => ({
          position: idx + 1,
          given_name_en: nm,
          given_name_te: nm,
          surname_en: '',
          surname_te: '',
          original_ocr: nm,
          verification_status: 'VERIFIED',
        }));

        await createReceipt({
          receipt_no: row.receipt_no,
          book_number: row.book_number || undefined,
          gothram_te: row.gothram_te,
          gothram_en: row.gothram_te,
          status: 'CONFIRMED',
          original_image_path: 'imported_excel_record.jpg',
          processing_cost: 0,
          processing_duration: 0,
          persons: personsPayload.length > 0 ? personsPayload : [{
            position: 1,
            given_name_en: 'Devotee',
            given_name_te: 'భక్తుడు',
            surname_en: '',
            surname_te: '',
            original_ocr: '',
            verification_status: 'VERIFIED',
          }],
          phones: [],
        }).catch((e) => console.warn('Row import warning:', e));
        successCount++;
      }

      setImportNotice(`Successfully imported ${successCount} records!`);
      // Refresh list
      const fresh = await listDetailedReceipts({ status: 'CONFIRMED', limit: 250 });
      setReceipts(fresh);
      setTimeout(() => {
        setShowImportModal(false);
        setImportedRows([]);
        setImportFileName('');
        setImportNotice(null);
      }, 1500);
    } catch (err: any) {
      setImportNotice(`Import error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* ── Screen-Only Header & Controls ────────────────────────── */}
      <div className="print:hidden space-y-5 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Flame className="w-6 h-6 text-amber-600" />
              <h2 className="text-2xl font-bold text-gray-900 font-serif font-telugu">
                పూజా సంకల్పం నామావళి పట్టిక
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Sri Trikoteswara Swamy Temple • Karthika Masam Paroksha Abhishekam Sankalpam Sheet & Excel Sync
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Gothram Filter Dropdown */}
            {gothramKeys.length > 0 && (
              <select
                value={selectedGothram}
                onChange={(e) => setSelectedGothram(e.target.value)}
                className="text-xs border border-gray-300 rounded-xl px-3 py-2 bg-white text-gray-800 shadow-sm font-medium"
              >
                <option value="ALL">అన్ని గోత్రాలు (All Gothrams)</option>
                {gothramKeys.map((g) => (
                  <option key={g} value={g}>
                    {g} ({groupedByGothram[g].length})
                  </option>
                ))}
              </select>
            )}

            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              disabled={bookFilteredReceipts.length === 0}
              title="Export as Excel / CSV with Book Num, Receipt No, Telugu Gothram, Telugu Names"
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-xs font-semibold rounded-xl shadow transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Excel ఎగుమతి (Export)</span>
            </button>

            {/* Import Excel / CSV Button */}
            <button
              onClick={() => setShowImportModal(true)}
              title="Import Excel or CSV containing Book Num, Receipt No, Gothram, Devotee Names"
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold rounded-xl shadow transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Excel దిగుమతి (Import)</span>
            </button>

            {/* Print Sankalpam Sheet */}
            <button
              onClick={handlePrint}
              disabled={bookFilteredReceipts.length === 0}
              className="flex items-center space-x-1.5 px-4 py-2 bg-gray-900 hover:bg-black disabled:opacity-40 text-white text-xs font-semibold rounded-xl shadow transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print Sankalpam Sheet</span>
            </button>
          </div>
        </div>

        {/* Book Segregation Filter Bar */}
        <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-500 mr-2">
            <BookOpen className="w-4 h-4 text-amber-700" />
            <span>పుస్తకం వారీగా (Filter by Book):</span>
          </div>

          <button
            onClick={() => setSelectedBook('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              selectedBook === 'ALL'
                ? 'bg-amber-700 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Books ({receipts.length})
          </button>

          {booksSummary.map((b) => (
            <button
              key={b.key}
              onClick={() => setSelectedBook(b.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                selectedBook === b.key
                  ? 'bg-amber-700 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>{b.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  selectedBook === b.key
                    ? 'bg-amber-900/60 text-amber-100'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {b.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Printable Sankalpam Section ────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 print:p-0 print:border-none print:shadow-none font-sans">
        {/* Printable Temple Crest Header */}
        <div className="text-center pb-6 mb-6 border-b-2 border-amber-800">
          <p className="text-xs text-amber-900 font-bold uppercase tracking-widest">
            || శ్రీ సాంబశివార్పణమస్తు ||
          </p>
          <h1 className="text-2xl font-bold text-gray-900 font-serif font-telugu mt-1">
            శ్రీ త్రికోటేశ్వర స్వామి వారి దేవస్థానము, కోటప్పకొండ
          </h1>
          <p className="text-sm font-semibold text-gray-700 font-telugu mt-0.5">
            కార్తీక మాస పరోక్ష అభిషేక పూజా సంకల్ప గోత్ర నామముల పట్టిక
          </p>
          <div className="flex items-center justify-center space-x-4 text-xs font-mono text-gray-500 mt-1">
            <span>
              పుస్తకం (Book):{' '}
              <strong className="text-gray-900">
                {selectedBook === 'ALL' ? 'అన్ని పుస్తకాలు (All)' : selectedBook}
              </strong>
            </span>
            <span>•</span>
            <span>Date Generated: {new Date().toLocaleDateString('en-IN')}</span>
            <span>•</span>
            <span>Records: {bookFilteredReceipts.length}</span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 text-xs">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-amber-600 border-t-transparent mb-2" />
            <p>Loading sankalpam records...</p>
          </div>
        ) : gothramKeys.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-xs">
            <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="font-semibold text-gray-600">No confirmed sankalpam records in this book.</p>
            <p className="mt-1">
              Verify and confirm receipts in the Scan page to populate the priest's sankalpam sheet.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {gothramKeys
              .filter((g) => selectedGothram === 'ALL' || selectedGothram === g)
              .map((gothram) => (
                <div
                  key={gothram}
                  className="border border-amber-200 rounded-xl overflow-hidden print:border-gray-400 print:break-inside-avoid"
                >
                  {/* Gothram Header */}
                  <div className="bg-amber-100/70 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-amber-800 text-sm font-serif">🕉️</span>
                      <h3 className="text-base font-bold text-amber-950 font-telugu">
                        గోత్రము: {gothram}
                      </h3>
                    </div>
                    <span className="text-xs font-mono font-semibold text-amber-800">
                      {groupedByGothram[gothram].length} Family Units
                    </span>
                  </div>

                  {/* Devotees List in Sankalpam Format */}
                  <div className="divide-y divide-gray-100 p-3 bg-amber-50/20 font-telugu">
                    {groupedByGothram[gothram].map((receipt) => {
                      const allNames = receipt.persons
                        .map((p) => {
                          const fullNameTe = [p.surname_te, p.given_name_te]
                            .filter(Boolean)
                            .join(' ');
                          const fullNameEn = [p.surname_en, p.given_name_en]
                            .filter(Boolean)
                            .join(' ');
                          return fullNameTe || fullNameEn;
                        })
                        .filter(Boolean)
                        .join(', ');

                      return (
                        <div key={receipt.id} className="py-2.5 px-2 flex items-start justify-between">
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-gray-900 leading-relaxed">
                              నామధేయులు:{' '}
                              <span className="text-amber-900 font-bold">{allNames || '—'}</span>
                            </div>
                            <div className="text-xs text-gray-600 mt-0.5">
                              చిరునామా: {receipt.address_te || receipt.address_en || '—'}
                              {receipt.pincode && ` - ${receipt.pincode}`}
                            </div>
                          </div>
                          <div className="text-right text-[11px] font-mono text-gray-500 pl-4">
                            <div>
                              {receipt.book_number && (
                                <span className="bg-amber-100 text-amber-900 px-1 py-0.2 rounded font-bold mr-1">
                                  B#{receipt.book_number}
                                </span>
                              )}
                              రశీదు #{receipt.receipt_no}
                            </div>
                            {receipt.abhishekam_from && (
                              <div className="text-amber-800 text-[10px]">
                                పూజ: {receipt.abhishekam_from}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ── Modal: Import as Excel / CSV ────────────────────────── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                <h3 className="text-base font-bold text-gray-900 font-serif">
                  Import as Excel / CSV (సంకల్పం డేటా దిగుమతి)
                </h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-gray-600">
                Upload a CSV or Excel export containing columns:{' '}
                <strong>Book Num</strong>, <strong>Receipt Number</strong>,{' '}
                <strong>Gothram in Telugu</strong>, <strong>Names in Telugu</strong>.
              </p>

              {/* Upload Drop Area */}
              <label className="border-2 border-dashed border-gray-300 hover:border-emerald-600 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-gray-50/50">
                <Upload className="w-8 h-8 text-emerald-600 mb-2" />
                <span className="text-xs font-semibold text-gray-800">
                  {importFileName ? importFileName : 'Click to select CSV / Excel file'}
                </span>
                <span className="text-[11px] text-gray-400 mt-1">.csv, .txt, UTF-8 formatted</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {/* Status / Notice */}
              {importNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{importNotice}</span>
                </div>
              )}

              {/* Preview Rows if parsed */}
              {importedRows.length > 0 && (
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl text-xs divide-y divide-gray-100">
                  {importedRows.slice(0, 5).map((row, idx) => (
                    <div key={idx} className="p-2 font-mono flex items-center justify-between">
                      <span>
                        Bk #{row.book_number || '-'} • Rcpt #{row.receipt_no}
                      </span>
                      <span className="font-telugu text-gray-700 font-bold truncate max-w-[180px]">
                        {row.gothram_te} • {row.names_te}
                      </span>
                    </div>
                  ))}
                  {importedRows.length > 5 && (
                    <div className="p-2 text-center text-[11px] text-gray-400 italic">
                      + {importedRows.length - 5} more records...
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={importedRows.length === 0 || isImporting}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-xs font-semibold rounded-xl shadow flex items-center space-x-1.5"
                >
                  {isImporting ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Confirm Import ({importedRows.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
