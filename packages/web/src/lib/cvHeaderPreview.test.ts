import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_HEADER_PREVIEW } from '@/components/cv/CVEditContext';
import {
  headerPreviewToHideList,
  readHeaderPreviewStorage,
  writeHeaderPreviewStorage,
} from '@/lib/cvHeaderPreview';

afterEach(() => {
  window.sessionStorage.clear();
});

describe('headerPreviewToHideList', () => {
  it('hides nothing when every toggle is on', () => {
    expect(headerPreviewToHideList(DEFAULT_HEADER_PREVIEW)).toEqual([]);
  });

  it('lists only the toggles that are off, as export tokens', () => {
    expect(
      headerPreviewToHideList({
        ...DEFAULT_HEADER_PREVIEW,
        showPhone: false,
        showLinkedIn: false,
        showWebsiteToggle: false,
        dateOfBirth: false,
      }),
    ).toEqual(['phone', 'linkedin', 'website', 'dateOfBirth']);
  });
});

describe('readHeaderPreviewStorage', () => {
  it('returns defaults without a profile or saved state', () => {
    expect(readHeaderPreviewStorage(null)).toEqual(DEFAULT_HEADER_PREVIEW);
    expect(readHeaderPreviewStorage('p1')).toEqual(DEFAULT_HEADER_PREVIEW);
  });

  it('round-trips what the editor saved', () => {
    writeHeaderPreviewStorage('p1', {
      ...DEFAULT_HEADER_PREVIEW,
      showEmail: false,
    });
    expect(headerPreviewToHideList(readHeaderPreviewStorage('p1'))).toEqual([
      'email',
    ]);
  });

  it('maps legacy link toggles to the current ones', () => {
    window.sessionStorage.setItem(
      'applymate:cv:headerPreview:p1',
      JSON.stringify({ showLink: false, showExtraLink: false }),
    );
    expect(headerPreviewToHideList(readHeaderPreviewStorage('p1'))).toEqual([
      'linkedin',
      'github',
      'portfolio',
    ]);
  });

  it('falls back to defaults on corrupt storage', () => {
    window.sessionStorage.setItem('applymate:cv:headerPreview:p1', '{not json');
    expect(readHeaderPreviewStorage('p1')).toEqual(DEFAULT_HEADER_PREVIEW);
  });
});
