// ── Document Export Utilities ──
// Provides functions to export workflow documents to PDF and HTML formats.

export function exportDocumentPDF(element, filename = 'document.pdf', title = 'Document') {
  if (!element) {
    console.error('No element provided for PDF export');
    return;
  }

  // Import html2pdf dynamically to avoid build issues
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
  script.onload = () => {
    const opt = {
      margin: [0.5, 0.5, 0.75, 0.5], // top, left, bottom, right in inches
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { orientation: 'portrait', unit: 'in', format: 'letter' }
    };

    const html2pdf = window.html2pdf;
    if (!html2pdf) {
      console.error('html2pdf library failed to load');
      return;
    }

    html2pdf()
      .set(opt)
      .from(element)
      .save()
      .catch((err) => {
        console.error('PDF export failed:', err);
        alert('Failed to export PDF. Please try again.');
      });
  };

  script.onerror = () => {
    console.error('Failed to load html2pdf library');
    alert('Failed to load PDF library. Please try again.');
  };

  document.head.appendChild(script);
}

export function exportDocumentHTML(element, filename = 'document.html', title = 'Document') {
  if (!element) {
    console.error('No element provided for HTML export');
    return;
  }

  // Get the HTML content
  const htmlContent = element.outerHTML;

  // Wrap in a complete HTML document with styling
  const completeHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Inter', 'Segoe UI', sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #0f172a;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 0.75in;
      background: white;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    td, th {
      padding: 8px 0;
    }
    h1 {
      font-family: 'Merriweather', Georgia, serif;
      font-size: 28px;
      font-weight: bold;
      color: #0A2540;
      margin: 0;
    }
    h2 {
      font-family: 'Merriweather', Georgia, serif;
      font-size: 14px;
      font-weight: bold;
      color: #1B3A6B;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
      margin-bottom: 12px;
      margin-top: 24px;
    }
    .highlight-yellow {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px;
    }
    .disclaimer {
      background-color: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 16px;
      margin-top: 24px;
      font-size: 9px;
      line-height: 1.6;
      color: #475569;
      font-style: italic;
    }
    @media print {
      body {
        padding: 0.5in;
      }
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;

  // Create a blob and download
  const blob = new Blob([completeHTML], { type: 'text/html;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function printDocument(element, title = 'Document') {
  if (!element) {
    console.error('No element provided for printing');
    return;
  }

  const printWindow = window.open('', '', 'height=600,width=900');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body {
          font-family: 'Inter', 'Segoe UI', sans-serif;
          font-size: 11px;
          line-height: 1.5;
          color: #0f172a;
          margin: 0.75in;
        }
        table {
          border-collapse: collapse;
          width: 100%;
        }
        h1, h2 {
          font-family: 'Merriweather', Georgia, serif;
          color: #0A2540;
        }
        @media print {
          body {
            margin: 0.5in;
          }
        }
      </style>
    </head>
    <body>
      ${element.outerHTML}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

export function exportTermSheetPDF(element, filename = 'term-sheet.pdf') {
  return exportDocumentPDF(element, filename, 'Term Sheet');
}

export function exportTermSheetHTML(element, filename = 'term-sheet.html') {
  return exportDocumentHTML(element, filename, 'Term Sheet');
}

export function printTermSheet(element) {
  return printDocument(element, 'Term Sheet');
}
