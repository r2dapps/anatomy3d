import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CLINICAL_TRACKS,
  SYSTEMS,
  getStructureExplanation,
  type Concept,
  type Part,
} from '../data/fullBodyAnatomy.ts';
import {
  PointerTap,
  createExplosionLayout,
  getClinicalTrack,
  getPerformanceBudget,
  isPartVisible,
  searchConcepts,
} from './fullBodyLogic.ts';

describe('full-body anatomy systems & clinical focus tracks', () => {
  it('defines all 15 full-body systems and 6 clinical study tracks', () => {
    assert.equal(SYSTEMS.length, 15);
    assert.equal(CLINICAL_TRACKS.length, 6);
    const dental = getClinicalTrack('dental');
    assert.ok(dental.systems.includes('skeletal'));
    const cardio = getClinicalTrack('cardio');
    assert.ok(cardio.systems.includes('cardiac'));
    assert.ok(cardio.systems.includes('arterial'));
  });

  it('provides discipline-specific explanations for cardio, lungs, dental, ortho, and physio structures', () => {
    const heart = getStructureExplanation('Heart', 'cardiac');
    assert.equal(heart.isSpecific, true);
    assert.match(heart.discipline, /Cardiology/);

    const molar = getStructureExplanation('Right upper first molar tooth', 'digestive');
    assert.match(molar.discipline, /Dentistry/);

    const deltoid = getStructureExplanation('Left deltoid muscle', 'muscular');
    assert.match(deltoid.discipline, /Physiotherapy/);
  });
});

describe('hide / unhide visibility precedence', () => {
  it('hides individually hidden meshes even when their system or selection is active, and restores when unhidden', () => {
    const part = { id: 'FMA1', system: 'skeletal' as const };
    const visibleSystems = new Set(['skeletal' as const, 'cardiac' as const]);
    const selected = new Set(['FMA1']);
    const hidden = new Set(['FMA1']);

    assert.equal(isPartVisible(part, visibleSystems, selected, hidden, false), false);
    assert.equal(isPartVisible(part, visibleSystems, selected, hidden, true), false);

    // Unhide restores visibility immediately
    hidden.delete('FMA1');
    assert.equal(isPartVisible(part, visibleSystems, selected, hidden, false), true);
    assert.equal(isPartVisible(part, visibleSystems, selected, hidden, true), true);
  });

  it('respects isolate mode by hiding unselected parts', () => {
    const unselectedPart = { id: 'FMA2', system: 'skeletal' as const };
    const visibleSystems = new Set(['skeletal' as const]);
    const selected = new Set(['FMA1']);
    const hidden = new Set<string>();

    assert.equal(isPartVisible(unselectedPart, visibleSystems, selected, hidden, false), true);
    assert.equal(isPartVisible(unselectedPart, visibleSystems, selected, hidden, true), false);
  });
});

describe('concept search, explosion packing & pointer tap', () => {
  const concepts: Concept[] = [
    { id: 'c1', name: 'Heart', elements: ['p1'] },
    { id: 'c2', name: 'Right atrium of heart', elements: ['p2'] },
    { id: 'c3', name: 'Heart valve', elements: ['p3'] },
    { id: 'c4', name: 'Femur', elements: ['p4'] },
  ];

  it('ranks exact matches before prefix and substring matches', () => {
    const hits = searchConcepts(concepts, 'heart', 10);
    assert.equal(hits.length, 3);
    assert.equal(hits[0].name, 'Heart');
    assert.equal(hits[1].name, 'Heart valve');
    assert.equal(hits[2].name, 'Right atrium of heart');
  });

  it('packs visible parts into centered non-overlapping layout cells', () => {
    const sampleParts: Part[] = [
      {
        id: 'p1',
        name: 'Bone A',
        conceptId: 'c1',
        system: 'skeletal',
        chunk: 0,
        positions: 0,
        normals: 0,
        indices: 0,
        vertexCount: 10,
        indexCount: 12,
        bounds: [
          [0, 0, 0],
          [0.2, 0.4, 0.2],
        ],
      },
      {
        id: 'p2',
        name: 'Bone B',
        conceptId: 'c2',
        system: 'skeletal',
        chunk: 0,
        positions: 0,
        normals: 0,
        indices: 0,
        vertexCount: 10,
        indexCount: 12,
        bounds: [
          [0, 0, 0],
          [0.3, 0.2, 0.2],
        ],
      },
    ];
    const layout = createExplosionLayout(sampleParts, 1.5);
    assert.equal(layout.cells.size, 2);
    assert.ok(layout.width > 0 && layout.height > 0);
  });

  it('distinguishes clean tap from drag and multi-touch pinch', () => {
    const tap = new PointerTap();
    tap.down(1, 100, 100, 6);
    tap.move(1, 102, 103);
    assert.equal(tap.up(1, 102, 103), true);

    tap.down(2, 100, 100, 6);
    tap.move(2, 125, 100);
    assert.equal(tap.up(2, 125, 100), false);

    tap.down(3, 100, 100, 6);
    tap.down(4, 150, 150, 6);
    assert.equal(tap.up(3, 100, 100), false);
    assert.equal(tap.up(4, 150, 150), false);
  });

  it('applies conservative DPR caps for software WebGL and mobile devices', () => {
    assert.equal(getPerformanceBudget('auto', true, 2, false).pixelRatio, 1);
    assert.equal(getPerformanceBudget('auto', false, 3, true).pixelRatio, 1.5);
    assert.equal(getPerformanceBudget('auto', false, 2, false).pixelRatio, 2);
  });
});

