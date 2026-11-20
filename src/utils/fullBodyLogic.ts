import {
  CLINICAL_TRACKS,
  type ClinicalTrack,
  type ClinicalTrackConfig,
  type Concept,
  type Part,
  type SystemId,
} from '../data/fullBodyAnatomy.ts';

export interface LayoutCell {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type QualityTier = 'auto' | 'high' | 'balanced' | 'low';

export interface PerformanceBudget {
  resolvedTier: 'high' | 'balanced' | 'low';
  pixelRatio: number;
  antialias: boolean;
}

/**
 * Pack only visible source meshes into a non-overlapping flat inventory layout
 * for the second half of the Explode slider (adopted from ashemag/human-atlas).
 */
export function createExplosionLayout(
  parts: readonly Part[],
  aspect = 1
): { cells: Map<string, LayoutCell>; width: number; height: number } {
  const cards = parts.map((p) => ({
    id: p.id,
    system: p.system,
    width: Math.max(0.035, p.bounds[1][0] - p.bounds[0][0]) + 0.04,
    height: Math.max(0.035, p.bounds[1][1] - p.bounds[0][1]) + 0.04,
  }));

  const area = cards.reduce((n, c) => n + c.width * c.height, 0);
  const maxWidth = Math.max(0.3, ...cards.map((c) => c.width));
  const targetWidth = Math.max(
    maxWidth,
    Math.sqrt(area * Math.max(0.5, Math.min(1.5, aspect))) * 1.18
  );

  cards.sort((a, b) => b.height - a.height || a.id.localeCompare(b.id));

  const cells = new Map<string, LayoutCell>();
  let x = 0;
  let y = 0;
  let row = 0;
  let usedWidth = 0;

  for (const c of cards) {
    if (x > 0 && x + c.width > targetWidth) {
      x = 0;
      y += row;
      row = 0;
    }
    cells.set(c.id, {
      x: x + c.width / 2,
      y: -y - c.height / 2,
      width: c.width,
      height: c.height,
    });
    x += c.width;
    usedWidth = Math.max(usedWidth, x);
    row = Math.max(row, c.height);
  }

  const height = y + row;
  cells.forEach((c) => {
    c.x -= usedWidth / 2;
    c.y += height / 2;
  });

  return { cells, width: usedWidth, height };
}

/**
 * Distinguish a clean tap/click from an orbit drag, pinch zoom, or canceled touch.
 */
export class PointerTap {
  private active = new Map<number, { x: number; y: number; threshold: number }>();
  private blocked = false;

  down(id: number, x: number, y: number, threshold: number): void {
    if (this.active.size === 0) this.blocked = false;
    this.active.set(id, { x, y, threshold });
    if (this.active.size > 1) this.blocked = true;
  }

  move(id: number, x: number, y: number): void {
    const start = this.active.get(id);
    if (start && Math.hypot(x - start.x, y - start.y) > start.threshold) {
      this.blocked = true;
    }
  }

  up(id: number, x: number, y: number): boolean {
    this.move(id, x, y);
    const tap = this.active.has(id) && this.active.size === 1 && !this.blocked;
    this.active.delete(id);
    return tap;
  }

  cancel(id: number): void {
    this.active.delete(id);
    this.blocked = true;
  }
}

/**
 * Safely decode gzipped or plain binary geometry chunks without double-decompressing.
 */
export async function decodeModelResponse(
  response: Response,
  expectedBytes: number,
  compressed: boolean
): Promise<ArrayBuffer> {
  if (!response.ok) {
    throw new Error(`Failed to load anatomy chunk (${response.status}).`);
  }
  const payload = await response.arrayBuffer();
  const sig = new Uint8Array(payload, 0, Math.min(2, payload.byteLength));
  const isGzipMagic = compressed && sig[0] === 0x1f && sig[1] === 0x8b;
  const buffer = isGzipMagic
    ? await new Response(
        new Blob([payload]).stream().pipeThrough(new DecompressionStream('gzip'))
      ).arrayBuffer()
    : payload;

  if (buffer.byteLength !== expectedBytes) {
    throw new Error(
      `Incomplete anatomy chunk (${buffer.byteLength} vs ${expectedBytes} bytes).`
    );
  }
  return buffer;
}

/**
 * Compute per-mesh visibility with clean precedence:
 * 1. Individually hidden parts are ALWAYS hidden (even if their system is enabled),
 *    until explicitly unhidden by the user.
 * 2. When isolate is active, only non-hidden selected parts are shown.
 * 3. Otherwise, parts whose system is enabled OR that are currently selected are shown.
 */
export function isPartVisible(
  part: Pick<Part, 'id' | 'system'>,
  visibleSystems: ReadonlySet<SystemId>,
  selectedIds: ReadonlySet<string>,
  hiddenIds: ReadonlySet<string>,
  isolate: boolean
): boolean {
  if (hiddenIds.has(part.id)) return false;
  const isSelected = selectedIds.has(part.id);
  if (isolate) return isSelected;
  return visibleSystems.has(part.system) || isSelected;
}

/**
 * Ranked search across 3,432 FMA anatomical concepts.
 * Prioritizes exact matches -> prefix matches -> word-boundary matches -> substring matches.
 */
export function searchConcepts(
  concepts: readonly Concept[],
  rawQuery: string,
  limit = 60
): Concept[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) {
    const featured = [
      'heart',
      'brain',
      'right lung',
      'left lung',
      'mandible',
      'maxilla',
      'femur',
      'humerus',
      'liver',
      'stomach',
      'diaphragm',
      'trachea',
      'vertebral column',
      'skull',
      'pelvis',
      'patella',
    ];
    const picked: Concept[] = [];
    const seen = new Set<string>();
    for (const term of featured) {
      const match = concepts.find((c) => c.name.toLowerCase() === term);
      if (match && !seen.has(match.id)) {
        seen.add(match.id);
        picked.push(match);
      }
    }
    return picked.length > 0 ? picked : concepts.slice(0, Math.min(limit, 24));
  }

