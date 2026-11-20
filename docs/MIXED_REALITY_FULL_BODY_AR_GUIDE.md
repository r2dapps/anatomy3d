# Mixed Reality Full-Body Anatomy Tracking & Classroom Projection Guide

## 1. Executive Summary & Objective

This document outlines the technical architecture, mathematical transformations, and implementation roadmap for projecting authentic 3D anatomical structures (from the BodyParts3D dataset) onto human bodies in real time. 

The primary target use case is **Classroom Spatial Augmented Reality (SAR)**:
- A university professor or anatomy lecturer stands in front of a lecture hall wearing a light coat or shirt.
- A standard webcam or PTZ camera captures the instructor.
- A classroom projector maps real-time radiographic X-ray shaders of internal organs (brain, jaw, heart, lungs, ribs, liver, stomach, kidneys, skeletal limbs) directly onto the instructor's physical body.
- When the instructor breathes, speaks, gestures with their hands, or walks across the podium, internal structures track synchronously with minimal latency.

---

## 2. Theoretical Challenge: Static Scans vs. Dynamic Kinematic Chains

### 2.1 The BodyParts3D Dataset Structure
BodyParts3D 4.0 consists of polygonal surface meshes reconstructed from high-resolution MRI and CT scans of a single adult donor in a standard anatomical resting position:
- **Topology:** Discrete triangular meshes organized into 15 anatomical systems.
- **Data Limitations:** The meshes are **static** (`position`, `normal`, `index`). They contain **no skinning weights** (`skinIndices`, `skinWeights`) or skeletal bone hierarchies.

### 2.2 Why Generic Linear Blend Skinning (LBS) Fails on Raw Anatomy
In standard character animation (e.g., game avatars), meshes are deformed using a skeletal rig where each vertex has a weighted blend across 1 to 4 bones:
$$v' = \sum_{i=1}^k w_i \cdot M_i \cdot M_{bind,i}^{-1} \cdot v$$
Raw anatomical organs cannot use uniform skinning:
1. **Rigid Structures (Bones):** The humerus, femur, and skull must never deform, bend, or stretch; they must undergo purely rigid Euclidean transformations ($SE(3)$).
2. **Semi-Rigid Viscera (Lungs, Heart, Liver):** Visceral organs move with the diaphragm and thoracic cage, sliding within fascial planes rather than bending.
3. **Deformable Soft Tissue (Skin, Superficial Fascia):** Only superficial musculature and cutaneous tissue undergo non-rigid deformation.

### 2.3 Selected Solution: Hierarchical Segmented Kinematic Chain
Rather than attempting lossy automatic mesh deformation across 2,234 parts, the production-grade approach is **Segmented Rigid Hierarchical Binding**:
- Partition the anatomical models into 8 functional kinematic groups.
- Bind each group to an orthonormal coordinate frame derived from specific MediaPipe landmark triples.
- Apply non-uniform scale matching to dynamically adapt donor anatomy to the presenter's specific height, shoulder breadth, and limb proportions.

---

## 3. Kinematic Grouping & Landmark Transformation Matrix Derivation

### 3.1 Landmark Coordinate Spaces
MediaPipe Tasks Vision yields two coordinate spaces:
1. **Screen Normalized Landmark Space ($[0, 1]$):** $x$ (horizontal), $y$ (vertical), $z$ (depth scale relative to hips).
2. **World 3D Metric Space (Meters, Origin at Hip Center):** Real-world metric 3D coordinates ($X_w, Y_w, Z_w$).

For augmented projection, normalized camera-space landmarks are unprojected into Three.js perspective camera coordinates using camera intrinsics ($f_x, f_y, c_x, c_y$):
$$X_c = \frac{(x - c_x) \cdot Z_c}{f_x}, \quad Y_c = -\frac{(y - c_y) \cdot Z_c}{f_y}$$

---

### 3.2 Kinematic Segment Definitions

```
                     [Head & Brain]  <-- FaceMesh 468 (Rigid 6-DoF)
                           |
                      [Mandible]     <-- Blendshape JawOpen (Pitch Rotation)
                           |
                     [Cervical Spine]
                           |
     [Left Arm] ---- [Thoracic Cage] ---- [Right Arm]
     (Pose 11,13,15) (Ribs, Heart, Lungs)  (Pose 12,14,16)
                           |
                    [Abdominal Viscera]
                    (Liver, Stomach, Kidneys)
                           |
                    [Pelvic Girdle]  <-- Pose 23, 24 (Hips)
                     /           \
               [Left Leg]     [Right Leg]
             (Pose 23,25,27)  (Pose 24,26,28)
```

