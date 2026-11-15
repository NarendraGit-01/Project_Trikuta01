import React, { useEffect, useState, useMemo } from 'react';
import {
  Flame,
  Printer,
  Filter,
  BookOpen,
  Download,
} from 'lucide-react';
import { listDetailedReceipts, getExportExcelUrl } from '../services/api';
import { Receipt } from '../types';

interface PoojaListPageProps {
  selectedYear?: number | null;
  onSelectYear?: (year: number | null) => void;
}

export const PoojaListPage: React.FC<PoojaListPageProps> = ({ selectedYear, onSelectYear }) => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBook, setSelectedBook] = useState<string>('ALL');
  const [selectedGothram, setSelectedGothram] = useState<string>('ALL');

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

  /* ── Export to Formatted Excel (.xlsx) matching Books Page Sankalpam Option ── */
  const handleExportExcel = () => {
    const url = getExportExcelUrl({
      bookNumber: selectedBook === 'ALL' ? undefined : selectedBook,
      receiptYear: selectedYear,
      statusFilter: 'CONFIRMED',
      exportType: 'sankalpam',
    });
    window.open(url, '_blank');
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
              title="Export as Excel with Book Num, Receipt No, Telugu Gothram, Telugu Names"
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-xs font-semibold rounded-xl shadow transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Excel ఎగుమతి (Export)</span>
            </button>

            {/* Compact English Year Filter */}
            <div className="flex items-center space-x-1.5 bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 shadow-xs text-xs">
              <span className="font-semibold text-gray-600 text-[11px]">Year:</span>
              <select
                value={selectedYear ?? ''}
                onChange={(e) => onSelectYear && onSelectYear(e.target.value ? Number(e.target.value) : null)}
                className="font-mono font-bold text-gray-900 bg-transparent focus:outline-none cursor-pointer text-xs"
                title="Filter Sankalpam by Year"
              >
                <option value="">All Years</option>
                <option value="2027">2027</option>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
              </select>
            </div>

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
                      // Format Telugu devotee names with family surname once (NO English names!)
                      const familySurnameTe = receipt.persons.find((p) => p.surname_te)?.surname_te?.trim() || '';
                      const formattedMembers: string[] = [];
                      receipt.persons.forEach((p, idx) => {
                        const sTe = (p.surname_te || '').trim();
                        let gTe = (p.given_name_te || p.given_name_en || '').trim();
                        const surCandidate = sTe || familySurnameTe;
                        if (surCandidate && gTe.startsWith(surCandidate)) {
                          gTe = gTe.slice(surCandidate.length).replace(/^[\s\-:,]+/, '');
                        }
                        if (idx === 0) {
                          if (familySurnameTe && gTe) formattedMembers.push(`${familySurnameTe} ${gTe}`);
                          else if (familySurnameTe) formattedMembers.push(familySurnameTe);
                          else if (gTe) formattedMembers.push(gTe);
                        } else {
                          if (gTe) formattedMembers.push(gTe);
                        }
                      });
                      const allNames = formattedMembers.join(', ');

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
    </div>
  );
};
