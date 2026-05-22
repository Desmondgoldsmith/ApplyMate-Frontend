import { describe, expect, it } from 'vitest';

import {
  parseFilenameFromContentDisposition,
  resolveExportFilename,
} from './exportFilenameFromResponse';

describe('exportFilenameFromResponse', () => {
  it('parses quoted filename from Content-Disposition', () => {
    expect(
      parseFilenameFromContentDisposition(
        'attachment; filename="Desmond-Goldsmith-Frontend-Engineer-CV.pdf"',
      ),
    ).toBe('Desmond-Goldsmith-Frontend-Engineer-CV.pdf');
  });

  it('parses filename* UTF-8 values', () => {
    expect(
      parseFilenameFromContentDisposition(
        "attachment; filename*=UTF-8''Desmond-Goldsmith-ACME-Software-Engineer-CV-Tailored.pdf",
      ),
    ).toBe('Desmond-Goldsmith-ACME-Software-Engineer-CV-Tailored.pdf');
  });

  it('prefers X-Export-Filename over Content-Disposition', () => {
    expect(
      resolveExportFilename(
        {
          'x-export-filename': 'Server-Name-CV.pdf',
          'content-disposition': 'attachment; filename="Ignored.pdf"',
        },
        'CV.pdf',
      ),
    ).toBe('Server-Name-CV.pdf');
  });

  it('falls back when headers are missing', () => {
    expect(resolveExportFilename({}, 'CV.docx')).toBe('CV.docx');
  });
});
