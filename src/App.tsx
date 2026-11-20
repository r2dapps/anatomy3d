import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Camera,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  GraduationCap,
  Info,
  Layers3,
  Pause,
  RotateCcw,
  RotateCw,
  Scan,
  Scissors,
  Search,
  Sun,
  Undo2,
} from 'lucide-react';
import {
  DEFAULT_VISIBLE_SYSTEMS,
  SYSTEMS,
  type CameraView,
  type ClinicalTrack,
  type Concept,
  type FullBodyAtlas,
  type FullBodyShaderMode,
  type Part,
  type SystemId,
} from './data/fullBodyAnatomy.ts';
import {
  SPECIALTY_LABS,
  type GuidedTourStep,
  type PhysiologicalMotion,
} from './data/studyCurriculum.ts';
import {
  DEFAULT_SECTION_CUT,
  advanceStudyQuiz,
  createStudyQuizSession,
  getClinicalTrack,
  isPartVisible,
  submitStudyQuizAnswer,
  type QualityTier,
  type SectionCutAxis,
  type SectionCutState,
  type StudyQuizSession,
} from './utils/fullBodyLogic.ts';
import {
  FullBodyViewport,
  type FullBodySceneState,
  type FullBodyViewportHandle,
} from './components/FullBodyViewport.tsx';
import {
  checkWebXrSupport,
  formatCalloutLabel,
  resolveAssetUrl,
  type TourLabelSpec,
  type WebXrCapability,
} from './utils/xrAndLabelsLogic.ts';
import { LayersDrawer } from './components/LayersDrawer.tsx';
import { StructureSheet } from './components/StructureSheet.tsx';
import { StudyLabPanel, type StudyLabMode } from './components/StudyLabPanel.tsx';
import { SearchPopover } from './components/SearchPopover.tsx';
import { SplashScreen } from './components/SplashScreen.tsx';
import { AboutModal } from './components/AboutModal.tsx';
import { XRayMirrorView } from './components/XRayMirrorView.tsx';

type BottomDockTool = 'explode' | 'section';

interface HiddenBatch {
  label: string;
  ids: string[];
}

