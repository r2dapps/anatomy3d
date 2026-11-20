import {
  ANATOMY_CATALOG,
  HEAD_CENTROID,
  type AnatomyStructure,
  type AnatomySystem,
  type AtlasRegion,
} from '../data/anatomyCatalog.ts';

export type ShaderLook = 'solid' | 'xray' | 'lens' | 'wireframe';
export type ClipMode = 'whole' | 'left' | 'right' | 'top' | 'lower' | 'front';
export type QualityTier = 'auto' | 'high' | 'balanced' | 'low';
export type SystemPreset = 'all' | 'skeleton' | 'neuro' | 'muscular';

export interface SystemVisibility {
  skull: boolean;
  brain: boolean;
  musc: boolean;
  eye: boolean;
  hand: boolean;
}

export interface FilterOptions {
  region: AtlasRegion;
  systems: SystemVisibility;
  searchQuery: string;
  hiddenIds: ReadonlySet<string>;
  isolatedId: string | null;
}

export interface PerformanceBudget {
  resolvedTier: 'high' | 'balanced' | 'low';
  pixelRatio: number;
  antialias: boolean;
  enableRimDetail: boolean;
  maxLabels: number;
  raycastThrottleMs: number;
}

export interface QuizQuestion {
  targetId: string;
  prompt: string;
  hintSystem: AnatomySystem;
  hintSubGroup: string;
  choiceIds: string[];
}

export interface QuizSession {
  region: AtlasRegion;
  questions: QuizQuestion[];
  currentIndex: number;
  score: number;
  streak: number;
  bestStreak: number;
  answeredCount: number;
  lastResult: {
    correct: boolean;
    pickedId: string;
    targetId: string;
  } | null;
  completed: boolean;
}

/**
 * Decode quantized Int16 coordinates from the BodyParts3D binary buffer
 * into Float32 vertex positions in anatomical world units.
 */
export function decodeQuantizedPositions(
  quantized: Int16Array,
  center: readonly [number, number, number],
  halfExtent: number
): Float32Array {
  const vertexCount = Math.floor(quantized.length / 3);
  const positions = new Float32Array(vertexCount * 3);
  const scale = halfExtent / 32767;
  const cx = center[0];
  const cy = center[1];
  const cz = center[2];

  for (let i = 0; i < vertexCount; i++) {
    const idx = i * 3;
    positions[idx] = cx + quantized[idx] * scale;
    positions[idx + 1] = cy + quantized[idx + 1] * scale;
    positions[idx + 2] = cz + quantized[idx + 2] * scale;
  }
  return positions;
}

/**
 * Resolve system visibility toggles for educational presets.
 */
export function getPresetSystems(preset: SystemPreset): SystemVisibility {
  switch (preset) {
    case 'skeleton':
      return { skull: true, brain: false, musc: false, eye: false, hand: true };
    case 'neuro':
      return { skull: false, brain: true, musc: false, eye: true, hand: false };
    case 'muscular':
      return { skull: true, brain: false, musc: true, eye: true, hand: false };
    case 'all':
    default:
      return { skull: true, brain: true, musc: true, eye: true, hand: true };
  }
}

/**
 * Filter anatomical structures for active viewport visibility & search results.
 */
export function filterStructures(
  items: readonly AnatomyStructure[],
  options: FilterOptions
): AnatomyStructure[] {
  const q = options.searchQuery.trim().toLowerCase();

  return items.filter((item) => {
    if (item.region !== options.region) return false;
    if (options.isolatedId) {
      return item.id === options.isolatedId;
    }
    if (!options.systems[item.system]) return false;
    if (options.hiddenIds.has(item.id)) return false;
    if (!q) return true;

    return (
      item.displayName.toLowerCase().includes(q) ||
      item.rawName.toLowerCase().includes(q) ||
      item.latinName.toLowerCase().includes(q) ||
      item.subGroup.toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q)
    );
  });
}

/**
 * Compute deterministic radial explode displacement vector for any anatomical structure.
 */
