import React, { useState, useRef, useEffect } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowLeft,
  Search,
  Users,
  MapPin,
} from 'lucide-react';
import { PipelineResult, Person, Phone } from '../types';
import { createReceipt, updateReceipt, searchGothrams, resolvePincode, PincodeDetails } from '../services/api';
import {
  isTeluguScript,
  transliterateTeluguToEnglish,
  transliterateToTelugu,
} from '../utils/transliterate';

interface ReviewPageProps {
  result: PipelineResult;
  imageUrl: string;
  sourceFilename?: string;
  existingReceiptId?: number | null;
  onBackToScan: () => void;
  onSaved: (receiptId: number) => void;
}

export const ReviewPage: React.FC<ReviewPageProps> = ({
  result,
  imageUrl,
  sourceFilename,
  existingReceiptId,
  onBackToScan,
  onSaved,
}) => {
  /* ── 1. Receipt Header ─────────────────────────── */
  const [receiptNo, setReceiptNo] = useState(result.receipt_no || '');
  const [bookNumber, setBookNumber] = useState(
    (result.intermediate_passes as any)?.book_number || ''
  );
  const [receiptYear, setReceiptYear] = useState(result.receipt_year || new Date().getFullYear());
  const [receiptDate, setReceiptDate] = useState(result.date || '');
  const [abhishekamFrom, setAbhishekamFrom] = useState(result.abhishekam_from || '');
  const [abhishekamTo, setAbhishekamTo] = useState(result.abhishekam_to || '');
  const [amount, setAmount] = useState(result.amount_rupees || '100');

  /* ── 2. Gothram Resolution (Bidirectional Auto-Fill) ── */
  const rawGothram =
    typeof result.gothram_final === 'string'
      ? result.gothram_final
      : result.gothram_final?.name_en || result.gothram_as_written || '';

  const providedGothramTe =
    result.gothram_te ||
    (typeof result.gothram_final === 'object' ? result.gothram_final?.name_te : '') ||
    (isTeluguScript(result.gothram_as_written || '') ? result.gothram_as_written : '') ||
    '';

  let initGothramEn = '';
  let initGothramTe = '';

  if (isTeluguScript(rawGothram)) {
    initGothramTe = providedGothramTe || rawGothram;
    initGothramEn = transliterateTeluguToEnglish(rawGothram).toUpperCase();
  } else if (rawGothram) {
    initGothramEn = rawGothram.toUpperCase();
    initGothramTe = providedGothramTe || transliterateToTelugu(rawGothram);
  } else if (providedGothramTe) {
    initGothramTe = providedGothramTe;
    initGothramEn = transliterateTeluguToEnglish(providedGothramTe).toUpperCase();
  }

  const [gothramEn, setGothramEn] = useState(initGothramEn);
  const [gothramTe, setGothramTe] = useState(initGothramTe);
  const [gothramAsWritten] = useState(result.gothram_as_written || '');
  const [gothramQuery, setGothramQuery] = useState('');
  const [gothramSuggestions, setGothramSuggestions] = useState<any[]>([]);
  const [showGothramDrop, setShowGothramDrop] = useState(false);

  const handleGothramEnChange = (val: string) => {
    setGothramEn(val);
    setGothramTe(transliterateToTelugu(val));
  };

  const handleGothramTeChange = (val: string) => {
    setGothramTe(val);
    setGothramEn(transliterateTeluguToEnglish(val).toUpperCase());
  };

  /* ── 3. SHARED FAMILY SURNAME (Bidirectional Auto-Fill) ── */
  const rawPeople = Array.isArray(result.people) ? result.people : [];

  // Prefer explicit bilingual surname from backend/LLM, otherwise inspect first person
  let initSurnameEn = (result.family_surname_en || '').trim();
  let initSurnameTe = (result.family_surname_te || '').trim();

  if (!initSurnameEn || !initSurnameTe) {
    for (const p of rawPeople) {
      if (!initSurnameEn && p.surname_en && !isTeluguScript(p.surname_en)) {
        initSurnameEn = p.surname_en.trim();
      }
      if (!initSurnameTe && p.surname_te && isTeluguScript(p.surname_te)) {
        initSurnameTe = p.surname_te.trim();
      }
      if (initSurnameEn && initSurnameTe) break;
    }
  }

  let rawSurname = '';
  for (const p of rawPeople) {
    const s = (p.surname || p.surname_en || p.surname_te || '').trim();
    if (s.length > 0) {
      rawSurname = s;
      break;
    }
  }

  if (initSurnameEn && initSurnameTe) {
    initSurnameEn = initSurnameEn.toUpperCase();
  } else if (initSurnameTe && !initSurnameEn) {
    initSurnameEn = transliterateTeluguToEnglish(initSurnameTe).toUpperCase();
  } else if (initSurnameEn && !initSurnameTe) {
    initSurnameEn = initSurnameEn.toUpperCase();
    initSurnameTe = transliterateToTelugu(initSurnameEn);
  } else if (isTeluguScript(rawSurname)) {
    initSurnameTe = rawSurname;
    initSurnameEn = transliterateTeluguToEnglish(rawSurname).toUpperCase();
  } else if (rawSurname) {
    initSurnameEn = rawSurname.toUpperCase();
    initSurnameTe = transliterateToTelugu(rawSurname);
  }

  const [surnameEn, setSurnameEn] = useState(initSurnameEn);
  const [surnameTe, setSurnameTe] = useState(initSurnameTe);

  const handleSurnameEnChange = (val: string) => {
    if (isTeluguScript(val)) {
      setSurnameTe(val);
      setSurnameEn(transliterateTeluguToEnglish(val).toUpperCase());
    } else {
      setSurnameEn(val);
      setSurnameTe(transliterateToTelugu(val));
    }
  };

  const handleSurnameTeChange = (val: string) => {
    if (!isTeluguScript(val) && /[a-zA-Z]/.test(val)) {
      setSurnameEn(val.toUpperCase());
      setSurnameTe(transliterateToTelugu(val));
    } else {
      setSurnameTe(val);
      setSurnameEn(transliterateTeluguToEnglish(val).toUpperCase());
    }
  };

  /* ── 4. DEVOTEES GIVEN NAMES (Bidirectional Auto-Fill) ── */
  const initialPersons: Person[] =
    rawPeople.length > 0
      ? rawPeople.map((p: any, idx: number) => {
          // If pass 2 or pass 3 split a full name like 'వరలక్ష్మి (ప్రసన్న)' across surname and given_name,
          // recombine them so no name part is omitted
          let given = (p.given_name || p.given_name_en || p.given_name_te || '').trim();
          const straySurname = (p.surname || p.surname_en || p.surname_te || '').trim();
          const matchesFamilySurname =
            straySurname.toLowerCase() === rawSurname.toLowerCase() ||
            straySurname.toLowerCase() === initSurnameTe.toLowerCase() ||
            straySurname.toLowerCase() === initSurnameEn.toLowerCase();

          // If this person has a surname that differs from the family surname, it is part of their given name!
          if (idx > 0 && straySurname && !matchesFamilySurname) {
            given = `${straySurname} ${given}`.trim();
          }

          let gEn = (p.given_name_en || '').trim();
          let gTe = (p.given_name_te || '').trim();

          // Strictly enforce: English field MUST be in English; Telugu field MUST be in Telugu
          if (isTeluguScript(gEn)) {
            if (!gTe) gTe = gEn;
            gEn = transliterateTeluguToEnglish(gEn);
          }
          if (gTe && !isTeluguScript(gTe)) {
            if (!gEn) gEn = gTe;
            gTe = transliterateToTelugu(gTe);
          }

          if (!gEn && !gTe) {
            if (isTeluguScript(given)) {
              gTe = given;
              gEn = transliterateTeluguToEnglish(given);
            } else if (given) {
              gEn = given;
              gTe = transliterateToTelugu(given);
            }
          } else if (!gEn && gTe) {
            gEn = transliterateTeluguToEnglish(gTe);
          } else if (gEn && !gTe) {
            gTe = transliterateToTelugu(gEn);
          }

          return {
            position: idx + 1,
            given_name_en: gEn,
            given_name_te: gTe,
            surname_en: '',
            surname_te: '',
            original_ocr: p.original_ocr || given,
            verification_status: 'UNVERIFIED' as const,
          };
        })
      : [
          {
            position: 1,
            given_name_en: '',
            given_name_te: '',
            surname_en: '',
            surname_te: '',
            verification_status: 'UNVERIFIED' as const,
          },
        ];

  const [persons, setPersons] = useState<Person[]>(initialPersons);

  const handleGivenNameEn = (idx: number, val: string) => {
    const updated = [...persons];
    if (isTeluguScript(val)) {
      updated[idx].given_name_te = val;
      updated[idx].given_name_en = transliterateTeluguToEnglish(val);
    } else {
      updated[idx].given_name_en = val;
      updated[idx].given_name_te = transliterateToTelugu(val);
    }
    setPersons(updated);
  };

  const handleGivenNameTe = (idx: number, val: string) => {
    const updated = [...persons];
    if (!isTeluguScript(val) && /[a-zA-Z]/.test(val)) {
      updated[idx].given_name_en = val;
      updated[idx].given_name_te = transliterateToTelugu(val);
    } else {
      updated[idx].given_name_te = val;
      updated[idx].given_name_en = transliterateTeluguToEnglish(val);
    }
    setPersons(updated);
  };

  const handleAddPerson = () => {
    setPersons([
      ...persons,
      {
        position: persons.length + 1,
        given_name_en: '',
        given_name_te: '',
        surname_en: '',
        surname_te: '',
        verification_status: 'UNVERIFIED',
      },
    ]);
  };

  const handleRemovePerson = (index: number) => {
    if (persons.length <= 1) return;
    setPersons(persons.filter((_, i) => i !== index).map((p, i) => ({ ...p, position: i + 1 })));
  };

  /* ── 5. PHONES ─────────────────────────────────── */
  const rawPhones = Array.isArray(result.phones) ? result.phones : [];
  const [phones, setPhones] = useState<Phone[]>(
    rawPhones.length > 0
      ? rawPhones.map((ph: any, idx: number) => {
          const numStr = typeof ph === 'string' ? ph : ph?.number || '';
          const isPrim =
            typeof ph === 'object' && ph?.is_primary !== undefined ? ph.is_primary : idx === 0;
          return {
            number: String(numStr),
            is_primary: isPrim,
            verification_status: 'UNVERIFIED' as const,
          };
        })
      : [{ number: '', is_primary: true, verification_status: 'UNVERIFIED' as const }]
  );

  const handleAddPhone = () =>
    setPhones([...phones, { number: '', is_primary: false, verification_status: 'UNVERIFIED' }]);

  const handleRemovePhone = (index: number) => {
    if (phones.length <= 1) return;
    const updated = phones.filter((_, i) => i !== index);
    if (!updated.some((p) => p.is_primary)) updated[0].is_primary = true;
    setPhones(updated);
  };

  const handleSetPrimaryPhone = (index: number) =>
    setPhones(phones.map((p, i) => ({ ...p, is_primary: i === index })));

  /* ── 6. ADDRESS (Bidirectional Auto-Fill & Geo-Standardization) ───────── */
  const rawAddr =
    typeof result.address === 'string'
      ? result.address
      : result.address?.text_te || result.address?.text_en || '';

  let initAddrEn = result.address_en || '';
  let initAddrTe = result.address_te || '';

  if (!initAddrEn && !initAddrTe) {
    if (isTeluguScript(rawAddr)) {
      initAddrTe = rawAddr;
      initAddrEn = transliterateTeluguToEnglish(rawAddr);
    } else if (rawAddr) {
      initAddrEn = rawAddr;
      initAddrTe = transliterateToTelugu(rawAddr);
    }
  } else if (initAddrTe && !initAddrEn) {
    initAddrEn = transliterateTeluguToEnglish(initAddrTe);
  } else if (initAddrEn && !initAddrTe) {
    initAddrTe = transliterateToTelugu(initAddrEn);
  }

  const [addressEn, setAddressEn] = useState(initAddrEn);
  const [addressTe, setAddressTe] = useState(initAddrTe);
  const [pincode, setPincode] = useState(result.pincode || '');
  const [geoInfo, setGeoInfo] = useState<PincodeDetails | null>(
    result.geo_metadata
      ? {
          pincode: result.geo_metadata.pincode || result.pincode || '',
          post_office: result.geo_metadata.detected_town || '',
          taluk: result.geo_metadata.mandal || '',
          district_en: result.geo_metadata.district_en || '',
          district_te: result.geo_metadata.district_te || '',
          state: result.geo_metadata.state || 'Andhra Pradesh',
        }
      : null
  );

  const handlePincodeChange = async (val: string) => {
    setPincode(val);
    const clean = val.replace(/\D/g, '');
    if (clean.length === 6) {
      const details = await resolvePincode(clean);
      if (details) {
        setGeoInfo(details);
      }
    }
  };

  const handleEnrichAddress = () => {
    if (!geoInfo) return;
    const distEn = geoInfo.district_en;
    const distTe = geoInfo.district_te;
    const mandal = geoInfo.taluk;

    if (distEn && !addressEn.includes(distEn)) {
      setAddressEn((prev) =>
        prev
          ? `${prev.trim().replace(/,\s*$/, '')}, ${mandal ? mandal + ' Mandal, ' : ''}${distEn} Dist, ${geoInfo.state}`
          : `${distEn}, ${geoInfo.state}`
      );
    }
    if (distTe && !addressTe.includes(distTe)) {
      setAddressTe((prev) =>
        prev ? `${prev.trim().replace(/,\s*$/, '')}, ${distTe}` : `${distTe}`
      );
    }
  };

  const handleAddressEnChange = (val: string) => {
    setAddressEn(val);
    setAddressTe(transliterateToTelugu(val));
  };

  const handleAddressTeChange = (val: string) => {
    setAddressTe(val);
    setAddressEn(transliterateTeluguToEnglish(val));
  };

  /* ── Image Viewer Controls (Mouse Wheel Zoom & Pan Drag) ─── */
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(result.rotation_applied || 0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });
  const viewerRef = useRef<HTMLDivElement>(null);

  // Wheel zoom listener with passive: false so preventDefault() suppresses default page scroll
  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
      setZoomLevel((prev) => {
        const next = Math.min(Math.max(0.75, +(prev + zoomFactor).toFixed(2)), 4.0);
        return next;
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only main left click
    setIsPanning(true);
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    isDraggingRef.current = false;
  };

  const handleResetView = () => {
    setZoomLevel(1);
    setRotation(result.rotation_applied || 0);
    setPan({ x: 0, y: 0 });
  };

  const handleDoubleClick = () => {
    if (zoomLevel > 1.2) {
      setZoomLevel(1);
      setPan({ x: 0, y: 0 });
    } else {
      setZoomLevel(2);
    }
  };

  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /* ── Gothram Search Autocomplete ───────────────── */
  const handleGothramSearch = async (val: string) => {
    setGothramQuery(val);
    if (val.trim().length > 1) {
      try {
        const matches = await searchGothrams(val);
        setGothramSuggestions(matches);
        setShowGothramDrop(true);
      } catch (e) {
        console.error(e);
      }
    } else {
      setGothramSuggestions([]);
      setShowGothramDrop(false);
    }
  };

  /* ── Save Handler ──────────────────────────────── */
  const handleSaveReceipt = async (targetStatus: 'CONFIRMED' | 'INCOMPLETE') => {
    setIsSaving(true);
    setSaveError(null);

    if (targetStatus === 'CONFIRMED') {
      const errors: string[] = [];
      if (!receiptNo.trim()) errors.push('Receipt number is required');
      if (!gothramEn.trim() && !gothramTe.trim()) errors.push('Gothram is required');
      const hasDevotee = persons.some((p) => p.given_name_en.trim() || p.given_name_te.trim());
      if (!hasDevotee) errors.push('At least one devotee given name is required');
      const validPhone = phones.some((ph) => /^[6-9]\d{9}$/.test(ph.number.replace(/\D/g, '')));
      if (!validPhone) errors.push('At least one valid 10-digit Indian phone number is required');
      if (!addressEn.trim() && !addressTe.trim()) errors.push('Devotee address is required');
      if (errors.length > 0) {
        setSaveError(errors.join('. '));
        setIsSaving(false);
        return;
      }
    }

    const payload = {
      receipt_no: receiptNo.trim(),
      book_number: bookNumber.trim() || undefined,
      image_hash: (result.intermediate_passes as any)?.image_hash || undefined,
      receipt_year: receiptYear,
      receipt_date: receiptDate.trim(),
      abhishekam_from: abhishekamFrom.trim(),
      abhishekam_to: abhishekamTo.trim(),
      amount: amount.trim(),
      gothram_en: gothramEn.trim(),
      gothram_te: gothramTe.trim(),
      gothram_as_written: gothramAsWritten,
      address_en: addressEn.trim(),
      address_te: addressTe.trim(),
      pincode: pincode.trim(),
      status: targetStatus,
      original_image_path: sourceFilename || 'uploaded_image.jpg',
      model_name: result.token_usage?.model_name || 'gemini-3.5-flash-lite',
      processing_cost: result.total_cost_usd || 0.0,
      processing_duration: result.duration_seconds || 0.0,
      confidence_data: result.field_confidences,
      ocr_raw: result.intermediate_passes,
      persons: persons.map((p, idx) => ({
        position: idx + 1,
        given_name_en: p.given_name_en.trim(),
        given_name_te: p.given_name_te.trim(),
        surname_en: surnameEn.trim(),
        surname_te: surnameTe.trim(),
        original_ocr: p.original_ocr || '',
        verification_status: targetStatus === 'CONFIRMED' ? 'VERIFIED' : 'UNVERIFIED',
      })),
      phones: phones
        .filter((ph) => ph.number.trim().length > 0)
        .map((ph) => ({
          number: ph.number.trim(),
          is_primary: ph.is_primary,
          verification_status: targetStatus === 'CONFIRMED' ? 'VERIFIED' : 'UNVERIFIED',
        })),
    };

    try {
      let savedId: number;
      if (existingReceiptId) {
        const updated = await updateReceipt(existingReceiptId, payload);
        savedId = updated.id;
      } else {
        const created = await createReceipt(payload);
        savedId = created.id;
      }
      setIsSaving(false);
      onSaved(savedId);
    } catch (err: any) {
      setIsSaving(false);
      setSaveError(err.message || 'Failed to save receipt record to database');
    }
  };

  /* ── Field Confidence Badges ───────────────────── */
  const getBadge = (fieldName: string) => {
    const conf = result.field_confidences?.[fieldName];
    if (!conf) return null;
    const reasonStr = Array.isArray(conf.reasons)
      ? conf.reasons.join('; ')
      : conf.reason || '';

    if (conf.status === 'GREEN')
      return (
        <span
          className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300"
          title={reasonStr}
        >
          <CheckCircle className="w-3 h-3 text-emerald-600" />
          <span>High ({Math.round(conf.score * 100)}%)</span>
        </span>
      );
    if (conf.status === 'AMBER')
      return (
        <span
          className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300"
          title={reasonStr}
        >
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          <span>Review ({Math.round(conf.score * 100)}%)</span>
        </span>
      );
    return (
      <span
        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800 border border-red-300"
        title={reasonStr}
      >
        <XCircle className="w-3 h-3 text-red-600" />
        <span>Uncertain</span>
      </span>
    );
  };

  const humanChecks = Array.isArray(result.needs_human_check) ? result.needs_human_check : [];

  return (
    <div className="max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* ── Top Bar ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-200 mb-6">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToScan}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-600"
            title="Back to Scan"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-gray-900 font-serif">
                Receipt Verification & Correction
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                #{receiptNo || 'Unnumbered'}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Verify handwritten Telugu & English fields with bidirectional transliteration.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => handleSaveReceipt('INCOMPLETE')}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors"
          >
            Save as Incomplete
          </button>
          <button
            onClick={() => handleSaveReceipt('CONFIRMED')}
            disabled={isSaving}
            className="flex items-center space-x-2 px-5 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Confirm & Finalize Record</span>
          </button>
        </div>
      </div>

      {/* ── Save Error ──────────────────────────────── */}
      {saveError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* ── Human Check Banner ──────────────────────── */}
      {humanChecks.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center space-x-2 text-xs font-bold text-amber-900 uppercase tracking-wider mb-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <span>Attention Items Flagged by AI Pipeline:</span>
          </div>
          <ul className="list-disc list-inside text-xs text-amber-800 space-y-0.5 pl-2">
            {humanChecks.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Split-Screen Workspace ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Wide Aspect-Ratio Image Viewer */}
        <div className="lg:col-span-6 xl:col-span-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sticky top-20">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                Receipt Document Image
              </span>
              <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full hidden sm:inline-block">
                Wide Mode
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                title="Rotate 90° CW"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.min(+(z + 0.25).toFixed(2), 4.0))}
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.max(+(z - 0.25).toFixed(2), 0.75))}
                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleResetView}
                className="text-[10px] text-gray-500 hover:text-gray-900 px-2 py-1 rounded border border-gray-200 font-medium"
                title="Reset zoom and position"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Interactive Wide Viewer (Scroll Wheel Zoom & Click-and-Drag Pan) */}
          <div
            ref={viewerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            className={`relative h-[310px] sm:h-[340px] md:h-[370px] bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center p-2 border border-gray-300 select-none ${
              isPanning ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            title="Scroll mouse wheel inside to zoom • Click & drag to pan • Double-click to toggle 2x zoom"
          >
            <div
              className="transition-transform duration-75 origin-center will-change-transform flex items-center justify-center w-full h-full"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoomLevel})`,
              }}
            >
              <img
                src={imageUrl}
                alt="Receipt Original"
                draggable={false}
                className="max-h-full max-w-full w-full object-contain shadow-2xl rounded pointer-events-none"
              />
            </div>

            {/* Quick Helper Floating Badge */}
            <div className="absolute bottom-2 left-2 pointer-events-none bg-slate-900/85 backdrop-blur-sm text-[10px] text-amber-200/90 px-2.5 py-1 rounded-md border border-slate-700/60 flex items-center space-x-1.5 shadow">
              <span>🖱️ Wheel to Zoom</span>
              <span className="text-gray-500">•</span>
              <span>Drag to Pan</span>
              <span className="text-gray-500">•</span>
              <span>2x on Double-Click</span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
            <span>Rotation: {rotation}° (Applied: {result.rotation_applied || 0}°)</span>
            <span className="font-mono font-semibold text-gray-700">Zoom: {Math.round(zoomLevel * 100)}%</span>
          </div>
        </div>

        {/* Right: Form */}
        <div className="lg:col-span-6 xl:col-span-6 space-y-6">
          {/* Card 1: Receipt Header */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                1. Receipt Header & Pooja Dates
              </h3>
              {getBadge('receipt_no')}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Receipt No *', val: receiptNo, set: setReceiptNo, mono: true },
                { label: 'Book Number', val: bookNumber, set: setBookNumber, mono: true, placeholder: 'e.g. BOOK-001' },
                {
                  label: 'Book Year',
                  val: String(receiptYear),
                  set: (v: string) => setReceiptYear(parseInt(v) || 2026),
                  mono: true,
                },
                {
                  label: 'Receipt Date',
                  val: receiptDate,
                  set: setReceiptDate,
                  placeholder: 'DD-MM-YYYY',
                },
                { label: 'Amount (₹)', val: amount, set: setAmount, mono: true },
              ].map(({ label, val, set, mono, placeholder }) => (
                <div key={label}>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    placeholder={placeholder}
                    className={`w-full text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-900 focus:ring-2 focus:ring-amber-500 ${
                      mono ? 'font-mono font-bold' : ''
                    }`}
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-50">
              {[
                { label: 'Abhishekam From', val: abhishekamFrom, set: setAbhishekamFrom },
                { label: 'Abhishekam To', val: abhishekamTo, set: setAbhishekamTo },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    placeholder="DD-MM-YYYY"
                    className="w-full text-xs font-mono border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-900 focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: Gothram Resolution (Bidirectional Auto-Fill) */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="flex items-center space-x-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                  2. Gothram Resolution (గోత్రం)
                </h3>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    result.gothram_in_reference
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}
                >
                  {result.gothram_in_reference ? '✓ Verified in Master List' : 'Review Needed'}
                </span>
              </div>
              {getBadge('gothram')}
            </div>

            {gothramAsWritten && (
              <div className="text-[11px] text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-200">
                <span className="font-semibold text-gray-700">Raw OCR As-Written:</span>{' '}
                <span className="font-mono text-gray-800">"{gothramAsWritten}"</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1 font-telugu">
                  గోత్రం (తెలుగు) — Auto-filled / Editable
                </label>
                <input
                  type="text"
                  value={gothramTe}
                  onChange={(e) => handleGothramTeChange(e.target.value)}
                  placeholder="ఉదా. పైడిపల్లి"
                  className="w-full text-xs font-telugu font-semibold border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Gothram (English) *
                </label>
                <input
                  type="text"
                  value={gothramEn}
                  onChange={(e) => handleGothramEnChange(e.target.value)}
                  placeholder="e.g. PAIDIPALLI"
                  className="w-full text-xs font-bold border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Gothram Directory Search */}
            <div className="relative pt-1">
              <label className="block text-[11px] font-medium text-gray-500 mb-1 flex items-center space-x-1">
                <Search className="w-3 h-3" />
                <span>Search from 2,099 Master Gothrams:</span>
              </label>
              <input
                type="text"
                value={gothramQuery}
                onChange={(e) => handleGothramSearch(e.target.value)}
                placeholder="Type 2+ letters (e.g. Paidipalli, Kashyapa, Haritha)..."
                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1 text-gray-700 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-amber-500"
              />

              {showGothramDrop && gothramSuggestions.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-300 rounded-xl shadow-xl divide-y divide-gray-100">
                  {gothramSuggestions.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setGothramEn(item.gothram_en);
                        if (item.gothram_te) setGothramTe(item.gothram_te);
                        else setGothramTe(transliterateToTelugu(item.gothram_en));
                        setGothramQuery('');
                        setShowGothramDrop(false);
                      }}
                      className="px-3 py-2 hover:bg-amber-50 cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-gray-800">{item.gothram_en}</span>
                        {item.gothram_te && (
                          <span className="text-gray-500 ml-2 font-telugu">({item.gothram_te})</span>
                        )}
                      </div>
                      <span className="text-[10px] text-amber-700 font-mono">
                        {Math.round(item.similarity_score)}% match
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Shared Family Surname & Devotees List */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-amber-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                  3. Family Details (కుటుంబ సభ్యులు)
                </h3>
                <span className="text-xs text-gray-500 font-normal">
                  ({persons.length} member{persons.length !== 1 ? 's' : ''})
                </span>
              </div>
              <button
                onClick={handleAddPerson}
                className="flex items-center space-x-1 text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Member</span>
              </button>
            </div>

            {/* ── SHARED SURNAME (Bidirectional Auto-Fill) ── */}
            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3">
              <p className="text-[11px] font-bold text-amber-900 mb-2 uppercase tracking-wider">
                Family Surname (ఇంటిపేరు) — Shared by all family members
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 mb-0.5 font-telugu">
                    ఇంటిపేరు (తెలుగు) — Auto-filled / Editable
                  </label>
                  <input
                    type="text"
                    value={surnameTe}
                    onChange={(e) => handleSurnameTeChange(e.target.value)}
                    placeholder="ఉదా. యడ్ల"
                    className="w-full text-sm font-telugu font-semibold border-2 border-amber-300 rounded-lg px-2.5 py-1.5 text-gray-900 bg-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                    Surname (English) — Auto-filled / Editable
                  </label>
                  <input
                    type="text"
                    value={surnameEn}
                    onChange={(e) => handleSurnameEnChange(e.target.value)}
                    placeholder="e.g. YADLA"
                    className="w-full text-sm font-bold border-2 border-amber-300 rounded-lg px-2.5 py-1.5 text-gray-900 bg-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* ── GIVEN NAMES LIST (Bidirectional Auto-Fill) ── */}
            <div className="space-y-2">
              {persons.map((person, idx) => (
                <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-gray-700">
                      Member #{idx + 1}:{' '}
                      {surnameTe ? `${surnameTe} ` : surnameEn ? `${surnameEn} ` : ''}
                      <span className="text-amber-800">
                        {person.given_name_te || person.given_name_en || '(పేరు / Name)'}
                      </span>
                    </span>
                    {persons.length > 1 && (
                      <button
                        onClick={() => handleRemovePerson(idx)}
                        className="text-gray-400 hover:text-red-600 p-1 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5 font-telugu">
                        పేరు (తెలుగు) — Auto-filled / Editable
                      </label>
                      <input
                        type="text"
                        value={person.given_name_te}
                        onChange={(e) => handleGivenNameTe(idx, e.target.value)}
                        placeholder="ఉదా. పట్టాభి రామయ్య"
                        className="w-full text-xs font-telugu font-semibold border border-gray-300 rounded-md px-2 py-1.5 text-gray-800 focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-0.5">
                        Given Name (English) — Auto-filled / Editable
                      </label>
                      <input
                        type="text"
                        value={person.given_name_en}
                        onChange={(e) => handleGivenNameEn(idx, e.target.value)}
                        placeholder="e.g. PATTABHI RAMAYYA"
                        className="w-full text-xs font-semibold border border-gray-300 rounded-md px-2 py-1.5 text-gray-800 focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 4: Phones */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                4. Contact Phone Numbers (ఫోన్ నంబర్లు)
              </h3>
              <div className="flex items-center space-x-2">
                {getBadge('phones')}
                <button
                  onClick={handleAddPhone}
                  className="flex items-center space-x-1 text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Phone</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {phones.map((phone, idx) => {
                const digits = phone.number.replace(/\D/g, '');
                const isValid = /^[6-9]\d{9}$/.test(digits);
                return (
                  <div key={idx} className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="primaryPhone"
                      checked={phone.is_primary}
                      onChange={() => handleSetPrimaryPhone(idx)}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <div className="flex-1 relative">
                      <input
                        type="tel"
                        value={phone.number}
                        onChange={(e) => {
                          const updated = [...phones];
                          updated[idx].number = e.target.value;
                          setPhones(updated);
                        }}
                        placeholder="10-digit Indian Mobile (e.g. 9989496034)"
                        className={`w-full text-xs font-mono font-bold border rounded-md px-2.5 py-1.5 pr-24 ${
                          isValid
                            ? 'border-emerald-300 bg-emerald-50/20 text-gray-900'
                            : 'border-red-300 bg-red-50/20 text-red-900'
                        }`}
                      />
                      <span className="absolute right-2.5 top-1.5 text-[10px] font-semibold">
                        {isValid ? (
                          <span className="text-emerald-600">✓ Valid Mobile</span>
                        ) : (
                          <span className="text-red-500">Must be 10 digits</span>
                        )}
                      </span>
                    </div>
                    {phone.is_primary && (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                        Primary
                      </span>
                    )}
                    {phones.length > 1 && (
                      <button
                        onClick={() => handleRemovePhone(idx)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 5: Postal Address (Bidirectional Auto-Fill) */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                5. Postal Address for Prasadam (చిరునామా)
              </h3>
              <div className="flex items-center space-x-2">
                {addressTe && (
                  <button
                    type="button"
                    onClick={() => setAddressEn(transliterateTeluguToEnglish(addressTe))}
                    title="Re-sync English translation directly from Telugu text"
                    className="text-[10px] font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded"
                  >
                    ⇄ Sync Te → En
                  </button>
                )}
                {getBadge('address')}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1 font-telugu">
                  చిరునామా (తెలుగు) — Auto-filled / Editable
                </label>
                <textarea
                  rows={3}
                  value={addressTe}
                  onChange={(e) => handleAddressTeChange(e.target.value)}
                  placeholder="డి.నెం, మెయిన్ రోడ్డు, గ్రామం, మండలం, జిల్లా"
                  className="w-full text-xs font-telugu border border-gray-300 rounded-lg p-2 text-gray-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Address (English) * — Auto-filled / Editable
                </label>
                <textarea
                  rows={3}
                  value={addressEn}
                  onChange={(e) => handleAddressEnChange(e.target.value)}
                  placeholder="D.No, Street, Landmark, Village, District"
                  className="w-full text-xs border border-gray-300 rounded-lg p-2 text-gray-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
              <div className="w-full sm:w-48">
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  PIN Code
                </label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => handlePincodeChange(e.target.value)}
                  placeholder="6 digits (e.g. 533307)"
                  className="w-full text-xs font-mono font-bold border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {geoInfo && (geoInfo.district_en || geoInfo.district_te) && (
                <div className="flex-1 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-amber-700 flex-shrink-0" />
                    <div className="text-[11px] text-gray-800">
                      <span className="font-bold text-amber-950">AP/TS Geolocation: </span>
                      <span className="font-semibold">{geoInfo.district_en}</span>
                      {geoInfo.district_te && (
                        <span className="font-telugu text-gray-600 ml-1">({geoInfo.district_te})</span>
                      )}
                      {geoInfo.taluk && (
                        <span className="text-gray-600 ml-1.5">• {geoInfo.taluk} Mandal</span>
                      )}
                      {geoInfo.state && (
                        <span className="text-gray-500 ml-1">({geoInfo.state})</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleEnrichAddress}
                    className="text-[10px] font-bold text-amber-800 bg-white hover:bg-amber-100 border border-amber-300 px-2 py-1 rounded shadow-xs whitespace-nowrap"
                  >
                    + Enrich Address
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Card 6: AI Diagnostics (Collapsible) */}
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4">
            <button
              onClick={() => setShowAuditPanel(!showAuditPanel)}
              className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-700"
            >
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>AI Pipeline Diagnostics & API Cost</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="font-mono text-emerald-700 font-bold lowercase">
                  ${result.total_cost_usd?.toFixed(5) || '0.00000'} (~₹
                  {result.total_cost_inr?.toFixed(2) || '0.00'})
                </span>
                {showAuditPanel ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </div>
            </button>

            {showAuditPanel && (
              <div className="mt-3 pt-3 border-t border-gray-200 text-xs space-y-2 text-gray-600">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                  {[
                    { label: 'Duration', val: `${result.duration_seconds || 0}s` },
                    {
                      label: 'Input Tokens',
                      val: String(result.token_usage?.total_input_tokens || 0),
                    },
                    {
                      label: 'Output Tokens',
                      val: String(result.token_usage?.total_output_tokens || 0),
                    },
                    {
                      label: 'Model',
                      val: result.token_usage?.calls?.[0]?.model || 'gemini-3.5-flash-lite',
                    },
                  ].map(({ label, val }) => (
                    <div key={label} className="bg-white p-2 rounded border border-gray-200">
                      <span className="text-gray-400 block">{label}</span>
                      <span className="font-bold text-gray-800 text-[10px]">{val}</span>
                    </div>
                  ))}
                </div>
                {result.intermediate_passes?.pass1_transcription && (
                  <div className="mt-2 bg-white p-2.5 rounded border border-gray-200">
                    <span className="font-bold text-gray-700 block text-[10px] uppercase mb-1">
                      Pass 1 Transcription:
                    </span>
                    <pre className="text-[10px] text-gray-600 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {result.intermediate_passes.pass1_transcription}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
