import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ShieldCheck,
  Tag,
  VideoOff,
} from 'lucide-react';
import {
  ANATOMY_CATALOG,
  JAW_PIVOT,
  PLANE_EYE_Y,
  PLANE_NOSE_Y,
  type AnatomyStructure,
} from '../data/anatomyCatalog.ts';
import { loadAnatomyGeometries } from '../three/anatomyLoader.ts';

interface XRayMirrorViewProps {
  onBackToAtlas: () => void;
}

type MirrorReveal = 'whole' | 'lens' | 'left' | 'right' | 'top' | 'lower';

const MP_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL_BASE = 'https://storage.googleapis.com/mediapipe-models/';

const MIRROR_VS = `
  varying vec3 vN, vV, vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vec4 mv = viewMatrix * w;
    vN = normalize(normalMatrix * normal);
    vV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const MIRROR_FS = `
  precision highp float;
  uniform vec3 uColor;
  uniform float uBright, uXray, uClip, uLensOn, uGain;
  uniform vec4 uPlane, uLens;
  varying vec3 vN, vV, vW;
  void main() {
    if (uClip > 0.5 && dot(vW, uPlane.xyz) + uPlane.w < 0.0) discard;
    float la = 1.0;
    if (uLensOn > 0.5) {
      la = 1.0 - smoothstep(uLens.z * (1.0 - uLens.w), uLens.z, length(gl_FragCoord.xy - uLens.xy));
      if (la < 0.01 || (uXray < 0.5 && la < 0.5)) discard;
    }
    float nv = abs(dot(normalize(vN), normalize(vV)));
    if (uXray > 0.5) {
      float f = pow(1.0 - nv, 2.2);
      vec3 c = uColor * (0.04 + 0.78 * f) * uBright * uGain * la;
      gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
    } else {
      gl_FragColor = vec4(uColor * (0.35 + 0.65 * nv) * uBright, 1.0);
    }
  }
