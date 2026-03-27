import React from "react";

export default function ProGate() {
  return (
    <div className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 border border-blue-700/50 rounded-lg p-4">
      <div className="text-sm font-semibold mb-2">Pro'ya Yukselt</div>
      <ul className="text-xs text-gray-300 space-y-1 mb-3">
        <li>Sinirsiz tarama</li>
        <li>14 PII tipi (email, IBAN, TC kimlik, isim...)</li>
        <li>Dosya tarama (PDF, DOCX, TXT)</li>
        <li>Otomatik maskeleme</li>
        <li>Tum AI siteleri + generic destek</li>
      </ul>
      <a
        href="https://pdfcensor.com/pricing"
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2 rounded-lg transition-colors"
      >
        Pro'ya Gec
      </a>
    </div>
  );
}
