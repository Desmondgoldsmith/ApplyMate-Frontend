/**
 * CV headshot: resize + JPEG compress before base64-in-JSON to avoid 413 / huge PATCH bodies.
 * Browser-only (uses Canvas / createImageBitmap).
 */

export const CV_PHOTO_TOO_LARGE_USER_MESSAGE =
  'Image is too large. Please choose a smaller file or try another photo.';

/** Reject or recompress if base64 is above this (≈1.5MB raw, ~2M chars). */
export const CV_PHOTO_MAX_BASE64_CHARS = 2_000_000;

const MAX_EDGE_PX = 1000;
/** Below this, further shrinking rarely helps — fail with user message. */
const STOP_EDGE_PX = 240;
const JPEG_QUALITY_START = 0.82;
const JPEG_QUALITY_FLOOR = 0.45;
const JPEG_QUALITY_STEP = 0.07;

function loadImageForCanvas(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this image. Try JPG or PNG.'));
    };
    img.src = url;
  });
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read pasted image data.'));
    img.src = dataUrl;
  });
}

function scaleToMaxEdge(width: number, height: number, maxEdge: number): { w: number; h: number } {
  const m = Math.max(width, height);
  if (m <= maxEdge) return { w: width, h: height };
  const s = maxEdge / m;
  return { w: Math.max(1, Math.round(width * s)), h: Math.max(1, Math.round(height * s)) };
}

function encodeWithCanvasDraw(
  sourceW: number,
  sourceH: number,
  draw: (ctx: CanvasRenderingContext2D, tw: number, th: number) => void,
): string {
  if (!sourceW || !sourceH) {
    throw new Error('Invalid image dimensions.');
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not process this image in your browser.');
  }

  let maxEdge = MAX_EDGE_PX;
  let quality = JPEG_QUALITY_START;

  for (;;) {
    const { w: tw, h: th } = scaleToMaxEdge(sourceW, sourceH, maxEdge);
    canvas.width = tw;
    canvas.height = th;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tw, th);
    draw(ctx, tw, th);

    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length > CV_PHOTO_MAX_BASE64_CHARS && quality > JPEG_QUALITY_FLOOR + 1e-6) {
      quality = Math.max(JPEG_QUALITY_FLOOR, quality - JPEG_QUALITY_STEP);
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    if (dataUrl.length <= CV_PHOTO_MAX_BASE64_CHARS) {
      return dataUrl;
    }
    maxEdge = Math.floor(maxEdge * 0.85);
    quality = JPEG_QUALITY_START;
    if (maxEdge < STOP_EDGE_PX) {
      throw new Error(CV_PHOTO_TOO_LARGE_USER_MESSAGE);
    }
  }
}

/**
 * Produces a `data:image/jpeg;base64,...` URL, typically well under 1MB for a headshot.
 */
export async function compressImageFileToCvDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }

  let img: HTMLImageElement | undefined;
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    try {
      img = await loadImageForCanvas(file);
    } catch (e) {
      throw e instanceof Error ? e : new Error('Could not read this image. Try JPG or PNG.');
    }
  }

  const sourceW = bitmap ? bitmap.width : img!.naturalWidth;
  const sourceH = bitmap ? bitmap.height : img!.naturalHeight;

  try {
    return encodeWithCanvasDraw(sourceW, sourceH, (ctx, tw, th) => {
      if (bitmap) {
        ctx.drawImage(bitmap, 0, 0, tw, th);
      } else if (img) {
        ctx.drawImage(img, 0, 0, tw, th);
      }
    });
  } finally {
    bitmap?.close();
  }
}

/**
 * Re-encode a pasted `data:image/...` that exceeds {@link CV_PHOTO_MAX_BASE64_CHARS}.
 * Smaller data URLs are returned unchanged (no extra JPEG round-trip).
 */
export async function compressOversizedDataImageUrl(dataUrl: string): Promise<string> {
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith('data:image/')) {
    throw new Error('Not an image data URL.');
  }
  if (trimmed.length <= CV_PHOTO_MAX_BASE64_CHARS) {
    return trimmed;
  }
  const img = await loadImageFromDataUrl(trimmed);
  return encodeWithCanvasDraw(img.naturalWidth, img.naturalHeight, (ctx, tw, th) => {
    ctx.drawImage(img, 0, 0, tw, th);
  });
}

const MAX_PLAIN_URL_CHARS = 8000;

/**
 * Normalizes the profile photo URL field: compresses huge pasted data URLs; passes through http(s) URLs.
 */
export async function normalizeCvPhotoUrlInput(raw: string): Promise<string> {
  const v = raw.trim();
  if (!v) return '';
  if (v.startsWith('data:image/')) {
    if (v.length <= CV_PHOTO_MAX_BASE64_CHARS) return v;
    return compressOversizedDataImageUrl(v);
  }
  if (v.length > MAX_PLAIN_URL_CHARS) {
    throw new Error(CV_PHOTO_TOO_LARGE_USER_MESSAGE);
  }
  return v;
}
