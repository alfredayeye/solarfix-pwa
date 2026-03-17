/**
 * Sun detection via Canvas API — no OpenCV.js dependency.
 * Finds the brightest region in a video frame using a fast downsampled scan.
 */

export interface SunDetection {
  /** 0–1 normalised position in frame (0,0 = top-left) */
  x: number;
  y: number;
  /** Brightness score 0–255 */
  brightness: number;
  /** True if clearly detected (not just noise) */
  detected: boolean;
}

/**
 * Analyse a video frame and return the sun's position.
 * Draws an overlay circle and aim guide onto the canvas.
 */
export function detectSun(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): SunDetection | null {
  const { videoWidth: vw, videoHeight: vh } = video;
  if (!vw || !vh) return null;

  canvas.width  = vw;
  canvas.height = vh;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, vw, vh);

  // ── Brightness scan (every 4th pixel for speed) ──
  const step   = 4;
  const data   = ctx.getImageData(0, 0, vw, vh).data;
  let maxBrt   = 0;
  let maxX     = 0;
  let maxY     = 0;
  let sumX     = 0;
  let sumY     = 0;
  let sumW     = 0;

  for (let y = 0; y < vh; y += step) {
    for (let x = 0; x < vw; x += step) {
      const i   = (y * vw + x) * 4;
      // Perceptual luminance
      const brt = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (brt > 230) {          // only accumulate very bright pixels
        sumX += x * brt;
        sumY += y * brt;
        sumW += brt;
      }
      if (brt > maxBrt) { maxBrt = brt; maxX = x; maxY = y; }
    }
  }

  const detected = maxBrt > 235 && sumW > 0;
  const cx = detected && sumW > 0 ? sumX / sumW : maxX;
  const cy = detected && sumW > 0 ? sumY / sumW : maxY;

  // ── Draw overlay ──
  const centerX = vw / 2;
  const centerY = vh / 2;
  const dx      = cx - centerX;
  const dy      = cy - centerY;
  const dist    = Math.sqrt(dx * dx + dy * dy);
  const aimed   = dist < vw * 0.08;  // sun within 8% of frame width from centre

  if (detected) {
    // Sun ring
    ctx.strokeStyle = aimed ? "#00FF88" : "#FFD700";
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 36, 0, Math.PI * 2);
    ctx.stroke();

    // Direction arrow when not centred
    if (!aimed) {
      const angle  = Math.atan2(dy, dx);
      const arrowR = Math.min(vw, vh) * 0.38;
      const ax     = centerX + Math.cos(angle) * arrowR;
      const ay     = centerY + Math.sin(angle) * arrowR;
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(ax, ay);
      // Arrowhead
      ctx.lineTo(ax - Math.cos(angle - 0.4) * 18, ay - Math.sin(angle - 0.4) * 18);
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - Math.cos(angle + 0.4) * 18, ay - Math.sin(angle + 0.4) * 18);
      ctx.stroke();
    }
  }

  // Crosshair at centre
  ctx.strokeStyle = aimed && detected ? "#00FF88" : "rgba(255,255,255,0.5)";
  ctx.lineWidth   = 1.5;
  const r = 28;
  ctx.beginPath();
  ctx.moveTo(centerX - r, centerY); ctx.lineTo(centerX + r, centerY);
  ctx.moveTo(centerX, centerY - r); ctx.lineTo(centerX, centerY + r);
  ctx.arc(centerX, centerY, r * 0.6, 0, Math.PI * 2);
  ctx.stroke();

  return {
    x:          cx / vw,
    y:          cy / vh,
    brightness: maxBrt,
    detected,
  };
}
