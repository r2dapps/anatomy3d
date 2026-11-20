# Human Anatomy 3D — Full-Body WebGL Explorer & Live X-Ray Mirror

Live Web Application: [https://r2dapps.github.io/anatomy3d/](https://r2dapps.github.io/anatomy3d/)

Human Anatomy 3D is a high-performance, browser-based full-body anatomical learning and mixed-reality platform spanning 2,234 adult structures across 15 organ systems. It is engineered with GPU-batched Solid PBR and Radiographic X-Ray WebGL shaders, real-time planar section cuts, one-click peel dissection, specialized clinical study labs (including dental and cardiopulmonary curricula), and an on-device Live X-Ray Mirror powered by MediaPipe vision tracking.

[![Three.js WebGL2](https://img.shields.io/badge/Three.js-WebGL2-0284c7?style=flat-square&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![React 19](https://img.shields.io/badge/React-19-18212b?style=flat-square&logo=react&logoColor=38bdf8)](https://react.dev/)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict-18212b?style=flat-square&logo=typescript&logoColor=38bdf8)](https://www.typescriptlang.org/)
[![MediaPipe Vision](https://img.shields.io/badge/MediaPipe-Vision_0.10-0284c7?style=flat-square)](https://developers.google.com/mediapipe)
[![Dataset BodyParts3D](https://img.shields.io/badge/Dataset-BodyParts3D_4.0_(CC_BY_4.0)-0f766e?style=flat-square)](https://lifesciencedb.jp/bp3d/)
[![Cross-Device Ready](https://img.shields.io/badge/Platform-Mobile_%7C_Desktop_%7C_WebXR-1e293b?style=flat-square)](https://r2dapps.github.io/anatomy3d/)

---

## Core Capabilities

### 1. Full-Body 3D Reference Dataset
- Comprehensive adult reference anatomy containing **2,234 meshes** mapped to **3,432 searchable FMA concepts** across **15 anatomical systems**.
- Systems include Skeletal, Muscular, Nervous, Cardiovascular, Respiratory, Digestive, Urinary, Endocrine, Lymphatic, Reproductive, and Sensory.
- Instant Spotlight Search (`/`) supporting common names, Latin anatomical taxonomy, and clinical synonyms.

### 2. Dual-Shader Engine: Solid PBR & Radiographic X-Ray
- **Solid PBR Mode**: Calibrated studio environment, soft directional lights, and realistic physical material shading for surface anatomy and topological context.
- **Radiographic X-Ray Mode**: Depth-independent Fresnel transmission shader simulating clinical fluoroscopy and volumetric radiographic penetration.
- Instant zero-hitch toggle (`X`) with no shader recompilation or pipeline stalls.

### 3. Live X-Ray AR Mirror & Mixed Reality
- Front-facing and rear camera support with automated mirroring detection (`facingMode` telemetry).
- **On-Device Machine Learning**: Zero video frames or sensor data leave the client. Powered by MediaPipe Face, Pose, and Hand Landmark models running via WebAssembly and WebGL GPU delegates.
- **Volumetric 3D Anatomical Anatomy Overlay**:
  - Head & Neurocranium: Dynamic TMJ jaw opening synced to user mandible motion.
  - Thoracic Cavity: Complete 3D rib cage and sternum with costal cartilages.
  - Vertebral Spine: Segmented T1-L5 vertebral column with spinous and transverse processes.
  - Cardiopulmonary Organs: Pulsing 3D heart with aortic arch and dual lungs with respiratory rhythm.
  - Pelvic Girdle: Anatomical sacrum and iliac wings anchored to hip joints.
  - Limb Long Bones: Articulated humerus, radius/ulna, femur, and tibia.
  - Hand Skeleton: Full 3D carpal, metacarpal, and phalangeal bones with corrected bilateral handedness.
- Floating translucent glass controls, adjustable X-Ray brightness, explode slider, and interactive fingertip lens mode.

### 4. Real-Time Planar Section Cuts (Sagittal, Axial, Coronal)
- GPU fragment-level clipping along **Sagittal (X)**, **Axial (Y)**, and **Coronal (Z)** planes.
- Section edge glow highlighting internal cross-sections.
- Inverted cut orientation toggle and clipped raycasting so interior organs can be inspected and selected directly.

### 5. Rapid Peel Dissection Workflow
- **Peel Mode (`P`)**: Click or tap any structure to immediately peel it away.
- Shortcut-driven workflow: `H` to hide selected part, `U` to undo the last hide, and one-click **Unhide All** to restore the full model.

### 6. Interactive Clinical Study Labs
- Specialized clinical focus tracks: **Cardiology**, **Pulmonology**, **Dentistry**, **Orthopedics**, **Physiotherapy**, and **General Surgery**.
- **Dental Student Curriculum**: In-depth maxillary and mandibular tooth numbering, enamel, dentin, pulp cavity, periodontal ligament, alveolar bone, and TMJ biomechanics.
- **Physiological Simulations**: Synchronized 72 BPM cardiac ventricle contraction and pulmonary tidal breathing animations.
- **3D Identification Quizzes**: Interactive quizzes where students identify structures directly on the 3D model or from multiple-choice options with real-time scoring and streak tracking.

### 7. WebXR & Spatial Computing
- 1:1 real-world metric scaling (~1.72 m standing adult reference) anchored to the WebXR `local-floor` coordinate space.
- Ready for standalone VR/MR headsets such as Meta Quest 2 and Quest 3.

---

## WebGL Performance Architecture

Engineered to deliver solid 60 FPS performance across mobile devices, low-power laptops, and desktop workstations:

- **GPU Batching**: Meshes are consolidated per anatomical system, keeping the total WebGL draw-call footprint minimal.
- **DataTexture State Synchronization**: Part visibility, selection highlights, and explosion displacement offsets are updated via compact `RGBAFloat` textures without geometry re-allocations.
- **Zero-Allocation Render Loops**: Math operations in high-frequency animation loops use pre-allocated scratch vectors, quaternions, and matrices, preventing JavaScript garbage collection pauses.
- **Decoupled Neural Inference**: In Live X-Ray mode, heavy vision detection runs at a throttled 30 Hz pace matching video capture, while Three.js WebGL interpolation and rendering run smoothly at 60 FPS.
- **Zero Layout Thrashing**: Container dimensions and viewport aspect ratios are observed via `ResizeObserver` and window events rather than querying DOM layout properties inside animation frames.
- **Adaptive Performance Budgets**: Automatically caps device pixel ratios (`1.0` on mobile/tablet, `1.5-1.75` on desktop) and selects appropriate antialiasing settings.

---

## Keyboard Controls & Shortcuts

| Shortcut | Description |
| :---: | :--- |
| `/` | Open anatomical search spotlight |
| `X` | Toggle Solid PBR / Radiographic X-Ray mode |
| `P` | Toggle Peel Dissection mode (or hold `Shift + Click`) |
| `H` | Hide currently selected structure |
| `U` | Undo last hidden structure |
| `L` | Toggle right-hand Systems & Study Focus drawer |
| `R` | Reset camera view, section cuts, and explode offsets |
| `Esc` | Clear selection, dismiss dialogs, or exit Peel mode |

---

## Local Development

### Prerequisites
- **Node.js 20+** and **npm**

### Getting Started
```bash
# Clone the repository
git clone https://github.com/r2dapps/anatomy3d.git
cd anatomy3d

# Install dependencies (respecting legacy peer dependencies)
npm install --legacy-peer-deps

# Start the Vite development server
npm run dev
```

Visit `http://localhost:3000` in any modern browser supporting WebGL2.

### Quality Assurance & Validation
```bash
# Run unit tests (logic, section cuts, search, quiz engine)
npx tsx --test src/utils/fullBodyLogic.test.ts src/utils/anatomyLogic.test.ts src/utils/xrAndLabelsLogic.test.ts

# Run strict TypeScript lint check
npm run lint

# Production build
npm run build
```

---

## Repository Structure

```text
├── public/
│   ├── favicon.svg              # Geometric anatomical cross-section favicon
│   ├── og-card.svg              # OpenGraph / Twitter social card preview
│   ├── site.webmanifest         # Web Application Manifest
│   └── models/                  # BodyParts3D binary chunks and manifest
├── src/
│   ├── App.tsx                  # Main clinical studio layout & mode orchestration
│   ├── components/
│   │   ├── FullBodyViewport.tsx # GPU-batched Three.js engine (PBR, X-Ray, Cuts, Motion)
│   │   ├── XRayMirrorView.tsx   # On-device MediaPipe AR live mirror mode
│   │   ├── StudyLabPanel.tsx    # Guided clinical tours and 3D identification quizzes
│   │   ├── LayersDrawer.tsx     # Systems toggle, hidden parts manager, clinical tracks
│   │   ├── StructureSheet.tsx   # Contextual anatomical structure inspector
│   │   ├── SearchPopover.tsx    # 3,432-concept anatomical search spotlight
│   │   └── SplashScreen.tsx     # Loading and preparation overlay
│   ├── data/
│   │   ├── fullBodyAnatomy.ts   # 15 organ systems, clinical tracks, and notes
│   │   ├── anatomyCatalog.ts   # Head and hand catalog mappings
│   │   └── studyCurriculum.ts   # Specialty tours and clinical quiz questions
│   └── utils/
│       ├── fullBodyLogic.ts     # Pure math: section cuts, layout packing, search, quiz
│       ├── xrAndLabelsLogic.ts  # WebXR rig placement, callout anti-collision layout
│       └── anatomyLogic.ts      # Coordinate unpacking and catalog indexing
└── index.html                   # SEO metadata, OpenGraph, Twitter cards & JSON-LD
```

---

## Credits & Dataset License

- **3D Anatomical Data**: **BodyParts3D 4.0** (c) The Database Center for Life Science (DBCLS), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Notice**: This software is designed exclusively for educational, study, and research purposes and is not intended for diagnostic or medical treatment procedures.
