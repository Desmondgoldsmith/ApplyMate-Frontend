'use client';

import { useMutation } from '@tanstack/react-query';

import { api, type CVProfile } from '@/lib/api';
import {
  buildCvNamingForExport,
  formatCvBackendExportFilename,
  isGenericCvExportFilename,
  type CvProfileNamingInput,
} from '@/lib/cv-profile-naming';
import { patchSanitizedContactUrlsForExport } from '@/lib/cvBuilder';
import {
  headerPreviewToHideList,
  readHeaderPreviewStorage,
} from '@/lib/cvHeaderPreview';

function hasValidPersonName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return n.length > 0 && n !== 'my cv' && n !== 'cv' && n !== 'untitled';
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function useExportCV() {
  return useMutation({
    mutationFn: async ({
      format,
      template,
      cvProfileId,
      jobAnalysisId,
      namingFallback,
      profileForNaming,
      profileDisplayName,
      printDocument,
    }: {
      /**
       * Builds the editor-rendered page for the PDF. When it (or the request) fails, the server's
       * own template is used instead, so a download always succeeds.
       */
      printDocument?: () => Promise<string | null>;
      format: 'pdf' | 'docx';
      template?: string;
      cvProfileId?: string;
      /** When set, server uses tailored filename suffix (`…-CV-Tailored.pdf`). */
      jobAnalysisId?: string;
      /** Used when export response headers are blocked (CORS) or generic. */
      namingFallback?: CvProfileNamingInput;
      profileForNaming?: CVProfile | null;
      /** In-app CV label from picker (e.g. `Desmond Goldsmith — DevOps Engineer`). */
      profileDisplayName?: string | null;
    }) => {
      if (cvProfileId?.trim()) {
        await patchSanitizedContactUrlsForExport(cvProfileId.trim());
      }
      const exportOpts = {
        template,
        cvProfileId,
        jobAnalysisId: jobAnalysisId?.trim() || undefined,
        hide: headerPreviewToHideList(readHeaderPreviewStorage(cvProfileId)),
      };
      const downloadPdf = async () => {
        const id = cvProfileId?.trim();
        if (id && printDocument) {
          try {
            const html = await printDocument();
            if (html) {
              return await api.cvExport.downloadPdfFromHtml({
                cvProfileId: id,
                html,
                jobAnalysisId: exportOpts.jobAnalysisId,
              });
            }
          } catch {
            /* fall back to the server-built PDF below */
          }
        }
        return api.cvExport.downloadPdf(exportOpts);
      };
      const { blob, filename: headerFilename } =
        format === 'pdf'
          ? await downloadPdf()
          : await api.cvExport.downloadDocx(exportOpts);
      const mime =
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const typed =
        blob.type && blob.type !== 'application/octet-stream'
          ? blob
          : new Blob([blob], { type: mime });

      const resolvedNaming =
        namingFallback ??
        (profileForNaming
          ? buildCvNamingForExport(profileForNaming, profileDisplayName, {
              tailored: Boolean(jobAnalysisId?.trim()),
            })
          : null);

      let downloadName = headerFilename;
      const shouldUseClientName =
        resolvedNaming &&
        (isGenericCvExportFilename(downloadName) ||
          /^my-cv-/i.test(downloadName) ||
          !hasValidPersonName(resolvedNaming.userName));
      if (shouldUseClientName && resolvedNaming) {
        downloadName = formatCvBackendExportFilename(
          {
            ...resolvedNaming,
            tailored: Boolean(jobAnalysisId?.trim()) || resolvedNaming.tailored,
          },
          format,
        );
      }

      triggerBlobDownload(typed, downloadName);
    },
  });
}
