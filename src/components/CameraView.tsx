/**
 * CameraView — live camera feed with sun detection overlay.
 * The canvas is drawn on top of the video element every animation frame.
 */

import { useEffect, useRef, useCallback } from "react";
import { detectSun, type SunDetection } from "../lib/sunDetector";

interface Props {
  onDetection: (d: SunDetection | null) => void;
  active: boolean;
}

export function CameraView({ onDetection, active }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  // Expose video element to parent via a custom event / callback pattern
  useEffect(() => {
    const el = videoRef.current;
    if (el) {
      el.dispatchEvent(new CustomEvent("videoready", { bubbles: true, detail: el }));
    }
  }, []);

  const loop = useCallback(() => {
    if (!active) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState >= 2) {
      const result = detectSun(video, canvas);
      onDetection(result);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [active, onDetection]);

  useEffect(() => {
    if (active) {
      rafRef.current = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, loop]);

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", background: "#000", borderRadius: 12, overflow: "hidden" }}>
      <video
        ref={videoRef}
        id="solarfix-video"
        playsInline
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
