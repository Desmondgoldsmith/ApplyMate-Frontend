import { describe, expect, it } from 'vitest';

import {
  buildCvNamingForExport,
  formatCvBackendExportFilename,
  isGenericCvExportFilename,
  parseCvDisplayLabelParts,
} from './cv-profile-naming';

describe('cv-profile-naming export', () => {
  it('builds backend-style base filename', () => {
    expect(
      formatCvBackendExportFilename(
        { userName: 'Desmond Goldsmith', role: 'Frontend Engineer' },
        'pdf',
      ),
    ).toBe('Desmond-Goldsmith-Frontend-Engineer-CV.pdf');
  });

  it('builds tailored filename', () => {
    expect(
      formatCvBackendExportFilename(
        {
          userName: 'Desmond Goldsmith',
          company: 'ACME',
          role: 'Software Engineer',
          tailored: true,
        },
        'pdf',
      ),
    ).toBe('Desmond-Goldsmith-ACME-Software-Engineer-CV-Tailored.pdf');
  });

  it('parses display label with em dash', () => {
    expect(parseCvDisplayLabelParts('Desmond Goldsmith — DevOps Engineer')).toEqual({
      userName: 'Desmond Goldsmith',
      role: 'DevOps Engineer',
    });
  });

  it('builds export naming from display label', () => {
    const naming = buildCvNamingForExport(
      { headline: 'DevOps Engineer', structured: { fullName: 'Desmond Goldsmith' } } as never,
      'Desmond Goldsmith — DevOps Engineer',
    );
    expect(naming.userName).toBe('Desmond Goldsmith');
    expect(naming.role).toBe('DevOps Engineer');
    expect(formatCvBackendExportFilename(naming, 'pdf')).toBe(
      'Desmond-Goldsmith-DevOps-Engineer-CV.pdf',
    );
  });

  it('detects generic export names', () => {
    expect(isGenericCvExportFilename('CV.pdf')).toBe(true);
    expect(isGenericCvExportFilename('Desmond-Goldsmith-CV.pdf')).toBe(false);
  });
});
