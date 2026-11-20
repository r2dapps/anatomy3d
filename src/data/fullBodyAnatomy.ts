export type SystemId =
  | 'skeletal'
  | 'muscular'
  | 'cardiac'
  | 'sensory'
  | 'arterial'
  | 'venous'
  | 'nervous'
  | 'respiratory'
  | 'digestive'
  | 'urinary'
  | 'lymphatic'
  | 'endocrine'
  | 'reproductive'
  | 'connective'
  | 'integumentary';

export interface SystemDef {
  id: SystemId;
  name: string;
  color: string;
  xrayColor: [number, number, number];
  description: string;
}

export interface Part {
  id: string;
  name: string;
  conceptId: string;
  system: SystemId;
  chunk: number;
  positions: number;
  normals: number;
  indices: number;
  vertexCount: number;
  indexCount: number;
  bounds: [number[], number[]];
}

export interface Concept {
  id: string;
  name: string;
  elements: string[];
}

export interface AtlasChunk {
  url: string;
  bytes: number;
  gzip?: string;
  gzipBytes?: number;
}

export interface FullBodyAtlas {
  version: string;
  sex?: 'male';
  source?: string;
  scope?: string;
  parts: Part[];
  concepts: Concept[];
  chunks: AtlasChunk[];
  triangles: number;
}

export type CameraView = 'three-quarter' | 'front' | 'back' | 'side';
export type FullBodyShaderMode = 'solid' | 'xray';
export type ClinicalTrack = 'all' | 'ortho' | 'cardio' | 'lungs' | 'physio' | 'dental';

export const SYSTEMS: SystemDef[] = [
  {
    id: 'skeletal',
    name: 'Skeleton',
    color: '#e2d9ba',
    xrayColor: [0.76, 0.90, 1.0],
    description:
      'Bones form the structural framework of the body, shield vital organs, anchor skeletal muscles, store calcium and phosphate, and house blood-forming marrow.',
  },
  {
    id: 'muscular',
    name: 'Muscles',
    color: '#b05b52',
    xrayColor: [0.98, 0.44, 0.40],
    description:
      'Skeletal muscles generate controlled force across joints via tendons, driving locomotion, posture stabilization, breathing mechanics, and functional rehabilitation.',
  },
  {
    id: 'cardiac',
    name: 'Heart',
    color: '#c25852',
    xrayColor: [1.0, 0.36, 0.46],
    description:
      'A four-chambered muscular pump directing deoxygenated blood from the right ventricle to the lungs and oxygenated blood from the left ventricle to the entire body.',
  },
  {
    id: 'respiratory',
    name: 'Respiratory & Lungs',
    color: '#c08791',
    xrayColor: [0.56, 0.88, 0.98],
    description:
      'The nasal airways, trachea, bronchi, and paired lungs conduct air to millions of alveoli where oxygen enters the bloodstream and carbon dioxide is exhaled.',
  },
  {
    id: 'arterial',
    name: 'Arteries',
    color: '#c94c42',
    xrayColor: [1.0, 0.42, 0.36],
    description:
      'High-pressure muscular and elastic vessels carrying oxygenated blood away from the heart (and deoxygenated blood in the pulmonary arteries) to every organ.',
  },
  {
    id: 'venous',
    name: 'Veins',
    color: '#4e7ca3',
    xrayColor: [0.42, 0.72, 1.0],
    description:
      'Low-pressure capacitance vessels equipped with one-way valves that return venous blood back toward the right atrium of the heart.',
  },
  {
    id: 'nervous',
    name: 'Nervous System',
    color: '#dab662',
    xrayColor: [0.96, 0.82, 0.42],
    description:
      'The brain, spinal cord, cranial nerves, and peripheral nerve plexuses integrate sensory perception, motor commands, autonomic balance, and cognition.',
  },
  {
    id: 'digestive',
    name: 'Digestive & Oral',
    color: '#bc9068',
    xrayColor: [0.92, 0.74, 0.50],
    description:
      'Extends from the oral cavity, teeth, and tongue through the esophagus, stomach, liver, pancreas, and intestines to mechanically and chemically absorb nutrients.',
  },
  {
    id: 'connective',
    name: 'Connective & Ligaments',
    color: '#c7b89c',
    xrayColor: [0.76, 0.84, 0.90],
    description:
      'Ligaments, joint capsules, fasciae, and cartilage stabilize articulations, transmit mechanical tension, and cushion bone-on-bone joint surfaces.',
  },
  {
    id: 'sensory',
    name: 'Sensory Organs',
    color: '#9dbdc6',
    xrayColor: [0.48, 0.86, 1.0],
    description:
      'Specialized ocular, auditory, and vestibular organs that transduce light, sound waves, and head acceleration into neural signals.',
  },
  {
    id: 'urinary',
    name: 'Urinary',
    color: '#b8765c',
    xrayColor: [0.90, 0.64, 0.48],
    description:
      'The kidneys, ureters, and urinary bladder filter plasma, balance fluid and electrolytes, regulate blood pressure, and excrete metabolic waste.',
  },
  {
    id: 'lymphatic',
    name: 'Lymphatic',
    color: '#82a078',
    xrayColor: [0.56, 0.92, 0.62],
    description:
      'Lymph nodes, spleen, thymus, and lymphatic vessels reclaim interstitial fluid and coordinate adaptive immune surveillance.',
  },
  {
    id: 'endocrine',
    name: 'Endocrine',
    color: '#c79e98',
    xrayColor: [0.88, 0.64, 0.88],
    description:
      'Ductless glands including thyroid, adrenals, pituitary, and pancreas secreting hormones that regulate metabolism, growth, and homeostasis.',
  },
  {
    id: 'reproductive',
    name: 'Reproductive',
    color: '#bda098',
    xrayColor: [0.86, 0.70, 0.76],
    description:
      'Pelvic reproductive organs and ducts responsible for gametogenesis, hormone synthesis, and transport.',
  },
  {
    id: 'integumentary',
    name: 'Body Surface',
    color: '#b89f8d',
    xrayColor: [0.68, 0.78, 0.86],
    description:
      'Translucent outer body contour providing spatial surface landmarks for palpation, surgical orientation, and physiotherapy surface anatomy.',
  },
];