export function computeExplodeOffset(
  center: readonly [number, number, number],
  region: AtlasRegion,
  explodeAmount: number
): [number, number, number] {
  const t = Math.max(0, Math.min(1, explodeAmount));
  if (t <= 0.0001) return [0, 0, 0];

  if (region === 'head') {
    const dx = center[0] - HEAD_CENTROID[0];
    const dy = center[1] - HEAD_CENTROID[1];
    const dz = center[2] - HEAD_CENTROID[2];
    const scale = t * 1.15;
    return [dx * scale, dy * scale, dz * scale];
  }

  // Hand bones explode outward along their anatomical ray from the wrist center
  const scale = t * 0.42;
  return [center[0] * scale, center[1] * scale, center[2] * scale];
}

/**
 * Build an anatomically proportioned 21-landmark 3D right hand skeleton
 * compatible with BodyParts3D hand bone placement (MediaPipe 0..20 topology).
 * `flexion` ranges from 0 (relaxed extended hand) to 1 (anatomical flexion).
 */
export function buildAnatomicalHandLandmarks(
  flexion = 0
): [number, number, number][] {
  const f = Math.max(0, Math.min(1, flexion));
  const pts: [number, number, number][] = new Array(21);

  // 0: Wrist base (Carpus origin)
  pts[0] = [0, -8.2, 0];

  // Helper to build a 3-joint finger chain starting from MCP joint
  const buildFinger = (
    mcpIdx: number,
    mcp: [number, number, number],
    dirX: number,
    lengths: [number, number, number],
    flexBias: number
  ) => {
    pts[mcpIdx] = mcp;
    const a1 = f * 1.15 * flexBias; // MCP flexion
    const a2 = a1 + f * 1.25 * flexBias; // PIP flexion
    const a3 = a2 + f * 0.85 * flexBias; // DIP flexion

    const p1: [number, number, number] = [
      mcp[0] + dirX * lengths[0] * 0.45,
      mcp[1] + Math.cos(a1) * lengths[0],
      mcp[2] + Math.sin(a1) * lengths[0],
    ];
    const p2: [number, number, number] = [
      p1[0] + dirX * lengths[1] * 0.25,
      p1[1] + Math.cos(a2) * lengths[1],
      p1[2] + Math.sin(a2) * lengths[1],
    ];
    const p3: [number, number, number] = [
      p2[0] + dirX * lengths[2] * 0.15,
      p2[1] + Math.cos(a3) * lengths[2],
      p2[2] + Math.sin(a3) * lengths[2],
    ];

    pts[mcpIdx + 1] = p1;
    pts[mcpIdx + 2] = p2;
    pts[mcpIdx + 3] = p3;
  };

  // Thumb (1: CMC, 2: MCP, 3: IP, 4: Tip) — opposable abduction/flexion
  const cmc: [number, number, number] = [-2.55, -6.1, 0.85];
  const thumbFlex = f * 0.85;
  const tMcp: [number, number, number] = [
    cmc[0] - 2.35 + f * 1.0,
    cmc[1] + 2.85 - f * 0.25,
    cmc[2] + 1.05 + f * 1.45,
  ];
  const tIp: [number, number, number] = [
    tMcp[0] - 1.55 * Math.cos(thumbFlex) + f * 1.65,
    tMcp[1] + 2.35 * Math.cos(thumbFlex * 0.65),
    tMcp[2] + 0.65 + Math.sin(thumbFlex) * 2.1,
  ];
  const tTip: [number, number, number] = [
    tIp[0] - 0.85 * Math.cos(thumbFlex * 1.3) + f * 1.55,
    tIp[1] + 1.85 * Math.cos(thumbFlex * 1.15),
    tIp[2] + 0.35 + Math.sin(thumbFlex * 1.3) * 1.85,
  ];
  pts[1] = cmc;
  pts[2] = tMcp;
  pts[3] = tIp;
  pts[4] = tTip;

  // Index (5..8), Middle (9..12), Ring (13..16), Little (17..20)
  buildFinger(5, [-2.75, 0.35, 0.12], -0.11, [3.85, 2.35, 1.65], 0.94);
  buildFinger(9, [-0.82, 0.95, 0.0], -0.02, [4.35, 2.7, 1.82], 1.0);
  buildFinger(13, [1.18, 0.42, 0.14], 0.06, [3.95, 2.48, 1.72], 1.04);
  buildFinger(17, [3.05, -0.58, 0.42], 0.16, [3.15, 1.9, 1.48], 1.08);

  return pts;
}