export default function App() {
  const viewportRef = useRef<FullBodyViewportHandle>(null);

  // Full-body atlas manifest & splash screen loading state
  const [atlas, setAtlas] = useState<FullBodyAtlas | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [splashMounted, setSplashMounted] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSoftwareGl, setIsSoftwareGl] = useState(false);

  // Workspace mode: Full-Body 3D Explorer (primary) vs optional Live X-Ray Mirror
  const [mirrorOpen, setMirrorOpen] = useState(false);

  // Clean panel toggles (Right Systems drawer, Left contextual Study Lab / Structure sheet)
  const [layersOpen, setLayersOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1100 : true
  );
  const [layersTab, setLayersTab] = useState<'systems' | 'hidden'>('systems');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [aboutOpen, setAboutOpen] = useState(false);

  // Bottom dock tool switch (Explode vs Section Cut X/Y/Z) & mobile collapsible states
  const [dockTool, setDockTool] = useState<BottomDockTool>('explode');
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [mobileDockCollapsed, setMobileDockCollapsed] = useState(false);

  // Core anatomical exploration state
  const [activeTrack, setActiveTrack] = useState<ClinicalTrack>('all');
  const [visibleSystems, setVisibleSystems] = useState<SystemId[]>(DEFAULT_VISIBLE_SYSTEMS);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [selectedPartIds, setSelectedPartIds] = useState<string[]>([]);
  const [hiddenPartIds, setHiddenPartIds] = useState<string[]>([]);
  const [hiddenHistory, setHiddenHistory] = useState<HiddenBatch[]>([]);
  const [peelMode, setPeelMode] = useState(false);
  const [isolate, setIsolate] = useState(false);
  const [explode, setExplode] = useState(0);
  const [sectionCut, setSectionCut] = useState<SectionCutState>(DEFAULT_SECTION_CUT);
  const [motion, setMotion] = useState<PhysiologicalMotion>('none');
  const [view, setView] = useState<CameraView>('three-quarter');
  const [rotate, setRotate] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [focusBox, setFocusBox] = useState<{
    center: [number, number, number];
    distance: number;
    token: number;
  } | null>(null);

  // Interactive Study Lab state (Guided 3D Tours + 3D Identify Quiz + 3D Labels)
  const [studyLabOpen, setStudyLabOpen] = useState(false);
  const [studyLabMode, setStudyLabMode] = useState<StudyLabMode>('tour');
  const [tourIndex, setTourIndex] = useState(0);
  const [showTourLabels, setShowTourLabels] = useState(true);
  const [quizSession, setQuizSession] = useState<StudyQuizSession>(() =>
    createStudyQuizSession(SPECIALTY_LABS.all.quiz.length)
  );

  // High-fidelity shader, mobile GPU budget & Quest 2 WebXR VR state
  const [shaderMode, setShaderMode] = useState<FullBodyShaderMode>('solid');
  const [exposure, setExposure] = useState(1.0);
  const [qualityTier, setQualityTier] = useState<QualityTier>('auto');
  const [vrCapability, setVrCapability] = useState<WebXrCapability>('checking');
  const [vrActive, setVrActive] = useState(false);
  const [vrNotice, setVrNotice] = useState<string | null>(null);

  // Probe WebXR headset compatibility once on mount
  useEffect(() => {
    let active = true;
    checkWebXrSupport().then((cap) => {
      if (active) setVrCapability(cap);
    });
    return () => {
      active = false;
    };
  }, []);

  // Smoothly unmount splash screen after fade-out at 100%
  const splashVisible = !errorMsg && loadProgress < 100;
  useEffect(() => {
    if (!splashVisible) {
      const id = setTimeout(() => setSplashMounted(false), 420);
      return () => clearTimeout(id);
    }
    setSplashMounted(true);
  }, [splashVisible]);

  // Load full-body atlas metadata manifest once (works at '/' and GitHub Pages subpaths)
  useEffect(() => {
    const controller = new AbortController();
    const manifestUrl = resolveAssetUrl('/models/atlas.json', import.meta.env.BASE_URL);
    fetch(manifestUrl, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Could not load full-body anatomy manifest.');
        return res.json() as Promise<FullBodyAtlas>;
      })
      .then((data) => setAtlas(data))
      .catch((err) => {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setErrorMsg(err instanceof Error ? err.message : 'Unable to load anatomy metadata.');
        }
      });
    return () => controller.abort();
  }, []);

  // Fast lookup maps for 2,234 parts & 3,432 concepts
  const partMap = useMemo(() => {
    const m = new Map<string, Part>();
    atlas?.parts.forEach((p) => m.set(p.id, p));
    return m;
  }, [atlas]);

  const conceptMap = useMemo(() => {
    const m = new Map<string, Concept>();
    atlas?.concepts.forEach((c) => m.set(c.id, c));
    return m;
  }, [atlas]);

  const conceptByName = useMemo(() => {
    const m = new Map<string, Concept>();
    atlas?.concepts.forEach((c) => {
      const key = c.name.toLowerCase();
      if (!m.has(key)) m.set(key, c);
    });
    return m;
  }, [atlas]);

  const systemCounts = useMemo(() => {
    const counts = Object.fromEntries(SYSTEMS.map((s) => [s.id, 0])) as Record<SystemId, number>;
    atlas?.parts.forEach((p) => {
      counts[p.system] = (counts[p.system] ?? 0) + 1;
    });
    return counts;
  }, [atlas]);

  const hiddenSet = useMemo(() => new Set(hiddenPartIds), [hiddenPartIds]);
  const visibleSystemSet = useMemo(() => new Set(visibleSystems), [visibleSystems]);
  const selectedSet = useMemo(() => new Set(selectedPartIds), [selectedPartIds]);

  const visiblePartCount = useMemo(() => {
    if (!atlas) return 0;
    let count = 0;
    for (let i = 0; i < atlas.parts.length; i++) {
      if (isPartVisible(atlas.parts[i], visibleSystemSet, selectedSet, hiddenSet, isolate)) {
        count++;
      }
    }
    return count;
  }, [atlas, visibleSystemSet, selectedSet, hiddenSet, isolate]);

  const hiddenParts = useMemo(
    () => hiddenPartIds.map((id) => partMap.get(id)).filter((p): p is Part => Boolean(p)),
    [hiddenPartIds, partMap]
  );

  const selectedParts = useMemo(
    () => selectedPartIds.map((id) => partMap.get(id)).filter((p): p is Part => Boolean(p)),
    [selectedPartIds, partMap]
  );

  const selectedConcept = useMemo<Concept | null>(() => {
    if (selectedConceptId) {
      const c = conceptMap.get(selectedConceptId);
      if (c) return c;
    }
    const first = selectedParts[0];
    if (!first) return null;
    return { id: first.conceptId || first.id, name: first.name, elements: [first.id] };
  }, [selectedConceptId, conceptMap, selectedParts]);

  // Keep left side mutually exclusive: Study Lab panel OR Structure Sheet
  const inspectorOpen = !studyLabOpen && selectedParts.length > 0 && Boolean(selectedConcept);
  const isDark = !mirrorOpen && shaderMode === 'xray';

  // Helper to highlight one or multiple named anatomical concepts cleanly in 3D
  const highlightNamedConcepts = useCallback(
    (names?: string[]): string[] => {
      if (!names || names.length === 0) {
        setSelectedConceptId(null);
        setSelectedPartIds([]);
        return [];
      }
      const combinedIds: string[] = [];
      let primaryConceptId: string | null = null;
      for (const rawName of names) {
        const match = conceptByName.get(rawName.toLowerCase());
        if (!match) continue;
        if (!primaryConceptId) primaryConceptId = match.id;
        for (const id of match.elements) {
          if (partMap.has(id) && !combinedIds.includes(id)) {
            combinedIds.push(id);
          }
        }
      }
      setSelectedConceptId(primaryConceptId);
      setSelectedPartIds(combinedIds);
      return combinedIds;
    },
    [conceptByName, partMap]
  );

  const highlightNamedConcept = useCallback(
    (name?: string) => {
      highlightNamedConcepts(name ? [name] : undefined);
    },
    [highlightNamedConcepts]
  );

  // Resolve 3D callout labels for the active Guided Tour step (automatically hidden during quizzes)
  const tourLabelSpecs = useMemo<TourLabelSpec[]>(() => {
    if (!studyLabOpen || studyLabMode !== 'tour' || !atlas) return [];
    const lab = SPECIALTY_LABS[activeTrack] ?? SPECIALTY_LABS.all;
    const step = lab.tourSteps[tourIndex] ?? lab.tourSteps[0];
    if (!step) return [];

    const names =
      step.highlightConcepts && step.highlightConcepts.length > 0
        ? step.highlightConcepts
        : step.highlightConcept
        ? [step.highlightConcept]
        : [];

    const specs: TourLabelSpec[] = [];
    for (const rawName of names) {
      const match = conceptByName.get(rawName.toLowerCase());
      if (!match) continue;
      const validIds = match.elements.filter((id) => partMap.has(id));
      if (validIds.length === 0) continue;
      const primaryPart = partMap.get(validIds[0]);
      specs.push({
        id: `${step.id}:${match.id}`,
        label: formatCalloutLabel(rawName),
        conceptName: rawName,
        partIds: validIds,
        system: primaryPart?.system ?? 'skeletal',
      });
    }
    return specs;
  }, [studyLabOpen, studyLabMode, atlas, activeTrack, tourIndex, conceptByName, partMap]);

  const handleToggleVrMode = useCallback(async () => {
    setVrNotice(null);
    if (vrActive) {
      await viewportRef.current?.exitVr();
      return;
    }
    const res = await viewportRef.current?.enterVr();
    if (res && !res.ok && res.message) {
      setVrNotice(res.message);
    }
  }, [vrActive]);

  // Apply a guided tour step smoothly to the 3D scene (never auto-enables section cut!)
  const applyTourStep = useCallback(
    (step: GuidedTourStep) => {
      setVisibleSystems(step.systems);
      setShaderMode(step.shaderMode);
      setRotate(false);
      setExplode(step.explode ?? 0);
      setSectionCut(DEFAULT_SECTION_CUT);
      setDockTool('explode');
      setMotion(step.motion ?? 'none');
      const conceptList =
        step.highlightConcepts && step.highlightConcepts.length > 0
          ? step.highlightConcepts
          : step.highlightConcept
          ? [step.highlightConcept]
          : [];
      const highlightedIds = highlightNamedConcepts(conceptList);
      const shouldIsolate = Boolean(step.isolateHighlight && highlightedIds.length > 0);
      setIsolate(shouldIsolate);
      if (shouldIsolate && typeof window !== 'undefined' && window.innerWidth < 1024) {
        setMobileDockCollapsed(true);
      }
      if (step.focusBox && !shouldIsolate) {
        setFocusBox({ ...step.focusBox, token: Date.now() });
      } else if (!shouldIsolate) {
        setFocusBox(null);
        setView('three-quarter');
        setResetToken((t) => t + 1);
      } else {
        setFocusBox(null);
      }
    },
    [highlightNamedConcepts]
  );

  // Cleanly close Study Lab and clear any leftover section plane, isolation, or tour highlights
  const handleCloseStudyLab = useCallback(() => {
    setStudyLabOpen(false);
    setSheetCollapsed(false);
    setMobileDockCollapsed(false);
    setSectionCut(DEFAULT_SECTION_CUT);
    setDockTool('explode');
    setExplode(0);
    setIsolate(false);
    setMotion('none');
    setSelectedPartIds([]);
    setSelectedConceptId(null);
    setFocusBox(null);
    setResetToken((t) => t + 1);
  }, []);

  // Apply a quiz question scene focus
  const applyQuizQuestion = useCallback(
    (track: ClinicalTrack, qIndex: number) => {
      const lab = SPECIALTY_LABS[track] ?? SPECIALTY_LABS.all;
      const q = lab.quiz[qIndex];
      if (!q) return;
      setVisibleSystems(q.systems);
      if (q.shaderMode) setShaderMode(q.shaderMode);
      else setShaderMode('solid');
      setIsolate(false);
      setExplode(0);
      setSectionCut(DEFAULT_SECTION_CUT);
      setMotion('none');
      setSelectedPartIds([]);
      setSelectedConceptId(null);
      if (q.focusBox) {
        setFocusBox({ ...q.focusBox, token: Date.now() });
      }
    },
    []
  );

  // Fast 1-click Hide (via Peel Mode, Shift+Click, or H shortcut)
  const handleQuickHidePart = useCallback(
    (partId: string) => {
      const part = partMap.get(partId);
      if (!part) return;
      setHiddenPartIds((prev) => (prev.includes(partId) ? prev : [...prev, partId]));
      setHiddenHistory((prev) => [...prev, { label: part.name, ids: [partId] }]);
      setSelectedPartIds((prev) => prev.filter((id) => id !== partId));
    },
    [partMap]
  );

  const handleSelectPart = useCallback(
    (partId: string) => {
      const part = partMap.get(partId);
      if (!part) return;

      // If Study Quiz is active & unanswered, clicking directly on the 3D body submits an answer!
      if (studyLabOpen && studyLabMode === 'quiz' && !quizSession.completed && quizSession.answeredOption === null) {
        const lab = SPECIALTY_LABS[activeTrack] ?? SPECIALTY_LABS.all;
        const q = lab.quiz[quizSession.currentIndex];
        if (q) {
          const clickedConcept = conceptMap.get(part.conceptId)?.name ?? part.name;
          const targetConceptObj = conceptByName.get(q.targetConcept.toLowerCase());
          const matchesTarget =
            clickedConcept.toLowerCase().includes(q.targetConcept.toLowerCase()) ||
            Boolean(targetConceptObj?.elements.includes(part.id));
          const submittedLabel = matchesTarget ? q.targetConcept : clickedConcept;
          setQuizSession((prev) => submitStudyQuizAnswer(prev, submittedLabel, q.targetConcept));
          highlightNamedConcept(q.targetConcept);
          return;
        }
      }

      setSelectedConceptId(part.conceptId || part.id);
      setSelectedPartIds([part.id]);
      setSheetCollapsed(false);
      setRotate(false);
    },
    [
      partMap,
      studyLabOpen,
      studyLabMode,
      quizSession.completed,
      quizSession.answeredOption,
      quizSession.currentIndex,
      activeTrack,
      conceptMap,
      conceptByName,
      highlightNamedConcept,
    ]
  );

  const handleChooseConcept = useCallback(
    (concept: Concept) => {
      const validIds = concept.elements.filter((id) => partMap.has(id));
      if (validIds.length === 0) return;

      const firstPart = partMap.get(validIds[0]);
      if (firstPart) {
        setVisibleSystems((prev) =>
          prev.includes(firstPart.system) ? prev : [...prev, firstPart.system]
        );
      }
      setHiddenPartIds((prev) => prev.filter((id) => !validIds.includes(id)));
      setStudyLabOpen(false);
      setSelectedConceptId(concept.id);
      setSelectedPartIds(validIds);
      setSheetCollapsed(false);
      setIsolate(false);
      setRotate(false);
    },
    [partMap]
  );

  const handleSelectTrack = useCallback(
    (trackId: ClinicalTrack) => {
      const cfg = getClinicalTrack(trackId);
      const lab = SPECIALTY_LABS[trackId] ?? SPECIALTY_LABS.all;
      setActiveTrack(trackId);
      setVisibleSystems(cfg.systems);
      setIsolate(false);
      setSelectedPartIds([]);
      setSelectedConceptId(null);
      setExplode(0);
      setSectionCut(DEFAULT_SECTION_CUT);
      setRotate(false);
      setMotion(lab.motionType !== 'none' ? lab.motionType : 'none');
      setTourIndex(0);
      setQuizSession(createStudyQuizSession(lab.quiz.length));

      if (studyLabOpen) {
        if (studyLabMode === 'tour' && lab.tourSteps[0]) {
          applyTourStep(lab.tourSteps[0]);
        } else {
          applyQuizQuestion(trackId, 0);
        }
        return;
      }

      if (cfg.focusRegionBox) {
        setFocusBox({ ...cfg.focusRegionBox, token: Date.now() });
      } else {
        setFocusBox(null);
        setView('three-quarter');
        setResetToken((t) => t + 1);
      }
    },
    [studyLabOpen, studyLabMode, applyTourStep, applyQuizQuestion]
  );

  const handleStartTour = useCallback(() => {
    const lab = SPECIALTY_LABS[activeTrack] ?? SPECIALTY_LABS.all;
    setStudyLabOpen(true);
    setStudyLabMode('tour');
    setSheetCollapsed(false);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setLayersOpen(false);
      setMobileDockCollapsed(true);
    }
    setTourIndex(0);
    if (lab.tourSteps[0]) applyTourStep(lab.tourSteps[0]);
  }, [activeTrack, applyTourStep]);

  const handleStartQuiz = useCallback(() => {
    const lab = SPECIALTY_LABS[activeTrack] ?? SPECIALTY_LABS.all;
    setStudyLabOpen(true);
    setStudyLabMode('quiz');
    setSheetCollapsed(false);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setLayersOpen(false);
      setMobileDockCollapsed(true);
    }
    setQuizSession(createStudyQuizSession(lab.quiz.length));
    applyQuizQuestion(activeTrack, 0);
  }, [activeTrack, applyQuizQuestion]);

  const handleSelectTourStep = useCallback(
    (index: number) => {
      const lab = SPECIALTY_LABS[activeTrack] ?? SPECIALTY_LABS.all;
      const step = lab.tourSteps[index];
      if (!step) return;
      setTourIndex(index);
      applyTourStep(step);
    },
    [activeTrack, applyTourStep]
  );

  const handleSubmitQuizOption = useCallback(
    (option: string) => {
      const lab = SPECIALTY_LABS[activeTrack] ?? SPECIALTY_LABS.all;
      const q = lab.quiz[quizSession.currentIndex];
      if (!q) return;
      setQuizSession((prev) => submitStudyQuizAnswer(prev, option, q.targetConcept));
      highlightNamedConcept(q.targetConcept);
    },
    [activeTrack, quizSession.currentIndex, highlightNamedConcept]
  );

  const handleNextQuizQuestion = useCallback(() => {
    const next = advanceStudyQuiz(quizSession);
    setQuizSession(next);
    if (!next.completed) {
      applyQuizQuestion(activeTrack, next.currentIndex);
    } else {
      setSelectedPartIds([]);
      setSelectedConceptId(null);
    }
  }, [quizSession, activeTrack, applyQuizQuestion]);

  const handleToggleSystem = useCallback((id: SystemId) => {
    setActiveTrack('all');
    setIsolate(false);
    setVisibleSystems((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }, []);

  const handleSoloSystem = useCallback((id: SystemId) => {
    setActiveTrack('all');
    setIsolate(false);
    setVisibleSystems([id]);
    setSelectedPartIds([]);
    setSelectedConceptId(null);
  }, []);

  const handleHideSelected = useCallback(() => {
    if (selectedPartIds.length === 0) return;
    const label = selectedConcept?.name ?? selectedParts[0]?.name ?? 'Structure';
    const idsToHide = [...selectedPartIds];
    setHiddenPartIds((prev) => Array.from(new Set([...prev, ...idsToHide])));
    setHiddenHistory((prev) => [...prev, { label, ids: idsToHide }]);
    setIsolate(false);
    setSelectedPartIds([]);
    setSelectedConceptId(null);
  }, [selectedPartIds, selectedConcept, selectedParts]);

  const handleUnhidePart = useCallback((partId: string) => {
    setHiddenPartIds((prev) => prev.filter((id) => id !== partId));
  }, []);

  const handleUnhideSelected = useCallback(() => {
    setHiddenPartIds((prev) => prev.filter((id) => !selectedPartIds.includes(id)));
  }, [selectedPartIds]);

  const handleUndoLastHide = useCallback(() => {
    if (hiddenHistory.length === 0) {
      if (hiddenPartIds.length > 0) {
        const lastId = hiddenPartIds[hiddenPartIds.length - 1];
        setHiddenPartIds((prev) => prev.slice(0, -1));
        const p = partMap.get(lastId);
        if (p) {
          setSelectedPartIds([p.id]);
          setSelectedConceptId(p.conceptId || p.id);
        }
      }
      return;
    }
    const lastBatch = hiddenHistory[hiddenHistory.length - 1];
    setHiddenHistory((prev) => prev.slice(0, -1));
    setHiddenPartIds((prev) => prev.filter((id) => !lastBatch.ids.includes(id)));
  }, [hiddenHistory, hiddenPartIds, partMap]);

  const handleUnhideAll = useCallback(() => {
    setHiddenPartIds([]);
    setHiddenHistory([]);
  }, []);

  const handleResetAll = useCallback(() => {
    setActiveTrack('all');
    setVisibleSystems(DEFAULT_VISIBLE_SYSTEMS);
    setHiddenPartIds([]);
    setHiddenHistory([]);
    setPeelMode(false);
    setSelectedPartIds([]);
    setSelectedConceptId(null);
    setIsolate(false);
    setExplode(0);
    setSectionCut(DEFAULT_SECTION_CUT);
    setMotion('none');
    setView('three-quarter');
    setRotate(false);
    setFocusBox(null);
    setResetToken((t) => t + 1);
  }, []);

  const handleSnapshot = useCallback(() => {
    const url = viewportRef.current?.captureSnapshot();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `human-anatomy-3d-${shaderMode}.png`;
    a.click();
  }, [shaderMode]);

  // Clear history when nothing is hidden
  useEffect(() => {
    if (hiddenPartIds.length === 0) setHiddenHistory([]);
  }, [hiddenPartIds.length]);

  // Fast keyboard shortcuts: / search, L systems, X Solid/X-Ray, P Peel, H Hide, U Undo Hide, R Reset
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');

      if (e.key === '/' && !inField && !mirrorOpen) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (e.key === 'Escape') {
        if (searchOpen) setSearchOpen(false);
        else if (aboutOpen) setAboutOpen(false);
        else if (peelMode) setPeelMode(false);
        else if (isolate) setIsolate(false);
        else if (selectedPartIds.length > 0) {
          setSelectedPartIds([]);
          setSelectedConceptId(null);
        }
        return;
      }
      if (inField || mirrorOpen) return;

      const k = e.key.toLowerCase();
      if (k === 'l') setLayersOpen((v) => !v);
      else if (k === 'x') setShaderMode((m) => (m === 'solid' ? 'xray' : 'solid'));
      else if (k === 'p') setPeelMode((v) => !v);
      else if (k === 'h' && selectedPartIds.length > 0) handleHideSelected();
      else if (k === 'u' && hiddenPartIds.length > 0) handleUndoLastHide();
      else if (k === 'r') handleResetAll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    mirrorOpen,
    searchOpen,
    aboutOpen,
    peelMode,
    isolate,
    selectedPartIds.length,
    hiddenPartIds.length,
    handleHideSelected,
    handleUndoLastHide,
    handleResetAll,
  ]);

  const sceneState = useMemo<FullBodySceneState>(
    () => ({
      visibleSystems,
      selectedPartIds,
      hiddenPartIds,
      isolate,
      explode,
      sectionCut,
      peelMode,
      motion,
      view,
      rotate,
      resetToken,
      shaderMode,
      exposure,
      qualityTier,
      inspectorOpen: (inspectorOpen || studyLabOpen) && !sheetCollapsed,
      layersOpen,
      focusBox,
      tourLabels: tourLabelSpecs,
      showTourLabels: studyLabOpen && studyLabMode === 'tour' && showTourLabels,
    }),
    [
      visibleSystems,
      selectedPartIds,
      hiddenPartIds,
      isolate,
      explode,
      sectionCut,
      peelMode,
      motion,
      view,
      rotate,
      resetToken,
      shaderMode,
      exposure,
      qualityTier,
      inspectorOpen,
      studyLabOpen,
      studyLabMode,
      sheetCollapsed,
      layersOpen,
      focusBox,
      tourLabelSpecs,
      showTourLabels,
    ]
  );

  const floatBtn = isDark
    ? 'bg-[#0c1622]/94 border-[#7bc4e8]/18 text-[#e8f3fb] hover:bg-[#132538]'
    : 'bg-white/95 border-[#18212b]/10 text-[#18212b] hover:bg-[#f6f8f7] shadow-[0_6px_22px_rgba(24,33,43,0.07)]';
  const floatBtnActive = isDark
    ? 'bg-[#0284c7] border-[#0284c7] text-white'
    : 'bg-[#1d2733] border-[#1d2733] text-white';
  const muted = isDark ? 'text-[#89a9c2]' : 'text-[#667482]';

  if (mirrorOpen) {
    return (
      <div className="relative w-full h-full flex flex-col bg-[#e9edeb] text-[#18212b]">
        <header className="flex items-center justify-between px-4 h-14 bg-white/95 border-b border-[#18212b]/10 shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[17px] font-bold tracking-tight">Human Anatomy 3D</h1>
            <span className="font-mono-num text-[10.5px] font-semibold px-1.5 py-0.5 rounded border border-[#18212b]/15 text-[#52606e]">
              Live X-Ray Mirror
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMirrorOpen(false)}
            className="px-3.5 py-1.5 rounded-xl bg-[#1d2733] text-white text-[12.5px] font-semibold hover:bg-[#2a3848] cursor-pointer"
          >
            Back to Full-Body 3D
          </button>
        </header>
        <main className="flex-1 min-h-0">
          <XRayMirrorView onBackToAtlas={() => setMirrorOpen(false)} />
        </main>
      </div>
    );
  }

  return (
    <main
      className={`relative w-full h-full overflow-hidden ${
        isDark ? 'bg-[#071019] text-[#e8f3fb]' : 'bg-[#ecefed] text-[#18212b]'
      }`}
    >
      {/* Full-Viewport 3D Stage (loads under the hood behind SplashScreen) */}
      {atlas && (
        <FullBodyViewport
          ref={viewportRef}
          atlas={atlas}
          state={sceneState}
          onSelectPart={handleSelectPart}
          onQuickHidePart={handleQuickHidePart}
          onSelectTourLabel={(conceptName) => highlightNamedConcept(conceptName)}
          onVrSessionChange={(active) => {
            setVrActive(active);
            if (active) setVrNotice(null);
          }}
          onProgress={setLoadProgress}
          onError={setErrorMsg}
          onSoftwareGlDetected={setIsSoftwareGl}
        />
      )}

      {/* Original Floating 3-Zone Clinical Studio Header */}
      <header className="pointer-events-none absolute top-3 left-3 right-3 z-20 flex items-center justify-between gap-2">
        {/* Left: Clean Brand Identity (icon-only on mobile, full title on sm+) */}
        <div className="pointer-events-auto flex items-center gap-2 select-none min-w-0">
          <img
            src={resolveAssetUrl('/favicon.svg', import.meta.env.BASE_URL)}
            alt="Human Anatomy 3D"
            className="w-8 h-8 rounded-xl shrink-0 shadow-[0_4px_14px_rgba(24,33,43,0.12)]"
          />
          <div className="min-w-0">
            <h1 className="sr-only sm:not-sr-only font-display text-[18px] font-bold tracking-tight leading-none whitespace-nowrap">
              Human Anatomy 3D
            </h1>
            <p className={`hidden md:block text-[11px] mt-0.5 ${muted}`}>
              {atlas ? `${atlas.parts.length.toLocaleString()} structures · 15 systems` : 'Full-Body WebGL Studio'}
            </p>
          </div>
        </div>

        {/* Center: True Solid / X-Ray Segmented Toggle Switch + Study Lab Trigger */}
        <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 shrink-0">
          <div
            role="group"
            aria-label="Rendering shader mode"
            className={`p-0.5 sm:p-1 rounded-xl border flex items-center gap-0.5 ${
              isDark
                ? 'bg-[#0c1622]/95 border-[#7bc4e8]/20'
                : 'bg-white/95 border-[#18212b]/10 shadow-[0_6px_22px_rgba(24,33,43,0.07)]'
            }`}
          >
            <button
              type="button"
              aria-pressed={shaderMode === 'solid'}
              onClick={() => setShaderMode('solid')}
              className={`h-7 sm:h-8 px-1.5 sm:px-3 rounded-lg text-[11.5px] sm:text-[12px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                shaderMode === 'solid'
                  ? 'bg-[#1d2733] text-white'
                  : `${muted} hover:opacity-100`
              }`}
              aria-label="Solid"
            >
              <Sun className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Solid</span>
            </button>
            <button
              type="button"
              aria-pressed={shaderMode === 'xray'}
              onClick={() => setShaderMode('xray')}
              className={`h-7 sm:h-8 px-1.5 sm:px-3 rounded-lg text-[11.5px] sm:text-[12px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                shaderMode === 'xray'
                  ? 'bg-[#0284c7] text-white'
                  : `${muted} hover:opacity-100`
              }`}
              aria-label="X-Ray"
            >
              <Scan className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">X-Ray</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (studyLabOpen) {
                handleCloseStudyLab();
              } else {
                handleStartTour();
              }
            }}
            className={`hidden md:flex h-10 px-3 rounded-xl border text-[12px] font-semibold items-center gap-1.5 cursor-pointer transition-colors ${
              studyLabOpen ? floatBtnActive : floatBtn
            }`}
            title="Interactive Guided Tours & 3D Quizzes"
            aria-label="Toggle Study Lab"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Study Lab</span>
          </button>
        </div>

        {/* Right: Search, Systems Drawer, Camera Mirror, Info */}
        <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className={`h-8 w-8 sm:w-auto sm:h-10 sm:px-3 rounded-xl border text-[12px] font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${floatBtn}`}
            title="Search 3,432 structures (/)"
            aria-label="Search anatomical structures"
          >
            <Search className="w-4 h-4 opacity-80" />
            <span className="hidden lg:inline opacity-80">Search</span>
            <kbd className="hidden xl:inline font-mono-num text-[10px] opacity-55 border border-current/20 rounded px-1">
              /
            </kbd>
          </button>

          <button
            type="button"
            onClick={() => setLayersOpen((v) => !v)}
            className={`h-8 min-w-8 px-1.5 sm:h-10 sm:px-3 rounded-xl border text-[12px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              layersOpen ? floatBtnActive : floatBtn
            }`}
            title="Systems & Study Focus (L)"
            aria-label="Toggle systems drawer"
          >
            <Layers3 className="w-4 h-4" />
            <span className="hidden sm:inline">Systems</span>
            {hiddenPartIds.length > 0 && (
              <span className="font-mono-num text-[10.5px] opacity-85">· {hiddenPartIds.length}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMirrorOpen(true)}
            className={`hidden sm:flex w-10 h-10 rounded-xl border items-center justify-center cursor-pointer transition-colors ${floatBtn}`}
            title="Live Camera X-Ray Mirror"
            aria-label="Open Live X-Ray Mirror"
          >
            <Camera className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center cursor-pointer transition-colors ${floatBtn}`}
            title="About Human Anatomy 3D"
            aria-label="About Human Anatomy 3D"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Left Slim Vertical Camera & Fast Peel Tool Rail */}
      <nav
        aria-label="Camera and quick dissection tools"
        className={`hidden sm:flex flex-col items-center gap-1 p-1.5 rounded-2xl border absolute left-3 top-1/2 -translate-y-1/2 z-20 ${
          isDark
            ? 'bg-[#0c1622]/94 border-[#7bc4e8]/18'
            : 'bg-white/95 border-[#18212b]/10 shadow-[0_8px_28px_rgba(24,33,43,0.08)]'
        }`}
      >
        {(
          [
            ['three-quarter', '¾', 'Three-quarter view'],
            ['front', 'F', 'Anterior view'],
            ['side', 'S', 'Lateral view'],
            ['back', 'B', 'Posterior view'],
          ] as const
        ).map(([v, glyph, title]) => (
          <button
            key={v}
            type="button"
            disabled={explode > 0.8 && v !== 'front'}
            onClick={() => {
              setFocusBox(null);
              setView(v);
              setRotate(false);
              setResetToken((t) => t + 1);
            }}
            title={title}
            aria-label={title}
            className={`w-9 h-9 rounded-xl text-[12px] font-semibold transition-colors cursor-pointer disabled:opacity-35 ${
              view === v && !focusBox
                ? isDark
                  ? 'bg-[#0284c7] text-white'
                  : 'bg-[#1d2733] text-white'
                : `${muted} hover:opacity-100`
            }`}
          >
            {glyph}
          </button>
        ))}

        <div
          className={`w-5 h-px my-0.5 ${isDark ? 'bg-[#7bc4e8]/18' : 'bg-[#18212b]/10'}`}
          aria-hidden="true"
        />

        {/* 1-Click Peel / Fast Hide Mode */}
        <button
          type="button"
          aria-pressed={peelMode}
          onClick={() => setPeelMode((v) => !v)}
          title="Peel Mode (P): click any mesh to hide immediately"
          aria-label="Toggle Peel Quick-Hide Mode"
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
            peelMode
              ? 'bg-[#0284c7] text-white'
              : `${muted} hover:opacity-100`
          }`}
        >
          <EyeOff className="w-4 h-4" />
        </button>

        <button
          type="button"
          disabled={explode >= 0.4 || isolate}
          onClick={() => setRotate((r) => !r)}
          title={rotate ? 'Pause rotation' : 'Auto rotate'}
          aria-label={rotate ? 'Pause rotation' : 'Auto rotate'}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer disabled:opacity-35 ${
            rotate
              ? isDark
                ? 'bg-[#0284c7] text-white'
                : 'bg-[#1d2733] text-white'
              : `${muted} hover:opacity-100`
          }`}
        >
          {rotate ? <Pause className="w-4 h-4" /> : <RotateCw className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={handleResetAll}
          title="Reset view & layers (R)"
          aria-label="Reset view and layers"
          className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer ${muted} hover:opacity-100`}
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleSnapshot}
          title="Save PNG snapshot"
          aria-label="Save PNG snapshot"
          className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer ${muted} hover:opacity-100`}
        >
          <Download className="w-4 h-4" />
        </button>
      </nav>

      {/* Right Collapsible Systems, Hidden Manager & Study Focus Drawer */}
      <LayersDrawer
        open={layersOpen}
        tab={layersTab}
        activeTrack={activeTrack}
        activeMotion={motion}
        visibleSystems={visibleSystems}
        systemCounts={systemCounts}
        visiblePartCount={visiblePartCount}
        hiddenParts={hiddenParts}
        exposure={exposure}
        qualityTier={qualityTier}
        vrCapability={vrCapability}
        vrActive={vrActive}
        vrNotice={vrNotice}
        isDark={isDark}
        onChangeTab={setLayersTab}
        onSelectTrack={handleSelectTrack}
        onStartTour={handleStartTour}
        onStartQuiz={handleStartQuiz}
        onToggleMotion={setMotion}
        onToggleSystem={handleToggleSystem}
        onSoloSystem={handleSoloSystem}
        onShowAllSystems={() => {
          setActiveTrack('all');
          setVisibleSystems(DEFAULT_VISIBLE_SYSTEMS);
          setIsolate(false);
        }}
        onHideAllSystems={() => {
          setVisibleSystems([]);
          setIsolate(false);
          setSelectedPartIds([]);
          setSelectedConceptId(null);
        }}
        onUnhidePart={handleUnhidePart}
        onUnhideAll={handleUnhideAll}
        onChangeExposure={setExposure}
        onChangeQuality={setQualityTier}
        onToggleVrMode={handleToggleVrMode}
        onClose={() => setLayersOpen(false)}
      />

      {/* Active Peel Mode Subtle Indicator Banner */}
      {peelMode && (
        <div
          role="status"
          className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-[#0284c7] text-white text-[12px] font-semibold shadow-md whitespace-nowrap"
        >
          <EyeOff className="w-3.5 h-3.5 shrink-0" />
          <span>Peel Mode: Tap any structure to hide</span>
          <button
            type="button"
            onClick={() => setPeelMode(false)}
            className="ml-1 underline text-white/90 hover:text-white cursor-pointer"
          >
            Done
          </button>
        </div>
      )}

      {/* Responsive Bottom Stack on Mobile (guarantees zero overlap between Sheet/StudyLab and Dock) | lg:contents preserves exact Desktop layout */}
      <div className="pointer-events-none fixed bottom-3 left-3 right-3 z-30 flex flex-col gap-2 lg:contents">
        {/* Left Contextual Study Lab Panel (Guided Tours & 3D Quiz) */}
        <StudyLabPanel
          open={studyLabOpen}
          collapsed={sheetCollapsed}
          mode={studyLabMode}
          track={activeTrack}
          tourIndex={tourIndex}
          quizSession={quizSession}
          activeMotion={motion}
          isolated={isolate}
          hasHighlights={selectedPartIds.length > 0}
          showTourLabels={showTourLabels}
          isDark={isDark}
          onToggleCollapse={() => setSheetCollapsed((c) => !c)}
          onToggleIsolate={() => {
            const nextIsolate = !isolate;
            setIsolate(nextIsolate);
            if (nextIsolate && typeof window !== 'undefined' && window.innerWidth < 1024) {
              setMobileDockCollapsed(true);
            }
          }}
          onToggleTourLabels={() => setShowTourLabels((v) => !v)}
          onSelectTrack={handleSelectTrack}
          onChangeMode={(m) => {
            setStudyLabMode(m);
            setSectionCut(DEFAULT_SECTION_CUT);
            setDockTool('explode');
            const lab = SPECIALTY_LABS[activeTrack] ?? SPECIALTY_LABS.all;
            if (m === 'tour') {
              setTourIndex(0);
              if (lab.tourSteps[0]) applyTourStep(lab.tourSteps[0]);
            } else {
              setQuizSession(createStudyQuizSession(lab.quiz.length));
              applyQuizQuestion(activeTrack, 0);
            }
          }}
          onSelectTourStep={handleSelectTourStep}
          onToggleMotion={setMotion}
          onSubmitAnswer={handleSubmitQuizOption}
          onNextQuestion={handleNextQuizQuestion}
          onRestartQuiz={handleStartQuiz}
          onClose={handleCloseStudyLab}
        />

        {/* Left Contextual Structure Details Sheet (only when selected outside Study Lab) */}
        <StructureSheet
          open={inspectorOpen}
          collapsed={sheetCollapsed}
          concept={selectedConcept}
          selectedParts={selectedParts}
          hiddenPartIds={hiddenSet}
          isolated={isolate}
          isDark={isDark}
          onToggleCollapse={() => setSheetCollapsed((c) => !c)}
          onToggleIsolate={() => {
            const nextIsolate = !isolate;
            setExplode(0);
            setIsolate(nextIsolate);
            if (nextIsolate && typeof window !== 'undefined' && window.innerWidth < 1024) {
              setSheetCollapsed(true);
              setMobileDockCollapsed(true);
            }
          }}
          onHideSelected={handleHideSelected}
          onUnhideSelected={handleUnhideSelected}
          onSelectPart={handleSelectPart}
          onClearSelection={() => {
            setSelectedPartIds([]);
            setSelectedConceptId(null);
            setIsolate(false);
            setSheetCollapsed(false);
          }}
        />

        {/* Unified Bottom Clinical Dock: Explode / Section Cut (X, Y, Z) + Fast Undo / Unhide All */}
        <div className="pointer-events-none w-full lg:fixed lg:bottom-3 lg:left-3 lg:right-3 lg:z-20 flex justify-center">
          <div
            className={`pointer-events-auto w-full max-w-[680px] rounded-2xl border px-2.5 sm:px-3.5 py-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 overflow-hidden ${
              isDark
                ? 'bg-[#0c1622]/94 border-[#7bc4e8]/18 text-[#e8f3fb]'
                : 'bg-white/95 border-[#18212b]/10 text-[#18212b] shadow-[0_10px_32px_rgba(24,33,43,0.09)]'
            }`}
          >
            {/* Mobile Collapsed 1-Line Dock Bar (maximizes 3D canvas while keeping 1-tap access to Explode, Section & Study Lab) */}
            {mobileDockCollapsed && (
              <div className="flex sm:hidden items-center justify-between gap-1.5 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setDockTool('explode');
                      setMobileDockCollapsed(false);
                    }}
                    className={`h-7 px-2 rounded-lg text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                      explode > 0
                        ? 'bg-[#0284c7] text-white'
                        : isDark
                        ? 'bg-[#122336] text-[#cfe7f8]'
                        : 'bg-[#f1f4f2] text-[#2c3a47]'
                    }`}
                  >
                    Explode{explode > 0 ? ` ${Math.round(explode * 100)}%` : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDockTool('section');
                      if (sectionCut.axis === 'off') {
                        setSectionCut({ axis: 'z', position: 0.5, flip: false });
                      }
                      setMobileDockCollapsed(false);
                    }}
                    className={`h-7 px-2 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                      sectionCut.axis !== 'off'
                        ? 'bg-[#0284c7] text-white'
                        : isDark
                        ? 'bg-[#122336] text-[#cfe7f8]'
                        : 'bg-[#f1f4f2] text-[#2c3a47]'
                    }`}
                  >
                    <Scissors className="w-3 h-3 shrink-0" />
                    <span>Section{sectionCut.axis !== 'off' ? ` ${sectionCut.axis.toUpperCase()}` : ''}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (studyLabOpen) {
                        setSheetCollapsed((c) => !c);
                      } else {
                        handleStartTour();
                      }
                    }}
                    className={`h-7 px-2 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                      studyLabOpen
                        ? 'bg-[#0284c7] text-white'
                        : isDark
                        ? 'bg-[#122336] text-[#cfe7f8]'
                        : 'bg-[#f1f4f2] text-[#2c3a47]'
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                    <span>Study</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileDockCollapsed(false)}
                  aria-label="Expand Explode and Section tools"
                  className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 cursor-pointer ${
                    isDark ? 'bg-[#122336] text-[#cfe7f8]' : 'bg-[#f1f4f2] text-[#2c3a47]'
                  }`}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Full Dock Content (always visible on sm+, toggleable on mobile < sm) */}
            <div className={`${mobileDockCollapsed ? 'hidden sm:contents' : 'contents'}`}>
              {/* Top Row on Mobile / Left Cluster on Desktop: Explode vs Section + Mobile Quick Actions */}
              <div className="flex items-center justify-between gap-1.5 min-w-0 shrink-0">
                <div
                  className={`flex items-center p-0.5 rounded-xl shrink-0 ${
                    isDark ? 'bg-[#071019]' : 'bg-[#eaeeec]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setDockTool('explode')}
                    className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-[11.5px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                      dockTool === 'explode'
                        ? isDark
                          ? 'bg-[#17314a] text-white'
                          : 'bg-white text-[#18212b] shadow-sm'
                        : muted
                    }`}
                  >
                    Explode
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDockTool('section');
                      if (sectionCut.axis === 'off') {
                        setSectionCut({ axis: 'z', position: 0.5, flip: false });
                      }
                    }}
                    className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-[11.5px] font-semibold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
                      dockTool === 'section'
                        ? isDark
                          ? 'bg-[#0284c7] text-white'
                          : 'bg-white text-[#18212b] shadow-sm'
                        : muted
                    }`}
                  >
                    <Scissors className="w-3 h-3 shrink-0" />
                    <span>Section</span>
                  </button>
                </div>

                {/* Mobile Quick Controls (Study, Peel, Unhide, Reset, Collapse) sized to fit cleanly inside >=320px cards */}
                <div className="flex sm:hidden items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (studyLabOpen) {
                        handleCloseStudyLab();
                      } else {
                        handleStartTour();
                      }
                    }}
                    aria-label="Toggle Study Lab"
                    title="Guided Tours & 3D Quizzes"
                    className={`h-7 ${
                      hiddenPartIds.length > 0 ? 'w-7 justify-center px-0' : 'px-2 gap-1'
                    } rounded-lg text-[11px] font-semibold flex items-center cursor-pointer shrink-0 ${
                      studyLabOpen
                        ? 'bg-[#0284c7] text-white'
                        : isDark
                        ? 'bg-[#122336] text-[#cfe7f8]'
                        : 'bg-[#f1f4f2] text-[#2c3a47]'
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                    {hiddenPartIds.length === 0 && <span>Study</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeelMode((v) => !v)}
                    aria-label="Toggle Peel Quick-Hide"
                    title="Peel Mode"
                    className={`h-7 w-7 rounded-lg flex items-center justify-center cursor-pointer shrink-0 ${
                      peelMode
                        ? 'bg-[#0284c7] text-white'
                        : isDark
                        ? 'bg-[#122336] text-[#cfe7f8]'
                        : 'bg-[#f1f4f2] text-[#2c3a47]'
                    }`}
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>
                  {hiddenPartIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleUnhideAll}
                      aria-label={`Unhide ${hiddenPartIds.length} hidden structures`}
                      className="h-7 px-1.5 rounded-lg bg-[#0284c7] text-white text-[11px] font-semibold flex items-center gap-0.5 cursor-pointer shrink-0"
                    >
                      <Eye className="w-3 h-3 shrink-0" />
                      <span>{hiddenPartIds.length}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleResetAll}
                    aria-label="Reset view"
                    className={`h-7 w-7 rounded-lg flex items-center justify-center cursor-pointer shrink-0 ${
                      isDark ? 'bg-[#122336] text-[#cfe7f8]' : 'bg-[#f1f4f2] text-[#2c3a47]'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileDockCollapsed(true)}
                    aria-label="Collapse Explode and Section tools"
                    title="Collapse tools"
                    className={`h-7 w-7 rounded-lg flex items-center justify-center cursor-pointer shrink-0 ${
                      isDark ? 'bg-[#122336] text-[#cfe7f8]' : 'bg-[#f1f4f2] text-[#2c3a47]'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Center Slider Area (Row 2 full-width on Mobile, Flex-1 on Desktop) */}
              {dockTool === 'explode' ? (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <label htmlFor="fullbody-explode" className="font-semibold">
                      Explode anatomy
                    </label>
                    <span className="font-mono-num opacity-75">{Math.round(explode * 100)}%</span>
                  </div>
                  <input
                    id="fullbody-explode"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={explode}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setExplode(val);
                      if (val > 0.8) setView('front');
                      setRotate(false);
                    }}
                    className={`w-full atlas-slider ${isDark ? 'atlas-slider-dark' : ''}`}
                  />
                </div>
              ) : (
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <div className="flex items-center gap-0.5 shrink-0" role="group" aria-label="Section cut axis">
                    {(
                      [
                        ['off', 'Off', 'Disable section cut'],
                        ['x', 'X', 'Sagittal X section cut'],
                        ['y', 'Y', 'Axial Y section cut'],
                        ['z', 'Z', 'Coronal Z section cut'],
                      ] as [SectionCutAxis, string, string][]
                    ).map(([ax, label, title]) => (
                      <button
                        key={ax}
                        type="button"
                        title={title}
                        aria-label={title}
                        aria-pressed={sectionCut.axis === ax}
                        onClick={() =>
                          setSectionCut((prev) => ({
                            ...prev,
                            axis: ax,
                          }))
                        }
                        className={`w-7 h-7 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                          sectionCut.axis === ax
                            ? 'bg-[#0284c7] text-white'
                            : isDark
                            ? 'bg-[#112233] text-[#9ec0d8] hover:text-white'
                            : 'bg-[#f1f4f2] text-[#455360] hover:text-[#18212b]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    aria-label="Section plane position"
                    disabled={sectionCut.axis === 'off'}
                    min={0}
                    max={1}
                    step={0.01}
                    value={sectionCut.position}
                    onChange={(e) =>
                      setSectionCut((prev) => ({ ...prev, position: Number(e.target.value) }))
                    }
                    className={`flex-1 min-w-0 atlas-slider disabled:opacity-35 ${isDark ? 'atlas-slider-dark' : ''}`}
                  />

                  <button
                    type="button"
                    disabled={sectionCut.axis === 'off'}
                    onClick={() => setSectionCut((prev) => ({ ...prev, flip: !prev.flip }))}
                    title="Flip cut direction"
                    aria-label="Flip section cut direction"
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-35 ${
                      isDark ? 'bg-[#112233] text-[#cfe7f8]' : 'bg-[#f1f4f2] text-[#2c3a47]'
                    }`}
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Desktop Right Fast Undo / Unhide All / Reset */}
              <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                {hiddenPartIds.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={handleUndoLastHide}
                      title="Undo last hide (U)"
                      aria-label="Undo last hide"
                      className={`h-8 px-2 rounded-lg text-[11.5px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                        isDark
                          ? 'bg-[#142b42] hover:bg-[#1c3b59] text-[#7dd3fc]'
                          : 'bg-[#eaf4fa] hover:bg-[#d7ecfa] text-[#0369a1]'
                      }`}
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>Undo</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleUnhideAll}
                      title="Unhide all hidden structures immediately"
                      className="h-8 px-2.5 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-[11.5px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Unhide ({hiddenPartIds.length})</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleResetAll}
                  title="Reset view, cuts, and layers (R)"
                  aria-label="Reset view"
                  className={`h-8 px-2.5 rounded-lg text-[11.5px] font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                    isDark
                      ? 'bg-[#122336] hover:bg-[#1a334e] text-[#cfe7f8]'
                      : 'bg-[#f1f4f2] hover:bg-[#e5eae8] text-[#2c3a47]'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-Viewport Splash Screen Loader (fades out once 15 chunks finish under the hood) */}
      {splashMounted && <SplashScreen progress={loadProgress} visible={splashVisible} />}

      {/* Error Recovery Overlay */}
      {errorMsg && (
        <div
          role="alert"
          className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-[#ecefed]/95"
        >
          <div className="max-w-sm text-center bg-white border border-[#18212b]/10 rounded-2xl p-6 shadow-lg space-y-3">
            <p className="font-display text-base font-bold">Viewer Notice</p>
            <p className="text-[13px] text-[#556370]">{errorMsg}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-[#1d2733] text-white text-[13px] font-semibold cursor-pointer"
            >
              Reload Human Anatomy 3D
            </button>
          </div>
        </div>
      )}

      {/* Search Spotlight Popover */}
      <SearchPopover
        open={searchOpen}
        query={searchQuery}
        concepts={atlas?.concepts ?? []}
        isDark={isDark}
        onChangeQuery={setSearchQuery}
        onChooseConcept={handleChooseConcept}
        onClose={() => setSearchOpen(false)}
      />

      {/* About & Attribution Dialog */}
      <AboutModal
        open={aboutOpen}
        isSoftwareGl={isSoftwareGl}
        partCount={atlas?.parts.length ?? 2234}
        conceptCount={atlas?.concepts.length ?? 3432}
        onClose={() => setAboutOpen(false)}
      />
    </main>
  );
}
