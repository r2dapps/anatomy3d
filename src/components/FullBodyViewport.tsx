import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  SYSTEMS,
  SYSTEM_BY_ID,
  type CameraView,
  type FullBodyAtlas,
  type FullBodyShaderMode,
  type SystemId,
} from '../data/fullBodyAnatomy.ts';
import {
  PointerTap,
  createExplosionLayout,
  decodeModelResponse,
  getPerformanceBudget,
  getSectionPlaneWorldCoord,
  isPartVisible,
  isPointClipped,
  type QualityTier,
  type SectionCutState,
} from '../utils/fullBodyLogic.ts';
import type { PhysiologicalMotion } from '../data/studyCurriculum.ts';
import {
  getTourCalloutWidth,
  getXrRigTransform,
  layoutTourCallouts,
  resolveAssetUrl,
  type ProjectedCalloutInput,
  type TourLabelSpec,
} from '../utils/xrAndLabelsLogic.ts';

export interface FullBodySceneState {
  visibleSystems: SystemId[];
  selectedPartIds: string[];
  hiddenPartIds: string[];
  isolate: boolean;
  explode: number;
  sectionCut: SectionCutState;
  peelMode: boolean;
  motion: PhysiologicalMotion;
  view: CameraView;
  rotate: boolean;
  resetToken: number;
  shaderMode: FullBodyShaderMode;
  exposure: number;
  qualityTier: QualityTier;
  inspectorOpen: boolean;
  layersOpen: boolean;
  focusBox: { center: [number, number, number]; distance: number; token: number } | null;
  tourLabels: TourLabelSpec[];
  showTourLabels: boolean;
}

export interface FullBodyViewportHandle {
  captureSnapshot: () => string | null;
  enterVr: () => Promise<{ ok: boolean; message?: string }>;
  exitVr: () => Promise<void>;
}

interface FullBodyViewportProps {
  atlas: FullBodyAtlas;
  state: FullBodySceneState;
  onSelectPart: (partId: string) => void;
  onQuickHidePart: (partId: string) => void;
  onSelectTourLabel?: (conceptName: string) => void;
  onVrSessionChange?: (active: boolean) => void;
  onProgress: (percent: number) => void;
  onError: (message: string) => void;
  onSoftwareGlDetected?: (isSw: boolean) => void;
}

