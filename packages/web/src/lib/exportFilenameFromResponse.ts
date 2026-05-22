/** Read a response header from Axios headers or a plain record. */
export function readResponseHeader(headers: unknown, name: string): string | null {
  if (headers == null) return null;
  const lower = name.toLowerCase();
  if (typeof headers === 'object' && headers !== null) {
    const maybeGet = headers as { get?: (key: string) => unknown };
    if (typeof maybeGet.get === 'function') {
      const direct = maybeGet.get(name) ?? maybeGet.get(lower);
      if (direct != null && direct !== '') return String(direct);
    }
    const rec = headers as Record<string, unknown>;
    const raw = rec[name] ?? rec[lower] ?? rec[name.toUpperCase()];
    if (raw == null || raw === '') return null;
    if (Array.isArray(raw)) return String(raw[0] ?? '');
    return String(raw);
  }
  return null;
}

/**
 * Parse `filename` / `filename*` from a Content-Disposition header.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition
 */
export function parseFilenameFromContentDisposition(
  header: string | null | undefined,
): string | null {
  if (!header?.trim()) return null;

  const starMatch = header.match(/filename\*\s*=\s*([^;]+)/i);
  if (starMatch) {
    let value = starMatch[1].trim().replace(/^["']|["']$/g, '');
    const utf8Prefix = /^UTF-8''/i;
    if (utf8Prefix.test(value)) {
      value = value.replace(utf8Prefix, '');
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
    return value;
  }

  const plainMatch = header.match(/filename\s*=\s*("([^"]+)"|([^;\s]+))/i);
  if (plainMatch) {
    const name = (plainMatch[2] ?? plainMatch[3] ?? '').trim();
    return name || null;
  }

  return null;
}

function sanitizeExportFilename(name: string): string {
  const trimmed = name.trim().replace(/[/\\?%*:|"<>]/g, '-');
  return trimmed || 'CV.pdf';
}

/** Prefer `X-Export-Filename`, then Content-Disposition, then fallback. */
export function resolveExportFilename(headers: unknown, fallback: string): string {
  const fromCustom = readResponseHeader(headers, 'X-Export-Filename');
  if (fromCustom?.trim()) return sanitizeExportFilename(fromCustom);

  const fromDisposition = parseFilenameFromContentDisposition(
    readResponseHeader(headers, 'Content-Disposition'),
  );
  if (fromDisposition?.trim()) return sanitizeExportFilename(fromDisposition);

  return sanitizeExportFilename(fallback);
}
