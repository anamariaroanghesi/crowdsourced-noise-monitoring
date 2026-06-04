/**
 * Spatial interpolation algorithms for noise data.
 *
 * Four methods are supported:
 *   idw      – Inverse Distance Weighting
 *   kriging  – Ordinary Kriging (spherical variogram)
 *   spline   – Thin-Plate Spline (RBF)
 *   nearest  – Nearest-Neighbour (Voronoi)
 */

export type InterpolationMethod = 'idw' | 'kriging' | 'spline' | 'nearest';

export interface GeoPoint {
  lat: number;
  lng: number;
  value: number;
}

// ─── Geometry helper ─────────────────────────────────────────────────────────

/**
 * Approximate planar distance in degrees (good enough for a city-scale extent).
 * We account for the longitude compression at Bucharest's latitude (~44.4°).
 */
function dist(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const cosLat = Math.cos((lat1 * Math.PI) / 180);
  const dLat = lat2 - lat1;
  const dLng = (lng2 - lng1) * cosLat;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

// ─── Inverse Distance Weighting ──────────────────────────────────────────────

export function idwPredict(
  pts: GeoPoint[],
  lat: number,
  lng: number,
  power = 2
): number {
  let num = 0;
  let den = 0;
  for (const p of pts) {
    const d = dist(lat, lng, p.lat, p.lng);
    if (d < 1e-9) return p.value; // exact hit
    const w = 1 / Math.pow(d, power);
    num += w * p.value;
    den += w;
  }
  return den > 0 ? num / den : 0;
}

// ─── Nearest Neighbour ───────────────────────────────────────────────────────

export function nearestPredict(
  pts: GeoPoint[],
  lat: number,
  lng: number
): number {
  let minD = Infinity;
  let val = pts[0]?.value ?? 0;
  for (const p of pts) {
    const d = dist(lat, lng, p.lat, p.lng);
    if (d < minD) {
      minD = d;
      val = p.value;
    }
  }
  return val;
}

// ─── Matrix utilities ─────────────────────────────────────────────────────────

/** Full matrix inversion via Gauss–Jordan with partial pivoting. */
function invertMatrix(A: number[][]): number[][] {
  const n = A.length;
  // Augment A with identity
  const M: number[][] = A.map((row, i) => {
    const id = new Array<number>(n).fill(0);
    id[i] = 1;
    return [...row, ...id];
  });

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[maxRow][col])) maxRow = r;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-12) continue; // skip near-singular rows

    for (let c = col; c < 2 * n; c++) M[col][c] /= pivot;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let c = col; c < 2 * n; c++) M[r][c] -= f * M[col][c];
    }
  }

  return M.map((row) => row.slice(n));
}

/** Solve Ax = b via Gaussian elimination with partial pivoting. */
function solveSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[maxRow][col])) maxRow = r;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-12) continue;

    for (let c = col; c <= n; c++) M[col][c] /= pivot;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }

  return M.map((row, i) => (Math.abs(row[i]) > 1e-12 ? row[n] / row[i] : 0));
}

// ─── Ordinary Kriging ─────────────────────────────────────────────────────────

/**
 * Spherical variogram model.
 *   γ(h) = 0                                          h = 0
 *   γ(h) = nugget + sill·[1.5(h/range) – 0.5(h/range)³]  0 < h ≤ range
 *   γ(h) = nugget + sill                              h > range
 */
function sphericalVariogram(
  h: number,
  nugget: number,
  sill: number,
  range: number
): number {
  if (h <= 0) return 0;
  if (h >= range) return nugget + sill;
  const r = h / range;
  return nugget + sill * (1.5 * r - 0.5 * r * r * r);
}

export class OrdinaryKriging {
  private pts: GeoPoint[];
  private nugget: number;
  private sill: number;
  private range: number;
  private AInv: number[][];

  constructor(pts: GeoPoint[]) {
    this.pts = pts;

    // ── Estimate variogram parameters ──────────────────────────────────────
    const mean = pts.reduce((s, p) => s + p.value, 0) / pts.length;
    const variance =
      pts.reduce((s, p) => s + (p.value - mean) ** 2, 0) / pts.length;

    this.nugget = variance * 0.05;
    this.sill = variance * 0.95;

    // Range = half the mean nearest-neighbour distance × 10 (heuristic)
    let sumNearestDist = 0;
    for (const p of pts) {
      let nearest = Infinity;
      for (const q of pts) {
        if (p === q) continue;
        nearest = Math.min(nearest, dist(p.lat, p.lng, q.lat, q.lng));
      }
      sumNearestDist += nearest;
    }
    this.range = Math.max((sumNearestDist / pts.length) * 8, 0.01);

    // ── Build kriging system matrix and invert once ────────────────────────
    const n = pts.length;
    const size = n + 1; // +1 for Lagrange constraint
    const A: number[][] = Array.from({ length: size }, () =>
      new Array<number>(size).fill(0)
    );

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const h = dist(pts[i].lat, pts[i].lng, pts[j].lat, pts[j].lng);
        A[i][j] = sphericalVariogram(h, this.nugget, this.sill, this.range);
      }
      A[i][i] += 1e-6; // regularisation against singular matrix
      A[i][n] = 1;
      A[n][i] = 1;
    }
    // A[n][n] stays 0

    this.AInv = invertMatrix(A);
  }

  predict(lat: number, lng: number): number {
    const n = this.pts.length;
    // γ₀ vector (variogram values from prediction to each sample + Lagrange 1)
    const gamma0: number[] = this.pts.map((p) => {
      const h = dist(lat, lng, p.lat, p.lng);
      return sphericalVariogram(h, this.nugget, this.sill, this.range);
    });
    gamma0.push(1); // Lagrange constraint

    // λ = A⁻¹ · γ₀
    const lambda = this.AInv.map((row) =>
      row.reduce((s, v, j) => s + v * gamma0[j], 0)
    );

    // ẑ = Σ λᵢ zᵢ  (ignore last element — the Lagrange multiplier)
    return this.pts.reduce((s, p, i) => s + lambda[i] * p.value, 0);
  }
}