`;

/* --------------------------------------------------------------------------
   3D Procedural Anatomical Builders (Torso, Ribs, Spine, Heart, Lungs, Limbs)
   -------------------------------------------------------------------------- */

// Creates bilateral 3D rib cage and sternum
function createRibCageGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Sternum plate
  const sternum = new THREE.BoxGeometry(0.32, 1.7, 0.14, 2, 8, 2);
  sternum.translate(0, 0.15, 0.88);
  parts.push(sternum);

  // 10 pairs of true & false ribs
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const y = 0.85 - t * 1.5;
    const spanX = 0.85 + Math.sin(t * Math.PI) * 0.72;
    const depthZ = 0.72 + Math.sin(t * Math.PI) * 0.35;
    const ribThick = 0.038 + (1 - t) * 0.015;

    // Left rib arc
    const curveL = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.14, y + 0.08, -0.65),
      new THREE.Vector3(-spanX * 0.7, y + 0.04, -0.45),
      new THREE.Vector3(-spanX, y - 0.04, 0.15),
      new THREE.Vector3(-spanX * 0.6, y - 0.12, depthZ),
      new THREE.Vector3(-0.16, y - 0.18, 0.82),
    ]);
    const ribL = new THREE.TubeGeometry(curveL, 16, ribThick, 6, false);
    parts.push(ribL);

    // Right rib arc
    const curveR = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.14, y + 0.08, -0.65),
      new THREE.Vector3(spanX * 0.7, y + 0.04, -0.45),
      new THREE.Vector3(spanX, y - 0.04, 0.15),
      new THREE.Vector3(spanX * 0.6, y - 0.12, depthZ),
      new THREE.Vector3(0.16, y - 0.18, 0.82),
    ]);
    const ribR = new THREE.TubeGeometry(curveR, 16, ribThick, 6, false);
    parts.push(ribR);
  }

  // Costal cartilages connecting lower ribs to sternum
  for (let i = 5; i < 9; i++) {
    const t = i / 9;
    const y = 0.85 - t * 1.5;
    const cartL = new THREE.CylinderGeometry(0.032, 0.032, 0.45, 6);
    cartL.rotateZ(-0.55);
    cartL.translate(-0.35, y - 0.14, 0.84);
    parts.push(cartL);

    const cartR = new THREE.CylinderGeometry(0.032, 0.032, 0.45, 6);
    cartR.rotateZ(0.55);
    cartR.translate(0.35, y - 0.14, 0.84);
    parts.push(cartR);
  }

  return mergeBufferGeometries(parts);
}

// Creates segmented 3D vertebral spine column
function createSpineGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const count = 18; // T1 to L5 vertebrae
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const y = 0.95 - t * 2.2;
    const sz = 0.22 + t * 0.12;

    // Vertebral body
    const body = new THREE.CylinderGeometry(sz * 0.9, sz, 0.09, 8);
    body.translate(0, y, -0.62);
    parts.push(body);

    // Spinous process pointing posterior
    const spine = new THREE.ConeGeometry(sz * 0.4, 0.28, 4);
    spine.rotateX(-1.3);
    spine.translate(0, y - 0.03, -0.82);
    parts.push(spine);

    // Transverse processes
    const tpL = new THREE.BoxGeometry(0.38, 0.06, 0.08);
    tpL.translate(-sz * 1.1, y, -0.66);
    parts.push(tpL);
    const tpR = new THREE.BoxGeometry(0.38, 0.06, 0.08);
    tpR.translate(sz * 1.1, y, -0.66);
    parts.push(tpR);
  }
  return mergeBufferGeometries(parts);
}

// Creates volumetric 3D heart with aorta arch
function createHeartGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Cardiac ventricles & atria bulk (oriented towards left chest)
  const ventricles = new THREE.SphereGeometry(0.52, 14, 12);
  ventricles.scale(0.85, 1.25, 0.95);
  ventricles.rotateZ(-0.35);
  ventricles.rotateX(0.2);
  ventricles.translate(-0.28, 0.18, 0.22);
  parts.push(ventricles);

  // Aortic arch
  const aortaCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.22, 0.65, 0.25),
    new THREE.Vector3(-0.16, 0.98, 0.18),
    new THREE.Vector3(0.05, 0.95, -0.05),
    new THREE.Vector3(0.08, 0.65, -0.25),
  ]);
  const aorta = new THREE.TubeGeometry(aortaCurve, 12, 0.11, 8, false);
  parts.push(aorta);

  // Pulmonary trunk
  const pulmCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.35, 0.55, 0.35),
    new THREE.Vector3(-0.32, 0.85, 0.22),
    new THREE.Vector3(-0.48, 0.82, -0.05),
  ]);
  const pulm = new THREE.TubeGeometry(pulmCurve, 10, 0.09, 8, false);
  parts.push(pulm);

  return mergeBufferGeometries(parts);
}

// Creates bilateral 3D lungs with cardiac notch
function createLungsGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Right lung (3 lobes, larger)
  const lungR = new THREE.SphereGeometry(0.68, 14, 14);
  lungR.scale(0.88, 1.85, 0.92);
  lungR.translate(0.72, 0.15, 0.08);
  parts.push(lungR);

  // Left lung (2 lobes with anterior cardiac notch)
  const lungL = new THREE.SphereGeometry(0.62, 14, 14);
  lungL.scale(0.78, 1.78, 0.88);
  lungL.translate(-0.76, 0.18, 0.08);
  parts.push(lungL);

  // Trachea & main bronchi
  const trachea = new THREE.CylinderGeometry(0.08, 0.08, 0.65, 8);
  trachea.translate(0, 1.05, -0.22);
  parts.push(trachea);

  const bronchusL = new THREE.CylinderGeometry(0.06, 0.06, 0.42, 6);
  bronchusL.rotateZ(-0.65);
  bronchusL.translate(-0.25, 0.68, -0.15);
  parts.push(bronchusL);

  const bronchusR = new THREE.CylinderGeometry(0.06, 0.06, 0.42, 6);
  bronchusR.rotateZ(0.65);
  bronchusR.translate(0.25, 0.68, -0.15);
  parts.push(bronchusR);

  return mergeBufferGeometries(parts);
}

// Creates 3D pelvic girdle and sacrum
function createPelvisGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Left & Right iliac crest wings
  const iliumL = new THREE.TorusGeometry(0.65, 0.14, 8, 16, Math.PI * 0.95);
  iliumL.rotateZ(-0.4);
  iliumL.rotateY(0.4);
  iliumL.translate(-0.52, -1.18, -0.05);
  parts.push(iliumL);

  const iliumR = new THREE.TorusGeometry(0.65, 0.14, 8, 16, Math.PI * 0.95);
  iliumR.rotateZ(Math.PI + 0.4);
  iliumR.rotateY(-0.4);
  iliumR.translate(0.52, -1.18, -0.05);
  parts.push(iliumR);

  // Pubic symphysis anterior bridge
  const pubis = new THREE.BoxGeometry(0.58, 0.22, 0.2);
  pubis.translate(0, -1.78, 0.35);
  parts.push(pubis);

  // Sacrum wedge
  const sacrum = new THREE.ConeGeometry(0.42, 0.75, 5);
  sacrum.rotateX(Math.PI);
  sacrum.translate(0, -1.35, -0.48);
  parts.push(sacrum);

  return mergeBufferGeometries(parts);
}

// Creates generic long bone (flared epiphysis at ends)
function createAnatomicBoneGeometry(length: number, radius: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const shaft = new THREE.CylinderGeometry(radius * 0.75, radius * 0.75, length * 0.88, 8);
  parts.push(shaft);

  // Proximal flared head
  const headP = new THREE.SphereGeometry(radius * 1.45, 8, 8);
  headP.translate(0, length * 0.45, 0);
  parts.push(headP);

  // Distal condyles
  const headD1 = new THREE.SphereGeometry(radius * 1.25, 8, 8);
  headD1.translate(-radius * 0.65, -length * 0.45, 0);
  parts.push(headD1);
  const headD2 = new THREE.SphereGeometry(radius * 1.25, 8, 8);
  headD2.translate(radius * 0.65, -length * 0.45, 0);
  parts.push(headD2);

  return mergeBufferGeometries(parts);
}

// Simple geometry merger
function mergeBufferGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalPos = 0;
  let totalIdx = 0;
  for (const g of geometries) {
    totalPos += g.attributes.position.count;
    totalIdx += g.index ? g.index.count : 0;
  }

  const mergedPos = new Float32Array(totalPos * 3);
  const mergedNorm = new Float32Array(totalPos * 3);
  const mergedIdx = new Uint32Array(totalIdx);

  let posOffset = 0;
  let idxOffset = 0;
  let vertexOffset = 0;

  for (const g of geometries) {
    const pos = g.attributes.position;
    const norm = g.attributes.normal;
    mergedPos.set(pos.array, posOffset * 3);
    if (norm) {
      mergedNorm.set(norm.array, posOffset * 3);
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) {
        mergedIdx[idxOffset + i] = g.index.array[i] + vertexOffset;
      }
      idxOffset += g.index.count;
    }
    vertexOffset += pos.count;
    posOffset += pos.count;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));
  if (totalIdx > 0) {
    out.setIndex(new THREE.BufferAttribute(mergedIdx, 1));
  } else {
    out.computeVertexNormals();
  }
  return out;
}

export function XRayMirrorView({ onBackToAtlas }: XRayMirrorViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState('Camera stays on your device — zero frames leave this browser.');
  const [error, setError] = useState<string | null>(null);

  // Auto-mirroring and camera controls
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [mirror, setMirror] = useState(true);

  // Minimalist controls - default to whole head
  const [look, setLook] = useState<'xray' | 'solid'>('xray');
  const [reveal, setReveal] = useState<MirrorReveal>('whole');
  const [explode, setExplode] = useState(0);
  const [lensSize, setLensSize] = useState(0.24);
  const [brightness, setBrightness] = useState(1.1);
  const [showLabels, setShowLabels] = useState(true);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  const settingsRef = useRef({
    look,
    reveal,
    explode,
    lensSize,
    brightness,
    facing,
    mirror,
    showLabels,
  });
  settingsRef.current = {
    look,
    reveal,
    explode,
    lensSize,
    brightness,
    facing,
    mirror,
    showLabels,
  };

  const runtimeRef = useRef<{
    stop: () => void;
    switchCamera: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    return () => {
      runtimeRef.current?.stop();
    };
  }, []);

  const startMirror = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    setError(null);

    let stream: MediaStream | null = null;
    let rafId = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    const materials: THREE.ShaderMaterial[] = [];

    const cleanup = () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }
      materials.forEach((m) => m.dispose());
      renderer?.dispose();
      runtimeRef.current = null;
    };

    try {
      const container = containerRef.current;
      const video = videoRef.current;
      const glCanvas = glCanvasRef.current;
      const ovCanvas = overlayRef.current;
      if (!container || !video || !glCanvas || !ovCanvas) {
        throw new Error('Mirror display elements not mounted.');
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not supported in this browser.');
      }

      setStatus('Requesting local camera access…');

      // Robust camera initialization with fallback cascade
      const openCam = async (prefMode: 'user' | 'environment') => {
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
          await new Promise((r) => setTimeout(r, 60));
        }

        let s: MediaStream | null = null;
        const constraints: MediaStreamConstraints[] = [
          {
            video: {
              facingMode: { ideal: prefMode },
              width: { ideal: 1920, max: 1920 },
              height: { ideal: 1080, max: 1080 },
            },
            audio: false,
          },
          { video: { facingMode: prefFacingSafe(prefMode) }, audio: false },
          { video: true, audio: false },
        ];

        for (const c of constraints) {
          try {
            s = await navigator.mediaDevices.getUserMedia(c);
            if (s) break;
          } catch {}
        }

        if (!s) throw new Error('Camera access failed or was denied on this device.');
        stream = s;

        const track = stream.getVideoTracks()[0];
        let actualFacing = prefMode;
        if (track?.getSettings) {
          const st = track.getSettings();
          if (st.facingMode) actualFacing = st.facingMode as 'user' | 'environment';
        }

        // Auto-mirror logic matching DivyaDrusti / anatomy index.html
        const isMirror = actualFacing !== 'environment';
        setFacing(actualFacing);
        setMirror(isMirror);
        settingsRef.current.facing = actualFacing;
        settingsRef.current.mirror = isMirror;

        video.srcObject = stream;
        await video.play();
        if (!video.videoWidth) {
          await new Promise<void>((res) => {
            video.onloadedmetadata = () => res();
          });
        }
      };

      function prefFacingSafe(mode: 'user' | 'environment') {
        return mode;
      }

      await openCam(settingsRef.current.facing);

      setStatus('Loading BodyParts3D full anatomical structures…');
      const geomMap = await loadAnatomyGeometries();

      setStatus('Initializing on-device MediaPipe vision models…');
      const mpMod = await import(/* @vite-ignore */ `${MP_CDN}/+esm`);
      const fileset = await mpMod.FilesetResolver.forVisionTasks(`${MP_CDN}/wasm`);

      const createLandmarker = async <T,>(
        Ctor: { createFromOptions: (fs: unknown, opts: Record<string, unknown>) => Promise<T> },
        assetUrl: string,
        extra: Record<string, unknown>
      ): Promise<T> => {
        for (const delegate of ['GPU', 'CPU']) {
          try {
            return await Ctor.createFromOptions(fileset, {
              baseOptions: { modelAssetPath: assetUrl, delegate },
              runningMode: 'VIDEO',
              ...extra,
            });
          } catch {}
        }
        throw new Error('Could not initialize vision model.');
      };

      let faceLandmarker: unknown = null;
      try {
        faceLandmarker = await createLandmarker(
          mpMod.FaceLandmarker,
          `${MODEL_BASE}face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          {
            numFaces: 1,
            outputFacialTransformationMatrixes: true,
            outputFaceBlendshapes: true,
          }
        );
      } catch {}

      let handLandmarker: unknown = null;
      try {
        handLandmarker = await createLandmarker(
          mpMod.HandLandmarker,
          `${MODEL_BASE}hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          { numHands: 2 }
        );
      } catch {}

      let poseLandmarker: unknown = null;
      try {
        poseLandmarker = await createLandmarker(
          mpMod.PoseLandmarker,
          `${MODEL_BASE}pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
          {
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          }
        );
      } catch {}

      let Cw = container.clientWidth || window.innerWidth;
      let Ch = container.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      glCanvas.width = Math.round(Cw * dpr);
      glCanvas.height = Math.round(Ch * dpr);
      ovCanvas.width = Math.round(Cw * dpr);
      ovCanvas.height = Math.round(Ch * dpr);

      renderer = new THREE.WebGLRenderer({
        canvas: glCanvas,
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      renderer.autoClear = false;
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(dpr);
      renderer.setSize(Cw, Ch, false);

      const sceneH = new THREE.Scene();
      const sceneD = new THREE.Scene();
      const camP = new THREE.PerspectiveCamera(63, Cw / Ch, 0.1, 1000);
      camP.position.set(0, 0, 0);
      camP.lookAt(0, 0, -1);

      const camO = new THREE.OrthographicCamera(0, Cw, Ch, 0, -3000, 3000);

      const makeShared = (gain: number) => ({
        uBright: { value: 1.1 },
        uXray: { value: 1 },
        uClip: { value: 0 },
        uPlane: { value: new THREE.Vector4() },
        uLens: { value: new THREE.Vector4() },
        uLensOn: { value: 0 },
        uGain: { value: gain },
      });
      const UH = makeShared(1.0);
      const UD = makeShared(2.2);

      const makeMat = (rgb: [number, number, number], U: ReturnType<typeof makeShared>) => {
        const m = new THREE.ShaderMaterial({
          vertexShader: MIRROR_VS,
          fragmentShader: MIRROR_FS,
          side: THREE.DoubleSide,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          blending: THREE.CustomBlending,
          blendEquation: THREE.AddEquation,
          blendSrc: THREE.OneFactor,
          blendDst: THREE.OneMinusSrcColorFactor,
          blendSrcAlpha: THREE.OneFactor,
          blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
          uniforms: { ...U, uColor: { value: new THREE.Color(...rgb) } },
        });
        materials.push(m);
        return m;
      };

      // 1. Head Group
      const headG = new THREE.Group();
      headG.matrixAutoUpdate = false;
      sceneH.add(headG);

      const headParts: { mesh: THREE.Mesh; structure: AnatomyStructure }[] = [];
      const handGeoms: Record<string, THREE.BufferGeometry> = {};

      for (const s of ANATOMY_CATALOG) {
        const g = geomMap.get(s.id);
        if (!g) continue;
        if (s.region === 'hand') {
          handGeoms[s.rawName] = g;
        } else {
          const mesh = new THREE.Mesh(g, makeMat(s.xrayColor, UH));
          mesh.frustumCulled = false;
          mesh.matrixAutoUpdate = false;
          headG.add(mesh);
          headParts.push({ mesh, structure: s });
        }
      }

      // 2. Full-Body 3D Torso & Organs Group (Rib cage, Spine, Heart, Lungs, Pelvis)
      const torsoG = new THREE.Group();
      torsoG.matrixAutoUpdate = false;
      torsoG.visible = false;
      sceneH.add(torsoG);

      // Rib cage mesh (bone color)
      const ribsMesh = new THREE.Mesh(createRibCageGeometry(), makeMat([0.82, 0.94, 1.0], UH));
      torsoG.add(ribsMesh);

      // Vertebral spine mesh (bone color)
      const spineMesh = new THREE.Mesh(createSpineGeometry(), makeMat([0.78, 0.92, 1.0], UH));
      torsoG.add(spineMesh);

      // Heart mesh (deep cardiac crimson/pink)
      const heartMesh = new THREE.Mesh(createHeartGeometry(), makeMat([1.0, 0.28, 0.42], UH));
      torsoG.add(heartMesh);

      // Lungs mesh (cyan/pulmonary blue)
      const lungsMesh = new THREE.Mesh(createLungsGeometry(), makeMat([0.38, 0.82, 0.98], UH));
      torsoG.add(lungsMesh);

      // Pelvis mesh (bone color)
      const pelvisMesh = new THREE.Mesh(createPelvisGeometry(), makeMat([0.80, 0.92, 1.0], UH));
      torsoG.add(pelvisMesh);

      // 3. Full-Body 3D Limb Bones (Humerus, Forearm, Femur, Tibia)
      const limbBoneGeom = createAnatomicBoneGeometry(1.0, 0.08);
      const makeLimbMesh = () => {
        const m = new THREE.Mesh(limbBoneGeom, makeMat([0.82, 0.94, 1.0], UH));
        m.visible = false;
        sceneH.add(m);
        return m;
      };

      const limbBones = {
        uArmL: makeLimbMesh(),
        lArmL: makeLimbMesh(),
        uArmR: makeLimbMesh(),
        lArmR: makeLimbMesh(),
        uLegL: makeLimbMesh(),
        lLegL: makeLimbMesh(),
        uLegR: makeLimbMesh(),
        lLegR: makeLimbMesh(),
      };

      // 4. Hand Slots (Orthographic 3D mesh placement)
      const handSlots = [0, 1].map(() => {
        const grp = new THREE.Group();
        const ms: Record<string, THREE.Mesh> = {};
        for (const k of Object.keys(handGeoms)) {
          const me = new THREE.Mesh(handGeoms[k], makeMat([0.85, 0.95, 1.0], UD));
          me.matrixAutoUpdate = false;
          me.frustumCulled = false;
          grp.add(me);
          ms[k] = me;
        }
        grp.visible = false;
        sceneD.add(grp);
        return { grp, ms };
      });

      const M = new THREE.Matrix4();
      const Msm = new THREE.Matrix4();
      const HM = new THREE.Matrix4();
      const Jm = new THREE.Matrix4();
      const JR = new THREE.Matrix4();
      const JT = new THREE.Matrix4();
      const PM = new THREE.Matrix4();
      const pp = new THREE.Vector3();
      const qq = new THREE.Quaternion();
      const ss = new THREE.Vector3();
      const sP = new THREE.Vector3();
      const sQ = new THREE.Quaternion();
      const sS = new THREE.Vector3();
      const O = new THREE.Vector3();
      const XD = new THREE.Vector3();
      const YD = new THREE.Vector3();

      let havePose = false;
      let faceOn = false;
      let miss = 0;
      let jawSmooth = 0;
      let lastVideoTime = -1;
      let handsP: { p: number[][]; right: boolean }[] = [];
      let prevLook: 'xray' | 'solid' = settingsRef.current.look;

      interface SmoothedJoint {
        x: number;
        y: number;
        z: number;
        v: number;
      }
      const smoothPose: SmoothedJoint[] = Array.from({ length: 33 }, () => ({
        x: 0,
        y: 0,
        z: 0,
        v: 0,
      }));
      let poseOn = false;
      let poseMiss = 0;

      const ovCtx = ovCanvas.getContext('2d');
      const FINGERS = [
        [5, 6, 7, 8],
        [9, 10, 11, 12],
        [13, 14, 15, 16],
        [17, 18, 19, 20],
      ];

      // Exact mathematical alignment between video object-fit: cover and WebGL camera
      const updateDimensions = () => {
        if (!container || !video || !renderer) return;
        const curCw = container.clientWidth || window.innerWidth;
        const curCh = container.clientHeight || window.innerHeight;
        const curDpr = Math.min(window.devicePixelRatio || 1, 2);

        if (curCw !== Cw || curCh !== Ch) {
          Cw = curCw;
          Ch = curCh;
          glCanvas.width = Math.round(Cw * curDpr);
          glCanvas.height = Math.round(Ch * curDpr);
          ovCanvas.width = Math.round(Cw * curDpr);
          ovCanvas.height = Math.round(Ch * curDpr);
          renderer.setPixelRatio(curDpr);
          renderer.setSize(Cw, Ch, false);
        }

        const Vw = video.videoWidth || 1280;
        const Vh = video.videoHeight || 720;
        const scale = Math.max(Cw / Vw, Ch / Vh);
        const Rh = Vh * scale;

        // Effective FOV accounting for object-cover crop
        const nominalFovRad = (63 * Math.PI) / 180;
        const effectiveFovRad = 2 * Math.atan(Math.tan(nominalFovRad / 2) * (Ch / Rh));
        camP.fov = (effectiveFovRad * 180) / Math.PI;
        camP.aspect = Cw / Ch;
        camP.updateProjectionMatrix();

        camO.left = 0;
        camO.right = Cw;
        camO.bottom = Ch;
        camO.top = 0;
        camO.updateProjectionMatrix();
      };

      window.addEventListener('resize', updateDimensions);

      const applyLookMode = (mode: 'xray' | 'solid') => {
        const isX = mode === 'xray';
        for (const mat of materials) {
          mat.transparent = isX;
          mat.depthWrite = !isX;
          mat.depthTest = !isX;
          mat.blending = isX ? THREE.CustomBlending : THREE.NoBlending;
          mat.needsUpdate = true;
        }
      };

      const renderLoop = () => {
        rafId = requestAnimationFrame(renderLoop);
        const cfg = settingsRef.current;
        const isMirror = cfg.mirror;
        const now = performance.now();

        if (cfg.look !== prevLook) {
          prevLook = cfg.look;
          applyLookMode(cfg.look);
        }

        updateDimensions();

        const Vw = video.videoWidth || 1280;
        const Vh = video.videoHeight || 720;
        const covScale = Math.max(Cw / Vw, Ch / Vh);
        const Rw = Vw * covScale;
        const Rh = Vh * covScale;
        const Ox = (Cw - Rw) / 2;
        const Oy = (Ch - Rh) / 2;

        if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;

          let mx: { data: number[] } | undefined = undefined;
          if (faceLandmarker) {
            try {
              const fr = (faceLandmarker as {
                detectForVideo: (v: HTMLVideoElement, t: number) => {
                  facialTransformationMatrixes?: { data: number[] }[];
                  faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[];
                };
              }).detectForVideo(video, now);

              mx = fr.facialTransformationMatrixes?.[0];
              const jawCat = fr.faceBlendshapes?.[0]?.categories.find(
                (c) => c.categoryName === 'jawOpen'
              );
              if (jawCat) jawSmooth += (jawCat.score - jawSmooth) * 0.6;
            } catch {}
          }

          if (poseLandmarker) {
            try {
              const pr = (poseLandmarker as {
                detectForVideo: (v: HTMLVideoElement, t: number) => {
                  landmarks?: { x: number; y: number; z: number; visibility?: number }[][];
                };
              }).detectForVideo(video, now);
              const plm = pr.landmarks?.[0];
              if (plm && plm.length >= 33) {
                poseOn = true;
                poseMiss = 0;
                for (let i = 0; i < 33; i++) {
                  const raw = plm[i];
                  const cur = smoothPose[i];
                  // Map directly to visible screen pixels
                  const targetX = Ox + raw.x * Rw;
                  const targetY = Oy + raw.y * Rh;
                  const targetZ = -raw.z * Rw;
                  const vis = raw.visibility ?? 1;

                  if (cur.v < 0.15) {
                    cur.x = targetX;
                    cur.y = targetY;
                    cur.z = targetZ;
                    cur.v = vis;
                  } else {
                    const dx = targetX - cur.x;
                    const dy = targetY - cur.y;
                    const dist = Math.hypot(dx, dy);
                    const alpha = dist < 4 ? 0.35 : dist < 25 ? 0.55 : 0.75;
                    cur.x += dx * alpha;
                    cur.y += dy * alpha;
                    cur.z += (targetZ - cur.z) * alpha;
                    cur.v += (vis - cur.v) * 0.35;
                  }
                }
              } else if (++poseMiss > 12) {
                poseOn = false;
                for (let i = 0; i < 33; i++) smoothPose[i].v = 0;
              }
            } catch {}
          }

          if (mx) {
            M.fromArray(mx.data).decompose(pp, qq, ss);
            if (!havePose) {
              sP.copy(pp);
              sQ.copy(qq);
              sS.copy(ss);
              havePose = true;
            } else {
              const dp = sP.distanceTo(pp);
              const alpha = dp < 0.02 ? 0.38 : 0.65;
              sP.lerp(pp, alpha);
              sQ.slerp(qq, alpha);
              sS.lerp(ss, alpha);
            }
            Msm.compose(sP, sQ, sS);
            faceOn = true;
            miss = 0;
          } else if (
            poseOn &&
            smoothPose[0].v > 0.45 &&
            smoothPose[11].v > 0.35 &&
            smoothPose[12].v > 0.35
          ) {
            // Full-body projector MR mode: anchor head directly from Pose when far back
            const nose = smoothPose[0];
            const lEar = smoothPose[7];
            const rEar = smoothPose[8];
            const lSh = smoothPose[11];
            const rSh = smoothPose[12];
            const shDist = Math.hypot(lSh.x - rSh.x, lSh.y - rSh.y);
            const headScale = Math.max(0.65, Math.min(2.4, shDist / 120.0));

            const nx = (nose.x / Cw) * 2 - 1;
            const ny = -(nose.y / Ch) * 2 + 1;
            const headZ = -14.0 / headScale;
            pp.set(nx * 7.5, ny * 5.5, headZ);

            const earDx = rEar.x - lEar.x;
            const earDz = rEar.z - lEar.z;
            const yaw = Math.atan2(earDz, Math.max(1, earDx)) * 0.5;
            qq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
            ss.set(headScale, headScale, headScale);

            if (!havePose) {
              sP.copy(pp);
              sQ.copy(qq);
              sS.copy(ss);
              havePose = true;
            } else {
              sP.lerp(pp, 0.45);
              sQ.slerp(qq, 0.45);
              sS.lerp(ss, 0.45);
            }
            Msm.compose(sP, sQ, sS);
            faceOn = true;
            miss = 0;
          } else if (++miss > 10) {
            faceOn = false;
            havePose = false;
          }

          if (handLandmarker) {
            try {
              const hr = (handLandmarker as {
                detectForVideo: (v: HTMLVideoElement, t: number) => {
                  landmarks: { x: number; y: number; z: number }[][];
                  handednesses: { categoryName: string }[][];
                };
              }).detectForVideo(video, now);

              handsP = hr.landmarks.map((lm, i) => {
                const cat = hr.handednesses[i]?.[0]?.categoryName || 'Right';
                // Handedness fix:
                // When mirror is active (selfie), MediaPipe's 'Left' label corresponds
                // to user's left hand on screen.
                // Inverting the boolean ensures the left-hand skeleton (thumb pointing outward)
                // renders on the user's left hand!
                const isRight = isMirror ? (cat !== 'Left') : (cat === 'Right');
                return {
                  p: lm.map((q) => [Ox + q.x * Rw, Oy + q.y * Rh, -q.z * Rw]),
                  right: isRight,
                };
              });
            } catch {}
          }
        }

        renderer!.clear();
        ovCtx?.clearRect(0, 0, Cw, Ch);

        UH.uBright.value = UD.uBright.value = cfg.brightness;
        UH.uXray.value = UD.uXray.value = cfg.look === 'xray' ? 1 : 0;

        const isLens = cfg.reveal === 'lens';
        const tip0 = handsP[0]?.p[8] ?? null;
        let tip = tip0;
        const R = cfg.lensSize * Ch;
        if (isLens && !tip && faceOn) {
          const pv = new THREE.Vector3().setFromMatrixPosition(Msm).project(camP);
          tip = [((pv.x + 1) / 2) * Cw, ((-pv.y + 1) / 2) * Ch];
        } else if (isLens && !tip && poseOn && smoothPose[20].v > 0.4) {
          tip = [smoothPose[20].x, smoothPose[20].y];
        }

        UH.uLensOn.value = isLens && tip ? 1 : 0;
        if (tip) {
          UH.uLens.value.set(tip[0], Ch - tip[1], R, 0.22);
        }

        headG.visible = faceOn && !(isLens && !tip);
        UH.uClip.value = 0;

        if (faceOn) {
          HM.copy(Msm);
          headG.matrix.copy(HM);
          headG.matrixWorldNeedsUpdate = true;
          O.setFromMatrixPosition(HM);
          XD.set(1, 0, 0).transformDirection(HM);
          YD.set(0, 1, 0).transformDirection(HM);

          const sx = XD.x * (isMirror ? -1 : 1) > 0 ? 1 : -1;
          const Rr = XD.clone().multiplyScalar(sx);
          const k = sS.x;
          let n: THREE.Vector3 | null = null;
          const p0 = O.clone();

          if (cfg.reveal === 'left') n = Rr.clone().negate();
          else if (cfg.reveal === 'right') n = Rr.clone();
          else if (cfg.reveal === 'top') {
            n = YD.clone();
            p0.addScaledVector(YD, PLANE_EYE_Y * k);
          } else if (cfg.reveal === 'lower') {
            n = YD.clone().negate();
            p0.addScaledVector(YD, PLANE_NOSE_Y * k);
          }

          if (n) {
            UH.uPlane.value.set(n.x, n.y, n.z, -n.dot(p0));
            UH.uClip.value = 1;
          }

          const ang = Math.min(1, jawSmooth * 1.3) * 0.45;
          Jm.makeTranslation(JAW_PIVOT[0], JAW_PIVOT[1], JAW_PIVOT[2])
            .multiply(JR.makeRotationX(ang))
            .multiply(JT.makeTranslation(-JAW_PIVOT[0], -JAW_PIVOT[1], -JAW_PIVOT[2]));

          for (const part of headParts) {
            const e = cfg.explode * 1.3;
            PM.makeTranslation(
              part.structure.center[0] * e,
              (part.structure.center[1] + 1) * e,
              (part.structure.center[2] + 2) * e
            );
            if (part.structure.isJaw) PM.multiply(Jm);
            part.mesh.matrix.copy(PM);
            part.mesh.matrixWorldNeedsUpdate = true;
          }
        }

        // 3D Full-Body Torso, Ribs, Heart, Lungs, and Pelvis Placement
        const lSh = smoothPose[11];
        const rSh = smoothPose[12];
        const lHip = smoothPose[23];
        const rHip = smoothPose[24];
        const hasTorso =
          poseOn &&
          lSh.v > 0.35 &&
          rSh.v > 0.35 &&
          (lHip.v > 0.25 || rHip.v > 0.25);

        torsoG.visible = hasTorso && !(isLens && !tip);
        if (hasTorso) {
          const neckX = (lSh.x + rSh.x) * 0.5;
          const neckY = (lSh.y + rSh.y) * 0.5;
          const hipMidX = (lHip.x + rHip.x) * 0.5;
          const hipMidY = (lHip.y + rHip.y) * 0.5;

          const shSpan = Math.hypot(rSh.x - lSh.x, rSh.y - lSh.y);
          const torsoLen = Math.hypot(hipMidX - neckX, hipMidY - neckY) || shSpan * 1.35;

          // Screen to 3D Perspective placement
          const midX = (neckX + hipMidX) * 0.5;
          const midY = (neckY + hipMidY) * 0.5;
          const nx = (midX / Cw) * 2 - 1;
          const ny = -(midY / Ch) * 2 + 1;

          const baseScale = Math.max(0.7, Math.min(3.2, shSpan / 140));
          const depthZ = -14.0 / baseScale;

          const torsoPos = new THREE.Vector3(nx * 7.5, ny * 5.5, depthZ);
          const torsoRot = new THREE.Euler(
            0,
            Math.atan2(rSh.z - lSh.z, Math.max(1, rSh.x - lSh.x)) * 0.4,
            Math.atan2(rSh.y - lSh.y, rSh.x - lSh.x) * 0.4
          );
          const torsoScale = new THREE.Vector3(
            (shSpan / 150) * baseScale * 0.85,
            (torsoLen / 200) * baseScale * 0.85,
            baseScale * 0.85
          );

          torsoG.matrix.compose(
            torsoPos,
            new THREE.Quaternion().setFromEuler(torsoRot),
            torsoScale
          );
          torsoG.matrixWorldNeedsUpdate = true;

          // Anatomical Explode offsets for 3D Torso Organs
          const ex = cfg.explode * 1.5;
          ribsMesh.position.set(0, 0, ex * 0.6);
          spineMesh.position.set(0, 0, -ex * 0.8);
          pelvisMesh.position.set(0, -ex * 0.9, 0);

          // Heart heartbeat animation and explode offset
          const pulse = 1.0 + Math.sin(now * 0.007) * 0.045;
          heartMesh.scale.set(pulse, pulse, pulse);
          heartMesh.position.set(-ex * 0.8, 0, ex * 1.1);

          // Lungs respiration expansion and explode offset
          const breath = 1.0 + Math.sin(now * 0.002) * 0.035;
          lungsMesh.scale.set(breath, breath, breath);
          lungsMesh.position.set(0, 0, ex * 0.4);
        }

        // Helper to orient a 3D long bone between two 2D/3D joints
        const orientBone = (
          mesh: THREE.Mesh,
          j1: SmoothedJoint,
          j2: SmoothedJoint,
          minVis = 0.35,
          radius = 0.12
        ) => {
          if (!poseOn || j1.v < minVis || j2.v < minVis) {
            mesh.visible = false;
            return;
          }
          const span = Math.hypot(j2.x - j1.x, j2.y - j1.y);
          if (span < 10) {
            mesh.visible = false;
            return;
          }
          mesh.visible = !(isLens && !tip);

          const midX = (j1.x + j2.x) * 0.5;
          const midY = (j1.y + j2.y) * 0.5;
          const nx = (midX / Cw) * 2 - 1;
          const ny = -(midY / Ch) * 2 + 1;

          const refScale = Math.max(0.6, Math.min(3.2, Math.hypot(rSh.x - lSh.x, rSh.y - lSh.y) / 140));
          const p = new THREE.Vector3(nx * 7.5, ny * 5.5, -14.0 / refScale);

          const dx = j2.x - j1.x;
          const dy = -(j2.y - j1.y);
          const angle = Math.atan2(dy, dx) - Math.PI / 2;

          mesh.position.copy(p);
          mesh.rotation.set(0, 0, angle);
          const boneLen = (span / 160) * refScale;
          mesh.scale.set(refScale * radius, boneLen, refScale * radius);
        };

        // Orient 3D Long Bones for Arms and Legs
        orientBone(limbBones.uArmL, smoothPose[11], smoothPose[13]);
        orientBone(limbBones.lArmL, smoothPose[13], smoothPose[15]);
        orientBone(limbBones.uArmR, smoothPose[12], smoothPose[14]);
        orientBone(limbBones.lArmR, smoothPose[14], smoothPose[16]);

        orientBone(limbBones.uLegL, smoothPose[23], smoothPose[25], 0.3, 0.15);
        orientBone(limbBones.lLegL, smoothPose[25], smoothPose[27], 0.3, 0.13);
        orientBone(limbBones.uLegR, smoothPose[24], smoothPose[26], 0.3, 0.15);
        orientBone(limbBones.lLegR, smoothPose[26], smoothPose[28], 0.3, 0.13);

        // 3D Hand Bones (Carpals, Metacarpals, Phalanges)
        handSlots.forEach((slot, idx) => {
          const h = handsP[idx];
          slot.grp.visible = false;
          if (!h) return;
          const P = (i: number) => new THREE.Vector3(h.p[i][0], h.p[i][1], h.p[i][2]);
          const n = new THREE.Vector3().crossVectors(P(5).sub(P(0)), P(17).sub(P(0)));
          if (!h.right) n.negate();

          const put = (key: string, A: THREE.Vector3, B: THREE.Vector3) => {
            const me = slot.ms[key];
            if (!me) return;
            const a = B.clone().sub(A);
            const L = Math.max(0.001, a.length());
            a.divideScalar(L);
            const u = n.clone().sub(a.clone().multiplyScalar(n.dot(a))).normalize();
            const sd = new THREE.Vector3().crossVectors(a, u);
            if (!h.right) sd.negate();
            me.matrix
              .makeBasis(sd.multiplyScalar(L), a.multiplyScalar(L), u.multiplyScalar(L))
              .setPosition(A);
            me.matrixWorldNeedsUpdate = true;
          };

          put('Carpal bones', P(0), P(9));
          [
            [0, 5],
            [0, 9],
            [0, 13],
            [0, 17],
          ].forEach(([a, b], i) => put(`MC${i + 2}`, P(a), P(b)));
          put('MC1', P(1), P(2));
          put('PP1', P(2), P(3));
          put('DP1', P(3), P(4));
          FINGERS.forEach((f, i) => {
            const k = i + 2;
            put(`PP${k}`, P(f[0]), P(f[1]));
            put(`MP${k}`, P(f[1]), P(f[2]));
            put(`DP${k}`, P(f[2]), P(f[3]));
          });
          slot.grp.visible = true;
        });

        renderer!.render(sceneH, camP);
        renderer!.clearDepth();
        renderer!.render(sceneD, camO);

        // Radiographic Mixed Reality Projection & Educational Labels
        if (poseOn && ovCtx) {
          const drawReticle = (i: number, r = 4, alpha = 0.7) => {
            const j = smoothPose[i];
            if (j.v < 0.3) return;
            ovCtx.strokeStyle = `rgba(186, 230, 253, ${alpha})`;
            ovCtx.fillStyle = `rgba(56, 189, 248, ${alpha * 0.5})`;
            ovCtx.lineWidth = 1.5;
            ovCtx.beginPath();
            ovCtx.arc(j.x, j.y, r, 0, Math.PI * 2);
            ovCtx.fill();
            ovCtx.stroke();
          };

          // Joint Articulation Nodes
          [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].forEach((idx) => drawReticle(idx));

          // Educational 3D Anatomical Labels (for classroom instruction)
          if (cfg.showLabels) {
            const drawCallout = (
              x: number,
              y: number,
              title: string,
              subtitle: string,
              side: 'left' | 'right' = 'left'
            ) => {
              const dx = side === 'left' ? -65 : 65;
              const tx = x + dx;
              const ty = y - 10;

              ovCtx.strokeStyle = 'rgba(125, 211, 252, 0.7)';
              ovCtx.lineWidth = 1;
              ovCtx.beginPath();
              ovCtx.moveTo(x, y);
              ovCtx.lineTo(tx, ty);
              ovCtx.lineTo(tx + (side === 'left' ? -30 : 30), ty);
              ovCtx.stroke();

              ovCtx.font = 'bold 11px system-ui, -apple-system, sans-serif';
              ovCtx.fillStyle = '#f8fafc';
              ovCtx.textAlign = side === 'left' ? 'right' : 'left';
              ovCtx.fillText(title, tx + (side === 'left' ? -35 : 35), ty + 3);

              ovCtx.font = '9.5px system-ui, -apple-system, sans-serif';
              ovCtx.fillStyle = '#94a3b8';
              ovCtx.fillText(subtitle, tx + (side === 'left' ? -35 : 35), ty + 15);
            };

            // Head / Neurocranium
            if (smoothPose[0].v > 0.4) {
              const jawAngleDeg = Math.round(jawSmooth * 24);
              drawCallout(
                smoothPose[0].x,
                smoothPose[0].y - 25,
                'Neurocranium & Brain',
                `TMJ Open: ${jawAngleDeg}°`,
                'left'
              );
            }

            // Thorax / Cardiopulmonary Organs
            if (lSh.v > 0.3 && rSh.v > 0.3) {
              const cx = (lSh.x + rSh.x) * 0.5;
              const cy = (lSh.y + rSh.y) * 0.5 + 30;
              drawCallout(cx, cy, 'Cardiopulmonary Organs', '3D Heart & Lungs', 'right');
            }

            // Vertebral Spine
            if (lSh.v > 0.3 && rSh.v > 0.3 && lHip.v > 0.3 && rHip.v > 0.3) {
              const sx = (lSh.x + rSh.x + lHip.x + rHip.x) * 0.25;
              const sy = (lSh.y + rSh.y + lHip.y + rHip.y) * 0.25 + 20;
              drawCallout(sx, sy, 'Vertebral Spine', 'Thoracolumbar Column', 'left');
            }

            // Pelvic Girdle
            if (lHip.v > 0.3 && rHip.v > 0.3) {
              const px = (lHip.x + rHip.x) * 0.5;
              const py = (lHip.y + rHip.y) * 0.5;
              drawCallout(px, py, 'Pelvic Girdle', 'Sacrum & Ilium', 'right');
            }

            // Knee Joint / Femur
            if (smoothPose[25].v > 0.3) {
              drawCallout(
                smoothPose[25].x,
                smoothPose[25].y,
                'Knee Articulation',
                'Femur & Patella',
                'right'
              );
            }
          }
        }

        // Circular fingertip lens indicator
        if (isLens && tip && ovCtx) {
          ovCtx.strokeStyle = 'rgba(125, 211, 252, 0.6)';
          ovCtx.lineWidth = 2;
          ovCtx.beginPath();
          ovCtx.arc(tip[0], tip[1], R, 0, Math.PI * 2);
          ovCtx.stroke();
        }
      };

      runtimeRef.current = {
        stop: cleanup,
        switchCamera: async () => {
          const next = settingsRef.current.facing === 'user' ? 'environment' : 'user';
          await openCam(next);
          updateDimensions();
        },
      };

      setStarted(true);
      setStarting(false);
      setStatus('Live tracking active — whole 3D anatomical structures mapped.');
      renderLoop();
    } catch (err) {
      cleanup();
      setStarting(false);
      setError(
        err instanceof Error
          ? err.message
          : 'Camera permission was declined or unavailable on this device.'
      );
      setStatus('Camera unavailable — you can return to the interactive 3D Atlas anytime.');
    }
  }, [starting]);

  const handleFlipCamera = async () => {
    try {
      await runtimeRef.current?.switchCamera();
    } catch {
      setError('Could not switch camera on this device.');
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#070d14] select-none"
    >
      {/* Full-Screen Camera Video Feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          transform: mirror ? 'scaleX(-1)' : 'none',
          filter: 'brightness(0.78)',
        }}
      />

      {/* 3D WebGL Canvas */}
      <canvas
        ref={glCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ transform: mirror ? 'scaleX(-1)' : 'none' }}
      />

      {/* Radiographic Mixed Reality Overlay */}
      <canvas
        ref={overlayRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ transform: mirror ? 'scaleX(-1)' : 'none' }}
      />

      {/* Pre-Start Splash / Permission Modal */}
      {!started && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center text-center p-6 bg-gradient-to-b from-[#0a111e]/90 to-[#050911]/95 text-white backdrop-blur-md">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 text-white flex items-center justify-center mb-4 shadow-xl">
            <Camera className="w-7 h-7 text-sky-400" />
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Live X-Ray Mirror Mode</h2>
          <p className="text-[13.5px] text-slate-300 max-w-md mt-2.5 leading-relaxed">
            Projects the complete 3D skull, brain, heart, lungs, ribcage, spine, pelvis, and hand
            skeleton directly onto your camera feed with live jaw articulation and full-body mixed
            reality tracking.
          </p>

          {error && (
            <div className="mt-4 px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-200 text-[12.5px] max-w-md flex items-center gap-2">
              <VideoOff className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button
              type="button"
              disabled={starting}
              onClick={startMirror}
              className="px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 text-[13.5px] font-bold cursor-pointer transition-colors shadow-lg shadow-sky-500/20"
            >
              {starting ? 'Initializing Vision Tracker…' : 'Start Live X-Ray Camera'}
            </button>
            <button
              type="button"
              onClick={onBackToAtlas}
              className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-[13.5px] font-medium cursor-pointer transition-colors"
            >
              Back to 3D Atlas
            </button>
          </div>

          <p className="text-[11.5px] text-slate-400 mt-4 inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{status}</span>
          </p>
        </div>
      )}

      {/* Floating Top Minimal Header */}
      <header className="absolute top-3 left-3 right-3 sm:top-4 sm:left-4 sm:right-4 z-20 flex items-center justify-between pointer-events-none">
        <button
          type="button"
          onClick={onBackToAtlas}
          className="pointer-events-auto h-9 px-3 rounded-xl bg-[#0f172a]/80 hover:bg-[#1e293b] text-white text-[12px] font-semibold border border-white/15 backdrop-blur-md flex items-center gap-1.5 shadow-lg transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>3D Atlas</span>
        </button>

        <div className="pointer-events-auto px-3 py-1.5 rounded-xl bg-[#0f172a]/70 border border-white/10 backdrop-blur-md flex items-center gap-2 text-white shadow-lg">
          <span className="font-display text-[13px] font-bold tracking-tight">Human Anatomy 3D</span>
          <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold">
            Live AR
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          {started && (
            <button
              type="button"
              onClick={handleFlipCamera}
              className="w-9 h-9 rounded-xl bg-[#0f172a]/80 hover:bg-[#1e293b] text-white border border-white/15 backdrop-blur-md flex items-center justify-center shadow-lg transition-colors cursor-pointer"
              title="Flip Camera"
              aria-label="Flip Camera"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowLabels((v) => !v)}
            className={`h-9 px-2.5 rounded-xl border backdrop-blur-md flex items-center gap-1.5 text-[12px] font-medium shadow-lg transition-colors cursor-pointer ${
              showLabels
                ? 'bg-sky-500/25 border-sky-400 text-sky-100'
                : 'bg-[#0f172a]/80 border-white/15 text-slate-300 hover:text-white'
            }`}
            title="Toggle 3D Anatomical Labels"
            aria-label="Toggle 3D Labels"
          >
            <Tag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Labels</span>
          </button>
        </div>
      </header>

      {/* Floating Bottom Minimalist Control Dock */}
      {started && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-24px)] max-w-[560px] pointer-events-none flex flex-col items-center gap-2">
          <div className="pointer-events-auto w-full rounded-2xl bg-[#0a111e]/85 backdrop-blur-xl border border-white/15 p-2.5 sm:p-3 shadow-2xl text-white transition-all">
            {/* Top Row: Mode Switch & Reveal Dropdown */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white/10 border border-white/10">
                {(['xray', 'solid'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setLook(m)}
                    className={`rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition-colors cursor-pointer ${
                      look === m
                        ? 'bg-sky-500 text-slate-950 shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {m === 'xray' ? 'X-Ray' : 'Solid PBR'}
                  </button>
                ))}
              </div>

              <div className="flex-1 max-w-[200px]">
                <select
                  value={reveal}
                  onChange={(e) => setReveal(e.target.value as MirrorReveal)}
                  className="w-full rounded-xl px-2.5 py-1.5 text-[11.5px] font-medium bg-white/10 border border-white/15 text-white focus:outline-none cursor-pointer"
                >
                  <option value="whole" className="bg-[#0f172a] text-white">
                    Whole Body & Head
                  </option>
                  <option value="lens" className="bg-[#0f172a] text-white">
                    X-Ray Lens
                  </option>
                  <option value="left" className="bg-[#0f172a] text-white">
                    Left Half
                  </option>
                  <option value="right" className="bg-[#0f172a] text-white">
                    Right Half
                  </option>
                  <option value="top" className="bg-[#0f172a] text-white">
                    Top Cranium
                  </option>
                  <option value="lower" className="bg-[#0f172a] text-white">
                    Lower Face
                  </option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setDockCollapsed((v) => !v)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
                title={dockCollapsed ? 'Expand controls' : 'Collapse controls'}
                aria-label={dockCollapsed ? 'Expand controls' : 'Collapse controls'}
              >
                {dockCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {/* Expandable Sliders Row */}
            {!dockCollapsed && (
              <div className="mt-2.5 pt-2 border-t border-white/10 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-300 w-24 shrink-0">Explode Anatomy</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={explode}
                    onChange={(e) => setExplode(Number(e.target.value))}
                    className="w-full atlas-slider"
                  />
                  <span className="font-mono-num text-[11px] text-sky-400 w-8 text-right font-medium">
                    {Math.round(explode * 100)}%
                  </span>
                </div>

                {reveal === 'lens' && (
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-300 w-24 shrink-0">Lens Radius</span>
                    <input
                      type="range"
                      min={0.12}
                      max={0.55}
                      step={0.02}
                      value={lensSize}
                      onChange={(e) => setLensSize(Number(e.target.value))}
                      className="w-full atlas-slider"
                    />
                    <span className="font-mono-num text-[11px] text-sky-400 w-8 text-right font-medium">
                      {Math.round(lensSize * 100)}%
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-300 w-24 shrink-0">X-Ray Brightness</span>
                  <input
                    type="range"
                    min={0.5}
                    max={1.8}
                    step={0.05}
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full atlas-slider"
                  />
                  <span className="font-mono-num text-[11px] text-sky-400 w-8 text-right font-medium">
                    {Math.round(brightness * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
