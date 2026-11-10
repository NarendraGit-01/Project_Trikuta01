import React, { useState } from 'react';
import { BookOpen, Search, CheckCircle, Database } from 'lucide-react';
import { searchGothrams } from '../services/api';
import { GothramSearchItem } from '../types';

export const GothramMasterPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GothramSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (val: string) => {
    setQuery(val);
    if (val.trim().length >= 2) {
      setLoading(true);
      setHasSearched(true);
      try {
        const data = await searchGothrams(val);
        setResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    } else {
      setResults([]);
      setHasSearched(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Title */}
      <div className="mb-6">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-6 h-6 text-amber-700" />
          <h2 className="text-2xl font-bold text-gray-900 font-serif font-telugu">
            గోత్రాల అధికారిక జాబితా (Gothram Master Directory)
          </h2>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          2,099 Clean, Unique Gothrams extracted from Sri Trikoteswara Swamy Temple reference registry.
        </p>
      </div>

      {/* Search Input */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm mb-6">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search any of 2,099 Gothrams by name in English or Telugu (e.g. Paidipala, Kashyapa, Haritha)..."
            className="w-full pl-9 pr-4 py-2.5 text-xs border border-gray-300 rounded-xl text-gray-800 focus:ring-2 focus:ring-amber-500 font-medium"
          />
        </div>
      </div>

      {/* Directory Stats / Results */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6">
        {!hasSearched ? (
          <div className="text-center py-8">
            <Database className="w-10 h-10 text-amber-600 mx-auto mb-2 opacity-50" />
            <h3 className="text-sm font-bold text-gray-800">2,099 Gothrams Ready in Local Database</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              Type at least 2 letters in the search bar above to look up any gothram name, phonetic variant, or Telugu spelling.
            </p>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {['PAIDIPALA', 'KASHYAPA', 'BHARADWAJA', 'KOUNDINYA', 'VASHISHTA', 'HARITHA', 'SREERANGA'].map(
                (sample) => (
                  <button
                    key={sample}
                    onClick={() => handleSearch(sample)}
                    className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-lg px-2.5 py-1 hover:bg-amber-100 transition-colors font-mono"
                  >
                    {sample}
                  </button>
                )
              )}
            </div>
          </div>
        ) : loading ? (
          <div className="text-center py-8 text-xs text-gray-400">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-amber-600 border-t-transparent mb-2" />
            <p>Searching directory...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400">
            <p className="font-semibold text-gray-600">No matching gothrams found</p>
            <p className="mt-1">Try alternate spelling or phonetics.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            <div className="pb-3 text-xs text-gray-500 font-semibold flex items-center justify-between">
              <span>Found {results.length} Matching Gothrams:</span>
              <span className="text-[10px] text-gray-400">Ranked by RapidFuzz Phonetic & String Similarity</span>
            </div>
            {results.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between text-xs hover:bg-amber-50/30 px-2 rounded-lg">
                <div>
                  <span className="font-bold text-gray-900 font-mono text-sm tracking-wide">
                    {item.gothram_en}
                  </span>
                  {item.gothram_te && (
                    <span className="ml-3 font-telugu text-gray-600 font-medium text-sm">
                      ({item.gothram_te})
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                    {Math.round(item.similarity_score)}% Match
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    ID #{item.id}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
