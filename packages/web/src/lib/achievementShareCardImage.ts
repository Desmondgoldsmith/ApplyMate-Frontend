import type { CareerAchievementsPayload, TodayPlanAchievementPayload } from '@/lib/today-plan';

export type AchievementShareCardInput = {
  displayName: string;
  career: CareerAchievementsPayload | null;
  achievements: TodayPlanAchievementPayload[] | null;
  /** Primary target role from profile (e.g. "Software Engineer"). */
  targetRole?: string | null;
};

const W = 1200;
const MIN_H = 1040;
const CARD_MARGIN = 72;

type WinRow = { title: string; desc: string };

function measureWrapTextEndY(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  maxWidth: number,
  lineHeight: number,
  font: string,
  maxLines: number,
): number {
  ctx.font = font;
  const words = text.split(/\s+/);
  let line = '';
  let cy = y;
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i]!;
    if (ctx.measureText(test).width > maxWidth && line) {
      cy += lineHeight;
      line = words[i]!;
      lines += 1;
      if (lines >= maxLines) return cy;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) cy += lineHeight;
  return cy;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  font: string,
  fill: string,
  maxLines = 4,
): number {
  ctx.font = font;
  ctx.fillStyle = fill;
  const words = text.split(/\s+/);
  let line = '';
  let cy = y;
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i]!;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = words[i]!;
      cy += lineHeight;
      lines += 1;
      if (lines >= maxLines) return cy;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) {
    ctx.fillText(line, x, cy);
    cy += lineHeight;
  }
  return cy;
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function measureWinRowHeight(
  ctx: CanvasRenderingContext2D,
  win: WinRow,
  cardW: number,
  pad: number,
): number {
  const desc = win.desc;
  const descWidth = cardW - 120;
  let inner = 52;
  if (desc) {
    const descEnd = measureWrapTextEndY(
      ctx,
      desc,
      0,
      descWidth,
      34,
      '400 22px system-ui, sans-serif',
      2,
    );
    inner = Math.max(inner, 40 + (descEnd - 0) + 8);
  }
  return inner + 20;
}

function measureLayout(
  ctx: CanvasRenderingContext2D,
  input: AchievementShareCardInput,
  wins: WinRow[],
  cardW: number,
  pad: number,
  cardY: number,
): { progressY: number; canvasHeight: number; cardH: number } {
  let y = cardY + 88;

  y += 44 + 56;
  y = measureWrapTextEndY(ctx, input.displayName, y, cardW - 112, 60, '700 52px system-ui, sans-serif', 2);

  const levelParts: string[] = [];
  if (input.career?.level?.number != null) levelParts.push(`Level ${input.career.level.number}`);
  if (input.career?.level?.title?.trim()) levelParts.push(input.career.level.title.trim());
  if (levelParts.length) y += 12 + 44;

  if (input.career?.summary?.totalUnlocked != null) y += 40;
  if (input.targetRole?.trim()) y += 40;

  const xp = input.career?.experiencePoints?.current;
  if (typeof xp === 'number' && xp > 0) y += 36;

  y += 8 + 40;

  for (const w of wins) {
    y += measureWinRowHeight(ctx, w, cardW, pad);
  }

  const progressY = y + 28;
  const footerY = progressY + 36;
  const contentBottom = footerY + 52;
  const canvasHeight = Math.max(MIN_H, contentBottom + CARD_MARGIN);
  const cardH = canvasHeight - CARD_MARGIN * 2;

  return { progressY, canvasHeight, cardH };
}