#### A. Head, Brain, & Mandible
- **Input:** MediaPipe FaceLandmarker (468 landmarks + facial transformation matrix).
- **Transformation:** Direct $4 \times 4$ rigid transform matrix $M_{head}$.
- **Mandible Articulation:** 
  $$\theta_{jaw} = \text{clamp}(\text{jawOpenScore} \cdot 1.3, 0, 1) \times 0.45 \text{ rad}$$
  Rotate mandible mesh around the temporomandibular joint pivot ($P_{TMJ} = [0, -0.42, 0.18]$).

#### B. Thoracic Viscera (Rib Cage, Spine, Lungs, Heart)
- **Anchor Landmarks:** 
  - Left Shoulder ($P_{11}$), Right Shoulder ($P_{12}$)
  - Left Hip ($P_{23}$), Right Hip ($P_{24}$)
- **Coordinate Basis Derivation:**
  $$\vec{C}_{mid} = \frac{P_{11} + P_{12}}{2}$$
  $$\vec{X}_{torso} = \text{normalize}(P_{12} - P_{11})$$
  $$\vec{Y}_{torso} = \text{normalize}\left(\vec{C}_{mid} - \frac{P_{23} + P_{24}}{2}\right)$$
  $$\vec{Z}_{torso} = \text{normalize}(\vec{X}_{torso} \times \vec{Y}_{torso})$$
- **Scale Factor:**
  $$S_x = \frac{\|P_{12} - P_{11}\|}{W_{ref}}, \quad S_y = \frac{\|\vec{C}_{mid} - \vec{H}_{mid}\|}{H_{ref}}, \quad S_z = \frac{S_x + S_y}{2}$$
- **Components Assigned:**
  - Real BodyParts3D Heart (pulmonary trunk, aorta, ventricles)
  - Real BodyParts3D Lungs (superior, middle, inferior lobes)
  - Real BodyParts3D Ribs & Sternum
  - Thoracic Vertebrae (T1-T12)

#### C. Abdominal & Retroperitoneal Viscera
- **Anchor Landmarks:** Mid-torso to Pelvis ($P_{23}, P_{24}$).
- **Components Assigned:**
  - Liver (anchored below right hemidiaphragm)
  - Stomach & Spleen (anchored below left hemidiaphragm)
  - Kidneys & Adrenal Glands (posterior abdominal wall, adjacent to L1-L3)
  - Transverse, Ascending, and Descending Colon

#### D. Limb Bones (Upper & Lower Extremities)
Each limb bone is an oriented cylinder aligned between two landmarks ($P_A \to P_B$):
- **Orientation Matrix Construction:**
  $$\vec{D} = \text{normalize}(P_B - P_A)$$
  $$\vec{U}_{temp} = [0, 1, 0]$$
  $$\vec{R} = \text{normalize}(\vec{D} \times \vec{U}_{temp})$$
  $$\vec{U} = \vec{R} \times \vec{D}$$
  $$M_{limb} = \begin{bmatrix} R_x & U_x & D_x & P_{A,x} \\ R_y & U_y & D_y & P_{A,y} \\ R_z & U_z & D_z & P_{A,z} \\ 0 & 0 & 0 & 1 \end{bmatrix}$$
- **Scale:** Length $L = \|P_B - P_A\|$, Radius $R = L \times 0.08$.
- **Bones Mapped:**
  - Humerus ($P_{11} \to P_{13}$, $P_{12} \to P_{14}$)
  - Radius / Ulna ($P_{13} \to P_{15}$, $P_{14} \to P_{16}$)
  - Femur ($P_{23} \to P_{25}$, $P_{24} \to P_{26}$)
  - Tibia / Fibula ($P_{25} \to P_{27}$, $P_{26} \to P_{28}$)

#### E. Hands & Digits
- **Input:** MediaPipe HandLandmarker (21 3D landmarks per hand).
- **Carpal / Metacarpal Cluster:** Orthographic or perspective anchor at $P_0$ (wrist) aligned to vector $P_0 \to P_9$ (middle knuckle).
- **Phalanges:** Bone segments along vectors:
  - Proximal phalanx: Knuckle to PIP joint
  - Middle phalanx: PIP to DIP joint
  - Distal phalanx: DIP to fingertip

---

## 4. Classroom Spatial Augmented Reality (Projector Calibration)

### 4.1 System Topology
```
 [Audience / Students]
          |
          v
   +--------------+      HDMI / USB-C      +-------------------+
   |  Projector   |<-----------------------|  Instructor PC    |
   +--------------+                        |  (Chrome WebGL)   |
          |                                +-------------------+
          | Light Projection                         ^
          v                                          | Camera Feed
   +--------------+                                  |
   |  Instructor  |----------------------------------+
   | (White Coat) |            Webcam / PTZ
   +--------------+
```

