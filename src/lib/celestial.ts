/**
 * Celestial navigation engine — NOAA solar position algorithm.
 * Gives GHA and Declination accurate to ~0.01° for ±50 years around J2000.
 * No external dependencies.
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Sun's Greenwich Hour Angle (°, 0–360 westward) and Declination (°) for a UTC Date. */
export function sunEphemeris(date: Date): { gha: number; dec: number } {
  const JD = date.getTime() / 86_400_000 + 2_440_587.5;
  const JC = (JD - 2_451_545.0) / 36_525.0;

  // Geometric mean longitude & anomaly
  const L0 = ((280.46646 + JC * (36000.76983 + JC * 0.0003032)) % 360 + 360) % 360;
  const M  = 357.52911 + JC * (35999.05029 - 0.0001537 * JC);
  const Mr = M * DEG;

  // Equation of center
  const C =
    Math.sin(Mr) * (1.914602 - JC * (0.004817 + 0.000014 * JC)) +
    Math.sin(2 * Mr) * (0.019993 - 0.000101 * JC) +
    Math.sin(3 * Mr) * 0.000289;

  const sunLon = L0 + C;

  // Apparent longitude (abberation + nutation)
  const omega = 125.04 - 1934.136 * JC;
  const appLon = sunLon - 0.00569 - 0.00478 * Math.sin(omega * DEG);

  // Obliquity of ecliptic
  const obliq =
    23 +
    (26 + (21.448 - JC * (46.815 + JC * (0.00059 - JC * 0.001813))) / 60) / 60 +
    0.00256 * Math.cos(omega * DEG);

  const appRad  = appLon * DEG;
  const oblRad  = obliq * DEG;

  // Declination
  const dec = Math.asin(Math.sin(oblRad) * Math.sin(appRad)) * RAD;

  // Right Ascension (°)
  const ra = (Math.atan2(Math.cos(oblRad) * Math.sin(appRad), Math.cos(appRad)) * RAD + 360) % 360;

  // Greenwich Mean Sidereal Time (°)
  const GMST = ((280.46061837 + 360.98564736629 * (JD - 2_451_545.0) + 0.000387933 * JC * JC) % 360 + 360) % 360;

  // GHA = GMST − RA
  const gha = ((GMST - ra) % 360 + 360) % 360;

  return { gha, dec };
}

/**
 * Single-sight fix: given sun's measured altitude + azimuth + time → lat/lon.
 *
 * Physics: Two spherical trig equations (altitude & azimuth) with two unknowns
 * (lat, LHA). Solved analytically then lon derived from GHA.
 *
 * @param altDeg  Measured altitude above horizon (degrees)
 * @param azDeg   Measured azimuth from North clockwise (degrees)
 * @param date    UTC datetime of observation
 * @returns       { lat, lon } in decimal degrees (±90, ±180)
 */
export function singleSightFix(
  altDeg: number,
  azDeg: number,
  date: Date
): { lat: number; lon: number; confidence: "high" | "medium" | "low" } {
  const { gha, dec } = sunEphemeris(date);

  const h = altDeg * DEG;
  const Z = azDeg * DEG;
  const d = dec * DEG;

  // From the azimuth equation:
  //   cos(Z) = (sin(dec) − sin(h)·sin(lat)) / (cos(h)·cos(lat))
  // Rearranging: A·sin(lat) + B·cos(lat) = C
  const A = Math.sin(h);
  const B = Math.cos(h) * Math.cos(Z);
  const C = Math.sin(d);

  const R   = Math.sqrt(A * A + B * B);
  const phi = Math.atan2(B, A);

  const sinArg = clamp(C / R, -1, 1);
  const lat1   = (Math.asin(sinArg) - phi) * RAD;
  const lat2   = (Math.PI - Math.asin(sinArg) - phi) * RAD;

  // Pick the latitude that is geographically plausible (|lat| ≤ 90)
  // and consistent with the altitude equation
  function lonFromLat(latDeg: number): number {
    const latR = latDeg * DEG;
    const cosLHA = clamp(
      (Math.sin(h) - Math.sin(latR) * Math.sin(d)) / (Math.cos(latR) * Math.cos(d)),
      -1,
      1
    );
    let lha = Math.acos(cosLHA) * RAD;
    // Sun east of meridian → LHA in (180°, 360°); west → (0°, 180°)
    if (azDeg < 180) lha = 360 - lha;
    const lon = ((gha - lha + 180) % 360 + 360) % 360 - 180;
    return lon;
  }

  function altError(latDeg: number): number {
    const latR = latDeg * DEG;
    const lha  = ((gha + lonFromLat(latDeg)) % 360) * DEG;
    const computed =
      Math.asin(
        clamp(Math.sin(latR) * Math.sin(d) + Math.cos(latR) * Math.cos(d) * Math.cos(lha), -1, 1)
      ) * RAD;
    return Math.abs(computed - altDeg);
  }

  const chosenLat =
    Math.abs(lat1) <= 90 && altError(lat1) < altError(lat2) ? lat1 : lat2;
  const chosenLon = lonFromLat(chosenLat);

  // Confidence: how well does the fix reproduce the observed altitude?
  const err = altError(chosenLat);
  const confidence: "high" | "medium" | "low" =
    err < 0.5 ? "high" : err < 2 ? "medium" : "low";

  return {
    lat: Math.round(chosenLat * 10000) / 10000,
    lon: Math.round(chosenLon * 10000) / 10000,
    confidence,
  };
}

/** Compute sun's altitude and azimuth for a known position (for verification). */
export function computeAltAz(
  latDeg: number,
  lonDeg: number,
  date: Date
): { alt: number; az: number } {
  const { gha, dec } = sunEphemeris(date);
  const lha = ((gha + lonDeg) % 360) * DEG;
  const lat = latDeg * DEG;
  const d   = dec * DEG;

  const sinAlt = clamp(
    Math.sin(lat) * Math.sin(d) + Math.cos(lat) * Math.cos(d) * Math.cos(lha),
    -1, 1
  );
  const alt = Math.asin(sinAlt) * RAD;

  const cosZ = clamp(
    (Math.sin(d) - Math.sin(alt * DEG) * Math.sin(lat)) /
    (Math.cos(alt * DEG) * Math.cos(lat)),
    -1, 1
  );
  let az = Math.acos(cosZ) * RAD;
  if (((gha + lonDeg) % 360 + 360) % 360 < 180) az = 360 - az;

  return { alt: Math.round(alt * 100) / 100, az: Math.round(az * 100) / 100 };
}

/** Format decimal degrees to degrees/minutes string. */
export function toDMS(deg: number, isLat: boolean): string {
  const d   = Math.floor(Math.abs(deg));
  const min = ((Math.abs(deg) - d) * 60).toFixed(3);
  const dir = isLat ? (deg >= 0 ? "N" : "S") : (deg >= 0 ? "E" : "W");
  return `${d}° ${min}' ${dir}`;
}

export function compassPoint(az: number): string {
  const pts = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return pts[Math.round(((az % 360) + 360) % 360 / 22.5) % 16];
}
