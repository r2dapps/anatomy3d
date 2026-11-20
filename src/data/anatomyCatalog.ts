import rawMeta from './bodyparts3dMeta.json';

export type AnatomySystem = 'skull' | 'brain' | 'musc' | 'eye' | 'hand';
export type AtlasRegion = 'head' | 'hand';

export interface RawMeshMeta {
  n: string;
  l: 'bone' | 'teeth' | 'brain' | 'musc' | 'eye' | 'hand';
  c: [number, number, number];
  h: number;
  nv: number;
  nt: number;
  o: number;
  a: [number, number, number][];
}

export interface AnatomyStructure {
  id: string;
  rawName: string;
  displayName: string;
  latinName: string;
  system: AnatomySystem;
  rawLayer: RawMeshMeta['l'];
  region: AtlasRegion;
  subGroup: string;
  summary: string;
  clinicalNote: string;
  relations: string;
  quizPrompt: string;
  solidColor: [number, number, number];
  xrayColor: [number, number, number];
  roughness: number;
  specular: number;
  subsurface: number;
  isJaw: boolean;
  hideDefaultLabel: boolean;
  center: [number, number, number];
  halfExtent: number;
  vertexCount: number;
  triangleCount: number;
  byteOffset: number;
  anchors: [number, number, number][];
}

export const JAW_PIVOT: readonly [number, number, number] = [-0.009, -0.551, -3.931];
export const PLANE_EYE_Y = 3.271;
export const PLANE_NOSE_Y = -2.089;
export const HEAD_CENTROID: readonly [number, number, number] = [0.05, 1.9, -3.4];

interface StructureEnrichment {
  displayName?: string;
  latinName: string;
  subGroup: string;
  summary: string;
  clinicalNote: string;
  relations: string;
  quizPrompt: string;
  solidColor?: [number, number, number];
  xrayColor?: [number, number, number];
  hideDefaultLabel?: boolean;
}

