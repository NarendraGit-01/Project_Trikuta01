import React, { useEffect, useState } from 'react';
import { Package, Truck, Printer, CheckCircle, Clock } from 'lucide-react';
import { listDetailedReceipts } from '../services/api';
import { Receipt } from '../types';

export const DispatchPage: React.FC = () => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedForPrint, setSelectedForPrint] = useState<number[]>([]);

  useEffect(() => {
    setLoading(true);
    listDetailedReceipts({ status: 'CONFIRMED', limit: 50 })
      .then((fulls) => {
        setReceipts(fulls);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleToggleSelect = (id: number) => {
    if (selectedForPrint.includes(id)) {
      setSelectedForPrint(selectedForPrint.filter((x) => x !== id));
    } else {
      setSelectedForPrint([...selectedForPrint, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedForPrint.length === receipts.length) {
      setSelectedForPrint([]);
    } else {
      setSelectedForPrint(receipts.map((r) => r.id));
    }
  };

  const handlePrintLabels = () => {
    window.print();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 print:hidden">
        <div>
          <div className="flex items-center space-x-2">
            <Package className="w-6 h-6 text-amber-700" />
            <h2 className="text-2xl font-bold text-gray-900 font-serif">
              ప్రసాదం పంపిణీ (Prasadam Postal Dispatch)
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Generate postal address labels and manage prasadam dispatches for confirmed pooja receipts.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSelectAll}
            className="text-xs px-3 py-2 border border-gray-300 rounded-xl bg-white hover:bg-gray-50 text-gray-700 font-medium"
          >
            {selectedForPrint.length === receipts.length ? 'Deselect All' : 'Select All'}
          </button>
          <button
            onClick={handlePrintLabels}
            disabled={receipts.length === 0}
            className="flex items-center space-x-1.5 px-4 py-2 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow"
          >
            <Printer className="w-4 h-4" />
            <span>Print Postal Labels ({selectedForPrint.length || receipts.length})</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-400 text-xs">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-amber-600 border-t-transparent mb-2" />
          <p>Loading dispatch queue...</p>
        </div>
      ) : receipts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400 text-xs shadow-sm">
          <Truck className="w-12 h-12 mx-auto mb-2 opacity-30 text-amber-700" />
          <p className="font-semibold text-gray-600">No confirmed prasadam dispatch orders.</p>
          <p className="mt-1">Confirm receipts with postal addresses to generate shipping slips.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {receipts.map((r) => {
            const isSelected = selectedForPrint.includes(r.id);
            const primaryDevotee = r.persons[0];
            const primaryPhone = r.phones.find((p) => p.is_primary) || r.phones[0];

            return (
              <div
                key={r.id}
                onClick={() => handleToggleSelect(r.id)}
                className={`cursor-pointer bg-white rounded-xl border p-4 shadow-sm transition-all relative ${
                  isSelected
                    ? 'border-amber-600 ring-2 ring-amber-500/20 bg-amber-50/20'
                    : 'border-gray-200 hover:border-amber-300'
                } print:border-gray-400 print:shadow-none print:break-inside-avoid`}
              >
                {/* Envelope Sender Crest for Printable Labels */}
                <div className="text-[10px] text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-1 mb-2 flex items-center justify-between">
                  <span>Sri Trikoteswara Swamy Temple Prasadam</span>
                  <span className="font-mono font-bold text-gray-700">Receipt #{r.receipt_no}</span>
                </div>

                <div className="space-y-1.5 font-sans">
                  {/* Devotee Name */}
                  <div className="text-sm font-bold text-gray-900">
                    To: {primaryDevotee?.surname_en} {primaryDevotee?.given_name_en}
                    {primaryDevotee?.given_name_te && (
                      <span className="text-xs text-gray-600 font-telugu ml-1.5">
                        ({primaryDevotee.surname_te} {primaryDevotee.given_name_te})
                      </span>
                    )}
                  </div>

                  {/* Gothram */}
                  <div className="text-xs text-amber-800 font-medium">
                    Gothram: {r.gothram_en} {r.gothram_te && `(${r.gothram_te})`}
                  </div>

                  {/* Postal Address */}
                  <div className="text-xs text-gray-700 leading-relaxed pt-1">
                    {r.address_en || r.address_te || 'No address specified'}
                  </div>

                  {/* PIN Code & Phone */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs font-mono">
                    <span className="font-bold text-gray-900">
                      PIN: {r.pincode || '—'}
                    </span>
                    <span className="text-gray-600">
                      Ph: {primaryPhone?.number || '—'}
                    </span>
                  </div>
                </div>

                {/* Dispatch Status Badge */}
                <div className="mt-3 pt-2 border-t border-dashed border-gray-200 flex items-center justify-between text-[11px] print:hidden">
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
  );
};
