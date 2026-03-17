/** Full-screen result overlay shown after a position fix. */

import { toDMS } from "../lib/celestial";

interface Props {
  lat:        number;
  lon:        number;
  confidence: "high" | "medium" | "low";
  fixTime:    Date;
  onDismiss:  () => void;
}

const CONFIDENCE_COLOR = { high: "#00FF88", medium: "#FFD700", low: "#FF6B35" };
const CONFIDENCE_NM    = { high: "±15 NM", medium: "±30 NM", low: "±60 NM" };
const CONFIDENCE_LABEL = { high: "✅  High confidence", medium: "⚠️  Moderate", low: "❌  Low — check aim" };

export function FixResult({ lat, lon, confidence, fixTime, onDismiss }: Props) {
  const decLat  = `${lat >= 0 ? "+" : ""}${lat.toFixed(4)}°`;
  const decLon  = `${lon >= 0 ? "+" : ""}${lon.toFixed(4)}°`;
  const utcStr  = fixTime.toUTCString().slice(5, 25);
  const mapsUrl = `https://maps.google.com/?q=${lat},${lon}`;
  const color   = CONFIDENCE_COLOR[confidence];

  function handleCopy() {
    navigator.clipboard?.writeText(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(5, 10, 25, 0.97)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 24, gap: 20,
    }}>
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 36 }}>📍</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#FFD700", marginTop: 4 }}>
          Position Fix
        </div>
        <div style={{ fontSize: 12, color: "#6b8cba", marginTop: 4 }}>{utcStr} UTC</div>
      </div>

      {/* Coordinates card */}
      <div style={{
        background: "#0a1628",
        borderRadius: 16, border: `1.5px solid ${color}`,
        padding: "24px 32px", textAlign: "center", width: "100%", maxWidth: 360,
      }}>
        <CoordRow label="Latitude"  dms={toDMS(lat, true)}  dec={decLat} />
        <div style={{ borderBottom: "1px solid #1e3050", margin: "16px 0" }} />
        <CoordRow label="Longitude" dms={toDMS(lon, false)} dec={decLon} />
      </div>

      {/* Confidence */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 14, color, fontWeight: 700 }}>
          {CONFIDENCE_LABEL[confidence]}
        </div>
        <div style={{ fontSize: 12, color: "#6b8cba", marginTop: 4 }}>
          Estimated accuracy: {CONFIDENCE_NM[confidence]}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <ActionBtn label="📋 Copy" onClick={handleCopy} />
        <ActionBtn label="🗺  Open Map" onClick={() => window.open(mapsUrl, "_blank")} primary />
        <ActionBtn label="🔄 New Fix" onClick={onDismiss} />
      </div>

      {/* How it works — brief */}
      <div style={{
        background: "#0a1628", borderRadius: 10, padding: "12px 16px",
        maxWidth: 360, width: "100%", fontSize: 12, color: "#6b8cba", lineHeight: 1.6,
      }}>
        <strong style={{ color: "#aaa" }}>How this fix was calculated:</strong><br />
        Sun altitude ({`${fixTime.getSeconds()}s`} UTC) + phone compass + gyroscope →
        spherical trig → lat/lon. Same method as a sextant, no GPS used.
      </div>
    </div>
  );
}

function CoordRow({ label, dms, dec }: { label: string; dms: string; dec: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#6b8cba", letterSpacing: 1 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "4px 0 2px" }}>{dms}</div>
      <div style={{ fontSize: 12, color: "#FFD700", fontFamily: "monospace" }}>{dec}</div>
    </div>
  );
}

function ActionBtn({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 20px", borderRadius: 10, border: "none",
        background: primary ? "#FFD700" : "#1a2e45",
        color: primary ? "#000" : "#fff",
        fontWeight: 700, fontSize: 14, cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