const ENRICHMENTS: Record<string, StructureEnrichment> = {
  'Frontal bone': {
    latinName: 'Os frontale',
    subGroup: 'Neurocranium',
    summary: 'Forms the forehead, the anterior roof of the cranial vault, and the superior margins of the eye sockets (orbits).',
    clinicalNote: 'Contains the frontal sinuses, air-filled cavities that lighten the skull and resonate vocal frequencies.',
    relations: 'Articulates with parietal, sphenoid, ethmoid, nasal, zygomatic, and maxillary bones.',
    quizPrompt: 'Which unpaired cranial bone forms the forehead and the upper roof of both eye sockets?',
    solidColor: [0.91, 0.87, 0.79],
    xrayColor: [0.68, 0.90, 1.0],
  },
  'Parietal bone': {
    latinName: 'Os parietale',
    subGroup: 'Neurocranium',
    summary: 'Paired curved bones forming the superior roof and lateral walls of the cranium.',
    clinicalNote: 'Grooves on the inner table house the middle meningeal artery, a critical landmark in epidural hematoma.',
    relations: 'Meets along the sagittal suture and joins the frontal, occipital, temporal, and sphenoid bones.',
    quizPrompt: 'Identify the paired bones that form the upper sides and roof of the cranial vault.',
    solidColor: [0.89, 0.85, 0.77],
    xrayColor: [0.66, 0.88, 1.0],
  },
  'Temporal bone': {
    latinName: 'Os temporale',
    subGroup: 'Neurocranium',
    summary: 'Complex paired bones on the lower lateral skull housing the middle and inner ear structures.',
    clinicalNote: 'The petrous part is among the densest bone in the body, shielding the cochlea and vestibular apparatus.',
    relations: 'Forms the temporomandibular joint (TMJ) fossa for the mandible and the zygomatic arch.',
    quizPrompt: 'Which lateral skull bone houses the inner ear and forms the socket of the jaw joint?',
    solidColor: [0.87, 0.83, 0.74],
    xrayColor: [0.62, 0.86, 1.0],
  },
  'Occipital bone': {
    latinName: 'Os occipitale',
    subGroup: 'Neurocranium',
    summary: 'Forms the posterior wall and base of the skull, cradling the occipital lobes and cerebellum.',
    clinicalNote: 'Perforated by the foramen magnum where the brainstem transitions into the spinal cord.',
    relations: 'Articulates inferiorly with the first cervical vertebra (atlas) via the occipital condyles.',
    quizPrompt: 'Which bone forms the back and base of the skull around the foramen magnum?',
    solidColor: [0.88, 0.84, 0.75],
    xrayColor: [0.64, 0.87, 1.0],
  },
  'Sphenoid bone': {
    latinName: 'Os sphenoidale',
    subGroup: 'Cranial Base',
    summary: 'Butterfly-shaped central keystone bone of the cranial base that locks all other cranial bones together.',
    clinicalNote: 'Its sella turcica cradle houses the pituitary gland, and its foramina transmit cranial nerves II–VI.',
    relations: 'Contacts every other cranial bone and contributes to the posterior orbital wall.',
    quizPrompt: 'Which butterfly-shaped keystone bone sits centrally at the skull base and houses the pituitary fossa?',
    solidColor: [0.86, 0.81, 0.71],
    xrayColor: [0.58, 0.85, 1.0],
    hideDefaultLabel: true,
  },
  'Ethmoid bone': {
    latinName: 'Os ethmoidale',
    subGroup: 'Cranial Base',
    summary: 'Delicate, spongy bone located between the eye sockets, forming the roof and upper septum of the nasal cavity.',
    clinicalNote: 'Olfactory nerve fibers pass directly through its perforated cribriform plate into the olfactory bulbs.',
    relations: 'Nestled between the frontal bone, sphenoid, maxillae, and medial orbital walls.',
    quizPrompt: 'Which porous bone sits between the orbits and allows olfactory fibers through its cribriform plate?',
    solidColor: [0.85, 0.80, 0.71],
    xrayColor: [0.60, 0.86, 1.0],
    hideDefaultLabel: true,
  },
  'Zygomatic bone': {
    latinName: 'Os zygomaticum',
    subGroup: 'Viscerocranium',
    summary: 'Paired cheekbones forming the lateral prominence of the face and the inferolateral orbital rim.',
    clinicalNote: 'Transfers biting forces from the maxilla toward the cranial vault and anchors the masseter muscle.',
    relations: 'Bridges the maxilla, frontal, temporal, and sphenoid bones.',
    quizPrompt: 'Locate the paired cheekbones that form the outer rim of the eye sockets.',
    solidColor: [0.90, 0.86, 0.78],
    xrayColor: [0.70, 0.91, 1.0],
  },
  'Nasal bone': {
    latinName: 'Os nasale',
    subGroup: 'Viscerocranium',
    summary: 'Two small oblong bones meeting at the midline to form the bony bridge of the nose.',
    clinicalNote: 'Because of their anterior prominence and thin profile, these are the most frequently fractured facial bones.',
    relations: 'Articulates superiorly with the frontal bone and laterally with the maxillae.',
    quizPrompt: 'Which small paired bones form the upper bony bridge of the nose?',
    solidColor: [0.92, 0.88, 0.80],
    xrayColor: [0.74, 0.93, 1.0],
  },
  Maxilla: {
    latinName: 'Maxilla',
    subGroup: 'Viscerocranium',
    summary: 'Upper jaw bone forming the central facial skeleton, hard palate, floor of the orbits, and upper dental arch.',
    clinicalNote: 'Houses the largest paranasal sinuses (maxillary sinuses) directly above the upper premolar and molar roots.',
    relations: 'Supports the upper teeth and articulates with every facial bone except the mandible.',
    quizPrompt: 'Identify the upper jaw bone that forms the hard palate and anchors the upper teeth.',
    solidColor: [0.90, 0.85, 0.76],
    xrayColor: [0.69, 0.90, 1.0],
  },
  Mandible: {
    latinName: 'Mandibula',
    subGroup: 'Viscerocranium',
    summary: 'The largest, strongest, and only freely movable bone of the human skull, carrying the lower dental arch.',
    clinicalNote: 'Hinges and glides at the paired temporomandibular joints (TMJs) during speech and mastication.',
    relations: 'Provides insertion sites for the masseter, temporalis, and pterygoid chewing muscles.',
    quizPrompt: 'Which U-shaped bone is the only freely movable bone of the skull?',
    solidColor: [0.91, 0.87, 0.78],
    xrayColor: [0.72, 0.92, 1.0],
  },
  Teeth: {
    displayName: 'Upper Teeth',
    latinName: 'Dentes superiores',
    subGroup: 'Dentition',
    summary: 'Maxillary dental arcade composed of incisors, canines, premolars, and molars embedded in alveolar sockets.',
    clinicalNote: 'Tooth enamel is the hardest mineralized tissue in the human body, composed of ~96% hydroxyapatite.',
    relations: 'Anchored within the alveolar process of the maxilla via periodontal ligaments.',
    quizPrompt: 'Select the upper dental arch anchored in the alveolar sockets of the maxilla.',
    solidColor: [0.97, 0.96, 0.93],
    xrayColor: [0.95, 0.99, 1.0],
  },
  'Lower teeth': {
    displayName: 'Lower Teeth',
    latinName: 'Dentes inferiores',
    subGroup: 'Dentition',
    summary: 'Mandibular dental arcade that articulates with the upper teeth during chewing and speech articulation.',
    clinicalNote: 'Innervated by the inferior alveolar nerve running inside the mandibular canal.',
    relations: 'Embedded in the alveolar part of the mandible and moves dynamically with the lower jaw.',
    quizPrompt: 'Identify the lower dental arcade that moves together with the mandible.',
    solidColor: [0.96, 0.95, 0.92],
    xrayColor: [0.94, 0.98, 1.0],
    hideDefaultLabel: true,
  },
  'Frontal lobe': {
    latinName: 'Lobus frontalis',
    subGroup: 'Cerebrum',
    summary: 'Largest cerebral lobe, directing executive planning, decision-making, expressive speech, and voluntary motor control.',
    clinicalNote: 'Contains the primary motor cortex along the precentral gyrus and Broca speech area in the dominant hemisphere.',
    relations: 'Lies deep to the frontal bone and anterior to the central sulcus and parietal lobe.',
    quizPrompt: 'Which cerebral lobe governs executive planning, decision-making, and voluntary movement?',
    solidColor: [0.80, 0.56, 0.68],
    xrayColor: [0.88, 0.48, 0.84],
  },
  'Parietal lobe': {
    latinName: 'Lobus parietalis',
    subGroup: 'Cerebrum',
    summary: 'Integrates somatosensory touch, proprioception, spatial orientation, and multisensory body awareness.',
    clinicalNote: 'The postcentral gyrus maps touch across the body in the classic sensory homunculus.',
    relations: 'Positioned behind the central sulcus, above the temporal lobe, and beneath the parietal bones.',
    quizPrompt: 'Which lobe integrates touch, spatial awareness, and body position?',
    solidColor: [0.56, 0.62, 0.84],
    xrayColor: [0.52, 0.60, 0.98],
  },
  'Temporal lobe': {
    latinName: 'Lobus temporalis',
    subGroup: 'Cerebrum',
    summary: 'Processes auditory perception, spoken language comprehension, facial recognition, and declarative memory.',
    clinicalNote: 'Houses the hippocampus medially and Wernicke receptive language cortex on the superior temporal gyrus.',
    relations: 'Sits inferior to the lateral (Sylvian) fissure, protected by the temporal bone.',
    quizPrompt: 'Locate the lateral cerebral lobe responsible for hearing, memory, and language comprehension.',
    solidColor: [0.44, 0.74, 0.76],
    xrayColor: [0.35, 0.86, 0.88],
  },
  'Occipital lobe': {
    latinName: 'Lobus occipitalis',
    subGroup: 'Cerebrum',
    summary: 'Posterior visual processing center decoding color, motion, depth, and spatial form from retinal signals.',
    clinicalNote: 'The primary visual cortex flanks the calcarine sulcus on the medial surface of the lobe.',
    relations: 'Rests on the tentorium cerebelli directly above the cerebellum and beneath the occipital bone.',
    quizPrompt: 'Which posterior cerebral lobe is dedicated to visual processing?',
    solidColor: [0.84, 0.64, 0.48],
    xrayColor: [0.96, 0.68, 0.42],
  },
  'Cerebral white matter': {
    latinName: 'Substantia alba cerebri',
    subGroup: 'Cerebrum',
    summary: 'Dense network of myelinated axons linking cortical regions within and between hemispheres via the corpus callosum.',
    clinicalNote: 'Myelin sheaths insulate axons for saltatory conduction, accelerating neural signaling up to 100 m/s.',
    relations: 'Forms the deep interior core beneath the cortical gray matter of all four cerebral lobes.',
    quizPrompt: 'Identify the deep myelinated tract core connecting cerebral hemispheres and lobes.',
    solidColor: [0.88, 0.82, 0.84],
    xrayColor: [0.72, 0.58, 0.94],
    hideDefaultLabel: true,
  },
  Cerebellum: {
    latinName: 'Cerebellum',
    subGroup: 'Hindbrain',
    summary: 'Tightly folded posterior brain structure that coordinates fine motor timing, balance, posture, and motor learning.',
    clinicalNote: 'Contains more than half of all neurons in the entire human brain despite representing ~10% of brain volume.',
    relations: 'Occupies the posterior cranial fossa behind the pons and beneath the occipital lobes.',
    quizPrompt: 'Which finely folded hindbrain structure coordinates balance and smooth voluntary movement?',
    solidColor: [0.54, 0.68, 0.82],
    xrayColor: [0.46, 0.72, 0.98],
  },
  Pons: {
    latinName: 'Pons',
    subGroup: 'Brainstem',
    summary: 'Prominent brainstem bridge relaying motor and sensory pathways between the cerebrum, cerebellum, and spinal cord.',
    clinicalNote: 'Houses nuclei for cranial nerves V–VIII and respiratory rhythm centers (pneumotaxic center).',
    relations: 'Positioned superior to the medulla oblongata and anterior to the cerebellum.',
    quizPrompt: 'Which bulging brainstem bridge relays signals between the cerebrum and cerebellum?',
    solidColor: [0.86, 0.70, 0.55],
    xrayColor: [0.98, 0.76, 0.46],
  },
  'Medulla oblongata': {
    latinName: 'Medulla oblongata',
    subGroup: 'Brainstem',
    summary: 'Inferior brainstem segment regulating vital autonomic functions including heart rate, blood pressure, and breathing.',
    clinicalNote: 'Motor corticospinal tracts cross sides here at the decussation of the pyramids.',
    relations: 'Extends inferiorly from the pons through the foramen magnum to become the spinal cord.',
    quizPrompt: 'Which lower brainstem segment controls vital autonomic functions like breathing and heart rate?',
    solidColor: [0.84, 0.58, 0.66],
    xrayColor: [0.96, 0.54, 0.72],
  },
  Frontalis: {
    displayName: 'Frontalis Muscle',
    latinName: 'Venter frontalis m. occipitofrontalis',
    subGroup: 'Facial Expression',
    summary: 'Broad sheet-like muscle over the forehead that elevates the eyebrows and furrows horizontal expression lines.',
    clinicalNote: 'Innervated by the temporal branch of the facial nerve (CN VII); has no bony insertion anteriorly.',
    relations: 'Overlies the frontal bone and blends inferiorly with the orbicularis oculi and skin of the brow.',
    quizPrompt: 'Which broad forehead muscle elevates the eyebrows and wrinkles the brow?',
    solidColor: [0.76, 0.30, 0.29],
    xrayColor: [1.0, 0.38, 0.34],
  },
  Temporalis: {
    displayName: 'Temporalis Muscle',
    latinName: 'Musculus temporalis',
    subGroup: 'Mastication',
    summary: 'Broad fan-shaped chewing muscle filling the temporal fossa that powerfully elevates and retracts the mandible.',
    clinicalNote: 'Its tendon passes deep to the zygomatic arch to insert on the coronoid process of the mandible.',
    relations: 'Covers the temporal and lower parietal bones; innervated by the mandibular nerve (CN V3).',
    quizPrompt: 'Identify the broad fan-shaped chewing muscle on the side of the skull.',
    solidColor: [0.73, 0.27, 0.27],
    xrayColor: [1.0, 0.35, 0.32],
  },
  Masseter: {
    displayName: 'Masseter Muscle',
    latinName: 'Musculus masseter',
    subGroup: 'Mastication',
    summary: 'Thick, quadrilateral chewing muscle generating the greatest closing force of the lower jaw during biting.',
    clinicalNote: 'By cross-sectional force ratio, the masseter is one of the strongest muscles in the human body.',
    relations: 'Spans from the zygomatic arch down to the lateral ramus and angle of the mandible.',
    quizPrompt: 'Which thick quadrilateral muscle along the cheek angle delivers primary jaw-closing force?',
    solidColor: [0.78, 0.28, 0.27],
    xrayColor: [1.0, 0.36, 0.33],
  },
  'Orbicularis oculi': {
    latinName: 'Musculus orbicularis oculi',
    subGroup: 'Facial Expression',
    summary: 'Concentric sphincter muscle encircling the eye socket that blinks, gently closes, and tightly squeezes the eyelids.',
    clinicalNote: 'Its lacrimal part pumps tears across the eye surface toward the nasolacrimal duct.',
    relations: 'Surrounds the orbital rim over the frontal, zygomatic, and maxillary bones.',
    quizPrompt: 'Which ring-shaped muscle encircles the eye socket to close the eyelids?',
    solidColor: [0.75, 0.32, 0.31],
    xrayColor: [1.0, 0.42, 0.38],
  },
  'Orbicularis oris': {
    latinName: 'Musculus orbicularis oris',
    subGroup: 'Facial Expression',
    summary: 'Complex circular muscle framing the mouth that closes, protrudes, and shapes the lips for speech and whistling.',
    clinicalNote: 'Serves as an anchor hub where surrounding buccinator, zygomaticus, and depressor fibers interlace.',
    relations: 'Lies anteriorly over the maxillary and mandibular dental arches.',
    quizPrompt: 'Which sphincter muscle encircles the mouth to close and purse the lips?',
    solidColor: [0.79, 0.31, 0.30],
    xrayColor: [1.0, 0.40, 0.36],
  },
  'Depressor anguli oris': {
    latinName: 'Musculus depressor anguli oris',
    subGroup: 'Facial Expression',
    summary: 'Triangular lower facial muscle that pulls the corner of the mouth downward during frowning.',
    clinicalNote: 'Innervated by the marginal mandibular branch of the facial nerve (CN VII).',
    relations: 'Arises along the oblique line of the mandible and converges at the modiolus beside the mouth.',
    quizPrompt: 'Which triangular muscle below the mouth corner draws the lip angle downward?',
    solidColor: [0.74, 0.29, 0.29],
    xrayColor: [1.0, 0.38, 0.36],
  },
  Zygomaticus: {
    displayName: 'Zygomaticus Muscle',
    latinName: 'Musculus zygomaticus major & minor',
    subGroup: 'Facial Expression',
    summary: 'Slender cheek muscles extending from the cheekbone to the mouth corner to draw the lips upward in a smile.',
    clinicalNote: 'Works synergistically with orbicularis oculi to produce a genuine Duchenne smile.',
    relations: 'Runs obliquely from the zygomatic bone to the orbicularis oris at the corner of the mouth.',
    quizPrompt: 'Which diagonal cheek muscle pulls the corners of the mouth upward when smiling?',
    solidColor: [0.77, 0.31, 0.30],
    xrayColor: [1.0, 0.41, 0.37],
    hideDefaultLabel: true,
  },
  Buccinator: {
    displayName: 'Buccinator Muscle',
    latinName: 'Musculus buccinator',
    subGroup: 'Facial Expression',
    summary: 'Deep cheek wall muscle that compresses the cheek against the teeth to keep food centered during chewing.',
    clinicalNote: 'Pierced by the parotid salivary gland duct opposite the upper second molar tooth.',
    relations: 'Lies deep to the masseter, bridging the maxilla and mandible into the orbicularis oris.',
    quizPrompt: 'Which deep cheek muscle presses the cheek inward against the teeth while chewing?',
    solidColor: [0.71, 0.26, 0.27],
    xrayColor: [0.98, 0.34, 0.32],
    hideDefaultLabel: true,
  },
  Eyeball: {
    displayName: 'Eyeballs (Ocular Globes)',
    latinName: 'Bulbus oculi',
    subGroup: 'Special Senses',
    summary: 'Paired optical globes (~24 mm diameter) focusing light through the cornea and lens onto retinal photoreceptors.',
    clinicalNote: 'Precisely steered by six extraocular muscles controlled by cranial nerves III, IV, and VI.',
    relations: 'Suspended inside the bony orbits cushioned by retrobulbar orbital fat.',
    quizPrompt: 'Locate the paired spherical sensory organs suspended within the bony orbits.',
    solidColor: [0.88, 0.92, 0.96],
    xrayColor: [0.42, 0.80, 1.0],
  },
  'Carpal bones': {
    latinName: 'Ossa carpi',
    subGroup: 'Carpus (Wrist)',
    summary: 'Eight tightly interlocked wrist bones arranged in proximal and distal rows forming the carpal arch.',
    clinicalNote: 'Forms the floor and walls of the carpal tunnel transmitting the median nerve and flexor tendons.',
    relations: 'Articulates proximally with the radius and distally with the five metacarpal bases.',
    quizPrompt: 'Identify the cluster of eight wrist bones forming the carpal arch at the base of the hand.',
    solidColor: [0.90, 0.85, 0.77],
    xrayColor: [0.72, 0.91, 1.0],
  },
};

