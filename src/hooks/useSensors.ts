/**
 * useSensors — compass, tilt, and UTC clock.
 * Camera is handled separately in App.tsx so getUserMedia can be called
 * directly inside a button click handler (required by iOS).
 */

import { useState, useEffect, useCallback } from "react";

export interface SensorData {
  azimuth:   number | null;   // compass heading 0–360° (0 = North)
  elevation: number | null;   // degrees above horizon
  utcTime:   Date;
  orientationActive: boolean;
}

export function useSensors() {
  const [sensors, setSensors] = useState<SensorData>({
    azimuth: null,
    elevation: null,
    utcTime: new Date(),
    orientationActive: false,
  });

  // UTC clock — tick every second
  useEffect(() => {
    const id = setInterval(() => setSensors(s => ({ ...s, utcTime: new Date() })), 1000);
    return () => clearInterval(id);
  }, []);

  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    const ios = e as DeviceOrientationEvent & { webkitCompassHeading?: number };

    // iOS provides webkitCompassHeading (0–360, true north).
    // Android alpha is degrees rotated from initial position; (360 - alpha) % 360 gives heading.
    const azimuth =
      ios.webkitCompassHeading !== undefined && ios.webkitCompassHeading !== null
        ? Math.round(ios.webkitCompassHeading * 10) / 10
        : e.alpha !== null
        ? Math.round(((360 - e.alpha) % 360) * 10) / 10
        : null;

    // beta: 0 = phone upright, negative = tilted back (pointing at sky)
    // elevation above horizon ≈ -beta when phone in portrait, rear cam facing sky
    const elevation = e.beta !== null ? Math.round(-e.beta * 10) / 10 : null;

    setSensors(s => ({ ...s, azimuth, elevation, orientationActive: true }));
  }, []);

  const requestOrientation = useCallback(async () => {
    try {
      const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
      if (typeof DOE.requestPermission === "function") {
        const result = await DOE.requestPermission();
        if (result !== "granted") return;
      }
      // Use absolute orientation when available (more accurate compass on Android)
      window.addEventListener("deviceorientationabsolute", handleOrientation as EventListener, true);
      window.addEventListener("deviceorientation",         handleOrientation as EventListener, true);
    } catch {
      // Orientation unavailable — app still works, just without compass
    }
  }, [handleOrientation]);

  useEffect(() => {
    return () => {
      window.removeEventListener("deviceorientationabsolute", handleOrientation as EventListener);
      window.removeEventListener("deviceorientation",         handleOrientation as EventListener);
    };
  }, [handleOrientation]);

  return { sensors, requestOrientation };
}
