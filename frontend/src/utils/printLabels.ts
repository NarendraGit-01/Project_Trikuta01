import { Receipt } from '../types';

/**
 * Universal print handler for A4 postal dispatch stickers.
 * Strictly formatted for 12 stickers per A4 sheet (2 columns x 6 rows).
 *
 * Prints directly in the existing browser page via a hidden iframe (no new browser tab/window).
 * Devotee name is rendered on a single compact line (Telugu + English) so full postal addresses
 * fit completely without being cut off.
 */
export function printPostalLabels(receipts: Receipt[], docTitle?: string): boolean {
  const withAddress = receipts.filter(
    (r) => (r.address_te || r.address_en || '').trim().length > 0
  );

  if (withAddress.length === 0) {
    alert('చిరునామా ఉన్న భక్తుల రికార్డులు కనుగొనబడలేదు (No devotees with addresses found to print labels).');
    return false;
  }

  const labelCards = withAddress.map((r) => {
    // Devotee Name: strictly first person only, single line
    const primaryDevotee = r.persons && r.persons.length > 0 ? r.persons[0] : null;
    const devoteeTe = primaryDevotee
      ? [primaryDevotee.surname_te, primaryDevotee.given_name_te].filter(Boolean).join(' ').trim()
      : '';
    const devoteeEn = primaryDevotee
      ? [primaryDevotee.surname_en, primaryDevotee.given_name_en].filter(Boolean).join(' ').trim()
      : '';

    const primaryPhone =
      r.phones?.find((p) => p.is_primary)?.number || r.phones?.[0]?.number || '';
    const addrTe = (r.address_te || '').trim();
    const addrEn = (r.address_en || '').trim();
    const bkLabel = r.book_number ? `BK #${r.book_number}` : 'BK #—';

    return `
      <div class="label-card">
        <div class="header">
          <span class="temple">SRI TRIKOTESWARA SWAMY TEMPLE</span>
          <span class="receipt-tag">${bkLabel} • RCPT #${r.receipt_no}</span>
        </div>

        <div class="to-section">
          <span class="sec-label">TO (గ్రహీత):</span>
          <span class="devotee-names">
            <strong class="devotee-te font-telugu">${devoteeTe}</strong>
            ${devoteeEn ? `<span class="devotee-en"> / ${devoteeEn}</span>` : ''}
            ${!devoteeTe && !devoteeEn ? `<span class="devotee-en">Devotee</span>` : ''}
          </span>
        </div>

        <div class="address-section">
          <div class="addr-label">ADDRESS (చిరునామా):</div>
          ${addrTe ? `<div class="addr-te font-telugu">${addrTe}</div>` : ''}
          ${addrEn ? `<div class="addr-en">${addrEn}</div>` : ''}
        </div>

        <div class="footer-meta">
          <span>PIN: <b>${r.pincode || '—'}</b></span>
          <span>Ph: <b>${primaryPhone || '—'}</b></span>
        </div>
      </div>
    `;
  });

  // Group strictly into pages of 12 labels (2 columns x 6 rows)
  const sheets: string[][] = [];
  for (let i = 0; i < labelCards.length; i += 12) {
    sheets.push(labelCards.slice(i, i + 12));
  }

  const pagesHtml = sheets
    .map(
      (sheet) => `
      <div class="sheet-page">
        <div class="grid">
          ${sheet.join('')}
        </div>
      </div>
    `
    )
    .join('');

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${docTitle || 'Postal Dispatch Labels'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Suranna&family=Tiro+Telugu&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 5mm 6mm;
    }
    * {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .font-telugu {
      font-family: 'Tiro Telugu', 'Suranna', 'Gautami', 'Segoe UI Historic', sans-serif;
    }
    .sheet-page {
      width: 100%;
      height: 285mm;
      max-height: 285mm;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }
    .sheet-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      grid-template-rows: repeat(6, 44.5mm);
      gap: 2.5mm 4mm;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
    }
    .label-card {
      border: 1px dashed #64748b;
      border-radius: 6px;
      padding: 3mm 4mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-inside: avoid;
      break-inside: avoid;
      overflow: hidden;
      background: #ffffff;
      height: 44.5mm;
      max-height: 44.5mm;
      box-sizing: border-box;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 1px;
      font-size: 7.2pt;
      flex-shrink: 0;
    }
    .temple {
      font-weight: 800;
      color: #78350f;
      letter-spacing: 0.2px;
    }
    .receipt-tag {
      font-family: 'SF Mono', Consolas, Monaco, monospace;
      font-weight: 700;
      color: #1e293b;
    }
    .to-section {
      display: flex;
      align-items: baseline;
      gap: 3px;
      margin-top: 1px;
      margin-bottom: 1px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .sec-label {
      font-size: 6.5pt;
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      flex-shrink: 0;
    }
    .devotee-names {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .devotee-te {
      font-size: 8.5pt;
      font-weight: 700;
      color: #0f172a;
    }
    .devotee-en {
      font-size: 7.2pt;
      font-weight: 600;
      color: #334155;
      text-transform: uppercase;
    }
    .address-section {
      border-top: 1px solid #e2e8f0;
      padding-top: 1.5px;
      margin-top: 1px;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      gap: 1px;
      overflow: hidden;
    }
    .addr-label {
      font-size: 6.5pt;
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .addr-te {
      font-size: 7.8pt;
      color: #0f172a;
      line-height: 1.2;
    }
    .addr-en {
      font-size: 7.2pt;
      color: #334155;
      line-height: 1.15;
      word-break: break-word;
    }
    .footer-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7.5pt;
      font-family: 'SF Mono', Consolas, Monaco, monospace;
      font-weight: 700;
      color: #0f172a;
      border-top: 1px solid #cbd5e1;
      padding-top: 1.5px;
      margin-top: 1px;
      flex-shrink: 0;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;

  // Print directly in the existing browser page using a hidden iframe
  let iframe = document.getElementById('trikuta-print-frame') as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'trikuta-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);
  }

  const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!iframeDoc) {
    // Graceful fallback if iframe document cannot be opened
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(fullHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 300);
    }
    return true;
  }

  iframeDoc.open();
  iframeDoc.write(fullHtml);
  iframeDoc.close();

  // Trigger print directly inside the current browser window
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  }, 350);

  return true;
}