  const scored: { concept: Concept; score: number }[] = [];
  for (let i = 0; i < concepts.length; i++) {
    const c = concepts[i];
    const name = c.name.toLowerCase();
    const pos = name.indexOf(q);
    if (pos < 0) continue;

    let score = 3;
    if (name === q) score = 0;
    else if (pos === 0) score = 1;
    else if (name[pos - 1] === ' ' || name[pos - 1] === '-') score = 2;

    scored.push({ concept: c, score });
  }

  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.concept.name.length - b.concept.name.length ||
      a.concept.name.localeCompare(b.concept.name)
  );
  return scored.slice(0, limit).map((s) => s.concept);
}

/**
 * Lookup specialty focus track configuration (Full Body, Ortho, Cardio, Lungs, Physio, Dental).
 */
export function getClinicalTrack(trackId: ClinicalTrack): ClinicalTrackConfig {
  return CLINICAL_TRACKS.find((t) => t.id === trackId) ?? CLINICAL_TRACKS[0];
}

/**
 * Determine WebGL rendering pixel ratio & antialias budget for desktop, tablet, mobile, and software WebGL.
 */
export function getPerformanceBudget(
  tier: QualityTier,
  isSoftwareGl: boolean,
  devicePixelRatio: number,
  isMobileOrTablet: boolean
): PerformanceBudget {
  const safeDpr = Math.max(1, Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1);

  const resolved: 'high' | 'balanced' | 'low' =
    tier !== 'auto'
      ? tier
      : isSoftwareGl
      ? 'low'
      : isMobileOrTablet
      ? 'balanced'
      : 'high';

  if (resolved === 'low' || isSoftwareGl) {
    return { resolvedTier: 'low', pixelRatio: 1, antialias: false };
  }
  if (resolved === 'balanced') {
    return { resolvedTier: 'balanced', pixelRatio: Math.min(safeDpr, 1.5), antialias: true };
  }
  return { resolvedTier: 'high', pixelRatio: Math.min(safeDpr, 2), antialias: true };
}

export type SectionCutAxis = 'off' | 'x' | 'y' | 'z';

export interface SectionCutState {
  axis: SectionCutAxis;
  /** Normalized 0..1 position across anatomical bounds on the active axis. */
  position: number;
  /** Flips which half of the cut plane is discarded. */
  flip: boolean;
}

export const DEFAULT_SECTION_CUT: SectionCutState = {
  axis: 'off',
  position: 0.5,
  flip: false,
};

/** Full-body adult metric bounds (meters) used for Sagittal (X), Axial (Y), Coronal (Z) cuts. */
export const SECTION_AXIS_BOUNDS: Record<Exclude<SectionCutAxis, 'off'>, [number, number]> = {
  x: [-0.42, 0.42],
  y: [0.02, 1.78],
  z: [-0.22, 0.22],
};

export function getSectionPlaneWorldCoord(axis: SectionCutAxis, normalizedPos: number): number {
  if (axis === 'off') return 0;
  const clamped = Math.max(0, Math.min(1, normalizedPos));
  const [min, max] = SECTION_AXIS_BOUNDS[axis];
  return min + (max - min) * clamped;
}

/**
 * Mirrors the exact GPU shader section-cut discard equation so pointer picking
 * ignores clipped-away geometry and hits internal organs exposed by the cut plane.
 */
export function isPointClipped(x: number, y: number, z: number, cut: SectionCutState): boolean {
  if (cut.axis === 'off') return false;
  const plane = getSectionPlaneWorldCoord(cut.axis, cut.position);
  const coord = cut.axis === 'x' ? x : cut.axis === 'y' ? y : z;
  const signed = (coord - plane) * (cut.flip ? -1 : 1);
  return signed > 0;
}

export interface StudyQuizSession {
  total: number;
  currentIndex: number;
  score: number;
  streak: number;
  answeredOption: string | null;
  lastCorrect: boolean | null;
  completed: boolean;
}

export function createStudyQuizSession(totalQuestions: number): StudyQuizSession {
  return {
    total: Math.max(0, totalQuestions),
    currentIndex: 0,
    score: 0,
    streak: 0,
    answeredOption: null,
    lastCorrect: null,
    completed: totalQuestions <= 0,
  };
}

export function submitStudyQuizAnswer(
  session: StudyQuizSession,
  selectedOption: string,
  expectedAnswer: string
): StudyQuizSession {
  if (session.completed || session.answeredOption !== null) return session;
  const correct = selectedOption.trim().toLowerCase() === expectedAnswer.trim().toLowerCase();
  return {
    ...session,
    score: correct ? session.score + 1 : session.score,
    streak: correct ? session.streak + 1 : 0,
    answeredOption: selectedOption,
    lastCorrect: correct,
  };
}

export function advanceStudyQuiz(session: StudyQuizSession): StudyQuizSession {
  if (session.completed) return session;
  const next = session.currentIndex + 1;
  if (next >= session.total) {
    return { ...session, completed: true, answeredOption: null };
  }
  return {
    ...session,
    currentIndex: next,
    answeredOption: null,
    lastCorrect: null,
  };
}

