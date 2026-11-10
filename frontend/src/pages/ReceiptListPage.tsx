import React, { useEffect, useState } from 'react';
import { Search, FileText, CheckCircle, AlertTriangle, Clock, Eye, Filter, Download, BookOpen } from 'lucide-react';
import { listReceipts } from '../services/api';
import { ReceiptListItem } from '../types';

interface ReceiptListPageProps {
  onSelectReceipt: (receiptId: number) => void;
  onNewScan: () => void;
}

export const ReceiptListPage: React.FC<ReceiptListPageProps> = ({ onSelectReceipt, onNewScan }) => {
  const [receipts, setReceipts] = useState<ReceiptListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [bookFilter, setBookFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await listReceipts({
        q: searchQuery || undefined,
        status: statusFilter || undefined,
        book_number: bookFilter || undefined,
      });
      setReceipts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, bookFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleExportExcel = () => {
    const params = new URLSearchParams();
    if (statusFilter) params.append('status_filter', statusFilter);
    if (bookFilter) params.append('book_number', bookFilter);
    const url = `/api/v1/receipts/export/excel?${params.toString()}`;
    window.open(url, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 font-serif">
            రసీదుల జాబితా (Temple Receipts Database)
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Search, filter, and review verified receipts for Sri Trikoteswara Swamy Temple.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center space-x-1.5"
            title="Download consolidated Excel workbook with all bilingual fields"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export to Excel</span>
          </button>
          <button
            onClick={onNewScan}
            className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center space-x-1.5"
          >
            <span>+ Scan New Receipt</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
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
            <input
              type="text"
              value={bookFilter}
              onChange={(e) => setBookFilter(e.target.value)}
              placeholder="Book # (e.g. BOOK-001)"
              className="text-xs border border-gray-300 rounded-xl px-3 py-2 text-gray-700 bg-white w-36"
            />

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

      {/* Receipts Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-xs">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-amber-600 border-t-transparent mb-2" />
            <p>Loading receipts...</p>
          </div>
        ) : receipts.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-xs">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="font-semibold text-gray-600">No receipts found</p>
            <p className="mt-1">Scan a receipt or adjust your search filter.</p>
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
                      <td className="py-3 px-4 font-mono text-xs text-amber-800 font-semibold">
                        {r.book_number || <span className="text-gray-300 font-normal">—</span>}
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
    </div>
  );
};
