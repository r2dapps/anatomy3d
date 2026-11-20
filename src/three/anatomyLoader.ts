import * as THREE from 'three';
import { ANATOMY_CATALOG } from '../data/anatomyCatalog.ts';
import { decodeQuantizedPositions } from '../utils/anatomyLogic.ts';
import { resolveAssetUrl } from '../utils/xrAndLabelsLogic.ts';

let cachedGeometriesPromise: Promise<Map<string, THREE.BufferGeometry>> | null = null;

/**
 * Fetch and decode the BodyParts3D binary geometry dataset once per session.
 * Returns a shared Map<structureId, THREE.BufferGeometry> with computed smooth vertex normals.
 */
export function loadAnatomyGeometries(): Promise<Map<string, THREE.BufferGeometry>> {
  if (cachedGeometriesPromise) {
    return cachedGeometriesPromise;
  }

  const binaryUrl = resolveAssetUrl('/assets/bodyparts3d.bin', import.meta.env.BASE_URL);
  cachedGeometriesPromise = fetch(binaryUrl)
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to fetch anatomy dataset (${res.status})`);
      }
      return res.arrayBuffer();
    })
    .then((buffer) => {
      const geometries = new Map<string, THREE.BufferGeometry>();

      for (const item of ANATOMY_CATALOG) {
        const quantized = new Int16Array(buffer, item.byteOffset, item.vertexCount * 3);
        const indices = new Uint16Array(
          buffer,
          item.byteOffset + item.vertexCount * 6,
          item.triangleCount * 3
        );
        const positions = decodeQuantizedPositions(quantized, item.center, item.halfExtent);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();

        geometries.set(item.id, geometry);
      }

      return geometries;
    })
    .catch((err) => {
      cachedGeometriesPromise = null;
      throw err;
    });

  return cachedGeometriesPromise;
}
