/**
 * CameraView — live camera feed with sun detection overlay.
 * Accepts a MediaStream directly so the parent can call getUserMedia
 * inside a user-gesture handler (required by iOS for camera permissions).
 */

import { useEffect, useRef, useCallback } from "react";
import { detectSun, type SunDetection } from "../lib/sunDetector";

interface Props {
  stream: MediaStream | null;
  onDetection: (d: SunDetection | null) => void;
}

export function CameraView({ stream, onDetection }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  // Attach stream to video element whenever stream changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream) {
      video.srcObject = stream;
      video.play().catch(() => {/* autoplay policy — already muted so should be fine */});
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  const loop = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState >= 2) {
      onDetection(detectSun(video, canvas));
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [onDetection]);

  // Start/stop detection loop based on whether we have a stream
  useEffect(() => {
    if (stream) {
      rafRef.current = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(rafRef.current);
      onDetection(null);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [stream, loop, onDetection]);

  return (
    <div style={{
      position: "relative", width: "100%", aspectRatio: "4/3",
      background: "#000", borderRadius: 12, overflow: "hidden",
    }}>
      <video
        ref={videoRef}
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
      {!stream && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#6b8cba", fontSize: 14,
        }}>
          Requesting camera…
        </div>
      )}
    </div>
  );
}