/** Render a printable congratulations card to PNG (client-side canvas). */
export async function renderAchievementShareCardPng(input: AchievementShareCardInput): Promise<Blob> {
  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = W;
  measureCanvas.height = MIN_H;
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) throw new Error('Could not create canvas');

  const wins: WinRow[] = (
    input.career?.recentWins?.length
      ? input.career.recentWins.slice(0, 5)
      : (input.achievements ?? []).slice(0, 5)
  ).map((w) => ({
    title: w.title?.trim() || 'Achievement',
    desc: w.description?.trim() ?? '',
  }));

  const cardX = CARD_MARGIN;
  const cardY = CARD_MARGIN;
  const cardW = W - CARD_MARGIN * 2;
  const pad = cardX + 56;

  const { progressY, canvasHeight, cardH } = measureLayout(
    measureCtx,
    input,
    wins,
    cardW,
    pad,
    cardY,
  );

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas');

  const H = canvasHeight;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#071211');
  bg.addColorStop(0.45, '#0c1817');
  bg.addColorStop(1, '#121c1f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.82, H * 0.12, 0, W * 0.82, H * 0.12, W * 0.55);
  glow.addColorStop(0, 'rgba(0, 201, 177, 0.22)');
  glow.addColorStop(1, 'rgba(0, 201, 177, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  drawRoundRect(ctx, cardX, cardY, cardW, cardH, 36);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 201, 177, 0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  drawRoundRect(ctx, cardX + 28, cardY + 28, cardW - 56, 8, 4);
  const bar = ctx.createLinearGradient(cardX, 0, cardX + cardW, 0);
  bar.addColorStop(0, '#00C9B1');
  bar.addColorStop(1, '#5EEAD4');
  ctx.fillStyle = bar;
  ctx.fill();
  ctx.restore();

  let y = cardY + 88;

  ctx.font = '600 22px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillStyle = '#FBBF24';
  ctx.fillText('★ CONGRATULATIONS ★', pad, y);

  y += 44;
  ctx.font = '600 26px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillStyle = '#5EEAD4';
  ctx.fillText('APPLYMATE', pad, y);

  y += 56;
  ctx.font = '700 52px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.fillStyle = '#ffffff';
  y = wrapText(ctx, input.displayName, pad, y, cardW - 112, 60, ctx.font, '#ffffff', 2);

  const levelParts: string[] = [];
  if (input.career?.level?.number != null) levelParts.push(`Level ${input.career.level.number}`);
  if (input.career?.level?.title?.trim()) levelParts.push(input.career.level.title.trim());
  if (levelParts.length) {
    y += 12;
    ctx.font = '500 30px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillText(levelParts.join(' · '), pad, y);
    y += 44;
  }

  if (input.career?.summary?.totalUnlocked != null) {
    ctx.font = '600 24px system-ui, sans-serif';
    ctx.fillStyle = '#00C9B1';
    ctx.fillText(`${input.career.summary.totalUnlocked} achievements unlocked`, pad, y);
    y += 40;
  }

  const roleLine = input.targetRole?.trim();
  if (roleLine) {
    ctx.font = '500 26px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.58)';
    ctx.fillText(`Target role · ${roleLine}`, pad, y);
    y += 40;
  }

  const xp = input.career?.experiencePoints?.current;
  if (typeof xp === 'number' && xp > 0) {
    ctx.font = '500 24px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`${xp.toLocaleString()} career XP earned`, pad, y);
    y += 36;
  }

  y += 8;
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('RECENT WINS', pad, y);
  y += 40;

  for (const w of wins) {
    const rowTop = y;
    const rowH = measureWinRowHeight(ctx, w, cardW, pad);

    ctx.save();
    drawRoundRect(ctx, pad - 8, rowTop, cardW - 96, rowH - 20, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(pad + 6, rowTop + 24, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#00C9B1';
    ctx.fill();

    ctx.font = '600 28px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(w.title, pad + 24, rowTop + 28);
    let textY = rowTop + 68;

    if (w.desc) {
      textY = wrapText(
        ctx,
        w.desc,
        pad + 24,
        textY,
        cardW - 120,
        34,
        '400 22px system-ui, sans-serif',
        'rgba(255,255,255,0.55)',
        2,
      );
    }

    y = rowTop + rowH;
  }

  const barW = cardW - 112;
  drawRoundRect(ctx, pad, progressY, barW, 10, 5);
  const prog = ctx.createLinearGradient(pad, 0, pad + barW, 0);
  prog.addColorStop(0, '#00C9B1');
  prog.addColorStop(1, '#5EEAD4');
  ctx.fillStyle = prog;
  ctx.fill();
  drawRoundRect(ctx, pad, progressY, Math.round(barW * 0.62), 10, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();

  ctx.font = '500 22px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.fillText('Celebrating your momentum — applymate.app', pad, progressY + 36);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not export image'));
      },
      'image/png',
      1,
    );
  });
}

export function downloadAchievementShareCardPng(blob: Blob, displayName: string) {
  const slug =
    displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'achievements';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}-applymate-achievement-card.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
