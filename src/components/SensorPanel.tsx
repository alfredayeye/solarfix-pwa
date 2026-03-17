/** Live sensor readings bar — elevation, azimuth, UTC clock. */

import type { SunDetection } from "../lib/sunDetector";
import { compassPoint } from "../lib/celestial";

interface Props {
  elevation: number | null;
  azimuth:   number | null;
  utcTime:   Date;
  detection: SunDetection | null;
}

export function SensorPanel({ elevation, azimuth, utcTime, detection }: Props) {
  const utcStr = utcTime.toUTCString().slice(17, 25); // HH:MM:SS

  const sunStatus = detection?.detected
    ? "☀️  Sun locked"
    : "🔍  Searching…";

  const statusColor = detection?.detected ? "#00FF88" : "#FFD700";

  return (
    <div style={{
      background: "#0a1628",
      borderRadius: 12,
      padding: "12px 16px",
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr 1fr",
      gap: 8,
      alignItems: "center",
    }}>
      <Cell label="ELEVATION" value={elevation !== null ? `${elevation.toFixed(1)}°` : "—"} />
      <Cell
        label="AZIMUTH"
        value={azimuth !== null ? `${azimuth.toFixed(1)}°` : "—"}
        sub={azimuth !== null ? compassPoint(azimuth) : undefined}
      />
      <Cell label="UTC" value={utcStr} mono />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "#6b8cba", marginBottom: 2 }}>STATUS</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: statusColor }}>{sunStatus}</div>
      </div>
    </div>
  );
}

function Cell({ label, value, sub, mono }: {
  label: string; value: string; sub?: string; mono?: boolean;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "#6b8cba", marginBottom: 2, letterSpacing: 1 }}>{label}</div>
      <div style={{
        fontSize: 15, fontWeight: 700, color: "#FFD700",
        fontFamily: mono ? "monospace" : undefined,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#aaa" }}>{sub}</div>}
    </div>
  );
}