const DIGIT_NAMES = ['Thumb (1st)', 'Index (2nd)', 'Middle (3rd)', 'Ring (4th)', 'Little (5th)'];
const DIGIT_ROMAN = ['I', 'II', 'III', 'IV', 'V'];

function enrichHandBone(rawName: string): StructureEnrichment {
  const num = Number(rawName.slice(2)) || 1;
  const digitLabel = DIGIT_NAMES[num - 1] ?? `Digit ${num}`;
  const roman = DIGIT_ROMAN[num - 1] ?? String(num);

  if (rawName.startsWith('MC')) {
    return {
      displayName: `${digitLabel} Metacarpal`,
      latinName: `Os metacarpi ${roman}`,
      subGroup: 'Metacarpus (Palm)',
      summary: `Long tubular palm bone supporting the ${digitLabel.toLowerCase()} ray and forming the knuckle head distally.`,
      clinicalNote:
        num === 1
          ? 'The 1st metacarpal articulates via a saddle joint at the trapezium, enabling thumb opposition.'
          : 'Metacarpal shafts transmit grip load from the fingers to the carpal arch.',
      relations: 'Articulates proximally with the distal carpal row and distally with the proximal phalanx.',
      quizPrompt: `Select the palm bone (metacarpal) belonging to the ${digitLabel.toLowerCase()} ray.`,
      solidColor: [0.91, 0.87, 0.79],
      xrayColor: [0.76, 0.93, 1.0],
    };
  }
  if (rawName.startsWith('PP')) {
    return {
      displayName: `${digitLabel} Proximal Phalanx`,
      latinName: `Phalanx proximalis digiti ${roman}`,
      subGroup: 'Phalanges',
      summary: `First finger bone directly distal to the metacarpophalangeal (knuckle) joint of the ${digitLabel.toLowerCase()} digit.`,
      clinicalNote: 'Flattened palmar shaft guides the flexor digitorum tendon sheaths.',
      relations:
        num === 1
          ? 'Connects the 1st metacarpal to the distal phalanx of the thumb.'
          : 'Articulates proximally with its metacarpal and distally with the middle phalanx.',
      quizPrompt: `Locate the proximal phalanx (base finger segment) of the ${digitLabel.toLowerCase()} digit.`,
      solidColor: [0.90, 0.86, 0.78],
      xrayColor: [0.74, 0.92, 1.0],
    };
  }
  if (rawName.startsWith('MP')) {
    return {
      displayName: `${digitLabel} Middle Phalanx`,
      latinName: `Phalanx media digiti ${roman}`,
      subGroup: 'Phalanges',
      summary: `Intermediate finger bone between the PIP and DIP hinge joints of the ${digitLabel.toLowerCase()} finger.`,
      clinicalNote: 'Only digits II–V possess a middle phalanx; the thumb has just proximal and distal phalanges.',
      relations: 'Provides insertion for the flexor digitorum superficialis tendon.',
      quizPrompt: `Identify the middle phalanx of the ${digitLabel.toLowerCase()} finger.`,
      solidColor: [0.89, 0.85, 0.77],
      xrayColor: [0.70, 0.90, 1.0],
    };
  }
  return {
    displayName: `${digitLabel} Distal Phalanx`,
    latinName: `Phalanx distalis digiti ${roman}`,
    subGroup: 'Phalanges',
    summary: `Terminal fingertip bone of the ${digitLabel.toLowerCase()} digit, capped by a rough tuft supporting the nail bed.`,
    clinicalNote: 'Distal tuft anchors fibrous septa of the fingertip pulp for high-acuity tactile grip.',
    relations:
      num === 1
        ? 'Articulates with the proximal phalanx at the thumb interphalangeal joint.'
        : 'Articulates with the middle phalanx at the distal interphalangeal (DIP) joint.',
    quizPrompt: `Select the fingertip bone (distal phalanx) of the ${digitLabel.toLowerCase()} digit.`,
    solidColor: [0.92, 0.88, 0.80],
    xrayColor: [0.80, 0.95, 1.0],
  };
}

