import React, { useEffect, useState, useMemo } from 'react';
import { Package, Truck, Printer, Clock, Filter, BookOpen, CheckSquare, Square } from 'lucide-react';
import { listDetailedReceipts } from '../services/api';
import { Receipt } from '../types';

interface DispatchPageProps {
  selectedYear?: number | null;
}

export const DispatchPage: React.FC<DispatchPageProps> = ({ selectedYear }) => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBook, setSelectedBook] = useState<string>('ALL');
  const [selectedForPrint, setSelectedForPrint] = useState<number[]>([]);

  useEffect(() => {
    setLoading(true);
    listDetailedReceipts({ status: 'CONFIRMED', receipt_year: selectedYear, limit: 200 })
      .then((fulls) => {
        setReceipts(fulls);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [selectedYear]);

  // Compute unique books available in the confirmed receipts list
  const booksSummary = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of receipts) {
      const bn = (r.book_number || '').trim();
      const key = bn || '__UNASSIGNED__';
      map[key] = (map[key] || 0) + 1;
    }
    const list = Object.entries(map).map(([key, count]) => ({
      key,
      label: key === '__UNASSIGNED__' ? 'Unassigned' : `Book #${key}`,
      count,
    }));
    return list.sort((a, b) => {
      if (a.key === '__UNASSIGNED__') return 1;
      if (b.key === '__UNASSIGNED__') return -1;
      return a.key.localeCompare(b.key, undefined, { numeric: true });
    });
  }, [receipts]);

  // Receipts filtered by selected book
  const filteredReceipts = useMemo(() => {
    if (selectedBook === 'ALL') return receipts;
    return receipts.filter((r) => {
      const bn = (r.book_number || '').trim();
      const key = bn || '__UNASSIGNED__';
      return key === selectedBook;
    });
  }, [receipts, selectedBook]);

  // Active items selected for print (if none manually checked, all filtered are printed)
  const itemsToPrint = useMemo(() => {
    if (selectedForPrint.length === 0) return filteredReceipts;
    return filteredReceipts.filter((r) => selectedForPrint.includes(r.id));
  }, [filteredReceipts, selectedForPrint]);

  // Chunk print items into exact batches of 12 for A4 pages (2 columns x 6 rows)
  const printPages = useMemo(() => {
    const pages: Receipt[][] = [];
    for (let i = 0; i < itemsToPrint.length; i += 12) {
      pages.push(itemsToPrint.slice(i, i + 12));
    }
    return pages;
  }, [itemsToPrint]);

  const handleToggleSelect = (id: number) => {
    if (selectedForPrint.includes(id)) {
      setSelectedForPrint(selectedForPrint.filter((x) => x !== id));
    } else {
      setSelectedForPrint([...selectedForPrint, id]);
    }
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredReceipts.map((r) => r.id);
    const allSelected = filteredIds.every((id) => selectedForPrint.includes(id));
    if (allSelected) {
      setSelectedForPrint(selectedForPrint.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedForPrint(Array.from(new Set([...selectedForPrint, ...filteredIds])));
    }
  };

  const handlePrintLabels = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* ── Screen-Only Header & Toolbar ────────────────────────── */}
      <div className="print:hidden space-y-5 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Package className="w-6 h-6 text-amber-700" />
              <h2 className="text-2xl font-bold text-gray-900 font-serif">
                ప్రసాదం పంపిణీ (Prasadam Postal Dispatch)
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Generate 12-per-page A4 postal shipping labels segregated by Book Number for confirmed pooja receipts.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleSelectAllFiltered}
              disabled={filteredReceipts.length === 0}
              className="text-xs px-3 py-2 border border-gray-300 rounded-xl bg-white hover:bg-gray-50 text-gray-700 font-medium flex items-center space-x-1.5 transition-colors disabled:opacity-40"
            >
              {filteredReceipts.length > 0 &&
              filteredReceipts.every((r) => selectedForPrint.includes(r.id)) ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-amber-700" />
                  <span>Deselect All in Book</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5 text-gray-400" />
                  <span>Select All in Book</span>
                </>
              )}
            </button>

            <button
              onClick={handlePrintLabels}
              disabled={itemsToPrint.length === 0}
              className="flex items-center space-x-1.5 px-4 py-2 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>
                Print A4 Labels ({itemsToPrint.length} items • {Math.ceil(itemsToPrint.length / 12)} Sheets)
              </span>
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

      {/* ── Screen Interactive Card Grid ────────────────────────── */}
      <div className="print:hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-xs">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-amber-600 border-t-transparent mb-2" />
            <p>Loading dispatch queue...</p>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400 text-xs shadow-sm">
            <Truck className="w-12 h-12 mx-auto mb-2 opacity-30 text-amber-700" />
            <p className="font-semibold text-gray-600">No confirmed prasadam dispatch orders in this book.</p>
            <p className="mt-1">Confirm receipts with postal addresses to generate shipping slips.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReceipts.map((r) => {
              const isSelected = selectedForPrint.includes(r.id);
              const primaryDevotee = r.persons[0];
              const primaryPhone = r.phones.find((p) => p.is_primary) || r.phones[0];

              const devoteeNameTe = [primaryDevotee?.surname_te, primaryDevotee?.given_name_te]
                .filter(Boolean)
                .join(' ');
              const devoteeNameEn = [primaryDevotee?.surname_en, primaryDevotee?.given_name_en]
                .filter(Boolean)
                .join(' ');

              return (
                <div
                  key={r.id}
                  onClick={() => handleToggleSelect(r.id)}
                  className={`cursor-pointer bg-white rounded-2xl border p-4 shadow-sm transition-all relative flex flex-col justify-between ${
                    isSelected
                      ? 'border-amber-600 ring-2 ring-amber-500/20 bg-amber-50/20'
                      : 'border-gray-200 hover:border-amber-300'
                  }`}
                >
                  <div>
                    {/* Envelope Sender Crest Header */}
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-1.5 mb-2.5 flex items-center justify-between">
                      <span className="font-semibold text-amber-900">Sri Trikoteswara Swamy Temple</span>
                      <span className="font-mono font-bold text-gray-700">
                        {r.book_number ? `Bk #${r.book_number} • ` : ''}Rcpt #{r.receipt_no}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {/* Devotee Name (Telugu & English) */}
                      <div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          To (గ్రహీత):
                        </div>
                        {devoteeNameTe && (
                          <div className="text-sm font-bold text-gray-950 font-telugu">
                            {devoteeNameTe}
                          </div>
                        )}
                        {devoteeNameEn && (
                          <div className="text-xs font-semibold text-gray-700 uppercase">
                            {devoteeNameEn}
                          </div>
                        )}
                        {!devoteeNameTe && !devoteeNameEn && (
                          <div className="text-xs text-gray-400 italic">No devotee name</div>
                        )}
                      </div>

                      {/* Devotee Address (Both Telugu & English) */}
                      <div className="pt-1 border-t border-gray-100 space-y-1">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          Address (చిరునామా):
                        </div>
                        {r.address_te && (
                          <div className="text-xs text-gray-900 font-telugu leading-relaxed font-medium">
                            {r.address_te}
                          </div>
                        )}
                        {r.address_en && (
                          <div className="text-xs text-gray-600 leading-relaxed">
                            {r.address_en}
                          </div>
                        )}
                        {!r.address_te && !r.address_en && (
                          <div className="text-xs text-gray-400 italic">No address specified</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* PIN Code & Phone */}
                  <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-gray-900">
                      PIN: {r.pincode || '—'}
                    </span>
                    <span className="text-gray-700 font-semibold">
                      Ph: {primaryPhone?.number || '—'}
                    </span>
                  </div>

                  {/* Postal Status Badge */}
                  <div className="mt-2.5 pt-2 border-t border-dashed border-gray-100 flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Postal Packet Status:</span>
                    <span className="inline-flex items-center space-x-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">
                      <Clock className="w-3 h-3" />
                      <span>Ready for Dispatch</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Exact A4 Print Layout: 12 Addresses Per Sheet (2 Cols x 6 Rows) ── */}
      <div className="hidden print:block">
        <style type="text/css">{`
          @page {
            size: A4 portrait;
            margin: 6mm 6mm;
          }
          @media print {
            body {
              background: white !important;
              color: black !important;
            }
            .dispatch-print-sheet {
              display: grid !important;
              grid-template-columns: repeat(2, 96mm) !important;
              grid-template-rows: repeat(6, 46.5mm) !important;
              column-gap: 4mm !important;
              row-gap: 2mm !important;
              height: 282mm !important;
              max-height: 284mm !important;
              page-break-after: always !important;
              break-after: page !important;
              box-sizing: border-box !important;
              overflow: hidden !important;
            }
            .dispatch-label-card {
              border: 1px dashed #64748b !important;
              border-radius: 4px !important;
              padding: 2mm 3mm !important;
              height: 46.5mm !important;
              box-sizing: border-box !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              font-size: 9.5pt !important;
              line-height: 1.25 !important;
              overflow: hidden !important;
            }
          }
        `}</style>

        {printPages.map((pageBatch, pageIdx) => (
          <div key={pageIdx} className="dispatch-print-sheet">
            {pageBatch.map((r) => {
              const primaryDevotee = r.persons[0];
              const primaryPhone = r.phones.find((p) => p.is_primary) || r.phones[0];
              const devoteeNameTe = [primaryDevotee?.surname_te, primaryDevotee?.given_name_te]
                .filter(Boolean)
                .join(' ');
              const devoteeNameEn = [primaryDevotee?.surname_en, primaryDevotee?.given_name_en]
                .filter(Boolean)
                .join(' ');

              return (
                <div key={r.id} className="dispatch-label-card">
                  {/* Sender Crest / Header */}
                  <div className="flex items-center justify-between border-b border-gray-400 pb-1 text-[8pt] text-gray-700">
                    <span className="font-bold">SRI TRIKOTESWARA SWAMY TEMPLE PRASADAM</span>
                    <span className="font-mono font-bold">
                      {r.book_number ? `B#${r.book_number} ` : ''}R#{r.receipt_no}
                    </span>
                  </div>

                  {/* Devotee Names (Both Telugu & English) */}
                  <div className="mt-0.5">
                    <div className="text-[7.5pt] text-gray-500 font-bold uppercase">To (గ్రహీత):</div>
                    {devoteeNameTe && (
                      <div className="text-[10.5pt] font-bold text-black font-telugu leading-tight">
                        {devoteeNameTe}
                      </div>
                    )}
                    {devoteeNameEn && (
                      <div className="text-[9pt] font-semibold text-gray-800 uppercase leading-tight">
                        {devoteeNameEn}
                      </div>
                    )}
                  </div>

                  {/* Devotee Address (Both Telugu & English) */}
                  <div className="my-auto text-[8.5pt] leading-tight space-y-0.5">
                    {r.address_te && (
                      <div className="font-telugu font-medium text-black">
                        {r.address_te}
                      </div>
                    )}
                    {r.address_en && (
                      <div className="text-gray-800">
                        {r.address_en}
                      </div>
                    )}
                  </div>

                  {/* PIN & Phone Number */}
                  <div className="flex items-center justify-between border-t border-gray-400 pt-0.5 text-[8.5pt] font-mono font-bold">
                    <span>PIN: {r.pincode || '—'}</span>
                    <span>Ph: {primaryPhone?.number || '—'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