export const SYSTEM_BY_ID: Record<SystemId, SystemDef> = Object.fromEntries(
  SYSTEMS.map((s) => [s.id, s])
) as Record<SystemId, SystemDef>;

export const DEFAULT_VISIBLE_SYSTEMS: SystemId[] = [
  'skeletal',
  'muscular',
  'cardiac',
  'respiratory',
  'arterial',
  'venous',
  'nervous',
  'digestive',
  'connective',
  'sensory',
  'urinary',
  'lymphatic',
  'endocrine',
  'reproductive',
];

export interface ClinicalTrackConfig {
  id: ClinicalTrack;
  label: string;
  shortLabel: string;
  systems: SystemId[];
  focusQuery?: string;
  focusRegionBox?: { center: [number, number, number]; distance: number };
  phaseNote: string;
}

export const CLINICAL_TRACKS: ClinicalTrackConfig[] = [
  {
    id: 'all',
    label: 'Full Body Atlas',
    shortLabel: 'Full Body',
    systems: DEFAULT_VISIBLE_SYSTEMS,
    phaseNote: 'Complete 2,234-mesh adult male reference anatomy across 15 systems.',
  },
  {
    id: 'ortho',
    label: 'Orthopedics',
    shortLabel: 'Ortho',
    systems: ['skeletal', 'connective'],
    phaseNote: 'Skeletal framework, joints, and stabilizing ligaments & cartilage.',
  },
  {
    id: 'cardio',
    label: 'Cardiology',
    shortLabel: 'Cardio',
    systems: ['cardiac', 'arterial', 'venous'],
    focusRegionBox: { center: [0.02, 1.24, 0.04], distance: 0.72 },
    phaseNote: 'Heart chambers, great vessels, systemic arteries, and venous return.',
  },
  {
    id: 'lungs',
    label: 'Pulmonology (Lungs)',
    shortLabel: 'Lungs',
    systems: ['respiratory', 'cardiac', 'skeletal'],
    focusRegionBox: { center: [0.0, 1.28, 0.02], distance: 0.85 },
    phaseNote: 'Tracheobronchial tree, lung lobes, rib cage mechanics, and pulmonary circulation.',
  },
  {
    id: 'physio',
    label: 'Physiotherapy',
    shortLabel: 'Physio',
    systems: ['muscular', 'skeletal', 'connective', 'nervous'],
    phaseNote: 'Musculoskeletal chains, joint stabilizers, and peripheral motor innervation.',
  },
  {
    id: 'dental',
    label: 'Dentistry & Craniofacial',
    shortLabel: 'Dental',
    systems: ['skeletal', 'digestive', 'nervous', 'muscular'],
    focusRegionBox: { center: [0.0, 1.54, 0.05], distance: 0.42 },
    phaseNote: 'Maxilla, mandible, dentition, muscles of mastication, and trigeminal pathways.',
  },
];

/**
 * Curated high-yield clinical study notes for core organs & specialty structures
 * (foundation for Phase 2 deep Dentistry / Ortho / Cardio / Lungs / Physio modules).
 */