// ─── Thin-Plate Spline ────────────────────────────────────────────────────────

/**
 * TPS radial basis function: φ(r) = r² ln(r)
 * The surface f(x,y) = a₀ + a₁x + a₂y + Σ wᵢ φ(‖x−xᵢ‖)
 * is fit by solving a linear system built from the sample points.
 */
export class ThinPlateSpline {
  private pts: GeoPoint[];
  private w: number[] = []; // RBF weights
  private a: number[] = []; // polynomial coefficients [a₀, a₁, a₂]

  private static kernel(r: number): number {
    return r < 1e-10 ? 0 : r * r * Math.log(r);
  }

  constructor(pts: GeoPoint[]) {
    this.pts = pts;

    const n = pts.length;
    const size = n + 3; // n points + 3 polynomial terms
    const A: number[][] = Array.from({ length: size }, () =>
      new Array<number>(size).fill(0)
    );
    const b: number[] = new Array<number>(size).fill(0);

    // ── RBF block ──────────────────────────────────────────────────────────
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const r = dist(pts[i].lat, pts[i].lng, pts[j].lat, pts[j].lng);
        A[i][j] = ThinPlateSpline.kernel(r);
      }
      A[i][i] += 1e-6; // regularisation

      // Polynomial block (right columns)
      A[i][n] = 1;
      A[i][n + 1] = pts[i].lat;
      A[i][n + 2] = pts[i].lng;

      // Polynomial block (bottom rows — transpose)
      A[n][i] = 1;
      A[n + 1][i] = pts[i].lat;
      A[n + 2][i] = pts[i].lng;

      b[i] = pts[i].value;
    }
    // b[n..n+2] stays 0 (orthogonality constraints)

    const coeffs = solveSystem(A, b);
    this.w = coeffs.slice(0, n);
    this.a = coeffs.slice(n); // [a₀, a₁, a₂]
  }

  predict(lat: number, lng: number): number {
    let result = this.a[0] + this.a[1] * lat + this.a[2] * lng;
    for (let i = 0; i < this.pts.length; i++) {
      const r = dist(lat, lng, this.pts[i].lat, this.pts[i].lng);
      result += this.w[i] * ThinPlateSpline.kernel(r);
    }
    return result;
  }
}

// ─── Context (pre-computed objects shared across the grid) ────────────────────

export interface InterpolationContext {
  kriging?: OrdinaryKriging;
  spline?: ThinPlateSpline;
}

export function buildContext(
  pts: GeoPoint[],
  method: InterpolationMethod
): InterpolationContext {
  if (pts.length < 2) return {};
  if (method === 'kriging') return { kriging: new OrdinaryKriging(pts) };
  if (method === 'spline' && pts.length >= 3)
    return { spline: new ThinPlateSpline(pts) };
  return {};
}

// ─── Main dispatch ────────────────────────────────────────────────────────────

export function interpolate(
  pts: GeoPoint[],
  lat: number,
  lng: number,
  method: InterpolationMethod,
  ctx: InterpolationContext = {}
): number {
  if (pts.length === 0) return 0;

  switch (method) {
    case 'idw':
      return idwPredict(pts, lat, lng);
    case 'nearest':
      return nearestPredict(pts, lat, lng);
    case 'kriging':
      return ctx.kriging
        ? ctx.kriging.predict(lat, lng)
        : idwPredict(pts, lat, lng);
    case 'spline':
      return ctx.spline
        ? ctx.spline.predict(lat, lng)
        : idwPredict(pts, lat, lng);
  }
}

// ─── dB → RGBA color (consistent with app colour scheme) ─────────────────────

/**
 * Maps a dB level to an [R, G, B] colour triple using smooth interpolation
 * between the app's fixed anchors:
 *   ≤ 40 dB → deep blue  (ambient / very quiet)
 *   50 dB   → green
 *   70 dB   → yellow
 *   85 dB   → orange
 *  100 dB   → red
 */
const COLOR_STOPS: Array<{ db: number; r: number; g: number; b: number }> = [
  { db: 20,  r: 59,  g: 130, b: 246 }, // blue-400
  { db: 50,  r: 34,  g: 197, b: 94  }, // green-500
  { db: 70,  r: 234, g: 179, b: 8   }, // yellow-500
  { db: 85,  r: 249, g: 115, b: 22  }, // orange-500
  { db: 100, r: 239, g: 68,  b: 68  }, // red-500
];

export function dbToRgba(db: number, alpha = 190): [number, number, number, number] {
  const clamped = Math.max(COLOR_STOPS[0].db, Math.min(COLOR_STOPS.at(-1)!.db, db));

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const lo = COLOR_STOPS[i];
    const hi = COLOR_STOPS[i + 1];
    if (clamped <= hi.db) {
      const t = (clamped - lo.db) / (hi.db - lo.db);
      return [
        Math.round(lo.r + t * (hi.r - lo.r)),
        Math.round(lo.g + t * (hi.g - lo.g)),
        Math.round(lo.b + t * (hi.b - lo.b)),
        alpha,
      ];
    }
  }

  const last = COLOR_STOPS.at(-1)!;
  return [last.r, last.g, last.b, alpha];
}