function getTissueOpticalProps(rawLayer: RawMeshMeta['l']): {
  roughness: number;
  specular: number;
  subsurface: number;
} {
  switch (rawLayer) {
    case 'teeth':
      return { roughness: 0.16, specular: 0.85, subsurface: 0.12 };
    case 'eye':
      return { roughness: 0.12, specular: 0.95, subsurface: 0.18 };
    case 'brain':
      return { roughness: 0.36, specular: 0.45, subsurface: 0.38 };
    case 'musc':
      return { roughness: 0.48, specular: 0.32, subsurface: 0.34 };
    case 'hand':
    case 'bone':
    default:
      return { roughness: 0.56, specular: 0.28, subsurface: 0.14 };
  }
}

export function mapRawLayerToSystem(rawLayer: RawMeshMeta['l']): AnatomySystem {
  if (rawLayer === 'bone' || rawLayer === 'teeth') return 'skull';
  return rawLayer;
}

export const ANATOMY_CATALOG: AnatomyStructure[] = (rawMeta as RawMeshMeta[]).map((m) => {
  const enrich = ENRICHMENTS[m.n] ?? enrichHandBone(m.n);
  const system = mapRawLayerToSystem(m.l);
  const region: AtlasRegion = m.l === 'hand' ? 'hand' : 'head';
  const optical = getTissueOpticalProps(m.l);

  return {
    id: m.n.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    rawName: m.n,
    displayName: enrich.displayName ?? m.n,
    latinName: enrich.latinName,
    system,
    rawLayer: m.l,
    region,
    subGroup: enrich.subGroup,
    summary: enrich.summary,
    clinicalNote: enrich.clinicalNote,
    relations: enrich.relations,
    quizPrompt: enrich.quizPrompt,
    solidColor: enrich.solidColor ?? [0.9, 0.86, 0.78],
    xrayColor: enrich.xrayColor ?? [0.75, 0.9, 1.0],
    roughness: optical.roughness,
    specular: optical.specular,
    subsurface: optical.subsurface,
    isJaw: m.n === 'Mandible' || m.n === 'Lower teeth',
    hideDefaultLabel: Boolean(enrich.hideDefaultLabel),
    center: m.c,
    halfExtent: m.h,
    vertexCount: m.nv,
    triangleCount: m.nt,
    byteOffset: m.o,
    anchors: m.a,
  };
});

export const ANATOMY_BY_ID: Record<string, AnatomyStructure> = Object.fromEntries(
  ANATOMY_CATALOG.map((item) => [item.id, item])
);

export const SYSTEM_META: Record<
  AnatomySystem,
  { label: string; shortLabel: string; swatch: string; xraySwatch: string }
> = {
  skull: {
    label: 'Skull & Teeth',
    shortLabel: 'Skeletal',
    swatch: '#d6c8ae',
    xraySwatch: '#7cc4e8',
  },
  brain: {
    label: 'Brain & Brainstem',
    shortLabel: 'Nervous',
    swatch: '#c48cb3',
    xraySwatch: '#b689f2',
  },
  musc: {
    label: 'Head Muscles',
    shortLabel: 'Muscular',
    swatch: '#c8524d',
    xraySwatch: '#f87171',
  },
  eye: {
    label: 'Ocular Globes',
    shortLabel: 'Sensory',
    swatch: '#5ba4cf',
    xraySwatch: '#38bdf8',
  },
  hand: {
    label: 'Hand Skeleton',
    shortLabel: 'Hand Bones',
    swatch: '#cbbda3',
    xraySwatch: '#89d4f5',
  },
};