export const CLINICAL_EXPLANATIONS: Record<string, { overview: string; discipline?: string }> = {
  heart: {
    discipline: 'Cardiology',
    overview:
      'A four-chambered muscular pump in the middle mediastinum. Its right side propels venous blood to the pulmonary circulation; its thick-walled left ventricle drives oxygenated blood through the aorta.',
  },
  'right lung': {
    discipline: 'Pulmonology',
    overview:
      'Composed of superior, middle, and inferior lobes separated by horizontal and oblique fissures. Shorter and wider than the left lung to accommodate the liver beneath the right hemidiaphragm.',
  },
  'left lung': {
    discipline: 'Pulmonology',
    overview:
      'Divided into superior and inferior lobes by the oblique fissure, featuring the cardiac notch and lingula to make space for the left apex of the heart.',
  },
  trachea: {
    discipline: 'Pulmonology',
    overview:
      'Cartilaginous airway supported by C-shaped hyaline rings connecting the larynx to the carina, where it bifurcates into the left and right main bronchi.',
  },
  diaphragm: {
    discipline: 'Pulmonology · Physio',
    overview:
      'Dome-shaped primary muscle of inspiration separating thoracic and abdominal cavities. Contraction flattens the dome, creating negative intrathoracic pressure to draw air into the lungs.',
  },
  mandible: {
    discipline: 'Dentistry · Ortho',
    overview:
      'The lower jaw and only freely movable cranial bone. Anchors the mandibular teeth in its alveolar process and hinges at the temporomandibular joints (TMJs).',
  },
  maxilla: {
    discipline: 'Dentistry',
    overview:
      'Paired upper jaw bone forming the hard palate, orbital floor, and maxillary dental arch. Houses the maxillary sinuses directly superior to the upper molar roots.',
  },
  femur: {
    discipline: 'Orthopedics · Physio',
    overview:
      'Longest and strongest weight-bearing bone in the human body, transferring axial load from the hip acetabulum to the tibiofemoral knee joint.',
  },
  humerus: {
    discipline: 'Orthopedics · Physio',
    overview:
      'Upper arm bone articulating proximally at the glenohumeral shoulder joint and distally with the radius and ulna at the elbow.',
  },
  brain: {
    discipline: 'Neurology',
    overview:
      'Central command organ of the nervous system integrating sensory perception, voluntary motor planning, language, memory, and autonomic homeostasis.',
  },
  liver: {
    discipline: 'Gastroenterology',
    overview:
      'Largest internal metabolic organ sitting beneath the right diaphragm; filters portal blood, synthesizes plasma proteins, detoxifies metabolites, and secretes bile.',
  },
  stomach: {
    discipline: 'Gastroenterology',
    overview:
      'J-shaped muscular reservoir between the esophagus and duodenum that churns food with hydrochloric acid and pepsin into chyme.',
  },
  spleen: {
    discipline: 'Immunology',
    overview:
      'Vascular lymphoid organ in the left upper quadrant that filters senescent red blood cells and mounts rapid immune responses to blood-borne antigens.',
  },
  pancreas: {
    discipline: 'Endocrine · Digestive',
    overview:
      'Retroperitoneal gland with both exocrine digestive enzyme secretion into the duodenum and endocrine islet secretion of insulin and glucagon.',
  },
  'urinary bladder': {
    discipline: 'Urology',
    overview:
      'Distensible detrusor muscle reservoir in the anterior pelvis storing urine delivered from both kidneys via the ureters.',
  },
};

export function getStructureExplanation(
  name: string,
  system: SystemId
): { text: string; discipline: string; isSpecific: boolean } {
  const lower = name.toLowerCase();
  const exact = CLINICAL_EXPLANATIONS[lower];
  if (exact) {
    return {
      text: exact.overview,
      discipline: exact.discipline ?? SYSTEM_BY_ID[system].name,
      isSpecific: true,
    };
  }

  // Keyword-aware educational context for key specialties
  if (/tooth|molar|premolar|incisor|canine|gingiva|palate|mandib|maxill|masseter|temporalis/.test(lower)) {
    return {
      text: `${SYSTEM_BY_ID[system].description} Key craniofacial/dental landmark involved in occlusion, mastication, or orofacial innervation.`,
      discipline: 'Dentistry · Craniofacial',
      isSpecific: false,
    };
  }
  if (/lung|bronch|trachea|pleura|larynx|pharynx|diaphragm/.test(lower)) {
    return {
      text: `${SYSTEM_BY_ID[system].description} Participates in pulmonary ventilation, airway patency, or alveolar gas exchange.`,
      discipline: 'Pulmonology',
      isSpecific: false,
    };
  }
  if (/heart|atrium|ventricle|aorta|coronary|pericard|vena cava|pulmonary artery/.test(lower)) {
    return {
      text: `${SYSTEM_BY_ID[system].description} Essential cardiovascular conduit or myocardial structure maintaining systemic and pulmonary perfusion.`,
      discipline: 'Cardiology',
      isSpecific: false,
    };
  }
  if (/femur|tibia|fibula|humerus|radius|ulna|vertebra|pelvis|scapula|clavicle|patella|meniscus|ligament|cartilage/.test(lower)) {
    return {
      text: `${SYSTEM_BY_ID[system].description} Load-bearing skeletal or articular structure fundamental to orthopedic biomechanics and joint stability.`,
      discipline: 'Orthopedics',
      isSpecific: false,
    };
  }
  if (/muscle|tendon|biceps|triceps|deltoid|quadriceps|gluteus|gastrocnemius|pectoralis|latissimus|trapezius|rotator/.test(lower)) {
    return {
      text: `${SYSTEM_BY_ID[system].description} Functional kinetic-chain actuator studied in physiotherapy for range of motion, posture, and rehabilitation.`,
      discipline: 'Physiotherapy',
      isSpecific: false,
    };
  }

  return {
    text: SYSTEM_BY_ID[system]?.description ?? 'Anatomical structure from BodyParts3D adult reference atlas.',
    discipline: SYSTEM_BY_ID[system]?.name ?? 'Anatomy',
    isSpecific: false,
  };
}
