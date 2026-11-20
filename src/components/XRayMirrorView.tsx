import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Camera, RefreshCw, ShieldCheck, VideoOff } from 'lucide-react';
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

type MirrorReveal = 'lens' | 'whole' | 'left' | 'right' | 'top' | 'lower';

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
      gl_FragColor = vec4(uColor * (0.3 + 0.7 * nv) * uBright, 1.0);
    }
  }
`;

export function XRayMirrorView({ onBackToAtlas }: XRayMirrorViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState('Camera stays on your device — zero frames leave this browser.');
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [look, setLook] = useState<'xray' | 'solid'>('xray');
  const [reveal, setReveal] = useState<MirrorReveal>('lens');
  const [explode, setExplode] = useState(0);
  const [lensSize, setLensSize] = useState(0.24);
  const [brightness, setBrightness] = useState(1.1);

  const settingsRef = useRef({ look, reveal, explode, lensSize, brightness, facing });
  settingsRef.current = { look, reveal, explode, lensSize, brightness, facing };

  const runtimeRef = useRef<{
    stop: () => void;
    switchCamera: (nextFacing: 'user' | 'environment') => Promise<void>;
  } | null>(null);

  useEffect(() => {
    return () => {
      runtimeRef.current?.stop();
    };
  }, []);

  const startMirror = async () => {
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
      const video = videoRef.current;
      const glCanvas = glCanvasRef.current;
      const ovCanvas = overlayRef.current;
      if (!video || !glCanvas || !ovCanvas) throw new Error('Mirror elements not mounted.');
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not supported in this browser.');
      }

      setStatus('Requesting local camera access…');
      const openCam = async (mode: 'user' | 'environment') => {
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
          await new Promise((r) => setTimeout(r, 60));
        }
        const prefFacing = mode || 'user';
        let s: MediaStream | null = null;
        const constraints: MediaStreamConstraints[] = [
          {
            video: {
              facingMode: { ideal: prefFacing },
              width: { ideal: 1920, max: 1920 },
              height: { ideal: 1080, max: 1080 },
            },
            audio: false,
          },
          { video: { facingMode: prefFacing }, audio: false },
          { video: true, audio: false },
        ];
        for (const c of constraints) {
          try {
            s = await navigator.mediaDevices.getUserMedia(c);
            if (s) break;
          } catch {}
        }
        if (!s) throw new Error('Camera access failed or unavailable on this device.');
        stream = s;
        const track = stream.getVideoTracks()[0];
        if (track?.getSettings) {
          const settings = track.getSettings();
          if (settings.facingMode) {
            setFacing(settings.facingMode as 'user' | 'environment');
          }
        }
        video.srcObject = stream;
        await video.play();
        if (!video.videoWidth) {
          await new Promise<void>((res) => {
            video.onloadedmetadata = () => res();
          });
        }
      };

      await openCam(settingsRef.current.facing);

      setStatus('Loading BodyParts3D 3D meshes…');
      const geomMap = await loadAnatomyGeometries();

      setStatus('Initializing on-device MediaPipe vision tracking…');
      // Dynamic ESM import from CDN for optional live camera mode only
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
          } catch {
            // Try next delegate
          }
        }
        throw new Error('Could not initialize on-device vision tracker.');
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

      let W = video.videoWidth || 640;
      let H = video.videoHeight || 480;
      glCanvas.width = ovCanvas.width = W;
      glCanvas.height = ovCanvas.height = H;

      renderer = new THREE.WebGLRenderer({ canvas: glCanvas, alpha: true, antialias: true });
      renderer.autoClear = false;
      renderer.setClearColor(0x000000, 0);
      renderer.setSize(W, H, false);

      const sceneH = new THREE.Scene();
      const sceneD = new THREE.Scene();
      const camP = new THREE.PerspectiveCamera(63, W / H, 0.1, 1000);
      const camO = new THREE.OrthographicCamera(0, W, H, 0, -3000, 3000);
      const headG = new THREE.Group();
      headG.matrixAutoUpdate = false;
      sceneH.add(headG);

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

      const handSlots = [0, 1].map(() => {
        const grp = new THREE.Group();
        const ms: Record<string, THREE.Mesh> = {};
        for (const k of Object.keys(handGeoms)) {
          const me = new THREE.Mesh(handGeoms[k], makeMat([0.82, 0.94, 1.0], UD));
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
        const mirror = cfg.facing === 'user';

        if (cfg.look !== prevLook) {
          prevLook = cfg.look;
          applyLookMode(cfg.look);
        }

        if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const now = performance.now();

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
                  const targetX = raw.x * W;
                  const targetY = (1 - raw.y) * H;
                  const targetZ = -raw.z * W;
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

            const nx = (nose.x / W) * 2 - 1;
            const ny = (nose.y / H) * 2 - 1;
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

              handsP = hr.landmarks.map((lm, i) => ({
                p: lm.map((q) => [q.x * W, (1 - q.y) * H, -q.z * W]),
                right: hr.handednesses[i]?.[0]?.categoryName === 'Left',
              }));
            } catch {}
          }
        }

        renderer!.clear();
        ovCtx?.clearRect(0, 0, W, H);

        UH.uBright.value = UD.uBright.value = cfg.brightness;
        UH.uXray.value = UD.uXray.value = cfg.look === 'xray' ? 1 : 0;

        const isLens = cfg.reveal === 'lens';
        const tip0 = handsP[0]?.p[8] ?? null;
        let tip = tip0;
        const R = cfg.lensSize * H;
        if (isLens && !tip && faceOn) {
          const pv = new THREE.Vector3().setFromMatrixPosition(Msm).project(camP);
          tip = [((pv.x + 1) / 2) * W, ((pv.y + 1) / 2) * H];
        } else if (isLens && !tip && poseOn && smoothPose[20].v > 0.4) {
          // Fallback to pose right index finger tip
          tip = [smoothPose[20].x, smoothPose[20].y];
        }

        UH.uLensOn.value = isLens && tip ? 1 : 0;
        if (tip) UH.uLens.value.set(tip[0], tip[1], R, 0.22);

        headG.visible = faceOn && !(isLens && !tip);
        UH.uClip.value = 0;
        if (faceOn) {
          headG.matrix.copy(Msm);
          headG.matrixWorldNeedsUpdate = true;
          O.setFromMatrixPosition(Msm);
          XD.set(1, 0, 0).transformDirection(Msm);
          YD.set(0, 1, 0).transformDirection(Msm);
          const sx = XD.x * (mirror ? -1 : 1) > 0 ? 1 : -1;
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

        // Hand bones
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

        // Draw Full-Body Radiographic MR Guides for Projector Alignment
        if (poseOn && ovCtx) {
          const toScreen = (joint: SmoothedJoint): [number, number] => {
            const sx = mirror ? W - joint.x : joint.x;
            const sy = H - joint.y;
            return [sx, sy];
          };

          const drawBone = (i1: number, i2: number, alpha = 0.55, width = 2) => {
            const j1 = smoothPose[i1];
            const j2 = smoothPose[i2];
            if (j1.v < 0.25 || j2.v < 0.25) return;
            const [x1, y1] = toScreen(j1);
            const [x2, y2] = toScreen(j2);
            ovCtx.strokeStyle = `rgba(125, 211, 252, ${alpha})`;
            ovCtx.lineWidth = width;
            ovCtx.beginPath();
            ovCtx.moveTo(x1, y1);
            ovCtx.lineTo(x2, y2);
            ovCtx.stroke();
          };

          const drawReticle = (i: number, r = 4, alpha = 0.7) => {
            const j = smoothPose[i];
            if (j.v < 0.3) return;
            const [x, y] = toScreen(j);
            ovCtx.strokeStyle = `rgba(186, 230, 253, ${alpha})`;
            ovCtx.fillStyle = `rgba(56, 189, 248, ${alpha * 0.5})`;
            ovCtx.lineWidth = 1.5;
            ovCtx.beginPath();
            ovCtx.arc(x, y, r, 0, Math.PI * 2);
            ovCtx.fill();
            ovCtx.stroke();
          };

          // Spine column (neck midpoint down to sacrum midpoint)
          const lSh = smoothPose[11];
          const rSh = smoothPose[12];
          const lHip = smoothPose[23];
          const rHip = smoothPose[24];
          if (lSh.v > 0.3 && rSh.v > 0.3 && lHip.v > 0.3 && rHip.v > 0.3) {
            const neckX = (lSh.x + rSh.x) * 0.5;
            const neckY = (lSh.y + rSh.y) * 0.5;
            const sacrumX = (lHip.x + rHip.x) * 0.5;
            const sacrumY = (lHip.y + rHip.y) * 0.5;
            const [nx, ny] = [mirror ? W - neckX : neckX, H - neckY];
            const [sx, sy] = [mirror ? W - sacrumX : sacrumX, H - sacrumY];

            // Radiographic vertebral spine beam
            ovCtx.strokeStyle = 'rgba(147, 197, 253, 0.65)';
            ovCtx.lineWidth = 3;
            ovCtx.beginPath();
            ovCtx.moveTo(nx, ny);
            ovCtx.lineTo(sx, sy);
            ovCtx.stroke();

            // Thoracic ribcage & heart/lungs pop contour
            const thoraxMidY = ny + (sy - ny) * 0.38;
            const ribRadiusX = Math.abs(rSh.x - lSh.x) * 0.42;
            const ribRadiusY = Math.abs(sy - ny) * 0.28;
            ovCtx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
            ovCtx.lineWidth = 1.8;
            ovCtx.beginPath();
            ovCtx.ellipse(nx, thoraxMidY, ribRadiusX, ribRadiusY, 0, 0, Math.PI * 2);
            ovCtx.stroke();
          }

          // Clavicles & Pelvis
          drawBone(11, 12, 0.6, 2.5);
          drawBone(23, 24, 0.6, 2.5);

          // Arms
          drawBone(11, 13, 0.5, 2);
          drawBone(13, 15, 0.5, 2);
          drawBone(12, 14, 0.5, 2);
          drawBone(14, 16, 0.5, 2);

          // Legs
          drawBone(23, 25, 0.5, 2.2);
          drawBone(25, 27, 0.5, 2.2);
          drawBone(27, 29, 0.4, 1.8);
          drawBone(29, 31, 0.4, 1.8);

          drawBone(24, 26, 0.5, 2.2);
          drawBone(26, 28, 0.5, 2.2);
          drawBone(28, 30, 0.4, 1.8);
          drawBone(30, 32, 0.4, 1.8);

          // Joint calibration reticles
          [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].forEach((idx) => drawReticle(idx));
        }

        if (isLens && tip && ovCtx) {
          const mx = mirror ? W - tip[0] : tip[0];
          ovCtx.strokeStyle = 'rgba(125, 211, 252, 0.55)';
          ovCtx.lineWidth = 2;
          ovCtx.beginPath();
          ovCtx.arc(mx, H - tip[1], R, 0, Math.PI * 2);
          ovCtx.stroke();
        }
      };

      runtimeRef.current = {
        stop: cleanup,
        switchCamera: async (nextFacing) => {
          await openCam(nextFacing);
          W = video.videoWidth || 640;
          H = video.videoHeight || 480;
          glCanvas.width = ovCanvas.width = W;
          glCanvas.height = ovCanvas.height = H;
          renderer?.setSize(W, H, false);
          camP.aspect = W / H;
          camP.updateProjectionMatrix();
          camO.right = W;
          camO.top = H;
          camO.updateProjectionMatrix();
        },
      };

      setStarted(true);
      setStarting(false);
      setStatus('Live tracking active — raise your hand to move the X-ray lens.');
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
  };

  const handleFlipCamera = async () => {
    const next = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    try {
      await runtimeRef.current?.switchCamera(next);
    } catch {
      setError('Could not switch camera on this device.');
    }
  };

  return (
    <div className="w-full h-full flex flex-col lg:flex-row items-center justify-center gap-5 p-4 lg:p-6 overflow-y-auto bg-[#e9edeb]">
      {/* Camera Stage */}
      <div className="relative w-full max-w-[820px] aspect-[4/3] rounded-2xl overflow-hidden bg-[#08101a] shadow-[0_18px_48px_rgba(24,33,43,0.18)] border border-white/60">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            transform: facing === 'user' ? 'scaleX(-1)' : 'none',
            filter: 'brightness(0.76)',
          }}
        />
        <canvas
          ref={glCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ transform: facing === 'user' ? 'scaleX(-1)' : 'none' }}
        />
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {!started && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center p-6 bg-gradient-to-b from-[#f7f9f8] to-[#e3e8e6] text-[#18212b]">
            <div className="w-12 h-12 rounded-2xl bg-[#1d2733] text-white flex items-center justify-center mb-4">
              <Camera className="w-6 h-6" />
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight">
              Live X-Ray Mirror Mode
            </h2>
            <p className="text-[13.5px] text-[#556472] max-w-md mt-2 leading-relaxed">
              Projects the real 49-structure BodyParts3D skull, brain, facial muscles, and hand skeleton directly onto your camera feed with live jaw &amp; fingertip lens tracking.
            </p>

            {error && (
              <div className="mt-4 px-4 py-2.5 rounded-xl bg-[#fef2f2] border border-[#dc2626]/25 text-[#991b1b] text-[12.5px] max-w-md flex items-center gap-2">
                <VideoOff className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
              <button
                type="button"
                disabled={starting}
                onClick={startMirror}
                className="px-6 py-3 rounded-xl bg-[#1d2733] hover:bg-[#2a3848] disabled:opacity-50 text-white text-[13.5px] font-semibold cursor-pointer transition-colors"
              >
                {starting ? 'Initializing Camera & Tracker…' : 'Start Live X-Ray Camera'}
              </button>
              <button
                type="button"
                onClick={onBackToAtlas}
                className="px-5 py-3 rounded-xl bg-white hover:bg-[#f2f5f4] border border-[#18212b]/12 text-[#18212b] text-[13.5px] font-medium cursor-pointer transition-colors"
              >
                Back to 3D Atlas
              </button>
            </div>

            <p className="text-[11.5px] text-[#667482] mt-4 inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" />
              <span>{status}</span>
            </p>
          </div>
        )}
      </div>

      {/* Compact Mirror Controls */}
      <div className="w-full max-w-[820px] lg:w-[290px] bg-white/95 border border-[#18212b]/10 rounded-2xl p-4 shadow-[0_8px_28px_rgba(24,33,43,0.07)] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[14px] font-semibold">X-Ray Mirror Controls</h3>
          {started && (
            <button
              type="button"
              onClick={handleFlipCamera}
              className="p-2 rounded-lg bg-[#f3f5f4] hover:bg-[#e7ecea] text-[#18212b] cursor-pointer"
              title="Flip camera"
              aria-label="Flip camera"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#eaeeec]">
          {(['xray', 'solid'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setLook(m)}
              className={`rounded-lg py-1.5 text-[12px] font-medium cursor-pointer ${
                look === m
                  ? 'bg-white text-[#18212b] shadow-sm'
                  : 'text-[#556472] hover:text-[#18212b]'
              }`}
            >
              {m === 'xray' ? 'X-Ray Shader' : 'Solid Model'}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="mirror-reveal" className="block text-[11.5px] text-[#667482] mb-1">
            Reveal Mode
          </label>
          <select
            id="mirror-reveal"
            value={reveal}
            onChange={(e) => setReveal(e.target.value as MirrorReveal)}
            className="w-full rounded-xl px-3 py-2 text-[12.5px] font-medium bg-[#f6f8f7] border border-[#18212b]/12 text-[#18212b]"
          >
            <option value="lens">X-Ray Lens (Follows Fingertip)</option>
            <option value="whole">Whole Head</option>
            <option value="left">Left Half Only</option>
            <option value="right">Right Half Only</option>
            <option value="top">Top Cranium Only</option>
            <option value="lower">Lower Face Only</option>
          </select>
        </div>

        <div>
          <div className="flex justify-between text-[12px] mb-1">
            <span className="text-[#667482]">Explode Anatomy</span>
            <span className="font-mono-num">{Math.round(explode * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={explode}
            onChange={(e) => setExplode(Number(e.target.value))}
            className="w-full atlas-slider"
          />
        </div>

        <div>
          <div className="flex justify-between text-[12px] mb-1">
            <span className="text-[#667482]">Lens Size</span>
            <span className="font-mono-num">{Math.round(lensSize * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.12}
            max={0.55}
            step={0.02}
            value={lensSize}
            onChange={(e) => setLensSize(Number(e.target.value))}
            className="w-full atlas-slider"
          />
        </div>

        <div>
          <div className="flex justify-between text-[12px] mb-1">
            <span className="text-[#667482]">X-Ray Intensity</span>
            <span className="font-mono-num">{Math.round(brightness * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={1.7}
            step={0.05}
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="w-full atlas-slider"
          />
        </div>

        <p className="text-[11.5px] text-[#667482] pt-2 border-t border-[#18212b]/10 leading-snug">
          {status}
        </p>
      </div>
    </div>
  );
}