### 4.2 Geometric Alignment: Projector-Camera Homography
When a projector and camera are not coaxial, an optical parallax offset occurs. Two calibration options exist:

#### Option 1: Planar Projector Homography ($3 \times 3$)
For instructors standing roughly planar to the projection backdrop:
$$\begin{bmatrix} x_{proj} \\ y_{proj} \\ 1 \end{bmatrix} = \mathbf{H} \begin{bmatrix} x_{cam} \\ y_{cam} \\ 1 \end{bmatrix}$$
1. The app renders a 4-point corner calibration screen (crosshairs at corners).
2. The instructor adjusts the 4 corners until projected markers match camera test coordinates.
3. Compute $\mathbf{H}$ using Direct Linear Transformation (DLT).
4. Apply $\mathbf{H}$ in the Three.js post-processing vertex shader.

#### Option 2: Pre-Aligned Coaxial Setup (Beam Splitter / Teleprompter Glass)
Mount the camera directly behind a 50/50 beam-splitter glass with the projector perpendicular:
- Optical centers of camera and projector become collinear.
- Parallax is mathematically zero ($\mathbf{H} = \mathbf{I}$).
- Zero manual calibration required during class lectures.

### 4.3 Optical Optimization for Lecture Halls
- **Presenter Attire:** A white laboratory coat or light grey shirt offers near-Lambertian reflection ($\sim 85\%$ reflectivity), maximizing radiographic contrast.
- **Background Suppression:** The shader discards fragments outside the detected body bounding polygon or alpha-mask, preventing organs from projecting onto the background wall.
- **Radiographic Inversion:** Dark lecture rooms require high-contrast cyan/white emission over dark backgrounds:
  $$I_{proj} = I_{bone} \cdot (1.0 - \text{Fresnel})^{2.2} \cdot \text{Gain}$$

---

## 5. Performance Engineering & Pacing Boundaries

To achieve stutter-free 60 FPS in a lecture setting:

1. **Inference Decoupling:**
   - Execute MediaPipe landmark detection on a fixed timer (24 ms to 33 ms intervals) or within a dedicated Web Worker using `OffscreenCanvas`.
   - Never block the Three.js WebGL animation loop on neural network inference.
2. **Exponential Smoothing (Jitter Suppression):**
   Raw landmark coordinates contain minor frame-to-frame pixel jitter. Apply One-Euro or dynamic exponential lerp:
   $$\vec{P}_{smooth} = \vec{P}_{prev} + \alpha \cdot (\vec{P}_{detected} - \vec{P}_{prev})$$
   $$\alpha = \begin{cases} 0.35 & \text{if } \Delta < 4\text{ px (subtle breathing)} \\ 0.65 & \text{if } 4 \le \Delta < 25\text{ px (natural motion)} \\ 0.85 & \text{if } \Delta \ge 25\text{ px (rapid step or gesture)} \end{cases}$$
3. **Zero Garbage Collection (GC) in Hot Loop:**
   All `THREE.Vector3`, `THREE.Quaternion`, `THREE.Matrix4`, and `THREE.Euler` instances must be hoisted outside the render function as shared module scratch variables.

---

## 6. Implementation Checklist & Phase Gates

- [x] Phase 1: Head & FaceMesh 6-DoF rigid anchoring with dynamic jaw articulation.
- [x] Phase 2: Dual-hand skeletal tracking (21 landmarks x 2 hands) with handedness inversion logic.
- [x] Phase 3: MediaPipe Pose landmark integration with procedural 3D torso, spine, ribs, heart, and limb bones.
- [ ] Phase 4: Extract and isolate authentic BodyParts3D visceral organ meshes (Liver, Kidneys, Stomach, True Lungs, True Heart).
- [ ] Phase 5: Map authentic BodyParts3D visceral organ groups to the thoracic coordinate frame ($M_{torso}$).
- [ ] Phase 6: Add Classroom Projector Mode (fullscreen UI, mirrored output toggle, Keystone/Homography calibration panel).

---

## 7. Relevant Code References

- Main Live AR Component: [src/components/XRayMirrorView.tsx](file:///D:/ReactApps2Git/anatomy3d_react/src/components/XRayMirrorView.tsx)
- Anatomy Catalog & Metadata: [src/data/anatomyCatalog.ts](file:///D:/ReactApps2Git/anatomy3d_react/src/data/anatomyCatalog.ts)
- 3D Geometry Loader: [src/three/anatomyLoader.ts](file:///D:/ReactApps2Git/anatomy3d_react/src/three/anatomyLoader.ts)
- Full-Body 3D Atlas Viewport: [src/components/FullBodyViewport.tsx](file:///D:/ReactApps2Git/anatomy3d_react/src/components/FullBodyViewport.tsx)
