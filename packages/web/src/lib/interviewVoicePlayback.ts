/** User-facing copy for `POST /interviews/:sessionId/speech` when `data.disabled` is true. */
export type InterviewSpeechDisabledReason =
  | 'elevenlabs_disabled'
  | 'elevenlabs_payment_required'
  | 'elevenlabs_rate_limited'
  | 'elevenlabs_unauthorized'
  | 'elevenlabs_error'
  | string;

export function interviewVoiceDisabledMessage(
  reason?: InterviewSpeechDisabledReason | null,
): string {
  switch (reason) {
    case 'elevenlabs_disabled':
      return 'Premium voice is off in this environment.';
    case 'elevenlabs_payment_required':
      return 'Premium voice is temporarily unavailable.';
    case 'elevenlabs_rate_limited':
      return 'Too many voice requests — try again shortly.';
    case 'elevenlabs_unauthorized':
      return 'Premium voice is misconfigured.';
    case 'elevenlabs_error':
    case 'empty_audio':
      return 'Premium voice could not be loaded.';
    default:
      return reason?.trim()
        ? `Premium voice unavailable (${reason}).`
        : 'Premium voice is unavailable right now.';
  }
}

export const INTERVIEW_BROWSER_VOICE_FALLBACK_MESSAGE =
  "Premium voice wasn't available — we're using your device's voice so you can keep going.";

/** Backend sometimes returns cacheHit with a tiny ID3-only stub — not playable speech. */
export function isPlayableInterviewSpeechBase64(audioBase64: string | undefined | null): boolean {
  const trimmed = audioBase64?.trim() ?? '';
  if (trimmed.length < 256) return false;
  try {
    const bytes = atob(trimmed);
    return bytes.length >= 1024;
  } catch {
    return false;
  }
}

export function decodeInterviewSpeechBase64(
  audioBase64: string,
  contentType: string,
): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType || 'audio/mpeg' });
}