import {
  advanceStudyQuiz,
  createStudyQuizSession,
  getSectionPlaneWorldCoord,
  isPointClipped,
  submitStudyQuizAnswer,
} from './fullBodyLogic.ts';

describe('anatomical X/Y/Z section cuts & study quiz engine', () => {
  it('maps normalized section coordinates onto adult metric body bounds and clips accurately', () => {
    assert.equal(getSectionPlaneWorldCoord('off', 0.5), 0);
    assert.ok(Math.abs(getSectionPlaneWorldCoord('y', 0) - 0.02) < 1e-6);
    assert.ok(Math.abs(getSectionPlaneWorldCoord('y', 1) - 1.78) < 1e-6);
    assert.ok(Math.abs(getSectionPlaneWorldCoord('x', 0.5) - 0) < 1e-6);

    const axialMid = { axis: 'y' as const, position: 0.5, flip: false };
    assert.equal(isPointClipped(0, 1.4, 0, axialMid), true);
    assert.equal(isPointClipped(0, 0.4, 0, axialMid), false);

    const axialFlipped = { axis: 'y' as const, position: 0.5, flip: true };
    assert.equal(isPointClipped(0, 1.4, 0, axialFlipped), false);
    assert.equal(isPointClipped(0, 0.4, 0, axialFlipped), true);
  });

  it('tracks study quiz score, streak, duplicate submission guard, and completion', () => {
    let q = createStudyQuizSession(2);
    assert.equal(q.currentIndex, 0);
    assert.equal(q.completed, false);

    q = submitStudyQuizAnswer(q, 'Heart', 'heart');
    assert.equal(q.score, 1);
    assert.equal(q.streak, 1);
    assert.equal(q.lastCorrect, true);

    // Second submission on same question is ignored
    q = submitStudyQuizAnswer(q, 'Liver', 'heart');
    assert.equal(q.score, 1);

    q = advanceStudyQuiz(q);
    assert.equal(q.currentIndex, 1);
    q = submitStudyQuizAnswer(q, 'Wrong', 'Femur');
    assert.equal(q.score, 1);
    assert.equal(q.streak, 0);
    assert.equal(q.lastCorrect, false);

    q = advanceStudyQuiz(q);
    assert.equal(q.completed, true);
  });
});

import fs from 'node:fs';
import { SPECIALTY_LABS } from '../data/studyCurriculum.ts';

describe('study curriculum topic highlighting & clean scene rules', () => {
  it('ensures every tour step highlights valid atlas.json concepts without auto-enabling section cuts', () => {
    const atlas = JSON.parse(fs.readFileSync('public/models/atlas.json', 'utf8')) as {
      concepts: { name: string }[];
    };
    const conceptNames = new Set(atlas.concepts.map((c) => c.name.toLowerCase()));

    for (const lab of Object.values(SPECIALTY_LABS)) {
      for (const step of lab.tourSteps) {
        assert.equal('sectionCut' in step, false, `${step.id} must not auto-enable section cut`);
        const targets = step.highlightConcepts ?? (step.highlightConcept ? [step.highlightConcept] : []);
        assert.ok(targets.length > 0, `${step.id} should highlight at least one main study structure`);
        for (const name of targets) {
          assert.ok(
            conceptNames.has(name.toLowerCase()),
            `${step.id} references unknown concept "${name}"`
          );
        }
      }
    }
  });
});


