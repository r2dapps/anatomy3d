import type { ClinicalTrack, FullBodyShaderMode, SystemId } from './fullBodyAnatomy.ts';

export type PhysiologicalMotion = 'none' | 'cardiac' | 'respiratory';

export interface GuidedTourStep {
  id: string;
  title: string;
  summary: string;
  clinicalPearl: string;
  highlightConcept?: string;
  highlightConcepts?: string[];
  isolateHighlight?: boolean;
  systems: SystemId[];
  shaderMode: FullBodyShaderMode;
  explode?: number;
  focusBox?: { center: [number, number, number]; distance: number };
  motion?: PhysiologicalMotion;
}

export interface StudyQuizQuestion {
  id: string;
  track: ClinicalTrack;
  prompt: string;
  hint: string;
  targetConcept: string;
  options: [string, string, string, string];
  explanation: string;
  systems: SystemId[];
  shaderMode?: FullBodyShaderMode;
  focusBox?: { center: [number, number, number]; distance: number };
}

export interface SpecialtyLabConfig {
  track: ClinicalTrack;
  headline: string;
  motionLabel?: string;
  motionType: PhysiologicalMotion;
  tourSteps: GuidedTourStep[];
  quiz: StudyQuizQuestion[];
}

export const SPECIALTY_LABS: Record<ClinicalTrack, SpecialtyLabConfig> = {
  all: {
    track: 'all',
    headline: 'Full-Body Clinical Walkthrough',
    motionType: 'none',
    tourSteps: [
      {
        id: 'all-1',
        title: 'Thoracic Cage & Vital Organ Protection',
        summary:
          'The rib cage and sternum shield the heart and lungs while allowing elastic expansion during every breath.',
        clinicalPearl: 'Highlighted in 3D: Heart and Rib Cage. Tap Isolate Topic to hide surrounding structures completely.',
        highlightConcepts: ['heart', 'rib cage'],
        systems: ['skeletal', 'cardiac', 'respiratory'],
        shaderMode: 'solid',
        explode: 0,
        focusBox: { center: [0.0, 1.24, 0.02], distance: 1.05 },
      },
      {
        id: 'all-2',
        title: 'Central Nervous Axis: Brain & Spine',
        summary:
          'Radiographic X-Ray reveals how the cranium and vertebral canal enclose the brain and descending spinal cord.',
        clinicalPearl: 'Highlighted in 3D: Brain and Spinal Cord. Use X-Ray anytime to inspect deep organs behind bone.',
        highlightConcepts: ['brain', 'spinal cord'],
        systems: ['skeletal', 'nervous'],
        shaderMode: 'xray',
        focusBox: { center: [0.0, 1.32, 0.0], distance: 1.15 },
      },
      {
        id: 'all-3',
        title: 'Cardiopulmonary & Great Vessel Core',
        summary:
          'The heart and aorta distribute oxygenated blood across systemic arteries while paired lungs oxygenate venous return.',
        clinicalPearl: 'Highlighted in 3D: Heart and Aorta. Open Section in the bottom dock anytime if you want to slice cross-sections manually.',
        highlightConcepts: ['heart', 'aorta'],
        systems: ['cardiac', 'respiratory', 'arterial', 'venous'],
        shaderMode: 'solid',
        focusBox: { center: [0.0, 1.22, 0.02], distance: 0.92 },
      },
    ],
    quiz: [
      {
        id: 'q-all-1',
        track: 'all',
        prompt: 'Which four-chambered organ sits in the middle mediastinum driving systemic and pulmonary circulation?',
        hint: 'Located slightly left of the midline behind the sternum.',
        targetConcept: 'heart',
        options: ['Heart', 'Liver', 'Spleen', 'Stomach'],
        explanation: 'The heart pumps deoxygenated venous blood to the lungs and oxygenated blood into the aorta.',
        systems: ['cardiac', 'skeletal', 'respiratory'],
        focusBox: { center: [0.02, 1.24, 0.04], distance: 0.85 },
      },
      {
        id: 'q-all-2',
        track: 'all',
        prompt: 'Which longest and strongest weight-bearing bone connects the hip acetabulum to the knee joint?',
        hint: 'Forms the skeletal shaft of the thigh.',
        targetConcept: 'femur',
        options: ['Femur', 'Humerus', 'Tibia', 'Clavicle'],
        explanation: 'The femur transfers full axial body weight from the pelvis down to the tibiofemoral knee.',
        systems: ['skeletal', 'connective'],
        focusBox: { center: [0.0, 0.65, 0.0], distance: 1.05 },
      },
      {
        id: 'q-all-3',
        track: 'all',
        prompt: 'Which dome-shaped primary respiratory muscle separates the thoracic and abdominal cavities?',
        hint: 'Flattens on inhalation to generate negative intrathoracic pressure.',
        targetConcept: 'diaphragm',
        options: ['Diaphragm', 'Trachea', 'Sternum', 'Pancreas'],
        explanation: 'Diaphragmatic contraction expands thoracic volume, drawing air through the tracheobronchial tree.',
        systems: ['respiratory', 'muscular', 'skeletal'],
        focusBox: { center: [0.0, 1.18, 0.02], distance: 0.9 },
      },
      {
        id: 'q-all-4',
        track: 'all',
        prompt: 'Which freely movable lower jaw bone anchors the lower dental arch at the TMJ?',
        hint: 'Only mobile bone of the human skull.',
        targetConcept: 'mandible',
        options: ['Mandible', 'Maxilla', 'Sternum', 'Patella'],
        explanation: 'The mandible articulates with the temporal bones at both temporomandibular joints.',
        systems: ['skeletal', 'digestive'],
        focusBox: { center: [0.0, 1.54, 0.05], distance: 0.45 },
      },
    ],
  },

  cardio: {
    track: 'cardio',
    headline: 'Cardiology Visual Lab',
    motionLabel: 'Cardiac Pulse (72 BPM)',
    motionType: 'cardiac',
    tourSteps: [
      {
        id: 'cardio-1',
        title: 'Isolated Heart & Myocardial Chambers',
        summary:
          'Isolated cleanly from surrounding viscera, the four-chambered heart rests obliquely with its apex pointing anteriorly and left.',
        clinicalPearl: 'Cardiac Pulse (72 BPM) animates systolic-diastolic myocardial rhythm directly on the 3D heart. Tap Show Context to reveal vessels.',
        highlightConcepts: ['heart'],
        isolateHighlight: true,
        systems: ['cardiac'],
        shaderMode: 'solid',
        focusBox: { center: [0.02, 1.24, 0.04], distance: 0.42 },
        motion: 'cardiac',
      },
      {
        id: 'cardio-2',
        title: 'Coronary Arteries & Aortic Arch',
        summary:
          'Right and left coronary arteries arise directly above the aortic valve to perfuse the working myocardium during diastole.',
        clinicalPearl: 'Highlighted in 3D: Coronary Arteries and Aorta, with non-arterial clutter hidden for clear tracing.',
        highlightConcepts: ['coronary artery', 'aorta'],
        systems: ['cardiac', 'arterial'],
        shaderMode: 'solid',
        focusBox: { center: [0.02, 1.24, 0.04], distance: 0.56 },
        motion: 'cardiac',
      },
      {
        id: 'cardio-3',
        title: 'Great Vessels & Venous Return',
        summary:
          'Radiographic X-Ray highlights the superior and inferior venae cavae converging into the right atrium alongside the pulmonary trunk and aorta.',
        clinicalPearl: 'Highlighted in 3D: Superior/Inferior Vena Cava, Pulmonary Trunk, and Aorta.',
        highlightConcepts: ['superior vena cava', 'inferior vena cava', 'pulmonary trunk', 'aorta'],
        systems: ['cardiac', 'arterial', 'venous'],
        shaderMode: 'xray',
        focusBox: { center: [0.02, 1.24, 0.04], distance: 0.72 },
        motion: 'cardiac',
      },
    ],
    quiz: [
      {
        id: 'q-cardio-1',
        track: 'cardio',
        prompt: 'Identify the central four-chambered muscular pump positioned between the paired lungs.',
        hint: 'Its apex points toward the left fifth intercostal space.',
        targetConcept: 'heart',
        options: ['Heart', 'Liver', 'Right lung', 'Trachea'],
        explanation: 'The heart generates pressure gradients powering both pulmonary and systemic circulation.',
        systems: ['cardiac', 'arterial', 'venous'],
        shaderMode: 'xray',
        focusBox: { center: [0.02, 1.24, 0.04], distance: 0.72 },
      },
      {
        id: 'q-cardio-2',
        track: 'cardio',
        prompt: 'Which primary thoracic bone sits immediately anterior to the heart, shielding it from blunt trauma?',
        hint: 'Flat midline chest bone anchoring the anterior ribs.',
        targetConcept: 'sternum',
        options: ['Sternum', 'Scapula', 'Mandible', 'Femur'],
        explanation: 'The sternum (manubrium, body, and xiphoid process) protects the anterior mediastinum and heart.',
        systems: ['cardiac', 'skeletal'],
        focusBox: { center: [0.0, 1.28, 0.05], distance: 0.76 },
      },
      {
        id: 'q-cardio-3',
        track: 'cardio',
        prompt: 'Which large sub-diaphragmatic organ receives portal venous drainage before hepatic veins empty into the IVC?',
        hint: 'Visible just beneath the right dome of the diaphragm.',
        targetConcept: 'liver',
        options: ['Liver', 'Spleen', 'Left lung', 'Pancreas'],
        explanation: 'The liver filters nutrient-rich portal blood and drains via hepatic veins directly into the inferior vena cava.',
        systems: ['cardiac', 'venous', 'digestive'],
        shaderMode: 'xray',
        focusBox: { center: [-0.04, 1.12, 0.04], distance: 0.78 },
      },
    ],
  },

  lungs: {
    track: 'lungs',
    headline: 'Pulmonology Visual Lab',
    motionLabel: 'Breathing Cycle (14/min)',
    motionType: 'respiratory',
    tourSteps: [
      {
        id: 'lungs-1',
        title: 'Trachea & Main Bronchial Tree',
        summary:
          'Air descends through the hyaline-ringed trachea and splits at the carina into the right and left main bronchi.',
        clinicalPearl: 'Highlighted in 3D: Trachea and Main Bronchi. The right main bronchus is wider and more vertical than the left.',
        highlightConcepts: ['trachea', 'bronchus'],
        systems: ['respiratory'],
        shaderMode: 'solid',
        focusBox: { center: [0.0, 1.33, 0.03], distance: 0.56 },
        motion: 'respiratory',
      },
      {
        id: 'lungs-2',
        title: 'Paired Lungs & Cardiac Notch',
        summary:
          'The right lung has three lobes (superior, middle, inferior), while the left lung has two lobes shaped around the cardiac notch.',
        clinicalPearl: 'Highlighted in 3D: Right Lung and Left Lung with live Breathing Cycle expansion around the heart.',
        highlightConcepts: ['right lung', 'left lung'],
        systems: ['respiratory', 'cardiac'],
        shaderMode: 'solid',
        focusBox: { center: [0.0, 1.26, 0.02], distance: 0.72 },
        motion: 'respiratory',
      },
      {
        id: 'lungs-3',
        title: 'Diaphragm & Thoracic Cage Mechanics',
        summary:
          'During inspiration, the dome-shaped diaphragm flattens downward while the rib cage elevates to expand intrathoracic volume.',
        clinicalPearl: 'Highlighted in 3D: Diaphragm and Rib Cage in translucent X-Ray view.',
        highlightConcepts: ['diaphragm', 'rib cage'],
        systems: ['respiratory', 'skeletal', 'muscular'],
        shaderMode: 'xray',
        focusBox: { center: [0.0, 1.22, 0.02], distance: 0.85 },
        motion: 'respiratory',
      },
    ],
    quiz: [
      {
        id: 'q-lungs-1',
        track: 'lungs',
        prompt: 'Which lung contains three distinct lobes separated by horizontal and oblique fissures?',
        hint: 'Sits superior to the liver on the anatomical right side.',
        targetConcept: 'right lung',
        options: ['Right lung', 'Left lung', 'Trachea', 'Diaphragm'],
        explanation: 'The right lung has superior, middle, and inferior lobes and is slightly shorter due to the liver below.',
        systems: ['respiratory', 'cardiac'],
        focusBox: { center: [0.0, 1.28, 0.02], distance: 0.78 },
      },
      {
        id: 'q-lungs-2',
        track: 'lungs',
        prompt: 'Which lung features the cardiac notch and lingula to accommodate the apex of the heart?',
        hint: 'Divided into two lobes by a single oblique fissure.',
        targetConcept: 'left lung',
        options: ['Left lung', 'Right lung', 'Sternum', 'Liver'],
        explanation: 'The left lung is narrower and indented medially by the cardiac notch.',
        systems: ['respiratory', 'cardiac'],
        focusBox: { center: [0.0, 1.28, 0.02], distance: 0.78 },
      },
      {
        id: 'q-lungs-3',
        track: 'lungs',
        prompt: 'Which midline cartilaginous airway conducts air from the larynx to the carina?',
        hint: 'Reinforced anteriorly by C-shaped hyaline cartilage rings.',
        targetConcept: 'trachea',
        options: ['Trachea', 'Esophagus', 'Diaphragm', 'Heart'],
        explanation: 'C-shaped tracheal rings maintain airway patency during negative inspiratory pressures.',
        systems: ['respiratory'],
        focusBox: { center: [0.0, 1.36, 0.03], distance: 0.62 },
      },
    ],
  },

  ortho: {
    track: 'ortho',
    headline: 'Orthopedics Visual Lab',
    motionType: 'none',
    tourSteps: [
      {
        id: 'ortho-1',
        title: 'Axial Spine & Pelvic Girdle',
        summary:
          'The vertebral column transmits axial forces into the sacrum and bony pelvic ring while protecting the spinal cord.',
        clinicalPearl: 'Highlighted in 3D: Vertebral Column and Bony Pelvis. Orbit laterally to inspect natural spinal curvatures.',
        highlightConcepts: ['vertebral column', 'bony pelvis'],
        systems: ['skeletal', 'connective'],
        shaderMode: 'solid',
        focusBox: { center: [0.0, 1.05, 0.0], distance: 1.15 },
      },
      {
        id: 'ortho-2',
        title: 'Isolated Femur & Patella Load Axis',
        summary:
          'The femur transfers hip loads down to the knee while the patella glides in the trochlear groove to boost extensor leverage.',
        clinicalPearl: 'Isolated cleanly: Femur and Patella. Tap Show Context to inspect surrounding tibial and ligament attachments.',
        highlightConcepts: ['femur', 'patella'],
        isolateHighlight: true,
        systems: ['skeletal', 'connective'],
        shaderMode: 'solid',
        focusBox: { center: [0.0, 0.62, 0.02], distance: 0.88 },
      },
      {
        id: 'ortho-3',
        title: 'Shoulder Girdle: Humerus & Clavicle',
        summary:
          'The clavicle struts the shoulder laterally while the humeral head articulates with the shallow glenoid cavity for wide mobility.',
        clinicalPearl: 'Highlighted in 3D: Humerus and Clavicle. Drag Explode in the bottom dock to inspect joint spacing.',
        highlightConcepts: ['humerus', 'clavicle'],
        systems: ['skeletal', 'connective'],
        shaderMode: 'solid',
        focusBox: { center: [0.0, 1.24, 0.0], distance: 0.96 },
      },
    ],
    quiz: [
      {
        id: 'q-ortho-1',
        track: 'ortho',
        prompt: 'Which sesamoid bone glides in the femoral trochlear groove to increase quadriceps leverage?',
        hint: 'Commonly known as the kneecap.',
        targetConcept: 'patella',
        options: ['Patella', 'Femur', 'Clavicle', 'Scapula'],
        explanation: 'The patella protects the anterior knee joint and improves mechanical extension moment arm.',
        systems: ['skeletal', 'connective'],
        focusBox: { center: [0.0, 0.48, 0.06], distance: 0.72 },
      },
      {
        id: 'q-ortho-2',
        track: 'ortho',
        prompt: 'Which upper limb long bone articulates proximally with the glenoid cavity of the scapula?',
        hint: 'Forms the skeletal shaft of the upper arm.',
        targetConcept: 'humerus',
        options: ['Humerus', 'Femur', 'Sternum', 'Mandible'],
        explanation: 'The humeral head forms the ball-and-socket glenohumeral shoulder joint.',
        systems: ['skeletal', 'connective'],
        focusBox: { center: [0.0, 1.24, 0.0], distance: 0.98 },
      },
      {
        id: 'q-ortho-3',
        track: 'ortho',
        prompt: 'Which central segmented column supports the trunk and encases the spinal cord?',
        hint: 'Divided into cervical, thoracic, lumbar, sacral, and coccygeal regions.',
        targetConcept: 'vertebral column',
        options: ['Vertebral column', 'Sternum', 'Pelvis', 'Skull'],
        explanation: 'Intervertebral discs and facet joints balance structural load distribution with multi-planar mobility.',
        systems: ['skeletal', 'connective'],
        focusBox: { center: [0.0, 1.12, -0.04], distance: 1.12 },
      },
    ],
  },

  physio: {
    track: 'physio',
    headline: 'Physiotherapy Kinetic Lab',
    motionLabel: 'Diaphragmatic Breath',
    motionType: 'respiratory',
    tourSteps: [
      {
        id: 'physio-1',
        title: 'Prime Movers: Deltoid & Quadriceps',
        summary:
          'Skeletal muscles act in coordinated agonist-antagonist chains—deltoids elevate the upper limb while quadriceps power knee extension.',
        clinicalPearl: 'Highlighted in 3D: Deltoid and Quadriceps Femoris. Tap Isolate Topic to study their fiber lines directly.',
        highlightConcepts: ['zone of deltoid', 'zone of quadriceps femoris'],
        systems: ['muscular', 'skeletal'],
        shaderMode: 'solid',
        focusBox: { center: [0.0, 1.0, 0.04], distance: 1.65 },
      },
      {
        id: 'physio-2',
        title: 'Core & Diaphragmatic Stabilization',
        summary:
          'Intra-abdominal pressure coordinated by the diaphragm and deep trunk musculature stabilizes the lumbar spine during load transfer.',
        clinicalPearl: 'Highlighted in 3D: Diaphragm inside translucent X-Ray thorax with active breathing motion.',
        highlightConcepts: ['diaphragm'],
        systems: ['muscular', 'skeletal', 'respiratory'],
        shaderMode: 'xray',
        focusBox: { center: [0.0, 1.16, 0.03], distance: 0.92 },
        motion: 'respiratory',
      },
      {
        id: 'physio-3',
        title: 'Achilles Tendon & Skeletal Ligaments',
        summary:
          'High-tensile connective structures including the calcaneal (Achilles) tendon and joint ligaments store elastic energy and limit excessive shear.',
        clinicalPearl: 'Isolated cleanly: Calcaneal Tendons and Skeletal Ligaments.',
        highlightConcepts: ['calcaneal tendon', 'ligament organ'],
        isolateHighlight: true,
        systems: ['skeletal', 'connective'],
        shaderMode: 'solid',
        focusBox: { center: [0.0, 0.56, 0.02], distance: 1.25 },
      },
    ],
    quiz: [
      {
        id: 'q-physio-1',
        track: 'physio',
        prompt: 'Which dome-shaped core muscle both drives inspiration and stabilizes lumbar intra-abdominal pressure?',
        hint: 'Anchors along the lower costal margin and lumbar vertebrae.',
        targetConcept: 'diaphragm',
        options: ['Diaphragm', 'Patella', 'Heart', 'Liver'],
        explanation: 'Diaphragmatic breathing integrates pulmonary ventilation with deep spinal stabilization in physiotherapy.',
        systems: ['muscular', 'respiratory', 'skeletal'],
        focusBox: { center: [0.0, 1.18, 0.03], distance: 0.88 },
      },
      {
        id: 'q-physio-2',
        track: 'physio',
        prompt: 'Which central nervous structure coordinates voluntary motor planning and proprioceptive balance?',
        hint: 'Housed inside the cranial vault.',
        targetConcept: 'brain',
        options: ['Brain', 'Heart', 'Stomach', 'Spleen'],
        explanation: 'Cortical motor tracts and the cerebellum calibrate neuromuscular recruitment and balance.',
        systems: ['nervous', 'skeletal'],
        shaderMode: 'xray',
        focusBox: { center: [0.0, 1.58, 0.02], distance: 0.48 },
      },
      {
        id: 'q-physio-3',
        track: 'physio',
        prompt: 'Which upper-arm bone serves as the distal insertion lever for the deltoid and rotator cuff muscles?',
        hint: 'Rotates inside the shoulder glenoid during abduction and elevation.',
        targetConcept: 'humerus',
        options: ['Humerus', 'Femur', 'Mandible', 'Sternum'],
        explanation: 'Rotator cuff muscles compress the humeral head into the glenoid to stabilize overhead arm motion.',
        systems: ['muscular', 'skeletal', 'connective'],
        focusBox: { center: [0.0, 1.24, 0.02], distance: 0.96 },
      },
    ],
  },

  dental: {
    track: 'dental',
    headline: 'Dentistry & Craniofacial Lab',
    motionType: 'none',
    tourSteps: [
      {
        id: 'dental-1',
        title: 'Isolated Dental Arches & Jaws',
        summary:
          'Isolated cleanly from the rest of the body: upper maxillary and lower mandibular arches anchor all 28 modeled teeth.',
        clinicalPearl: 'Orbit 360° around the isolated Mandible, Maxilla, and Teeth—or tap Show Context to view the full cranium.',
        highlightConcepts: ['tooth', 'mandible', 'maxilla'],
        isolateHighlight: true,
        systems: ['skeletal', 'digestive'],
        shaderMode: 'solid',
        focusBox: { center: [0.0, 1.53, 0.06], distance: 0.30 },
      },
      {
        id: 'dental-2',
        title: 'Mandible & Temporomandibular Joint',
        summary:
          'The mandible is the only mobile skull bone, hinging and translating at both TMJs during mastication and speech.',
        clinicalPearl: 'Highlighted in 3D: Mandible within the full craniofacial skeletal vault.',
        highlightConcepts: ['mandible'],
        systems: ['skeletal'],
        shaderMode: 'solid',
        focusBox: { center: [0.0, 1.54, 0.06], distance: 0.36 },
      },
      {
        id: 'dental-3',
        title: 'Maxilla, Sinuses & Cranial Innervation',
        summary:
          'Radiographic X-Ray illuminates the paired maxillae and cranial vault alongside neural pathways supplying jaw sensation.',
        clinicalPearl: 'Highlighted in 3D: Maxilla and Skull landmarks over cranial nerves.',
        highlightConcepts: ['maxilla', 'skull'],
        systems: ['skeletal', 'nervous'],
        shaderMode: 'xray',
        focusBox: { center: [0.0, 1.56, 0.04], distance: 0.44 },
      },
    ],
    quiz: [
      {
        id: 'q-dental-1',
        track: 'dental',
        prompt: 'Which single U-shaped bone forms the lower jaw and articulates at the temporomandibular joint?',
        hint: 'Supports the lower incisors, canines, premolars, and molars.',
        targetConcept: 'mandible',
        options: ['Mandible', 'Maxilla', 'Sternum', 'Brain'],
        explanation: 'The mandible is the strongest facial bone and the only mobile bone of the skull.',
        systems: ['skeletal', 'digestive'],
        focusBox: { center: [0.0, 1.53, 0.06], distance: 0.38 },
      },
      {
        id: 'q-dental-2',
        track: 'dental',
        prompt: 'Which paired upper jaw bone forms the hard palate and houses the sinuses above upper molar roots?',
        hint: 'Forms the upper dental arcade and floor of the orbit.',
        targetConcept: 'maxilla',
        options: ['Maxilla', 'Mandible', 'Clavicle', 'Patella'],
        explanation: 'The maxilla anchors upper teeth in alveolar sockets directly beneath the maxillary sinuses.',
        systems: ['skeletal', 'digestive'],
        focusBox: { center: [0.0, 1.55, 0.06], distance: 0.38 },
      },
      {
        id: 'q-dental-3',
        track: 'dental',
        prompt: 'Which protective bony complex encompasses the cranium, orbits, nasal cavity, and facial skeleton?',
        hint: 'Encloses the brain and sensory organs.',
        targetConcept: 'skull',
        options: ['Skull', 'Vertebral column', 'Pelvis', 'Sternum'],
        explanation: 'The skull integrates the neurocranium and viscerocranium around the oral and sensory cavities.',
        systems: ['skeletal', 'nervous'],
        shaderMode: 'xray',
        focusBox: { center: [0.0, 1.57, 0.04], distance: 0.45 },
      },
    ],
  },
};

