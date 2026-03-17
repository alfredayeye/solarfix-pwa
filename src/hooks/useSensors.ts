/**
 * useSensors — React hook that aggregates:
 *   • Camera stream (rear camera)
 *   • DeviceOrientation (compass heading + tilt → azimuth + elevation)
 *   • Accurate UTC clock
 *
 * Handles iOS permission request for DeviceOrientationEvent.
 */

import { useState, useEffect, useRef, useCallback } from "react";

export interface SensorData {
  /** Compass heading 0–360° (0 = North) */
  azimuth: number | null;
  /** Elevation angle above horizon (degrees) */
  elevation: number | null;
  /** Current UTC Date */
  utcTime: Date;
  /** Whether sensors are live */
  orientationActive: boolean;
}

export type PermissionState = "idle" | "pending" | "granted" | "denied";

export function useSensors() {
  const [sensors, setSensors] = useState<SensorData>({
    azimuth: null,
    elevation: null,
    utcTime: new Date(),
    orientationActive: false,
  });
  const [cameraPermission, setCameraPermission] = useState<PermissionState>("idle");
  const [orientationPermission, setOrientationPermission] = useState<PermissionState>("idle");
  const streamRef = useRef<MediaStream | null>(null);
  const clockRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── UTC clock ──────────────────────────────────────────────
  useEffect(() => {
    clockRef.current = setInterval(() => {
      setSensors(s => ({ ...s, utcTime: new Date() }));
    }, 1000);
    return () => { if (clockRef.current) clearInterval(clockRef.current); };
  }, []);

  // ── Device orientation ─────────────────────────────────────
  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    // iOS uses webkitCompassHeading; Android uses alpha (needs 360-alpha for true heading)
    const heading =
      (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
      ?? (e.alpha !== null ? (360 - e.alpha) % 360 : null);

    // beta: 0 = phone vertical, 90 = phone flat (face up)
    // When tilting phone back to point at sky: beta goes negative
    // elevation ≈ -(beta) when phone held in portrait and tilted backward
    const elevation = e.beta !== null ? Math.round(-e.beta * 10) / 10 : null;
    const azimuth   = heading !== null ? Math.round(heading * 10) / 10 : null;

    setSensors(s => ({ ...s, azimuth, elevation, orientationActive: true }));
  }, []);

  const requestOrientation = useCallback(async () => {
    setOrientationPermission("pending");
    try {
      // iOS 13+ requires explicit permission
      const DOE = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };
      if (typeof DOE.requestPermission === "function") {
        const result = await DOE.requestPermission();
        if (result !== "granted") {
          setOrientationPermission("denied");
          return;
        }
      }
      window.addEventListener("deviceorientationabsolute", handleOrientation as EventListener, true);
      window.addEventListener("deviceorientation", handleOrientation as EventListener, true);
      setOrientationPermission("granted");
    } catch {
      setOrientationPermission("denied");
    }
  }, [handleOrientation]);

  // ── Camera ─────────────────────────────────────────────────
  const startCamera = useCallback(async (videoEl: HTMLVideoElement) => {
    setCameraPermission("pending");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      videoEl.srcObject = stream;
      await videoEl.play();
      setCameraPermission("granted");
    } catch {
      setCameraPermission("denied");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  // ── Cleanup ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopCamera();
      window.removeEventListener("deviceorientationabsolute", handleOrientation as EventListener);
      window.removeEventListener("deviceorientation", handleOrientation as EventListener);
    };
  }, [stopCamera, handleOrientation]);

  return {
    sensors,
    cameraPermission,
    orientationPermission,
    startCamera,
    stopCamera,
    requestOrientation,
  };
}
