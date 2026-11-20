import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkWebXrSupport,
  formatCalloutLabel,
  getTourCalloutWidth,
  getXrRigTransform,
  layoutTourCallouts,
  resolveAssetUrl,
  type ProjectedCalloutInput,
} from './xrAndLabelsLogic.ts';

describe('3D tour callout label formatting & anti-collision layout', () => {
  it('formats anatomical concept names cleanly for concise 3D callouts', () => {
    assert.equal(formatCalloutLabel('heart'), 'Heart');
    assert.equal(formatCalloutLabel('zone of deltoid'), 'Deltoid');
    assert.equal(formatCalloutLabel('ligament organ'), 'Ligament');
    assert.equal(formatCalloutLabel('superior vena cava'), 'Superior Vena Cava');
  });

  it('separates overlapping projected anchors vertically and fans boxes cleanly outside anchor dots', () => {
    const stacked: ProjectedCalloutInput[] = [
      { id: '1', label: 'Superior Vena Cava', conceptName: 'superior vena cava', system: 'venous', anchorX: 900, anchorY: 320, depth: 0.2, visible: true },
      { id: '2', label: 'Pulmonary Trunk', conceptName: 'pulmonary trunk', system: 'arterial', anchorX: 912, anchorY: 324, depth: 0.2, visible: true },
      { id: '3', label: 'Aorta', conceptName: 'aorta', system: 'arterial', anchorX: 938, anchorY: 328, depth: 0.2, visible: true },
      { id: '4', label: 'Inferior Vena Cava', conceptName: 'inferior vena cava', system: 'venous', anchorX: 944, anchorY: 332, depth: 0.2, visible: true },
    ];

    const resolved = layoutTourCallouts(stacked, 1440, 900, {
      left: 416,
      right: 1430,
      top: 88,
      bottom: 784,
    });

    const boxW = getTourCalloutWidth(1440);
    assert.equal(resolved.length, 4);

    // Check minimum vertical gap on each side independently
    for (const side of ['left', 'right'] as const) {
      const col = resolved.filter((r) => r.side === side).sort((a, b) => a.boxY - b.boxY);
      for (let i = 1; i < col.length; i++) {
        assert.ok(
          col[i].boxY - col[i - 1].boxY >= 41.5,
          `Expected >= 42px vertical gap on ${side} column, got ${col[i].boxY - col[i - 1].boxY}`
        );
      }
    }

    // All boxes stay cleanly within safe viewport boundaries and never cover their own anchor dot
    for (const r of resolved) {
      assert.ok(r.boxX >= 416 && r.boxX <= 1430 - boxW);
      assert.ok(r.boxY >= 88 && r.boxY <= 784);
      if (r.side === 'left') {
        assert.ok(
          r.boxX + boxW <= r.anchorX - 40,
          `Left box right edge (${r.boxX + boxW}) should stay clearly left of anchorX (${r.anchorX})`
        );
      } else {
        assert.ok(
          r.boxX >= r.anchorX + 40,
          `Right box left edge (${r.boxX}) should stay clearly right of anchorX (${r.anchorX})`
        );
      }
    }
  });

  it('docks compact mobile callouts cleanly to left and right flanks leaving the central 3D corridor open', () => {
    const mobileItems: ProjectedCalloutInput[] = [
      { id: 'm1', label: 'Maxilla', conceptName: 'maxilla', system: 'skeletal', anchorX: 184, anchorY: 200, depth: 0.2, visible: true },
      { id: 'm2', label: 'Mandible', conceptName: 'mandible', system: 'skeletal', anchorX: 205, anchorY: 250, depth: 0.2, visible: true },
      { id: 'm3', label: 'Tooth', conceptName: 'tooth', system: 'digestive', anchorX: 196, anchorY: 225, depth: 0.2, visible: true },
    ];
    const resolved = layoutTourCallouts(mobileItems, 390, 844, {
      left: 10,
      right: 380,
      top: 74,
      bottom: 380,
    });
    const boxW = getTourCalloutWidth(390);
    assert.equal(resolved.length, 3);
    for (const r of resolved) {
      if (r.side === 'left') {
        assert.equal(r.boxX, 10);
      } else {
        assert.equal(r.boxX, 380 - boxW);
      }
    }
  });

  it('filters out invisible or behind-camera anchors cleanly', () => {
    const items: ProjectedCalloutInput[] = [
      { id: 'ok', label: 'Heart', conceptName: 'heart', system: 'cardiac', anchorX: 200, anchorY: 220, depth: 0.4, visible: true },
      { id: 'behind', label: 'Back', conceptName: 'back', system: 'skeletal', anchorX: 200, anchorY: 220, depth: 1.4, visible: true },
      { id: 'hidden', label: 'Hidden', conceptName: 'hidden', system: 'skeletal', anchorX: 200, anchorY: 220, depth: 0.1, visible: false },
    ];

    const resolved = layoutTourCallouts(items, 390, 844);
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0].id, 'ok');
  });
});

describe('Quest 2 WebXR rig placement & capability detection', () => {
  it('places full-body anatomy standing on the VR floor 1.35m ahead of user', () => {
    const rig = getXrRigTransform(false, null);
    assert.deepEqual(rig.position, [0, 0, -1.35]);
    assert.equal(rig.scale, 1);
  });

  it('scales small isolated organs (heart/teeth) up to eye/chest level in VR', () => {
    const rig = getXrRigTransform(true, [0, 1.54, 0.05], 0.12);
    assert.equal(rig.scale, 2.4);
    // Transformed center should land at y = 1.32, z = -0.92
    const worldY = rig.position[1] + 1.54 * rig.scale;
    const worldZ = rig.position[2] + 0.05 * rig.scale;
    assert.ok(Math.abs(worldY - 1.32) < 0.001);
    assert.ok(Math.abs(worldZ - -0.92) < 0.001);
  });

  it('reports supported, unsupported, and insecure-context WebXR states safely', async () => {
    assert.equal(
      await checkWebXrSupport({ isSecureContext: false }),
      'insecure-context'
    );
    assert.equal(
      await checkWebXrSupport({ isSecureContext: true, xr: undefined }),
      'unsupported'
    );
    assert.equal(
      await checkWebXrSupport({
        isSecureContext: true,
        xr: { isSessionSupported: async (m) => m === 'immersive-vr' },
      }),
      'supported'
    );
    assert.equal(
      await checkWebXrSupport({
        isSecureContext: true,
        xr: { isSessionSupported: async () => false },
      }),
      'unsupported'
    );
  });
});

describe('GitHub Pages asset URL resolution', () => {
  it('resolves root and subpath deployment URLs without double slashes', () => {
    assert.equal(resolveAssetUrl('/models/atlas.json', '/'), '/models/atlas.json');
    assert.equal(
      resolveAssetUrl('/models/atlas.json', '/human-anatomy-3d/'),
      '/human-anatomy-3d/models/atlas.json'
    );
    assert.equal(
      resolveAssetUrl('/models/body-0.bin.gz', '/human-anatomy-3d'),
      '/human-anatomy-3d/models/body-0.bin.gz'
    );
    assert.equal(
      resolveAssetUrl('/models/atlas.json', './'),
      './models/atlas.json'
    );
    assert.equal(
      resolveAssetUrl('https://cdn.example.com/a.bin', '/human-anatomy-3d/'),
      'https://cdn.example.com/a.bin'
    );
  });
});
