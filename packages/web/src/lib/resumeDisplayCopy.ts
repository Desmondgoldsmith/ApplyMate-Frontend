/** User-facing copy: prefer "Resume" over "CV". */
export const RESUME_READY_TOAST = 'Your resume is ready — here it is.';

export function displayResumeCopy(text: string): string {
  return text
    .replace(/\bCVs\b/g, 'Resumes')
    .replace(/\bCV\b/g, 'Resume')
    .replace(/\bCv\b/g, 'Resume');
}
