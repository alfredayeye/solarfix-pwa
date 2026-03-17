/**
 * SolarFix PWA — main application.
 * Flow: request permissions → live camera + sensors → tap FIX → show result.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { CameraView }   from "./components/CameraView";
import { SensorPanel }  from "./components/SensorPanel";
import { FixResult }    from "./components/FixResult";
import { useSensors }   from "./hooks/useSensors";
import { singleSightFix } from "./lib/celestial";
import type { SunDetection } from "./lib/sunDetector";

type Screen = "welcome" | "active" | "result";

interface Fix {
  lat: number;
  lon: number;
  confidence: "high" | "medium" | "low";
  fixTime: Date;
}

export default function App() {
  const [screen, setScreen]       = useState<Screen>("welcome");
  const [detection, setDetection] = useState<SunDetection | null>(null);
  const [fix, setFix]             = useState<Fix | null>(null);
  const [fixing, setFixing]       = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const {
    sensors,
    cameraPermission,
    startCamera,
    requestOrientation,
  } = useSensors();

  // Capture video element once CameraView mounts
  useEffect(() => {
    const handler = (e: Event) => {
      videoRef.current = (e as CustomEvent).detail as HTMLVideoElement;
      if (screen === "active" && videoRef.current) {
        startCamera(videoRef.current);
      }
    };
    document.addEventListener("videoready", handler);
    return () => document.removeEventListener("videoready", handler);
  }, [screen, startCamera]);

  const handleStart = useCallback(async () => {
    setScreen("active");
    await requestOrientation();
    if (videoRef.current) startCamera(videoRef.current);
  }, [requestOrientation, startCamera]);

  const handleFix = useCallback(() => {
    const { azimuth, elevation, utcTime } = sensors;
    if (azimuth === null || elevation === null) {
      alert("Waiting for compass + tilt sensors. On iOS, tap Allow when prompted.");
      return;
    }
    if (!detection?.detected) {
      alert("Aim the camera at the sun until the gold ring appears, then tap Fix.");
      return;
    }
    setFixing(true);
    try {
      const result = singleSightFix(elevation, azimuth, utcTime);
      setFix({ ...result, fixTime: utcTime });
      setScreen("result");
    } finally {
      setFixing(false);
    }
  }, [sensors, detection]);

  const handleDismiss = useCallback(() => {
    setFix(null);
    setScreen("active");
  }, []);

  // ── Screens ────────────────────────────────────────────────

  if (screen === "result" && fix) {
    return (
      <FixResult
        lat={fix.lat}
        lon={fix.lon}
        confidence={fix.confidence}
        fixTime={fix.fixTime}
        onDismiss={handleDismiss}
      />
    );
  }

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#050a19",
      color: "#fff",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Header */}
      <header style={{
        padding: "16px 20px 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid #0f1f38",
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#FFD700", letterSpacing: -0.5 }}>
            ☀️ SolarFix
          </div>
          <div style={{ fontSize: 11, color: "#6b8cba", marginTop: 1 }}>
            Offline celestial navigation
          </div>
        </div>
        <div style={{
          fontSize: 11, color: "#6b8cba",
          background: "#0a1628", borderRadius: 8, padding: "4px 10px",
          fontFamily: "monospace",
        }}>
          {sensors.utcTime.toUTCString().slice(17, 25)} UTC
        </div>
      </header>

      {/* Body */}
      <main style={{ flex: 1, padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 12 }}>

        {screen === "welcome" && <WelcomeScreen onStart={handleStart} />}

        {screen === "active" && (
          <>
            {/* Safety warning */}
            <div style={{
              background: "#1a0a00", border: "1px solid #FF6B35",
              borderRadius: 10, padding: "8px 14px",
              fontSize: 12, color: "#FF6B35",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <span>Never look directly at the sun. Use a solar filter or photograph through cloud/haze.</span>
            </div>

            {/* Camera */}
            <CameraView onDetection={setDetection} active={cameraPermission === "granted"} />

            {/* Sensor readings */}
            <SensorPanel
              elevation={sensors.elevation}
              azimuth={sensors.azimuth}
              utcTime={sensors.utcTime}
              detection={detection}
            />

            {/* Guidance */}
            <GuidanceCard
              cameraOk={cameraPermission === "granted"}
              sensorsOk={sensors.orientationActive}
              sunDetected={detection?.detected ?? false}
            />
          </>
        )}
      </main>

      {/* Fix button */}
      {screen === "active" && (
        <div style={{ padding: "16px" }}>
          <button
            onClick={handleFix}
            disabled={fixing}
            style={{
              width: "100%", padding: "18px",
              background: detection?.detected ? "#FFD700" : "#1a2e45",
              color: detection?.detected ? "#000" : "#6b8cba",
              border: "none", borderRadius: 14,
              fontSize: 18, fontWeight: 800,
              cursor: detection?.detected ? "pointer" : "default",
              transition: "all 0.2s",
              letterSpacing: 0.5,
            }}
          >
            {fixing ? "Calculating…" : "📍  FIX MY POSITION"}
          </button>
          <div style={{ textAlign: "center", fontSize: 11, color: "#3a5070", marginTop: 8 }}>
            {detection?.detected
              ? "Sun locked — tap to calculate your position"
              : "Aim camera at the sun to enable fix"}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, textAlign: "center", padding: "0 8px" }}>
      <div style={{ fontSize: 72 }}>☀️</div>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#FFD700", margin: 0 }}>SolarFix</h1>
        <p style={{ color: "#6b8cba", margin: "8px 0 0", lineHeight: 1.6, fontSize: 15 }}>
          Know where you are using only<br />
          <strong style={{ color: "#aaa" }}>the sun + a clock.</strong><br />
          No GPS. No satellites. No signal.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 300 }}>
        <Step n="1" text="Point your camera at the sun" />
        <Step n="2" text="Hold steady until the ring locks on" />
        <Step n="3" text="Tap Fix — get your lat/lon instantly" />
      </div>

      <button
        onClick={onStart}
        style={{
          padding: "16px 48px", borderRadius: 14, border: "none",
          background: "#FFD700", color: "#000",
          fontSize: 17, fontWeight: 800, cursor: "pointer",
          marginTop: 8,
        }}
      >
        Start Navigation
      </button>
      <p style={{ fontSize: 11, color: "#3a5070", maxWidth: 280 }}>
        Requires camera + compass access. Works offline.
        Accuracy ~10–30 nautical miles.
      </p>
    </div>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: "#0a1628", border: "1.5px solid #FFD700",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 800, color: "#FFD700", flexShrink: 0,
      }}>{n}</div>
      <span style={{ fontSize: 14, color: "#ccc" }}>{text}</span>
    </div>
  );
}

function GuidanceCard({ cameraOk, sensorsOk, sunDetected }: {
  cameraOk: boolean; sensorsOk: boolean; sunDetected: boolean;
}) {
  const items = [
    { ok: cameraOk,   label: "Camera",  detail: cameraOk ? "Active" : "Tap Start to allow" },
    { ok: sensorsOk,  label: "Compass", detail: sensorsOk ? "Active" : "Tap Allow on iOS prompt" },
    { ok: sunDetected, label: "Sun",    detail: sunDetected ? "Locked ✓" : "Aim at sun" },
  ];
  return (
    <div style={{
      background: "#0a1628", borderRadius: 12, padding: "10px 16px",
      display: "flex", justifyContent: "space-around",
    }}>
      {items.map(({ ok, label, detail }) => (
        <div key={label} style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18 }}>{ok ? "✅" : "⏳"}</div>
          <div style={{ fontSize: 11, color: "#FFD700", fontWeight: 700 }}>{label}</div>
          <div style={{ fontSize: 10, color: "#6b8cba" }}>{detail}</div>
        </div>
      ))}
    </div>
  );
}
