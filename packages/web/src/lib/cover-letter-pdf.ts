import { jsPDF } from 'jspdf';

function slugFromCompany(company: string): string {
  const s = company
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return s || 'cover-letter';
}

/**
 * A4 cover letter PDF with a minimal teal accent — readable on screen and when printed.
 */
export function downloadCoverLetterPdf(opts: {
  body: string;
  title?: string;
  company?: string;
}): void {
  const { body, title, company } = opts;
  const text = body.trim();
  if (!text) return;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxW = pageW - margin * 2;
  let y = margin;

  doc.setDrawColor(0, 174, 175);
  doc.setLineWidth(0.55);
  doc.line(margin, y, pageW - margin, y);
  y += 11;

  doc.setTextColor(22, 24, 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Cover letter', margin, y);
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(75, 85, 85);
  if (title?.trim()) {
    doc.text(title.trim(), margin, y);
    y += 5.2;
  }
  if (company?.trim()) {
    doc.text(company.trim(), margin, y);
    y += 7;
  } else {
    y += 3;
  }

  doc.setTextColor(28, 32, 32);
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(text.replace(/\r\n/g, '\n'), maxW);
  const lineHeight = 6.1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (y > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineHeight;
  }

  const footer = 'Generated with ApplyMate';
  const lastPage = doc.getNumberOfPages();
  doc.setPage(lastPage);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(140, 150, 150);
  doc.text(footer, margin, pageH - 10);

  doc.save(`cover-letter-${slugFromCompany(company || '')}.pdf`);
}