const XRAY_VERTEX_SHADER = /* glsl */ `
  attribute float partIndex;
  uniform sampler2D partState;
  uniform sampler2D selectionState;
  uniform float stateWidth;
  uniform float uPulseScale;
  uniform vec3 uPulseOrigin;

  varying float vVisible;
  varying float vSelected;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec3 vModelPos;

  void main() {
    vec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5);
    vec4 state = texture2D(partState, stateUv);
    vVisible = state.w;
    if (vVisible < 0.5) {
      vSelected = 0.0;
      vNormal = vec3(0.0, 0.0, 1.0);
      vViewPos = vec3(0.0, 0.0, 1.0);
      vModelPos = vec3(0.0);
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    vSelected = texture2D(selectionState, stateUv).r;

    vec3 pos = position + state.xyz;
    if (abs(uPulseScale) > 0.0001) {
      pos = uPulseOrigin + (pos - uPulseOrigin) * (1.0 + uPulseScale);
    }
    vModelPos = pos;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    vViewPos = -mvPos.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const XRAY_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform vec3 uColor;
  uniform float uExposure;
  uniform float uClipAxis;
  uniform float uClipPos;
  uniform float uClipFlip;

  varying float vVisible;
  varying float vSelected;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec3 vModelPos;

  void main() {
    if (vVisible < 0.5) discard;
    float edgeBoost = 0.0;
    if (uClipAxis > 0.5) {
      float coord = uClipAxis < 1.5 ? vModelPos.x : (uClipAxis < 2.5 ? vModelPos.y : vModelPos.z);
      float signedDist = (coord - uClipPos) * uClipFlip;
      if (signedDist > 0.0) discard;
      edgeBoost = smoothstep(0.007, 0.0, abs(signedDist)) * 0.55;
    }

    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewPos);
    float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);
    float fresnel = pow(1.0 - ndotv, 2.35);

    vec3 tint = mix(uColor, vec3(0.38, 0.96, 1.0), clamp(vSelected * 0.72 + edgeBoost, 0.0, 1.0));
    float density = mix(0.018 + 0.44 * fresnel, 0.16 + 0.85 * fresnel, vSelected) + edgeBoost * 0.5;
    vec3 col = tint * density * uExposure;
    float alpha = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

export const FullBodyViewport = forwardRef<FullBodyViewportHandle, FullBodyViewportProps>(
  function FullBodyViewport(
    {
      atlas,
      state,
      onSelectPart,
      onQuickHidePart,
      onSelectTourLabel,
      onVrSessionChange,
      onProgress,
      onError,
      onSoftwareGlDetected,
    },
    ref
  ) {
    const mountRef = useRef<HTMLDivElement>(null);
    const stateRef = useRef(state);
    stateRef.current = state;

    const callbacksRef = useRef({
      onSelectPart,
      onQuickHidePart,
      onSelectTourLabel,
      onVrSessionChange,
      onProgress,
      onError,
      onSoftwareGlDetected,
    });
    callbacksRef.current = {
      onSelectPart,
      onQuickHidePart,
      onSelectTourLabel,
      onVrSessionChange,
      onProgress,
      onError,
      onSoftwareGlDetected,
    };

    const controllerRef = useRef<{
      markDirty: () => void;
      captureSnapshot: () => string | null;
      enterVr: () => Promise<{ ok: boolean; message?: string }>;
      exitVr: () => Promise<void>;
    } | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        captureSnapshot: () => controllerRef.current?.captureSnapshot() ?? null,
        enterVr: async () =>
          controllerRef.current
            ? controllerRef.current.enterVr()
            : { ok: false, message: '3D viewport is still initializing.' },
        exitVr: async () => {
          await controllerRef.current?.exitVr();
        },
      }),
      []
    );

    // Wake demand-driven renderer whenever React state changes
    useEffect(() => {
      controllerRef.current?.markDirty();
    }, [
      state.visibleSystems,
      state.selectedPartIds,
      state.hiddenPartIds,
      state.isolate,
      state.explode,
      state.sectionCut,
      state.peelMode,
      state.motion,
      state.view,
      state.rotate,
      state.resetToken,
      state.shaderMode,
      state.exposure,
      state.qualityTier,
      state.inspectorOpen,
      state.layersOpen,
      state.focusBox,
      state.tourLabels,
      state.showTourLabels,
    ]);

    useEffect(() => {
      const el = mountRef.current;
      if (!el) return;

      let disposed = false;
      let rafId = 0;
      let dirty = true;
      let ready = false;
      let amount = 0;
      let layoutKey = '';
      let lastView: CameraView | '' = '';
      let lastReset = -1;
      let lastIsolateKey = '';
      let lastFocusKey = '';
      let lastShaderMode: FullBodyShaderMode | '' = '';
      let lastExposure = -1;
      let lastPeelMode: boolean | null = null;
      let lastCutAxisNum = -1;
      let lastCutCoord = -999;
      let lastCutFlipVal = 0;
      let lastQuality: QualityTier = stateRef.current.qualityTier;
      let lastStateRef: FullBodySceneState | null = null;

      const abort = new AbortController();

      // Detect software WebGL before creating renderer
      let isSoftwareGl = false;
      try {
        const probe = document.createElement('canvas');
        const gl =
          probe.getContext('webgl2') ||
          probe.getContext('webgl') ||
          probe.getContext('experimental-webgl');
        if (gl) {
          const dbg = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
          const rendererStr = dbg
            ? String((gl as WebGLRenderingContext).getParameter(dbg.UNMASKED_RENDERER_WEBGL))
            : String(
              (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).RENDERER)
            );
          isSoftwareGl = /SwiftShader|llvmpipe|Software|Mesa|Microsoft Basic/i.test(rendererStr);
        }
      } catch {
        isSoftwareGl = false;
      }
      callbacksRef.current.onSoftwareGlDetected?.(isSoftwareGl);

      const isMobile = window.innerWidth < 820;
      const budget = getPerformanceBudget(
        stateRef.current.qualityTier,
        isSoftwareGl,
        window.devicePixelRatio || 1,
        isMobile
      );

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: budget.antialias,
          alpha: false,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
        });
      } catch {
        callbacksRef.current.onError(
          'WebGL is unavailable in this browser. Enable hardware acceleration to inspect the 3D atlas.'
        );
        return;
      }

      renderer.setPixelRatio(budget.pixelRatio);
      renderer.setClearColor('#ecefed');
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.96;
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType('local-floor');
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      renderer.domElement.setAttribute(
        'aria-label',
        'Interactive full-body 3D human anatomy. Drag to orbit, pinch or scroll to zoom, tap any structure to inspect.'
      );
      el.innerHTML = '';
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.005, 100);
      const controls = new OrbitControls(camera, renderer.domElement);
      camera.position.set(1.35, 1.02, 3.55);
      controls.target.set(0, 0.86, 0);
      controls.enableDamping = true;
      controls.dampingFactor = 0.085;
      controls.minDistance = 0.07;
      controls.maxDistance = 38;
      controls.maxPolarAngle = Math.PI * 0.96;

      // Studio PBR Environment + sculpted 3-point clinical gallery lighting
      const pmrem = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      const envRT = pmrem.fromScene(room, 0.04);
      scene.environment = envRT.texture;
      scene.environmentIntensity = 0.72;
      room.dispose();
      pmrem.dispose();

      scene.add(new THREE.HemisphereLight(0xfafcf9, 0x9aa2aa, 0.85));
      const keyLight = new THREE.DirectionalLight(0xfff9f0, 1.65);
      keyLight.position.set(-2.2, 4.2, 3.2);
      scene.add(keyLight);
      const rimLight = new THREE.DirectionalLight(0xd9e8fa, 1.18);
      rimLight.position.set(2.4, 2.2, -3.0);
      scene.add(rimLight);

      // Clean gallery stage floor & circular pedestal (hidden in X-Ray & Exploded Inventory)
      const stageGroup = new THREE.Group();
      const groundMat = new THREE.MeshStandardMaterial({ color: 0xd9dde0, roughness: 1 });
      const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 72), groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.019;
      stageGroup.add(ground);

      const platformMat = new THREE.MeshStandardMaterial({
        color: 0xf0f1ef,
        metalness: 0.1,
        roughness: 0.68,
      });
      const platform = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.68, 0.026, 80), platformMat);
      platform.position.y = -0.015;
      stageGroup.add(platform);

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x8a959f,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.61, 0.613, 96), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.001;
      stageGroup.add(ring);
      scene.add(stageGroup);

      // Per-part GPU DataTextures (2,234 parts updated in a single texture upload!)
      const texWidth = THREE.MathUtils.ceilPowerOfTwo(atlas.parts.length);
      const partData = new Float32Array(texWidth * 4);
      const partTexture = new THREE.DataTexture(
        partData,
        texWidth,
        1,
        THREE.RGBAFormat,
        THREE.FloatType
      );
      partTexture.needsUpdate = true;

      const selectedData = new Uint8Array(texWidth * 4);
      const selectionTexture = new THREE.DataTexture(selectedData, texWidth, 1);
      selectionTexture.needsUpdate = true;

      const solidMaterials = new Map<SystemId, THREE.MeshStandardMaterial>();
      const xrayMaterials = new Map<SystemId, THREE.ShaderMaterial>();
      const batchedMeshes: { mesh: THREE.Mesh; system: SystemId }[] = [];
      const geometries: THREE.BufferGeometry[] = [];
      const pickers: (THREE.Mesh | undefined)[] = new Array(atlas.parts.length);

      const centers = atlas.parts.map((p) =>
        new THREE.Vector3()
          .fromArray(p.bounds[0])
          .add(new THREE.Vector3().fromArray(p.bounds[1]))
          .multiplyScalar(0.5)
      );
      const bounds = atlas.parts.map(
        (p) =>
          new THREE.Box3(
            new THREE.Vector3().fromArray(p.bounds[0]),
            new THREE.Vector3().fromArray(p.bounds[1])
          )
      );
      const offsets: THREE.Vector3[] = centers.map((c) => c.clone());
      let packingWidth = 1;
      let packingHeight = 1;

      // Subtle anchor dots visible in fully exploded flat inventory mode
      const markerPositions = new Float32Array(atlas.parts.length * 3);
      const markerGeometry = new THREE.BufferGeometry();
      markerGeometry.setAttribute('position', new THREE.BufferAttribute(markerPositions, 3));
      const markerMaterial = new THREE.PointsMaterial({
        color: 0x64748b,
        size: 4.5,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.65,
        depthTest: false,
      });
      const markers = new THREE.Points(markerGeometry, markerMaterial);
      markers.frustumCulled = false;
      markers.renderOrder = 10;
      markers.visible = false;
      scene.add(markers);

      // WebXR-ready 1:1 metric root group (standing height ~1.72m, floor y = 0)
      const anatomyRoot = new THREE.Group();
      anatomyRoot.name = 'HumanAnatomyRoot';
      scene.add(anatomyRoot);

      // Visual indicator frame for active X/Y/Z Section Cut plane
      const sectionPlaneGeo = new THREE.PlaneGeometry(0.92, 0.92);
      const sectionPlaneMat = new THREE.MeshBasicMaterial({
        color: 0x0ea5e9,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const sectionPlaneMesh = new THREE.Mesh(sectionPlaneGeo, sectionPlaneMat);
      const sectionEdgeGeo = new THREE.EdgesGeometry(sectionPlaneGeo);
      const sectionEdgeMat = new THREE.LineBasicMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.55,
      });
      const sectionEdges = new THREE.LineSegments(sectionEdgeGeo, sectionEdgeMat);
      sectionPlaneMesh.add(sectionEdges);
      sectionPlaneMesh.visible = false;
      anatomyRoot.add(sectionPlaneMesh);

      // Shared GPU uniforms for zero-recompile section cuts & physiological motion
      const sharedClipUniforms = {
        uClipAxis: { value: 0 },
        uClipPos: { value: 0 },
        uClipFlip: { value: 1 },
      };
      const pulseUniformsBySystem = new Map<
        SystemId,
        { uPulseScale: { value: number }; uPulseOrigin: { value: THREE.Vector3 } }
      >();

      // Build dual Solid PBR + X-Ray GPU-batched materials for all 15 systems
      for (const sys of SYSTEMS) {
        const isSkin = sys.id === 'integumentary';
        const pulseOrigin =
          sys.id === 'cardiac'
            ? new THREE.Vector3(0.02, 1.24, 0.04)
            : new THREE.Vector3(0.0, 1.28, 0.01);
        const pulseUniforms = {
          uPulseScale: { value: 0 },
          uPulseOrigin: { value: pulseOrigin },
        };
        pulseUniformsBySystem.set(sys.id, pulseUniforms);

        const solidMat = new THREE.MeshStandardMaterial({
          color: sys.id === 'skeletal' ? '#d4c8b2' : sys.color,
          metalness: 0.06,
          roughness: sys.id === 'skeletal' ? 0.66 : sys.id === 'cardiac' ? 0.42 : 0.54,
          side: THREE.DoubleSide,
          transparent: isSkin,
          opacity: isSkin ? 0.11 : 1,
          depthWrite: !isSkin,
        });

        solidMat.onBeforeCompile = (shader) => {
          shader.uniforms.partState = { value: partTexture };
          shader.uniforms.selectionState = { value: selectionTexture };
          shader.uniforms.stateWidth = { value: texWidth };
          shader.uniforms.uClipAxis = sharedClipUniforms.uClipAxis;
          shader.uniforms.uClipPos = sharedClipUniforms.uClipPos;
          shader.uniforms.uClipFlip = sharedClipUniforms.uClipFlip;
          shader.uniforms.uPulseScale = pulseUniforms.uPulseScale;
          shader.uniforms.uPulseOrigin = pulseUniforms.uPulseOrigin;
          shader.vertexShader =
            'attribute float partIndex; uniform sampler2D partState; uniform sampler2D selectionState; uniform float stateWidth; uniform float uPulseScale; uniform vec3 uPulseOrigin; varying float partVisible; varying float partSelected; varying vec3 vModelPos;\n' +
            shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             vec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5);
             vec4 state = texture2D(partState, stateUv);
             transformed += state.xyz;
             if (abs(uPulseScale) > 0.0001) {
               transformed = uPulseOrigin + (transformed - uPulseOrigin) * (1.0 + uPulseScale);
             }
             vModelPos = transformed;
             partVisible = state.w;
             partSelected = texture2D(selectionState, stateUv).r;`
          );
          shader.vertexShader = shader.vertexShader.replace(
            '#include <project_vertex>',
            `#include <project_vertex>
             if (partVisible < 0.5) {
               gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
             }`
          );
          shader.fragmentShader =
            'uniform float uClipAxis; uniform float uClipPos; uniform float uClipFlip; varying float partVisible; varying float partSelected; varying vec3 vModelPos;\n' +
            shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <clipping_planes_fragment>',
            `#include <clipping_planes_fragment>
             if (partVisible < 0.5) discard;
             float cutEdge = 0.0;
             if (uClipAxis > 0.5) {
               float cVal = uClipAxis < 1.5 ? vModelPos.x : (uClipAxis < 2.5 ? vModelPos.y : vModelPos.z);
               float sDist = (cVal - uClipPos) * uClipFlip;
               if (sDist > 0.0) discard;
               cutEdge = smoothstep(0.0055, 0.0, abs(sDist));
             }`
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `#include <color_fragment>
             diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.08, 0.72, 0.88), partSelected * 0.72);
             diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.64, 0.88), cutEdge * 0.55);`
          );
        };
        solidMaterials.set(sys.id, solidMat);

        const xrayMat = new THREE.ShaderMaterial({
          vertexShader: XRAY_VERTEX_SHADER,
          fragmentShader: XRAY_FRAGMENT_SHADER,
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
          uniforms: {
            partState: { value: partTexture },
            selectionState: { value: selectionTexture },
            stateWidth: { value: texWidth },
            uColor: { value: new THREE.Color(...sys.xrayColor) },
            uExposure: { value: 1.0 },
            uClipAxis: sharedClipUniforms.uClipAxis,
            uClipPos: sharedClipUniforms.uClipPos,
            uClipFlip: sharedClipUniforms.uClipFlip,
            uPulseScale: pulseUniforms.uPulseScale,
            uPulseOrigin: pulseUniforms.uPulseOrigin,
          },
        });
        xrayMaterials.set(sys.id, xrayMat);
      }

      // Hover tooltip element (only active during exploded flat inventory)
      const hoverEl = document.createElement('div');
      hoverEl.className =
        'pointer-events-none absolute z-30 px-2.5 py-1 rounded-lg text-[12px] font-medium bg-[#18212b]/95 text-white shadow-md whitespace-nowrap';
      hoverEl.setAttribute('role', 'tooltip');
      hoverEl.hidden = true;
      el.appendChild(hoverEl);

      // Dynamic 3D Anatomical Tour Callout Layer (SVG leader lines + high-contrast clickable DOM labels)
      const calloutLayer = document.createElement('div');
      calloutLayer.className = 'pointer-events-none absolute inset-0 z-10 overflow-hidden';
      calloutLayer.setAttribute('data-testid', 'tour-labels-layer');
      calloutLayer.setAttribute('aria-label', 'Anatomical 3D structure callout labels');
      const svgNS = 'http://www.w3.org/2000/svg';
      const calloutSvg = document.createElementNS(svgNS, 'svg');
      calloutSvg.setAttribute('class', 'pointer-events-none absolute inset-0 w-full h-full');
      calloutLayer.appendChild(calloutSvg);
      const calloutTagContainer = document.createElement('div');
      calloutTagContainer.className = 'pointer-events-none absolute inset-0';
      calloutLayer.appendChild(calloutTagContainer);
      el.appendChild(calloutLayer);

      // Fast partId -> partIndex map for O(1) callout centroid projection
      const partIndexById = new Map<string, number>();
      for (let i = 0; i < atlas.parts.length; i++) {
        partIndexById.set(atlas.parts[i].id, i);
      }

      // Quest 2 WebXR Spatial Controller Rig (only visible while XR session is active)
      const xrRigGroup = new THREE.Group();
      xrRigGroup.name = 'WebXRControllerRig';
      xrRigGroup.visible = false;
      scene.add(xrRigGroup);

      const xrLaserGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -3.2),
      ]);
      const xrLaserMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.85,
      });
      const xrTipGeo = new THREE.SphereGeometry(0.012, 12, 12);
      const xrTipMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9 });

      const xrControllers = [renderer.xr.getController(0), renderer.xr.getController(1)];
      const xrRayOrigin = new THREE.Vector3();
      const xrRayDir = new THREE.Vector3();
      const xrRotMat = new THREE.Matrix4();
      const xrInvAnatomyMat = new THREE.Matrix4();

      // VR-space 3D floating label sprites (shown inside Quest 2 headset when tour labels are enabled)
      const vrLabelGroup = new THREE.Group();
      vrLabelGroup.name = 'VRTourLabelGroup';
      vrLabelGroup.visible = false;
      anatomyRoot.add(vrLabelGroup);
      let vrLabelKey = '';

      const clearVrLabels = () => {
        while (vrLabelGroup.children.length > 0) {
          const child = vrLabelGroup.children[0] as THREE.Sprite;
          vrLabelGroup.remove(child);
          const mat = child.material as THREE.SpriteMaterial;
          mat.map?.dispose();
          mat.dispose();
        }
        vrLabelKey = '';
      };

      const rebuildVrLabels = (specs: TourLabelSpec[], isXray: boolean) => {
        const nextKey = `${isXray ? 'x' : 's'}:${specs.map((sp) => sp.id).join(',')}`;
        if (nextKey === vrLabelKey) return;
        clearVrLabels();
        vrLabelKey = nextKey;
        if (specs.length === 0) return;

        for (let idx = 0; idx < specs.length; idx++) {
          const spec = specs[idx];
          const box = new THREE.Box3();
          for (let k = 0; k < spec.partIds.length; k++) {
            const pIdx = partIndexById.get(spec.partIds[k]);
            if (pIdx === undefined || partData[pIdx * 4 + 3] < 0.5) continue;
            scratchOffset.set(partData[pIdx * 4], partData[pIdx * 4 + 1], partData[pIdx * 4 + 2]);
            worldBox.copy(bounds[pIdx]).translate(scratchOffset);
            box.union(worldBox);
          }
          if (box.isEmpty()) continue;
          const center = box.getCenter(new THREE.Vector3());

          const canvas = document.createElement('canvas');
          canvas.width = 512;
          canvas.height = 112;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          ctx.fillStyle = isXray ? 'rgba(8, 19, 31, 0.94)' : 'rgba(255, 255, 255, 0.96)';
          ctx.strokeStyle = isXray ? 'rgba(56, 189, 248, 0.85)' : 'rgba(2, 132, 199, 0.85)';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.roundRect(8, 12, 496, 88, 20);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = SYSTEM_BY_ID[spec.system]?.color ?? '#0284c7';
          ctx.beginPath();
          ctx.arc(42, 56, 12, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = isXray ? '#f0f9ff' : '#0f172a';
          ctx.font = '600 34px sans-serif';
          ctx.textBaseline = 'middle';
          ctx.fillText(spec.label, 72, 56, 412);

          const tex = new THREE.CanvasTexture(canvas);
          tex.colorSpace = THREE.SRGBColorSpace;
          const spriteMat = new THREE.SpriteMaterial({
            map: tex,
            transparent: true,
            depthTest: false,
            depthWrite: false,
          });
          const sprite = new THREE.Sprite(spriteMat);
          const sideSign = idx % 2 === 0 ? 1 : -1;
          sprite.position.set(center.x + sideSign * 0.24, center.y + 0.04, center.z + 0.06);
          sprite.scale.set(0.32, 0.07, 1);
          sprite.renderOrder = 25;
          vrLabelGroup.add(sprite);
        }
      };

      const handleXrSelect = (controller: THREE.Object3D) => {
        if (!ready || !renderer.xr.isPresenting) return;
        xrRotMat.identity().extractRotation(controller.matrixWorld);
        xrRayOrigin.setFromMatrixPosition(controller.matrixWorld);
        xrRayDir.set(0, 0, -1).applyMatrix4(xrRotMat).normalize();

        // Transform world controller ray into anatomyRoot local space for accurate picking
        anatomyRoot.updateMatrixWorld(true);
        xrInvAnatomyMat.copy(anatomyRoot.matrixWorld).invert();
        raycaster.ray.origin.copy(xrRayOrigin).applyMatrix4(xrInvAnatomyMat);
        raycaster.ray.direction
          .copy(xrRayDir)
          .transformDirection(xrInvAnatomyMat)
          .normalize();

        let nearest = Infinity;
        let found = -1;
        const activeCut = stateRef.current.sectionCut;
        const hasSolid = atlas.parts.some(
          (p, i) => p.system !== 'integumentary' && partData[i * 4 + 3] > 0.5
        );
        for (let i = 0; i < pickers.length; i++) {
          const mesh = pickers[i];
          if (!mesh || partData[i * 4 + 3] < 0.5) continue;
          if (hasSolid && atlas.parts[i].system === 'integumentary') continue;
          worldBox.copy(bounds[i]).translate(mesh.position);
          if (!raycaster.ray.intersectBox(worldBox, hitPoint)) continue;
          const hits = raycaster.intersectObject(mesh, false);
          for (let h = 0; h < hits.length; h++) {
            const pt = hits[h].point;
            if (isPointClipped(pt.x, pt.y, pt.z, activeCut)) continue;
            if (hits[h].distance < nearest) {
              nearest = hits[h].distance;
              found = i;
            }
            break;
          }
        }
        if (found >= 0) {
          if (stateRef.current.peelMode) {
            callbacksRef.current.onQuickHidePart(atlas.parts[found].id);
          } else {
            callbacksRef.current.onSelectPart(atlas.parts[found].id);
          }
        }
      };

      const onXrSelect0 = () => handleXrSelect(xrControllers[0]);
      const onXrSelect1 = () => handleXrSelect(xrControllers[1]);

      xrControllers.forEach((ctrl, idx) => {
        const line = new THREE.Line(xrLaserGeo, xrLaserMat);
        const tip = new THREE.Mesh(xrTipGeo, xrTipMat);
        tip.position.set(0, 0, -0.02);
        ctrl.add(line);
        ctrl.add(tip);
        ctrl.addEventListener('selectstart', idx === 0 ? onXrSelect0 : onXrSelect1);
        xrRigGroup.add(ctrl);
      });

      let activeXrSession: XRSession | null = null;
      let savedCamPos: THREE.Vector3 | null = null;
      let savedCtrlTarget: THREE.Vector3 | null = null;

      // Scratch objects (zero per-frame allocations)
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const tap = new PointerTap();
      const worldBox = new THREE.Box3();
      const hitPoint = new THREE.Vector3();
      const projected = new THREE.Vector3();
      const scratchBox = new THREE.Box3();
      const scratchCenter = new THREE.Vector3();
      const scratchSize = new THREE.Vector3();
      const scratchDir = new THREE.Vector3();
      const scratchOffset = new THREE.Vector3();
      const labelScratchBox = new THREE.Box3();
      const labelScratchCenter = new THREE.Vector3();

      // Update projected 3D callout tags & SVG leader lines directly on DOM (zero React re-renders!)
      const renderTourCalloutOverlay = (s: FullBodySceneState) => {
        if (
          !s.showTourLabels ||
          s.tourLabels.length === 0 ||
          renderer.xr.isPresenting ||
          !ready
        ) {
          if (calloutSvg.childNodes.length > 0) calloutSvg.replaceChildren();
          if (calloutTagContainer.childNodes.length > 0) calloutTagContainer.replaceChildren();
          return;
        }

        const cw = el.clientWidth;
        const ch = el.clientHeight;
        if (cw <= 0 || ch <= 0) return;

        const isMobile = cw < 1024;
        const isXray = s.shaderMode === 'xray';
        const inputs: ProjectedCalloutInput[] = [];

        for (let t = 0; t < s.tourLabels.length; t++) {
          const spec = s.tourLabels[t];
          labelScratchBox.makeEmpty();
          let visibleCount = 0;

          for (let k = 0; k < spec.partIds.length; k++) {
            const pIdx = partIndexById.get(spec.partIds[k]);
            if (pIdx === undefined || partData[pIdx * 4 + 3] < 0.5) continue;
            scratchOffset.set(
              partData[pIdx * 4],
              partData[pIdx * 4 + 1],
              partData[pIdx * 4 + 2]
            );
            worldBox.copy(bounds[pIdx]).translate(scratchOffset);
            labelScratchBox.union(worldBox);
            visibleCount++;
          }

          if (visibleCount === 0 || labelScratchBox.isEmpty()) continue;

          labelScratchBox.getCenter(labelScratchCenter);
          // Slight anterior/superior bias on large structures so leader dot lands visibly on the organ face
          projected.copy(labelScratchCenter).project(camera);

          inputs.push({
            id: spec.id,
            label: spec.label,
            subtitle: spec.subtitle,
            conceptName: spec.conceptName,
            system: spec.system,
            anchorX: ((projected.x + 1) * cw) / 2,
            anchorY: ((1 - projected.y) * ch) / 2,
            depth: projected.z,
            visible: true,
          });
        }

        const safeRect = {
          left: !isMobile && s.inspectorOpen ? 416 : isMobile ? 10 : 72,
          right: !isMobile && s.layersOpen ? cw - 314 : cw - 10,
          top: isMobile ? 74 : 88,
          bottom: isMobile && s.inspectorOpen ? Math.max(190, ch * 0.45) : isMobile ? ch - 140 : ch - 116,
        };

        const resolved = layoutTourCallouts(inputs, cw, ch, safeRect);

        const svgFrag = document.createDocumentFragment();
        const tagFrag = document.createDocumentFragment();
        const isCompact = cw < 640;
        const boxW = getTourCalloutWidth(cw);

        const haloColor = isXray ? 'rgba(7, 16, 25, 0.92)' : 'rgba(255, 255, 255, 0.92)';
        const lineColor = isXray ? '#38bdf8' : '#0284c7';

        for (let i = 0; i < resolved.length; i++) {
          const item = resolved[i];
          const attachX = item.side === 'left' ? item.boxX + boxW : item.boxX;
          const attachY = item.boxY;
          const elbowX =
            item.side === 'left'
              ? Math.min(item.anchorX, attachX + 14)
              : Math.max(item.anchorX, attachX - 14);
          const pts = `${item.anchorX.toFixed(1)},${item.anchorY.toFixed(1)} ${elbowX.toFixed(1)},${attachY.toFixed(1)} ${attachX.toFixed(1)},${attachY.toFixed(1)}`;

          // Contrast halo stroke underneath so leader line stays crisp on BOTH Solid & X-Ray
          const haloLine = document.createElementNS(svgNS, 'polyline');
          haloLine.setAttribute('points', pts);
          haloLine.setAttribute('fill', 'none');
          haloLine.setAttribute('stroke', haloColor);
          haloLine.setAttribute('stroke-width', '3.6');
          haloLine.setAttribute('stroke-linecap', 'round');
          haloLine.setAttribute('stroke-linejoin', 'round');
          svgFrag.appendChild(haloLine);

          const mainLine = document.createElementNS(svgNS, 'polyline');
          mainLine.setAttribute('points', pts);
          mainLine.setAttribute('fill', 'none');
          mainLine.setAttribute('stroke', lineColor);
          mainLine.setAttribute('stroke-width', '1.6');
          mainLine.setAttribute('stroke-linecap', 'round');
          mainLine.setAttribute('stroke-linejoin', 'round');
          svgFrag.appendChild(mainLine);

          // Target anchor ring + dot directly on the 3D anatomical landmark
          const outerDot = document.createElementNS(svgNS, 'circle');
          outerDot.setAttribute('cx', item.anchorX.toFixed(1));
          outerDot.setAttribute('cy', item.anchorY.toFixed(1));
          outerDot.setAttribute('r', '5');
          outerDot.setAttribute('fill', haloColor);
          outerDot.setAttribute('stroke', lineColor);
          outerDot.setAttribute('stroke-width', '1.6');
          svgFrag.appendChild(outerDot);

          const innerDot = document.createElementNS(svgNS, 'circle');
          innerDot.setAttribute('cx', item.anchorX.toFixed(1));
          innerDot.setAttribute('cy', item.anchorY.toFixed(1));
          innerDot.setAttribute('r', '2.1');
          innerDot.setAttribute('fill', lineColor);
          svgFrag.appendChild(innerDot);

          // High-contrast interactive DOM callout tag (no backdrop-blur over WebGL!)
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.setAttribute('data-tour-label', item.conceptName);
          btn.setAttribute('aria-label', `Inspect ${item.label}`);
          btn.style.position = 'absolute';
          btn.style.left = `${Math.round(item.boxX)}px`;
          btn.style.top = `${Math.round(item.boxY)}px`;
          btn.style.width = `${boxW}px`;
          btn.style.transform = 'translateY(-50%)';
          btn.className = isXray
            ? 'pointer-events-auto flex items-center gap-1.5 px-2 py-1 rounded-lg border text-left transition-colors cursor-pointer bg-[#08131f]/95 border-[#38bdf8]/55 text-[#f0f9ff] hover:border-[#7dd3fc] shadow-[0_4px_16px_rgba(0,0,0,0.55)]'
            : 'pointer-events-auto flex items-center gap-1.5 px-2 py-1 rounded-lg border text-left transition-colors cursor-pointer bg-white/95 border-[#18212b]/18 text-[#111a24] hover:border-[#0284c7] shadow-[0_4px_14px_rgba(15,23,42,0.12)]';

          const swatch = document.createElement('span');
          swatch.className = 'w-2 h-2 rounded-full shrink-0';
          swatch.style.backgroundColor = SYSTEM_BY_ID[item.system]?.color ?? '#0284c7';
          swatch.setAttribute('aria-hidden', 'true');

          const textSpan = document.createElement('span');
          textSpan.className = isCompact
            ? 'text-[11px] font-semibold leading-tight truncate tracking-[0.01em]'
            : 'text-[12px] font-semibold leading-tight truncate tracking-[0.01em]';
          textSpan.textContent = item.label;

          btn.appendChild(swatch);
          btn.appendChild(textSpan);
          btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            callbacksRef.current.onSelectTourLabel?.(item.conceptName);
          });
          tagFrag.appendChild(btn);
        }

        calloutSvg.replaceChildren(svgFrag);
        calloutTagContainer.replaceChildren(tagFrag);
      };

      type FlatTarget = {
        index: number;
        x: number;
        y: number;
        left: number;
        right: number;
        top: number;
        bottom: number;
      };
      let targets: FlatTarget[] = [];

      const findFlatTarget = (x: number, y: number, radius: number) => {
        let best = -1;
        let score = Infinity;
        for (let i = 0; i < targets.length; i++) {
          const t = targets[i];
          const dx = Math.max(t.left - x, 0, x - t.right);
          const dy = Math.max(t.top - y, 0, y - t.bottom);
          const dist = Math.hypot(dx, dy);
          if (dist > radius) continue;
          const candidate = dist + Math.hypot(t.x - x, t.y - y) * 0.025;
          if (candidate < score) {
            score = candidate;
            best = t.index;
          }
        }
        return best;
      };

      const fitCamera = (view: CameraView, extent = 0) => {
        const aspect = Math.max(0.45, camera.aspect);
        const w = Math.max(1, el.clientWidth);
        const h = Math.max(1, el.clientHeight);
        const vFov = THREE.MathUtils.degToRad(camera.fov);
        const target = new THREE.Vector3(0, 0.86, 0);

        let distance = 3.55;
        if (extent > 0.05) {
          const spanY = THREE.MathUtils.lerp(1.85, packingHeight * 1.06, extent);
          const spanX = THREE.MathUtils.lerp(0.85, packingWidth * 1.06, extent);
          const distY = spanY / (2 * Math.tan(vFov / 2));
          const distX = spanX / (2 * Math.tan(vFov / 2) * aspect);
          distance = Math.max(distY, distX) * 1.18;
        } else {
          // Comfortable full-body standing framing for both desktop and portrait mobile
          const bodyHeight = 1.92;
          const bodyWidth = 0.72;
          const distY = bodyHeight / (2 * Math.tan(vFov / 2));
          const distX = bodyWidth / (2 * Math.tan(vFov / 2) * aspect);
          distance = Math.max(distY, distX) * (w < 640 ? 1.24 : 1.14);
        }

        const dir = scratchDir;
        if (view === 'front' || extent > 0.6) dir.set(0, 0.04, 1);
        else if (view === 'back') dir.set(0, 0.04, -1);
        else if (view === 'side') dir.set(1, 0.04, 0.08);
        else dir.set(0.36, 0.06, 0.93);
        dir.normalize();

        // Keep specimen nicely centered between top/bottom chrome
        const verticalShift = w < 640 ? 0.03 : 0.01;
        camera.setViewOffset(w, h, 0, h * verticalShift, w, h);
        controls.target.copy(target);
        camera.position.copy(target).addScaledVector(dir, distance);
        controls.maxDistance = Math.max(38, distance * 2.2);
        controls.update();
        dirty = true;
      };

      const markDirty = () => {
        dirty = true;
      };

      controls.addEventListener('change', markDirty);

      const resize = () => {
        if (disposed) return;
        const w = Math.max(1, el.clientWidth);
        const h = Math.max(1, el.clientHeight);
        const nextBudget = getPerformanceBudget(
          stateRef.current.qualityTier,
          isSoftwareGl,
          window.devicePixelRatio || 1,
          w < 820
        );
        renderer.setPixelRatio(nextBudget.pixelRatio);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.clearViewOffset();
        camera.updateProjectionMatrix();
        lastFocusKey = '';
        lastIsolateKey = '';
        if (!stateRef.current.isolate && !stateRef.current.focusBox) {
          fitCamera(stateRef.current.view, amount);
        }
        markDirty();
      };

      const ro = new ResizeObserver(resize);

      // Pointer / Tap interaction (orbit vs click picking)
      const onPointerDown = (e: PointerEvent) => {
        hoverEl.hidden = true;
        tap.down(e.pointerId, e.clientX, e.clientY, e.pointerType === 'touch' ? 12 : 5);
      };

      const onPointerMove = (e: PointerEvent) => {
        tap.move(e.pointerId, e.clientX, e.clientY);
        if (e.buttons || amount < 0.5 || e.pointerType === 'touch') {
          hoverEl.hidden = true;
          return;
        }
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const idx = findFlatTarget(x, y, 12);
        hoverEl.hidden = idx < 0;
        renderer.domElement.style.cursor = idx < 0 ? 'grab' : 'pointer';
        if (idx >= 0) {
          hoverEl.textContent = atlas.parts[idx].name;
          hoverEl.style.left = `${Math.max(8, Math.min(x + 14, el.clientWidth - 250))}px`;
          hoverEl.style.top = `${Math.max(8, Math.min(y + 18, el.clientHeight - 48))}px`;
        }
      };

      const onPointerCancel = (e: PointerEvent) => tap.cancel(e.pointerId);

      const onPointerUp = (e: PointerEvent) => {
        const isTap = tap.up(e.pointerId, e.clientX, e.clientY);
        if (!isTap || !ready) return;

        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(pointer, camera);

        let nearest = Infinity;
        let found = -1;
        const hasSolid = atlas.parts.some(
          (p, i) => p.system !== 'integumentary' && partData[i * 4 + 3] > 0.5
        );

        const activeCut = stateRef.current.sectionCut;
        for (let i = 0; i < pickers.length; i++) {
          const mesh = pickers[i];
          if (!mesh || partData[i * 4 + 3] < 0.5) continue;
          if (hasSolid && atlas.parts[i].system === 'integumentary') continue;
          worldBox.copy(bounds[i]).translate(mesh.position);
          if (!raycaster.ray.intersectBox(worldBox, hitPoint)) continue;
          const hits = raycaster.intersectObject(mesh, false);
          for (let h = 0; h < hits.length; h++) {
            const pt = hits[h].point;
            if (isPointClipped(pt.x, pt.y, pt.z, activeCut)) continue;
            if (hits[h].distance < nearest) {
              nearest = hits[h].distance;
              found = i;
            }
            break;
          }
        }

        if (found < 0 && amount > 0.45) {
          found = findFlatTarget(
            e.clientX - rect.left,
            e.clientY - rect.top,
            e.pointerType === 'touch' ? 24 : 16
          );
        }

        if (found >= 0) {
          hoverEl.hidden = true;
          if (stateRef.current.peelMode || e.shiftKey) {
            callbacksRef.current.onQuickHidePart(atlas.parts[found].id);
          } else {
            callbacksRef.current.onSelectPart(atlas.parts[found].id);
          }
        }
      };

      const onContextLost = (e: Event) => {
        e.preventDefault();
        callbacksRef.current.onError(
          'Your device paused the WebGL session. Reload or switch to Eco GPU mode to resume.'
        );
      };

      const dom = renderer.domElement;
      dom.addEventListener('pointerdown', onPointerDown);
      dom.addEventListener('pointermove', onPointerMove);
      dom.addEventListener('pointerup', onPointerUp);
      dom.addEventListener('pointercancel', onPointerCancel);
      dom.addEventListener('webglcontextlost', onContextLost);

      // Stream & batch all 15 compressed binary chunks with concurrency 3
      let loadedChunks = 0;
      const loadChunk = async (ci: number) => {
        const chunk = atlas.chunks[ci];
        const useGzip = Boolean(chunk.gzip) && typeof DecompressionStream !== 'undefined';
        const chunkUrl = resolveAssetUrl(
          useGzip ? chunk.gzip! : chunk.url,
          import.meta.env.BASE_URL
        );
        const res = await fetch(chunkUrl, { signal: abort.signal });
        const buffer = await decodeModelResponse(res, chunk.bytes, useGzip);
        if (disposed) return;

        const groups = new Map<SystemId, THREE.BufferGeometry[]>();
        for (let i = 0; i < atlas.parts.length; i++) {
          const p = atlas.parts[i];
          if (p.chunk !== ci) continue;

          const g = new THREE.BufferGeometry();
          g.setAttribute(
            'position',
            new THREE.BufferAttribute(new Float32Array(buffer, p.positions, p.vertexCount * 3), 3)
          );
          g.setAttribute(
            'normal',
            new THREE.BufferAttribute(
              new Int16Array(buffer, p.normals, p.vertexCount * 3),
              3,
              true
            )
          );
          g.setIndex(
            new THREE.BufferAttribute(new Uint32Array(buffer, p.indices, p.indexCount), 1)
          );
          g.boundingBox = bounds[i].clone();
          g.computeBoundingSphere();

          const picker = new THREE.Mesh(g);
          picker.matrixAutoUpdate = false;
          pickers[i] = picker;
          geometries.push(g);

          g.setAttribute(
            'partIndex',
            new THREE.BufferAttribute(new Float32Array(p.vertexCount).fill(i), 1)
          );
          const list = groups.get(p.system) ?? [];
          list.push(g);
          groups.set(p.system, list);
        }

        const currentShader = stateRef.current.shaderMode;
        groups.forEach((gs, sys) => {
          const merged = mergeGeometries(gs, false);
          if (!merged) return;
          geometries.push(merged);
          const mat =
            currentShader === 'xray' ? xrayMaterials.get(sys)! : solidMaterials.get(sys)!;
          const mesh = new THREE.Mesh(merged, mat);
          mesh.frustumCulled = false;
          anatomyRoot.add(mesh);
          batchedMeshes.push({ mesh, system: sys });
        });

        lastStateRef = null;
        loadedChunks++;
        callbacksRef.current.onProgress(Math.round((loadedChunks / atlas.chunks.length) * 100));
        markDirty();
      };

      (async () => {
        try {
          let cursor = 0;
          await Promise.all(
            Array.from({ length: 3 }, async () => {
              while (cursor < atlas.chunks.length) {
                const idx = cursor++;
                await loadChunk(idx);
              }
            })
          );
          if (!disposed) {
            ready = true;
            markDirty();
          }
        } catch (err) {
          if (!disposed && !(err instanceof DOMException && err.name === 'AbortError')) {
            callbacksRef.current.onError(
              err instanceof Error ? err.message : 'Unable to load full-body anatomy chunks.'
            );
          }
        }
      })();

      let lastTime = performance.now();
      let lastExtent = -1;

      function animate(now: number) {
        if (disposed || !el) return;
        if (!renderer.xr.isPresenting) {
          rafId = requestAnimationFrame(animate);
        }

        const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;
        const s = stateRef.current;

        if (s.qualityTier !== lastQuality) {
          lastQuality = s.qualityTier;
          resize();
        }

        // Shader mode update (instant swap across all batched meshes!)
        if (s.shaderMode !== lastShaderMode) {
          lastShaderMode = s.shaderMode;
          const isXray = s.shaderMode === 'xray';
          renderer.setClearColor(isXray ? '#071019' : '#ecefed');
          for (let i = 0; i < batchedMeshes.length; i++) {
            const bm = batchedMeshes[i];
            bm.mesh.material = isXray
              ? xrayMaterials.get(bm.system)!
              : solidMaterials.get(bm.system)!;
          }
          dirty = true;
        }

        if (s.exposure !== lastExposure) {
          lastExposure = s.exposure;
          renderer.toneMappingExposure = s.exposure * 0.96;
          xrayMaterials.forEach((m) => {
            m.uniforms.uExposure.value = s.exposure;
          });
          dirty = true;
        }

        if (s.peelMode !== lastPeelMode) {
          lastPeelMode = s.peelMode;
          renderer.domElement.style.cursor = s.peelMode ? 'crosshair' : 'grab';
        }

        // Update GPU Section Cut uniforms & 3D anatomical plane wireframe
        const cutAxisNum =
          s.sectionCut.axis === 'x' ? 1 : s.sectionCut.axis === 'y' ? 2 : s.sectionCut.axis === 'z' ? 3 : 0;
        const cutCoord = getSectionPlaneWorldCoord(s.sectionCut.axis, s.sectionCut.position);
        const cutFlipVal = s.sectionCut.flip ? -1 : 1;
        if (
          cutAxisNum !== lastCutAxisNum ||
          cutCoord !== lastCutCoord ||
          cutFlipVal !== lastCutFlipVal
        ) {
          lastCutAxisNum = cutAxisNum;
          lastCutCoord = cutCoord;
          lastCutFlipVal = cutFlipVal;
          sharedClipUniforms.uClipAxis.value = cutAxisNum;
          sharedClipUniforms.uClipPos.value = cutCoord;
          sharedClipUniforms.uClipFlip.value = cutFlipVal;
          sectionPlaneMesh.visible = cutAxisNum > 0;
          if (cutAxisNum === 1) {
            sectionPlaneMesh.rotation.set(0, Math.PI / 2, 0);
            sectionPlaneMesh.scale.set(0.62, 1.9, 1);
            sectionPlaneMesh.position.set(cutCoord, 0.9, 0);
          } else if (cutAxisNum === 2) {
            sectionPlaneMesh.rotation.set(-Math.PI / 2, 0, 0);
            sectionPlaneMesh.scale.set(0.95, 0.58, 1);
            sectionPlaneMesh.position.set(0, cutCoord, 0);
          } else if (cutAxisNum === 3) {
            sectionPlaneMesh.rotation.set(0, 0, 0);
            sectionPlaneMesh.scale.set(0.95, 1.9, 1);
            sectionPlaneMesh.position.set(0, 0.9, cutCoord);
          }
          dirty = true;
        }

        // Update procedural GPU physiological motion (Cardio 72 BPM / Lungs 14/min)
        const motionActive = s.motion !== 'none' && amount < 0.05;
        if (motionActive) {
          const sec = now * 0.001;
          const cardiacBeat =
            s.motion === 'cardiac'
              ? (Math.pow(Math.max(0, Math.sin(sec * Math.PI * 1.2)), 6) * 0.045 +
                Math.pow(Math.max(0, Math.sin(sec * Math.PI * 1.2 - 0.55)), 8) * 0.022)
              : 0;
          const breathWave =
            s.motion === 'respiratory' ? (Math.sin(sec * 1.45) * 0.5 + 0.5) * 0.036 : 0;

          pulseUniformsBySystem.forEach((u, sysId) => {
            if (sysId === 'cardiac') {
              u.uPulseScale.value = cardiacBeat;
            } else if (sysId === 'respiratory') {
              u.uPulseScale.value = breathWave;
            } else {
              u.uPulseScale.value = 0;
            }
          });
          dirty = true;
        } else if (
          (pulseUniformsBySystem.get('cardiac')?.uPulseScale.value ?? 0) !== 0 ||
          (pulseUniformsBySystem.get('respiratory')?.uPulseScale.value ?? 0) !== 0
        ) {
          pulseUniformsBySystem.forEach((u) => {
            u.uPulseScale.value = 0;
          });
          dirty = true;
        }

        const stateChanged =
          lastStateRef?.visibleSystems !== s.visibleSystems ||
          lastStateRef?.selectedPartIds !== s.selectedPartIds ||
          lastStateRef?.hiddenPartIds !== s.hiddenPartIds ||
          lastStateRef?.isolate !== s.isolate;

        const movingExplode = Math.abs(amount - s.explode) > 0.0006;
        if (movingExplode) {
          amount = THREE.MathUtils.damp(amount, s.explode, 8, dt);
          if (Math.abs(amount - s.explode) <= 0.0006) amount = s.explode;
          dirty = true;
        }

        if (stateChanged || movingExplode || lastExtent < 0) {
          const visibleSet = new Set(s.visibleSystems);
          const selectedSet = new Set(s.selectedPartIds);
          const hiddenSet = new Set(s.hiddenPartIds);

          const visibleParts = atlas.parts.filter((p) =>
            isPartVisible(p, visibleSet, selectedSet, hiddenSet, s.isolate)
          );

          const nextLayoutKey =
            `${visibleParts.length}:${s.visibleSystems.join(',')}:${s.hiddenPartIds.length}:${s.isolate}:${camera.aspect.toFixed(2)}`;
          if (nextLayoutKey !== layoutKey) {
            const layout = createExplosionLayout(visibleParts, camera.aspect);
            packingWidth = layout.width;
            packingHeight = layout.height;
            for (let i = 0; i < atlas.parts.length; i++) {
              const p = atlas.parts[i];
              const cell = layout.cells.get(p.id);
              if (cell) {
                offsets[i].set(cell.x, cell.y + 0.85, 0);
              } else {
                offsets[i].copy(centers[i]);
              }
            }
            layoutKey = nextLayoutKey;
            if (amount > 0.05 && !s.isolate) {
              fitCamera(s.view, Math.max(0, (amount - 0.3) / 0.7));
            }
          }

          const activeSystems = new Set<SystemId>();
          for (let i = 0; i < atlas.parts.length; i++) {
            const p = atlas.parts[i];
            const c = centers[i];
            const dest = offsets[i];
            let dx = 0;
            let dy = 0;
            let dz = 0;

            if (amount > 0.0001) {
              const groupIdx = SYSTEMS.findIndex((sys) => sys.id === p.system);
              const angle = (groupIdx / SYSTEMS.length) * Math.PI * 2;
              if (amount <= 0.45) {
                const t = amount / 0.45;
                dx = Math.sin(angle) * t * 0.48;
                dy = (c.y - 0.85) * t * 0.28;
                dz = Math.cos(angle) * t * 0.48;
              } else {
                const t = (amount - 0.45) / 0.55;
                dx = THREE.MathUtils.lerp(Math.sin(angle) * 0.48, dest.x - c.x, t);
                dy = THREE.MathUtils.lerp((c.y - 0.85) * 0.28, dest.y - c.y, t);
                dz = THREE.MathUtils.lerp(Math.cos(angle) * 0.48, -c.z, t);
              }
            }

            const isVis = isPartVisible(p, visibleSet, selectedSet, hiddenSet, s.isolate);
            const isSel = selectedSet.has(p.id) && isVis;
            if (isVis) activeSystems.add(p.system);

            partData[i * 4] = dx;
            partData[i * 4 + 1] = dy;
            partData[i * 4 + 2] = dz;
            partData[i * 4 + 3] = isVis ? 1 : 0;
            selectedData[i * 4] = isSel ? 255 : 0;

            if (isVis) {
              markerPositions[i * 3] = c.x + dx;
              markerPositions[i * 3 + 1] = c.y + dy;
              markerPositions[i * 3 + 2] = c.z + dz;
            } else {
              markerPositions[i * 3] = 10000;
              markerPositions[i * 3 + 1] = 10000;
              markerPositions[i * 3 + 2] = 10000;
            }

            const picker = pickers[i];
            if (picker) {
              picker.position.set(dx, dy, dz);
              picker.updateMatrix();
              picker.updateMatrixWorld(true);
            }
          }

          // Skip draw calls completely for systems with zero visible parts (huge mobile/WebGL boost)
          for (let i = 0; i < batchedMeshes.length; i++) {
            const bm = batchedMeshes[i];
            bm.mesh.visible = activeSystems.has(bm.system);
          }

          partTexture.needsUpdate = true;
          selectionTexture.needsUpdate = true;
          markerGeometry.attributes.position.needsUpdate = true;
          lastStateRef = s;
          lastExtent = amount;
          dirty = true;
        }

        // Handle camera view preset or reset
        if (s.view !== lastView || s.resetToken !== lastReset) {
          fitCamera(s.view, amount);
          lastView = s.view;
          lastReset = s.resetToken;
        }
        if (movingExplode && !s.isolate) {
          fitCamera(amount > 0.5 ? 'front' : s.view, Math.max(0, (amount - 0.3) / 0.7));
        }

        // Handle specialty regional focus (Cardio, Lungs, Dental) centered clear of RIGHT drawer or MOBILE sheet
        const focusKey = s.focusBox
          ? `${s.focusBox.token}:${s.inspectorOpen}:${s.layersOpen}:${camera.aspect.toFixed(2)}`
          : '';
        if (s.focusBox && focusKey !== lastFocusKey && !s.isolate) {
          lastFocusKey = focusKey;
          const w = Math.max(1, el.clientWidth);
          const h = Math.max(1, el.clientHeight);
          const mobile = w < 1024;
          if (!mobile && s.layersOpen) {
            const leftEdge = s.inspectorOpen ? 360 : 68;
            const rightEdge = w - 310;
            camera.setViewOffset(w, h, w / 2 - (leftEdge + rightEdge) / 2, 0, w, h);
          } else if (mobile && s.inspectorOpen) {
            const top = 66;
            const bottom = h * 0.50;
            camera.setViewOffset(w, h, 0, h / 2 - (top + bottom) / 2, w, h);
          } else if (mobile) {
            const top = 64;
            const bottom = h - 132;
            camera.setViewOffset(w, h, 0, h / 2 - (top + bottom) / 2, w, h);
          } else {
            camera.clearViewOffset();
          }
          const aspectScale = camera.aspect < 1 ? Math.min(1.85, 1.08 / Math.max(0.45, camera.aspect)) : 1;
          controls.target.set(...s.focusBox.center);
          scratchDir.set(0.24, 0.08, 0.96).normalize();
          camera.position
            .copy(controls.target)
            .addScaledVector(scratchDir, s.focusBox.distance * aspectScale);
          controls.update();
          dirty = true;
        }

        // Handle isolated structure framing (centers specimen in open canvas clear of right drawer & mobile/left card)
        const isolateKey = s.isolate
          ? `${s.selectedPartIds.join(',')}:${s.resetToken}:${s.inspectorOpen}:${s.layersOpen}:${camera.aspect.toFixed(2)}`
          : '';
        if (isolateKey !== lastIsolateKey || (s.isolate && movingExplode)) {
          if (s.isolate && s.selectedPartIds.length > 0) {
            scratchBox.makeEmpty();
            const selSet = new Set(s.selectedPartIds);
            const hidSet = new Set(s.hiddenPartIds);
            for (let i = 0; i < atlas.parts.length; i++) {
              const p = atlas.parts[i];
              if (selSet.has(p.id) && !hidSet.has(p.id)) {
                scratchOffset.set(partData[i * 4], partData[i * 4 + 1], partData[i * 4 + 2]);
                worldBox.copy(bounds[i]).translate(scratchOffset);
                scratchBox.union(worldBox);
              }
            }
            if (!scratchBox.isEmpty()) {
              scratchBox.getCenter(scratchCenter);
              scratchBox.getSize(scratchSize);
              const w = Math.max(1, el.clientWidth);
              const h = Math.max(1, el.clientHeight);
              const mobile = w < 1024;
              const left = !mobile && s.inspectorOpen ? 360 : mobile ? 20 : 68;
              const right = !mobile && s.layersOpen ? w - 308 : w - 20;
              const top = 72;
              const bottom = mobile && s.inspectorOpen ? h * 0.44 : mobile ? h - 152 : h - 116;
              const availW = Math.max(160, right - left);
              const availH = Math.max(120, bottom - top);

              camera.setViewOffset(
                w,
                h,
                w / 2 - (left + right) / 2,
                h / 2 - (top + bottom) / 2,
                w,
                h
              );
              const dist = Math.max(
                0.1,
                (Math.max(
                  (scratchSize.y * h) / availH,
                  ((scratchSize.x * w) / availW) / Math.max(0.5, camera.aspect),
                  scratchSize.z
                ) /
                  (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) *
                1.4
              );
              controls.target.copy(scratchCenter);
              camera.position
                .copy(scratchCenter)
                .add(scratchDir.set(0.22, 0.1, 0.97).normalize().multiplyScalar(dist));
              controls.update();
              dirty = true;
            }
          } else if (lastIsolateKey) {
            camera.clearViewOffset();
            fitCamera(s.view, amount);
          }
          lastIsolateKey = isolateKey;
        }

        // Interaction modes & visibility of gallery stage
        controls.enableRotate = amount < 0.8;
        controls.mouseButtons.LEFT = amount < 0.8 ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
        controls.touches.ONE = amount < 0.8 ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN;
        stageGroup.visible = s.shaderMode === 'solid' && amount < 0.45 && !s.isolate;
        markers.visible = amount > 0.72;
        controls.autoRotate = s.rotate && !s.isolate && amount < 0.4;
        controls.autoRotateSpeed = 0.7;

        const controlsMoved = controls.update();
        if (controlsMoved || controls.autoRotate) dirty = true;

        if (dirty) {
          renderer.render(scene, camera);

          // Update flat-inventory hit targets when exploded > 45%
          targets = [];
          if (amount > 0.45) {
            const hasSolid = atlas.parts.some(
              (p, i) => p.system !== 'integumentary' && partData[i * 4 + 3] > 0.5
            );
            const cw = el.clientWidth;
            const ch = el.clientHeight;
            for (let i = 0; i < atlas.parts.length; i++) {
              const p = atlas.parts[i];
              if (partData[i * 4 + 3] < 0.5 || (hasSolid && p.system === 'integumentary')) {
                continue;
              }
              const ox = partData[i * 4];
              const oy = partData[i * 4 + 1];
              const oz = partData[i * 4 + 2];
              projected.set(centers[i].x + ox, centers[i].y + oy, centers[i].z + oz).project(camera);
              if (projected.z < -1 || projected.z > 1) continue;
              const cx = ((projected.x + 1) * cw) / 2;
              const cy = ((1 - projected.y) * ch) / 2;

              let left = cx - 8;
              let right = cx + 8;
              let top = cy - 8;
              let bottom = cy + 8;
              for (let c = 0; c < 8; c++) {
                projected
                  .set(
                    p.bounds[c & 1 ? 1 : 0][0] + ox,
                    p.bounds[c & 2 ? 1 : 0][1] + oy,
                    p.bounds[c & 4 ? 1 : 0][2] + oz
                  )
                  .project(camera);
                const sx = ((projected.x + 1) * cw) / 2;
                const sy = ((1 - projected.y) * ch) / 2;
                if (sx < left) left = sx;
                if (sx > right) right = sx;
                if (sy < top) top = sy;
                if (sy > bottom) bottom = sy;
              }
              targets.push({ index: i, x: cx, y: cy, left, right, top, bottom });
            }
          }
          if (renderer.xr.isPresenting) {
            if (s.showTourLabels && s.tourLabels.length > 0) {
              vrLabelGroup.visible = true;
              rebuildVrLabels(s.tourLabels, s.shaderMode === 'xray');
            } else {
              vrLabelGroup.visible = false;
            }
          } else {
            vrLabelGroup.visible = false;
            renderTourCalloutOverlay(s);
          }
          dirty = false;
        }
      }

      // Quest 2 WebXR immersive-vr loop (stereo tracked rendering + Touch thumbstick manipulation)
      const xrTick = (now: number) => {
        if (disposed || !renderer.xr.isPresenting) return;
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        const session = renderer.xr.getSession();
        if (session) {
          for (const source of session.inputSources) {
            const gp = source.gamepad;
            if (!gp || gp.axes.length < 4) continue;
            const axisX = gp.axes[2] ?? 0;
            const axisY = gp.axes[3] ?? 0;
            if (source.handedness === 'right' && Math.abs(axisX) > 0.14) {
              anatomyRoot.rotation.y += axisX * dt * 1.65;
            }
            if (source.handedness === 'left' && Math.abs(axisY) > 0.14) {
              anatomyRoot.position.y = THREE.MathUtils.clamp(
                anatomyRoot.position.y - axisY * dt * 0.75,
                -0.8,
                1.2
              );
            }
          }
        }
        dirty = true;
        animate(now);
      };

      const onXrSessionEnd = () => {
        activeXrSession = null;
        renderer.setAnimationLoop(null);
        xrRigGroup.visible = false;
        vrLabelGroup.visible = false;
        clearVrLabels();
        anatomyRoot.position.set(0, 0, 0);
        anatomyRoot.rotation.set(0, 0, 0);
        anatomyRoot.scale.setScalar(1);
        controls.enabled = true;
        if (savedCamPos && savedCtrlTarget) {
          camera.position.copy(savedCamPos);
          controls.target.copy(savedCtrlTarget);
          controls.update();
        }
        callbacksRef.current.onVrSessionChange?.(false);
        markDirty();
        if (!disposed && !rafId) {
          rafId = requestAnimationFrame(animate);
        }
      };

      const enterVr = async (): Promise<{ ok: boolean; message?: string }> => {
        if (disposed) return { ok: false, message: 'Viewport unavailable.' };
        if (activeXrSession) return { ok: true };

        if (!window.isSecureContext) {
          return {
            ok: false,
            message: 'WebXR requires HTTPS. Open the deployed HTTPS link on your Meta Quest 2 Browser.',
          };
        }

        const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
        if (!xr) {
          return {
            ok: false,
            message: 'No WebXR headset detected. Open this page in Meta Quest 2 Browser to enter 1:1 VR.',
          };
        }

        try {
          const supported = await xr.isSessionSupported('immersive-vr');
          if (!supported) {
            return {
              ok: false,
              message: 'This browser does not have an active VR headset connected. Open on Meta Quest 2 Browser.',
            };
          }

          const session = await xr.requestSession('immersive-vr', {
            optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
          });
          activeXrSession = session;
          session.addEventListener('end', onXrSessionEnd, { once: true });

          // Cancel desktop RAF loop before handing control to WebXR stereo loop
          if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = 0;
          }

          savedCamPos = camera.position.clone();
          savedCtrlTarget = controls.target.clone();
          controls.enabled = false;
          camera.clearViewOffset();
          calloutSvg.replaceChildren();
          calloutTagContainer.replaceChildren();

          // Map the 1:1 metric human model right in front of the Quest 2 floor origin
          const s = stateRef.current;
          let targetCenter: [number, number, number] | null = null;
          let targetExtent: number | undefined;
          if (s.isolate && s.selectedPartIds.length > 0) {
            scratchBox.makeEmpty();
            for (const pid of s.selectedPartIds) {
              const pIdx = partIndexById.get(pid);
              if (pIdx !== undefined) scratchBox.union(bounds[pIdx]);
            }
            if (!scratchBox.isEmpty()) {
              scratchBox.getCenter(scratchCenter);
              scratchBox.getSize(scratchSize);
              targetCenter = [scratchCenter.x, scratchCenter.y, scratchCenter.z];
              targetExtent = Math.max(scratchSize.x, scratchSize.y, scratchSize.z);
            }
          }
          const rig = getXrRigTransform(s.isolate, targetCenter, targetExtent);
          anatomyRoot.position.set(...rig.position);
          anatomyRoot.rotation.set(0, rig.rotationY, 0);
          anatomyRoot.scale.setScalar(rig.scale);
          xrRigGroup.visible = true;

          await renderer.xr.setSession(session);
          callbacksRef.current.onVrSessionChange?.(true);
          renderer.setAnimationLoop(xrTick);
          return { ok: true };
        } catch (err) {
          return {
            ok: false,
            message:
              err instanceof Error
                ? `Unable to start WebXR VR session: ${err.message}`
                : 'Unable to initialize WebXR VR session.',
          };
        }
      };

      const exitVr = async (): Promise<void> => {
        if (activeXrSession) {
          try {
            await activeXrSession.end();
          } catch {
            onXrSessionEnd();
          }
        }
      };

      controllerRef.current = {
        markDirty,
        enterVr,
        exitVr,
        captureSnapshot: () => {
          try {
            renderer.render(scene, camera);
            return renderer.domElement.toDataURL('image/png');
          } catch {
            return null;
          }
        },
      };

      ro.observe(el);
      resize();
      markDirty();
      rafId = requestAnimationFrame(animate);

      return () => {
        disposed = true;
        controllerRef.current = null;
        abort.abort();
        if (activeXrSession) {
          activeXrSession.end().catch(() => { });
          activeXrSession = null;
        }
        renderer.setAnimationLoop(null);
        if (rafId) cancelAnimationFrame(rafId);
        ro.disconnect();
        controls.removeEventListener('change', markDirty);
        controls.dispose();
        dom.removeEventListener('pointerdown', onPointerDown);
        dom.removeEventListener('pointermove', onPointerMove);
        dom.removeEventListener('pointerup', onPointerUp);
        dom.removeEventListener('pointercancel', onPointerCancel);
        dom.removeEventListener('webglcontextlost', onContextLost);
        xrControllers[0].removeEventListener('selectstart', onXrSelect0);
        xrControllers[1].removeEventListener('selectstart', onXrSelect1);

        clearVrLabels();
        xrLaserGeo.dispose();
        xrLaserMat.dispose();
        xrTipGeo.dispose();
        xrTipMat.dispose();
        geometries.forEach((g) => g.dispose());
        solidMaterials.forEach((m) => m.dispose());
        xrayMaterials.forEach((m) => m.dispose());
        sectionPlaneGeo.dispose();
        sectionPlaneMat.dispose();
        sectionEdgeGeo.dispose();
        sectionEdgeMat.dispose();
        ground.geometry.dispose();
        groundMat.dispose();
        platform.geometry.dispose();
        platformMat.dispose();
        ring.geometry.dispose();
        ringMat.dispose();
        envRT.dispose();
        partTexture.dispose();
        selectionTexture.dispose();
        markerGeometry.dispose();
        markerMaterial.dispose();
        hoverEl.remove();
        calloutLayer.remove();
        renderer.dispose();
      };
    }, [atlas]);

    return (
      <div
        ref={mountRef}
        className="relative w-full h-full overflow-hidden select-none"
      />
    );
  }
);

export { SYSTEM_BY_ID };
