import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ANATOMY_CATALOG } from '../data/anatomyCatalog.ts';
import {
  advanceQuizSession,
  buildAnatomicalHandLandmarks,
  computeExplodeOffset,
  createQuizSession,
  decodeQuantizedPositions,
  evaluateQuizAnswer,
  filterStructures,
  getPerformanceBudget,
  getPresetSystems,
} from './anatomyLogic.ts';

describe('anatomyCatalog & quantized mesh decoding', () => {
  it('loads all 49 BodyParts3D structures split cleanly between head (29) and hand (20)', () => {
    assert.equal(ANATOMY_CATALOG.length, 49);
    const headCount = ANATOMY_CATALOG.filter((s) => s.region === 'head').length;
    const handCount = ANATOMY_CATALOG.filter((s) => s.region === 'hand').length;
    assert.equal(headCount, 29);
    assert.equal(handCount, 20);
    for (const s of ANATOMY_CATALOG) {
      assert.ok(s.latinName.length > 0, `missing Latin name for ${s.rawName}`);
      assert.ok(s.summary.length > 10, `missing summary for ${s.rawName}`);
      assert.ok(s.vertexCount > 0 && s.triangleCount > 0);
    }
  });

  it('decodes quantized Int16 vertex positions accurately around center & halfExtent', () => {
    const q = new Int16Array([0, 32767, -32767, 16384, 0, -16384]);
    const out = decodeQuantizedPositions(q, [1.5, -2.0, 0.5], 10.0);
    assert.equal(out.length, 6);
    assert.ok(Math.abs(out[0] - 1.5) < 1e-4);
    assert.ok(Math.abs(out[1] - 8.0) < 1e-4);
    assert.ok(Math.abs(out[2] - -9.5) < 1e-4);
    assert.ok(Math.abs(out[3] - 6.5) < 1e-2);
  });
});

describe('structure filtering, presets & explode vectors', () => {
  it('filters by region, system toggles, search query (including Latin names), hidden & isolated state', () => {
    const allSystems = getPresetSystems('all');
    const allHead = filterStructures(ANATOMY_CATALOG, {
      region: 'head',
      systems: allSystems,
      searchQuery: '',
      hiddenIds: new Set(),
      isolatedId: null,
    });
    assert.equal(allHead.length, 29);

    const neuroPreset = getPresetSystems('neuro');
    const neuroHead = filterStructures(ANATOMY_CATALOG, {
      region: 'head',
      systems: neuroPreset,
      searchQuery: '',
      hiddenIds: new Set(),
      isolatedId: null,
    });
    assert.equal(neuroHead.length, 9); // 8 brain structures + eyeballs

    const latinMatch = filterStructures(ANATOMY_CATALOG, {
      region: 'head',
      systems: allSystems,
      searchQuery: 'Os sphenoidale',
      hiddenIds: new Set(),
      isolatedId: null,
    });
    assert.equal(latinMatch.length, 1);
    assert.equal(latinMatch[0].rawName, 'Sphenoid bone');

    const isolated = filterStructures(ANATOMY_CATALOG, {
      region: 'head',
      systems: getPresetSystems('skeleton'),
      searchQuery: 'nonexistent',
      hiddenIds: new Set(['frontal-lobe']),
      isolatedId: 'frontal-lobe',
    });
    assert.equal(isolated.length, 1);
    assert.equal(isolated[0].id, 'frontal-lobe');
  });

  it('computes zero explode offset at 0 and scales monotonically radially', () => {
    assert.deepEqual(computeExplodeOffset([2, 8, 1], 'head', 0), [0, 0, 0]);
    const half = computeExplodeOffset([2, 8, 1], 'head', 0.5);
    const full = computeExplodeOffset([2, 8, 1], 'head', 1.0);
    assert.ok(Math.abs(full[1] - half[1] * 2) < 1e-6);
    assert.ok(full[1] > 0);
  });
});

describe('hand kinematics & WebGL performance budgets', () => {
  it('generates 21 valid 3D hand landmarks and curls fingertips forward when flexion increases', () => {
    const extended = buildAnatomicalHandLandmarks(0);
    const flexed = buildAnatomicalHandLandmarks(0.8);
    assert.equal(extended.length, 21);
    assert.equal(flexed.length, 21);
    // Middle fingertip (index 12) should move forward (+Z) and downward (-Y) during flexion
    assert.ok(flexed[12][2] > extended[12][2] + 2.0);
    assert.ok(flexed[12][1] < extended[12][1]);
  });

  it('selects strict software-GL / low-end budgets and caps mobile DPR', () => {
    const sw = getPerformanceBudget('auto', true, 2, false);
    assert.equal(sw.resolvedTier, 'low');
    assert.equal(sw.pixelRatio, 1);
    assert.equal(sw.antialias, false);

    const mobile = getPerformanceBudget('auto', false, 3, true);
    assert.equal(mobile.resolvedTier, 'balanced');
    assert.equal(mobile.pixelRatio, 1.5);

    const desktop = getPerformanceBudget('auto', false, 2, false);
    assert.equal(desktop.resolvedTier, 'high');
    assert.equal(desktop.pixelRatio, 2);
  });
});

describe('educational quiz engine', () => {
  it('runs a full deterministic quiz session tracking score, streak, and completion', () => {
    let session = createQuizSession('head', 3, 42);
    assert.equal(session.questions.length, 3);
    assert.equal(session.completed, false);

    // Correct answer on Q1
    const q1 = session.questions[0];
    assert.ok(q1.choiceIds.includes(q1.targetId));
    session = evaluateQuizAnswer(session, q1.targetId);
    assert.equal(session.score, 1);
    assert.equal(session.streak, 1);
    assert.equal(session.lastResult?.correct, true);

    session = advanceQuizSession(session);
    assert.equal(session.currentIndex, 1);

    // Wrong answer on Q2 resets streak
    const q2 = session.questions[1];
    const wrongId = q2.choiceIds.find((id) => id !== q2.targetId)!;
    session = evaluateQuizAnswer(session, wrongId);
    assert.equal(session.score, 1);
    assert.equal(session.streak, 0);
    assert.equal(session.bestStreak, 1);
    assert.equal(session.lastResult?.correct, false);

    session = advanceQuizSession(session);
    const q3 = session.questions[2];
    session = evaluateQuizAnswer(session, q3.targetId);
    session = advanceQuizSession(session);
    assert.equal(session.completed, true);
    assert.equal(session.score, 2);
  });
});
