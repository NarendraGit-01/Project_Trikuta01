import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginPage } from './pages/LoginPage';
import { BooksPage } from './pages/BooksPage';
import { ScanPage } from './pages/ScanPage';
import { ReviewPage } from './pages/ReviewPage';
import { ReceiptListPage } from './pages/ReceiptListPage';
import { PoojaListPage } from './pages/PoojaListPage';
import { DispatchPage } from './pages/DispatchPage';
import { PipelineResult } from './types';
import { getReceipt, deleteStagedReceipt, getStoredAuth, logoutUser, AuthUser } from './services/api';
import { deleteStoredReceipt } from './services/receiptStore';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredAuth());
  const [currentTab, setCurrentTab] = useState<string>('scan');
  const [activeModel, setActiveModel] = useState<string>('gemini-3.5-flash-lite');

  // Global Year Selector (defaults to 2026 or persisted selection)
  const [selectedYear, setSelectedYear] = useState<number | null>(() => {
    const saved = localStorage.getItem('trikuta_selected_year');
    return saved !== null && saved !== '' ? Number(saved) : 2026;
  });

  const handleSelectYear = (year: number | null) => {
    setSelectedYear(year);
    if (year !== null) {
      localStorage.setItem('trikuta_selected_year', String(year));
    } else {
      localStorage.removeItem('trikuta_selected_year');
    }
  };

  // OCR Review State
  const [activeReceiptId, setActiveReceiptId] = useState<number | null>(null);
  const [activeStoredReceiptId, setActiveStoredReceiptId] = useState<string | undefined>(undefined);
  const [activeOCRResult, setActiveOCRResult] = useState<PipelineResult | null>(null);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const [activeSourceFilename, setActiveSourceFilename] = useState<string | undefined>(undefined);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const handleOCRComplete = (
    result: PipelineResult,
    imageUrl: string,
    filename?: string,
    storedReceiptId?: string
  ) => {
    if (selectedYear) {
      result.receipt_year = selectedYear;
    }
    setActiveReceiptId(null);
    setActiveStoredReceiptId(storedReceiptId);
    setActiveOCRResult(result);
    setActiveImageUrl(imageUrl);
    setActiveSourceFilename(filename);
    setCurrentTab('review');
    setSuccessBanner('OCR extraction completed! Please review and verify the extracted fields.');
    setTimeout(() => setSuccessBanner(null), 6000);
  };

  const handleSavedReceipt = async (receiptId: number) => {
    const stagedIdFromResult = (activeOCRResult?.intermediate_passes as any)?.staged_id;
    const stagedIdFromKey =
      activeStoredReceiptId && activeStoredReceiptId.startsWith('staged_')
        ? Number(activeStoredReceiptId.replace('staged_', ''))
        : undefined;
    const stagedIdToDelete = stagedIdFromResult || stagedIdFromKey;

    if (stagedIdToDelete && !Number.isNaN(stagedIdToDelete)) {
      await deleteStagedReceipt(stagedIdToDelete).catch((e) =>
        console.warn('Could not remove receipt from cloud queue:', e)
      );
    }

    if (activeStoredReceiptId) {
      try {
        await deleteStoredReceipt(activeStoredReceiptId);
      } catch (e) {
        console.warn('Could not remove processed receipt from local queue:', e);
      }
      setActiveStoredReceiptId(undefined);
    }
    setActiveOCRResult(null);
    setActiveImageUrl(null);
    setActiveReceiptId(null);
    setSuccessBanner(`Receipt #${receiptId} has been successfully recorded and confirmed.`);
    setTimeout(() => setSuccessBanner(null), 6000);
    setCurrentTab('books');
  };

  const handleSelectReceiptFromList = async (receiptId: number) => {
    try {
      const receipt = await getReceipt(receiptId);
      // Map stored receipt into PipelineResult shape for ReviewPage
      const mappedResult: PipelineResult = {
        receipt_no: receipt.receipt_no,
        receipt_year: receipt.receipt_year,
        date: receipt.receipt_date,
        abhishekam_from: receipt.abhishekam_from,
        abhishekam_to: receipt.abhishekam_to,
        amount_rupees: receipt.amount,
        gothram_final: {
          name_en: receipt.gothram_en || '',
          name_te: receipt.gothram_te || '',
          source: 'database',
          confidence: 'high',
        },
        gothram_as_written: receipt.gothram_as_written,
        gothram_in_reference: !!receipt.gothram_master_id,
        people: (receipt.persons || []).map((p) => ({
          given_name_en: p.given_name_en,
          given_name_te: p.given_name_te,
          surname_en: p.surname_en,
          surname_te: p.surname_te,
          original_ocr: p.original_ocr,
        })),
        address: {
          text_en: receipt.address_en || '',
          text_te: receipt.address_te || '',
        },
        pincode: receipt.pincode,
        phones: (receipt.phones || []).map((ph) => ({
          number: ph.number,
          is_primary: ph.is_primary,
          raw: ph.number,
        })),
        field_confidences: receipt.confidence_data || {},
        needs_human_check: [],
        overall_confidence: receipt.status === 'CONFIRMED' ? 'GREEN' : 'AMBER',
        duration_seconds: receipt.processing_duration || 0,
        total_cost_usd: receipt.processing_cost || 0,
        total_cost_inr: (receipt.processing_cost || 0) * 87.0,
        intermediate_passes: {
          book_number: receipt.book_number || '',
          image_hash: receipt.image_hash || '',
          stored_original_path: receipt.original_image_path || '',
        },
      };

      let imgUrl = receipt.original_image_url || '';
      if (!imgUrl && receipt.original_image_path) {
        const raw = receipt.original_image_path;
        if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('/api/') || raw.startsWith('/static/')) {
          imgUrl = raw;
        } else {
          imgUrl = `/api/v1/storage/${raw}`;
        }
      }
      if (!imgUrl) {
        imgUrl = '/samples/sample_img4.jpeg';
      }

      setActiveReceiptId(receipt.id);
      setActiveOCRResult(mappedResult);
      setActiveImageUrl(imgUrl);
      setActiveSourceFilename(receipt.original_image_path);
      setCurrentTab('review');
    } catch (e) {
      console.error(e);
    }
  };

  if (!currentUser) {
    return <LoginPage onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-gray-900">
      {/* Header Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        activeModel={activeModel}
        currentUser={currentUser}
        onLogout={() => {
          logoutUser();
          setCurrentUser(null);
        }}
      />

      {/* Global Success Banner */}
      {successBanner && (
        <div className="bg-emerald-600 text-white text-xs font-medium py-2.5 px-4 text-center shadow-md animate-fade-in flex items-center justify-center space-x-2">
          <span>✓</span>
          <span>{successBanner}</span>
        </div>
      )}

      {/* Main Tab Content */}
      <main className="flex-1">
        {currentTab === 'scan' && (
          <ErrorBoundary fallbackTitle="Scanner Encountered an Error" onReset={() => setCurrentTab('scan')}>
            <ScanPage
              onOCRComplete={handleOCRComplete}
              activeModel={activeModel}
              onChangeModel={setActiveModel}
            />
          </ErrorBoundary>
        )}

        {currentTab === 'review' && (
          activeOCRResult ? (
            <ErrorBoundary fallbackTitle="Review View Encountered an Error" onReset={() => setCurrentTab('scan')}>
              <ReviewPage
                result={activeOCRResult}
                imageUrl={activeImageUrl || ''}
                sourceFilename={activeSourceFilename}
                existingReceiptId={activeReceiptId}
                onBackToScan={() => setCurrentTab('scan')}
                onSaved={handleSavedReceipt}
                onNextReview={(nextResult, nextImageUrl, nextFilename, nextStoredId) => {
                  handleOCRComplete(nextResult, nextImageUrl, nextFilename, nextStoredId);
                }}
              />
            </ErrorBoundary>
          ) : (
            <div className="max-w-xl mx-auto my-16 text-center p-8 bg-white rounded-2xl border border-gray-200 shadow-sm">
              <p className="text-sm font-semibold text-gray-700">No active receipt selected for review.</p>
              <button
                onClick={() => setCurrentTab('scan')}
                className="mt-4 px-4 py-2 bg-amber-700 text-white rounded-xl text-xs font-bold"
              >
                Go to Scan Page
              </button>
            </div>
          )
        )}

        {currentTab === 'receipts' && (
          <ErrorBoundary fallbackTitle="Receipts View Encountered an Error">
            <ReceiptListPage
              selectedYear={selectedYear}
              onSelectYear={handleSelectYear}
              onSelectReceipt={handleSelectReceiptFromList}
              onNewScan={() => setCurrentTab('scan')}
            />
          </ErrorBoundary>
        )}

        {currentTab === 'books' && (
          <ErrorBoundary fallbackTitle="Books View Encountered an Error">
            <BooksPage
              selectedYear={selectedYear}
              onSelectYear={handleSelectYear}
              onSelectReceipt={handleSelectReceiptFromList}
              onNewScanForBook={(_bookNum) => {
                setCurrentTab('scan');
              }}
            />
          </ErrorBoundary>
        )}

        {currentTab === 'pooja' && (
          <ErrorBoundary fallbackTitle="Sankalpam View Encountered an Error">
            <PoojaListPage selectedYear={selectedYear} onSelectYear={handleSelectYear} />
          </ErrorBoundary>
        )}

        {currentTab === 'dispatch' && (
          <ErrorBoundary fallbackTitle="Dispatch View Encountered an Error">
            <DispatchPage selectedYear={selectedYear} onSelectYear={handleSelectYear} />
          </ErrorBoundary>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 text-center text-xs text-gray-500">
        <p className="font-telugu">
          శ్రీ త్రికోటేశ్వర స్వామి వారి దేవస్థానము • కోటప్పకొండ, పల్నాడు జిల్లా, ఆంధ్రప్రదేశ్
        </p>
        <p className="text-[11px] text-gray-400 mt-1 font-mono">
          AI Receipt OCR & Management System • Primary Models: gemini-3.5-flash-lite / gemini-3.1-flash-lite
        </p>
      </footer>
    </div>
  );
};
