'use client';

import { useState } from 'react';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function BillActions({ message, filename = 'ratan-medical-hall-bill.txt' }: { message: string; filename?: string }) {
  const [notice, setNotice] = useState('');

  async function copyBill() {
    try {
      await navigator.clipboard.writeText(message);
      setNotice('Text bill copied to clipboard.');
    } catch {
      setNotice('Clipboard access was blocked. Select the message text and copy it manually.');
    }
  }

  function downloadBill() {
    const blob = new Blob([message], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotice('Text bill download started.');
  }

  function printBill() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setNotice('The print window was blocked. Allow pop-ups for this site and try again.');
      return;
    }

    const safeText = escapeHtml(message);
    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ratan Medical Hall — Settlement Summary</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 28px; color: #111; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; font: 12pt/1.5 Arial, sans-serif; }
    @page { size: A4; margin: 16mm; }
  </style>
</head>
<body><pre>${safeText}</pre></body>
</html>`);
    printWindow.document.close();
    printWindow.opener = null;
    printWindow.focus();
    printWindow.print();
    setNotice('Print dialog opened.');
  }

  return <div className="stack" style={{ gap: 8 }}>
    <div className="inline-form" style={{ flexWrap: 'wrap' }}>
      <button type="button" className="btn btn-secondary" onClick={copyBill}>Copy text bill</button>
      <button type="button" className="btn btn-secondary" onClick={downloadBill}>Download .txt</button>
      <button type="button" className="btn btn-secondary" onClick={printBill}>Print bill</button>
    </div>
    {notice && <div className="notice notice-neutral" role="status" aria-live="polite">{notice}</div>}
  </div>;
}
