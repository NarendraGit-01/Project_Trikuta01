import { Receipt } from '../types';

/**
 * Universal print handler for A4 postal dispatch stickers (2 columns x 6 rows = 12 stickers/sheet).
 * Standardizes dimensions, typography, and single-devotee address formatting across both
 * the Books Page and the Dispatch Page.
 *
 * Devotee name is rendered on a single compact line (Telugu + English) so the full postal
 * address in both languages has ample space and is never cut off.
 */
export function printPostalLabels(receipts: Receipt[], docTitle?: string): boolean {
  const withAddress = receipts.filter(
    (r) => (r.address_te || r.address_en || '').trim().length > 0
  );

  if (withAddress.length === 0) {
    alert('No devotees with addresses found to print labels.');
    return false;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print dispatch labels.');
    return false;
  }

  const labelCards = withAddress
    .map((r) => {
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
    })
    .join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${docTitle || 'Postal Dispatch Labels'}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Suranna&family=Tiro+Telugu&display=swap" rel="stylesheet">
      <style>
        @page {
          size: A4 portrait;
          margin: 8mm 10mm;
        }
        * {
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 0;
          background: #fff;
          color: #111;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .font-telugu {
          font-family: 'Tiro Telugu', 'Suranna', 'Gautami', 'Segoe UI Historic', sans-serif;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          grid-auto-rows: 44.5mm;
          gap: 4mm 5mm;
        }
        .label-card {
          border: 1px dashed #64748b;
          border-radius: 6px;
          padding: 4mm 5mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          page-break-inside: avoid;
          overflow: hidden;
          background: #ffffff;
          box-sizing: border-box;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #cbd5e1;
          padding-bottom: 2px;
          font-size: 7.5pt;
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
          gap: 4px;
          margin-top: 1.5px;
          margin-bottom: 1.5px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .sec-label {
          font-size: 7pt;
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
          font-size: 9pt;
          font-weight: 700;
          color: #0f172a;
        }
        .devotee-en {
          font-size: 8pt;
          font-weight: 600;
          color: #334155;
          text-transform: uppercase;
        }
        .address-section {
          border-top: 1px solid #e2e8f0;
          padding-top: 2px;
          margin-top: 1px;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          gap: 1.5px;
          overflow: hidden;
        }
        .addr-label {
          font-size: 6.8pt;
          color: #64748b;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .addr-te {
          font-size: 8pt;
          color: #0f172a;
          line-height: 1.25;
        }
        .addr-en {
          font-size: 7.5pt;
          color: #334155;
          line-height: 1.2;
        }
        .footer-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 8pt;
          font-family: 'SF Mono', Consolas, Monaco, monospace;
          font-weight: 700;
          color: #0f172a;
          border-top: 1px solid #cbd5e1;
          padding-top: 2px;
          margin-top: 1.5px;
          flex-shrink: 0;
        }
      </style>
    </head>
    <body>
      <div class="grid">${labelCards}</div>
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
  return true;
}
