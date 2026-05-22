import { api } from '@/lib/api';
import { patchSanitizedContactUrlsForExport } from '@/lib/cvBuilder';

/** Opens the exported PDF in a new browser tab (object URL). Backend should accept `cvProfileId` on GET /cv/export/pdf. */
export async function openCvPdfInNewTab(cvProfileId: string, template?: string): Promise<void> {
  await patchSanitizedContactUrlsForExport(cvProfileId);
  const { blob } = await api.cvExport.downloadPdf({ template, cvProfileId });
  const mime = blob.type && blob.type !== 'application/octet-stream' ? blob.type : 'application/pdf';
  const typed = new Blob([blob], { type: mime });
  const url = URL.createObjectURL(typed);
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error('Popup blocked — allow popups for this site to view the PDF.');
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}
