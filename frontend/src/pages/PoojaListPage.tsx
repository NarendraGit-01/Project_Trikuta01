import React, { useEffect, useState } from 'react';
import { Flame, Printer, Filter, BookOpen } from 'lucide-react';
import { listReceipts, getReceipt } from '../services/api';
import { Receipt } from '../types';

export const PoojaListPage: React.FC = () => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGothram, setSelectedGothram] = useState<string>('ALL');

  useEffect(() => {
    setLoading(true);
    listReceipts({ status: 'CONFIRMED', limit: 100 })
      .then(async (items) => {
        // Fetch full details for each
        const fulls = await Promise.all(
          items.map((it) => getReceipt(it.id).catch(() => null))
        );
        setReceipts(fulls.filter((f): f is Receipt => f !== null));
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  // Group by Gothram
  const groupedByGothram = receipts.reduce((acc, r) => {
    const key = r.gothram_te || r.gothram_en || 'ఇతర గోత్రాలు (Unspecified)';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {} as Record<string, Receipt[]>);

  const gothramKeys = Object.keys(groupedByGothram);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Title & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 print:hidden">
        <div>
          <div className="flex items-center space-x-2">
            <Flame className="w-6 h-6 text-amber-600" />
            <h2 className="text-2xl font-bold text-gray-900 font-serif font-telugu">
              పూజా సంకల్పం నామావళి పట్టిక
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Sri Trikoteswara Swamy Temple • Karthika Masam Paroksha Abhishekam Sankalpam Sheet
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {gothramKeys.length > 0 && (
            <select
              value={selectedGothram}
              onChange={(e) => setSelectedGothram(e.target.value)}
              className="text-xs border border-gray-300 rounded-xl px-3 py-2 bg-white text-gray-800"
            >
              <option value="ALL">అన్ని గోత్రాలు (All Gothrams)</option>
              {gothramKeys.map((g) => (
                <option key={g} value={g}>
                  {g} ({groupedByGothram[g].length})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow"
          >
            <Printer className="w-4 h-4" />
            <span>Print Sankalpam Sheet</span>
          </button>
        </div>
      </div>

      {/* Printable Sankalpam Section */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 print:p-0 print:border-none print:shadow-none">
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
          <p className="text-xs text-gray-500 font-mono mt-1">
            Date Generated: {new Date().toLocaleDateString('en-IN')}
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 text-xs">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-amber-600 border-t-transparent mb-2" />
            <p>Loading sankalpam records...</p>
          </div>
        ) : gothramKeys.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-xs">
            <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="font-semibold text-gray-600">No confirmed sankalpam records yet.</p>
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
                  className="border border-amber-200 rounded-xl overflow-hidden print:border-gray-400"
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
                            <div>రసీదు #{receipt.receipt_no}</div>
                            {receipt.abhishekam_from && (
                              <div className="text-[10px] text-gray-400">
                                {receipt.abhishekam_from} to {receipt.abhishekam_to}
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