/**
 * Determine WebGL rendering budget tailored for desktops, tablets, phones, and software WebGL.
 */
export function getPerformanceBudget(
  tier: QualityTier,
  isSoftwareGl: boolean,
  devicePixelRatio: number,
  isMobileOrTablet: boolean
): PerformanceBudget {
  const safeDpr = Math.max(1, Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1);

  let resolved: 'high' | 'balanced' | 'low';
  if (tier !== 'auto') {
    resolved = tier;
  } else if (isSoftwareGl) {
    resolved = 'low';
  } else if (isMobileOrTablet) {
    resolved = 'balanced';
  } else {
    resolved = 'high';
  }

  if (resolved === 'low' || isSoftwareGl) {
    return {
      resolvedTier: 'low',
      pixelRatio: 1,
      antialias: false,
      enableRimDetail: false,
      maxLabels: 10,
      raycastThrottleMs: 120,
    };
  }

  if (resolved === 'balanced') {
    return {
      resolvedTier: 'balanced',
      pixelRatio: Math.min(safeDpr, 1.5),
      antialias: true,
      enableRimDetail: true,
      maxLabels: 14,
      raycastThrottleMs: 75,
    };
  }

  return {
    resolvedTier: 'high',
    pixelRatio: Math.min(safeDpr, 2),
    antialias: true,
    enableRimDetail: true,
    maxLabels: 20,
    raycastThrottleMs: 45,
  };
}

/**
 * Deterministic shuffle helper using an optional seed for reproducible tests.
 */
function shuffleWithSeed<T>(arr: readonly T[], seed = Date.now()): T[] {
  const out = [...arr];
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * Build an educational 3D identification quiz session for the active region.
 */
export function createQuizSession(
  region: AtlasRegion,
  questionCount = 8,
  seed?: number
): QuizSession {
  const pool = ANATOMY_CATALOG.filter((s) => s.region === region);
  const shuffled = shuffleWithSeed(pool, seed ?? Date.now());
  const count = Math.min(questionCount, shuffled.length);
  const targets = shuffled.slice(0, count);

  const questions: QuizQuestion[] = targets.map((target, idx) => {
    const distractors = shuffleWithSeed(
      pool.filter((p) => p.id !== target.id),
      (seed ?? Date.now()) + idx * 97 + 13
    ).slice(0, 3);
    const choiceIds = shuffleWithSeed(
      [target.id, ...distractors.map((d) => d.id)],
      (seed ?? Date.now()) + idx * 31 + 7
    );
    return {
      targetId: target.id,
      prompt: target.quizPrompt,
      hintSystem: target.system,
      hintSubGroup: target.subGroup,
      choiceIds,
    };
  });

  return {
    region,
    questions,
    currentIndex: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    answeredCount: 0,
    lastResult: null,
    completed: questions.length === 0,
  };
}

/**
 * Evaluate a user's answer (clicked 3D structure or multiple-choice selection).
 */
export function evaluateQuizAnswer(
  session: QuizSession,
  pickedId: string
): QuizSession {
  if (session.completed || session.currentIndex >= session.questions.length) {
    return session;
  }
  const current = session.questions[session.currentIndex];
  const correct = current.targetId === pickedId;
  const nextStreak = correct ? session.streak + 1 : 0;

  return {
    ...session,
    score: correct ? session.score + 1 : session.score,
    streak: nextStreak,
    bestStreak: Math.max(session.bestStreak, nextStreak),
    answeredCount: session.answeredCount + 1,
    lastResult: {
      correct,
      pickedId,
      targetId: current.targetId,
    },
  };
}

/**
 * Advance the quiz session to the next question.
 */
export function advanceQuizSession(session: QuizSession): QuizSession {
  if (session.completed) return session;
  const nextIndex = session.currentIndex + 1;
  const completed = nextIndex >= session.questions.length;
  return {
    ...session,
    currentIndex: completed ? session.currentIndex : nextIndex,
    lastResult: null,
    completed,
  };
}
