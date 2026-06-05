/**
 * Single surface identifier for every in-app CV editor (clinic, onboarding, tailoring).
 * Maps to {@link CVBuilder} layout props — core click-to-edit + autosave stay identical.
 */

export type CvBuilderSurfaceContext = 'clinic' | 'onboarding' | 'tailoring';

export type CvBuilderSurfaceLayout = {
  mode: 'dashboard';
  cvMode: 'clinic' | 'tailor';
  deferIncompletePreviewBadges: boolean;
};

export function resolveCvBuilderSurfaceLayout(
  context: CvBuilderSurfaceContext,
): CvBuilderSurfaceLayout {
  switch (context) {
    case 'tailoring':
      return {
        mode: 'dashboard',
        cvMode: 'tailor',
        deferIncompletePreviewBadges: false,
      };
    case 'onboarding':
      return {
        mode: 'dashboard',
        cvMode: 'clinic',
        deferIncompletePreviewBadges: true,
      };
    case 'clinic':
    default:
      return {
        mode: 'dashboard',
        cvMode: 'clinic',
        deferIncompletePreviewBadges: false,
      };
  }
}

export type CvClinicToolbarSurfaceVisibility = {
  libraryLink: boolean;
  profilePicker: boolean;
  newCvButton: boolean;
  pdfDocx: boolean;
};

export function toolbarVisibilityForSurface(
  context: CvBuilderSurfaceContext,
): CvClinicToolbarSurfaceVisibility {
  if (context === 'onboarding') {
    return {
      libraryLink: false,
      profilePicker: false,
      newCvButton: false,
      pdfDocx: false,
    };
  }
  if (context === 'tailoring') {
    return {
      libraryLink: false,
      profilePicker: false,
      newCvButton: false,
      pdfDocx: false,
    };
  }
  return {
    libraryLink: true,
    profilePicker: true,
    newCvButton: true,
    pdfDocx: true,
  };
}
