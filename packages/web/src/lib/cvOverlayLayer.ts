/** Tailoring full-screen shell (`CvTailoringSidebar`). */
export const TAILOR_MODAL_BACKDROP_Z = 100_050;
export const TAILOR_MODAL_PANEL_Z = 100_060;

/**
 * Popovers portaled to `document.body` (EntryToolbar delete confirm, date picker, etc.)
 * must sit above the tailoring shell.
 */
export const TAILOR_CV_PORTAL_Z = 100_200;

/** Expanded inline editor inside tailor CV builder. */
export const TAILOR_CV_EDITOR_OVERLAY_Z = 100_210;
export const TAILOR_CV_EDITOR_DIALOG_Z = 100_220;

/** Default for CV Clinic / dashboard builder. */
export const CV_CLINIC_PORTAL_Z = 200;
