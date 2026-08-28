"use client";
/* eslint-disable @next/next/no-img-element -- MCP App images can be data URLs and MCP resources. */

import {
  ArrowLeft,
  ArrowUpRight,
  CircleDashed,
  Download,
  FolderDown,
  ImagePlus,
  Maximize2,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { ArtworkLightbox, type ArtworkViewerItem } from "@/components/ui/artwork-lightbox";
import { FanCollection, type FanCollectionItem, type FanCollectionPhase } from "@/components/ui/fan-collection";
import { MorphingComposer } from "@/components/ui/morphing-composer";
import { InteractiveTiltCard } from "@/components/ui/tilt-card";
import { StudioSettings } from "@/components/studio-settings";
import { useStudioCopy } from "@/hooks/use-studio-copy";
import { groupRecentRunsBySkill } from "@/lib/fan-collection.mjs";
import { isPublishedRun } from "@/lib/published-run.mjs";
import { studioPreviewUrl } from "@/lib/studio-image-url.mjs";
import { fanCollectionPhase, isRouteTransitioning, rankViewportCards } from "@/lib/studio-interaction-state.mjs";

export type StudioSkillExample = {
  id: string;
  prompt: string;
  aspectRatio: string;
  preview?: string;
  previewResourceUri?: string;
  mode?: "text-to-image" | "image-to-image";
  referencePreview?: string;
  referenceResourceUri?: string;
  referenceRole?: "subject" | "style" | "composition" | "reference";
  promptFile?: string;
};

export type StudioSkillGalleryItem = {
  id: string;
  caption?: string;
  aspectRatio?: string;
  preview?: string;
  previewResourceUri?: string;
};

export type StudioSkillLicense = {
  spdx?: string | null;
  name: string;
  redistribute?: boolean;
  commercial?: boolean;
  note?: string;
};

export type StudioSkill = {
  id: string;
  displayName: string;
  description: string;
  category: string;
  availability: "ready" | "available" | "missing" | "invalid" | string;
  origin?: "host" | "bundled" | "remote" | "registered" | "local" | string;
  canInstall?: boolean;
  needsFetch?: boolean;
  contentHash?: string;
  skillPath?: string;
  stars?: number | null;
  license?: StudioSkillLicense;
  author?: { name?: string; url?: string };
  upstream?: { repo?: string; commit?: string; homepage?: string };
  preview?: string;
  previewResourceUri?: string;
  examples?: StudioSkillExample[];
  gallery?: StudioSkillGalleryItem[];
  capabilities: {
    references: boolean;
    maxReferences: number;
    aspectRatios: string[];
  };
};

export type StudioFile = {
  file_id: string;
  download_url: string;
  file_name?: string;
  mime_type?: string;
  role?: "subject" | "style" | "composition" | "reference";
  preview_url?: string;
  data_url?: string;
};

export type StudioRun = {
  id: string;
  clientRequestId?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  snapshot: {
    skill: StudioSkill;
    prompt: string;
    aspectRatio: string;
    references: Array<{
      fileId?: string;
      downloadUrl?: string;
      fileName?: string;
      mimeType?: string;
      role?: string;
    }>;
  };
  artifacts: Array<{
    id?: string;
    fileId?: string;
    downloadUrl?: string;
    dataUrl?: string;
    resourceUri?: string;
    savedPath?: string;
    fileName?: string;
    mimeType?: string;
  }>;
  events: Array<{ type: string; label: string; at: string }>;
  error?: string | null;
  agentThreadId?: string | null;
};

export type StudioSnapshot = { skills: StudioSkill[]; runs: StudioRun[] };

export type StudioBridge = {
  generate(input: {
    skillId: string;
    prompt: string;
    aspectRatio: string;
    clientRequestId: string;
    references: StudioFile[];
  }): Promise<{ run: StudioRun; instruction?: string; dispatchMode?: string }>;
  getRun(runId: string): Promise<StudioRun | null>;
  refresh(): Promise<StudioSnapshot>;
  uploadFile?: (file: File) => Promise<StudioFile>;
  exportFile?: (blob: Blob, filename: string) => Promise<void>;
  sendInstruction?: (
    instruction: string,
    context?: { runId: string; references: StudioFile[] },
  ) => Promise<{ isError?: boolean } | void>;
  requestFullscreen?: () => Promise<void> | void;
  subscribe?: (listener: (snapshot: Partial<StudioSnapshot>) => void) => () => void;
  registerSkill?(input: { sourcePath: string; overwrite?: boolean }): Promise<{ skills: StudioSkill[]; skill?: StudioSkill }>;
  installSkill?(input: { skillId: string; overwrite?: boolean }): Promise<{ skills: StudioSkill[]; destination?: string }>;
};

type ImageSkillStudioProps = {
  initialState: StudioSnapshot;
  bridge?: StudioBridge;
  previewMode?: boolean;
  initialLoading?: boolean;
};

type ComposerOrigin = "agent" | "remix" | "same";
type DetailTab = "feed" | "creations";

type SkillRouteItemKind = "run" | "example";
type StudioRoute = "feed" | "skill";
type RouteTransitionPhase = "idle" | "exiting" | "morphing" | "revealing";
type ProjectionSurface = "feed-runs" | "feed-examples" | "skill-runs" | "skill-examples";

type SkillRouteItem = {
  id: string;
  src: string;
  layoutId: string;
  imageLayoutId: string;
  alt: string;
  meta?: string;
};

type SkillRouteOrigin = {
  skillId: string;
  kind: SkillRouteItemKind;
  selectedItemId: string;
  items: SkillRouteItem[];
  fromSurface: ProjectionSurface;
  toSurface: ProjectionSurface;
};

type DetailViewState = {
  activeTab: DetailTab;
  scrollTopByTab: Record<DetailTab, number>;
  railScrollLeftByTab: Record<DetailTab, number>;
  selectedExampleId: string | null;
  visibleItemIdsByTab: Record<DetailTab, string[]>;
};

const statusLabels: Record<string, string> = {
  awaiting_agent: "等待 Codex",
  agent_running: "Codex 创作中",
  imagegen_running: "ImageGen 创作中",
  finalizing: "即将完成",
  succeeded: "完成",
  failed: "失败",
  cancelled: "已取消",
  unknown: "未完成",
};

function artifactUrl(run: StudioRun) {
  return run.artifacts?.[0]?.dataUrl || run.artifacts?.[0]?.downloadUrl || "";
}

function referenceUrl(run: StudioRun) {
  return run.snapshot.references?.[0]?.downloadUrl || "";
}

function skillPreview(skill: StudioSkill, _index = 0) {
  return skill.preview || "";
}

function examplePreview(example: StudioSkillExample, _skill: StudioSkill, _index = 0) {
  return example.preview || "";
}

// Curated Skills carry promptable examples. Upstream Skills usually only ship
// finished work, so their gallery fills the same image slots read-only, and a
// Skill with neither still gets one card from its cover.
function skillDisplaySlots(skill: StudioSkill, index = 0): StudioSkillExample[] {
  if (skill.examples?.length) return skill.examples;
  const ratio = skill.capabilities.aspectRatios[0] ?? "3:4";
  if (skill.gallery?.length) {
    return skill.gallery.map((item) => ({
      id: item.id,
      prompt: item.caption || skill.description,
      aspectRatio: item.aspectRatio || ratio,
      preview: item.preview,
      previewResourceUri: item.previewResourceUri,
    }));
  }
  return [{
    id: `skill-${skill.id}`,
    prompt: skill.description,
    aspectRatio: ratio,
    preview: skillPreview(skill, index),
  }];
}

function interleaveExampleModes(examples: StudioSkillExample[]) {
  const textToImage = examples.filter((example) => example.mode === "text-to-image");
  const imageToImage = examples.filter((example) => example.mode === "image-to-image");
  if (!textToImage.length || !imageToImage.length) return examples;
  const interleaved: StudioSkillExample[] = [];
  for (let index = 0; index < Math.max(textToImage.length, imageToImage.length); index += 1) {
    if (textToImage[index]) interleaved.push(textToImage[index]);
    if (imageToImage[index]) interleaved.push(imageToImage[index]);
  }
  return [
    ...interleaved,
    ...examples.filter((example) => !example.mode),
  ];
}

const WEB_PROMPT_HEADING = "Image Skill generation context";

function buildWebGenerationPrompt({
  skill,
  prompt,
  aspectRatio,
  references,
}: {
  skill: StudioSkill;
  prompt: string;
  aspectRatio: string;
  references: StudioFile[];
}) {
  const repository = skill.upstream?.repo;
  const skillUrl = skill.upstream?.homepage
    || (repository ? `https://github.com/${repository}` : skill.author?.url)
    || `https://studio.clash.video/#skill/${encodeURIComponent(skill.id)}`;
  const installCommand = repository ? `npx skills add https://github.com/${repository}` : null;
  const referenceLines = references.length
    ? references.map((reference, index) => {
        const url = reference.download_url || reference.preview_url || reference.data_url || "URL unavailable; attach this local file manually";
        const details = [reference.role, reference.file_name].filter(Boolean).join(", ");
        return `${index + 1}. ${details ? `${details}: ` : ""}${url}`;
      })
    : ["None"];

  return [
    WEB_PROMPT_HEADING,
    "",
    `Skill: ${skill.displayName} (${skill.id})`,
    `Skill URL: ${skillUrl}`,
    ...(installCommand ? [`Install: ${installCommand}`] : []),
    ...(skill.upstream?.commit ? [`Pinned commit: ${skill.upstream.commit}`] : []),
    "",
    "Generation request:",
    prompt.trim(),
    "",
    `Aspect ratio: ${aspectRatio}`,
    "Reference images:",
    ...referenceLines,
    "",
    "Follow the linked Skill instructions and use the reference images above as the declared inputs.",
  ].join("\n");
}

async function copyText(text: string, fallbackError: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error(fallbackError);
}

function isLandscapeRatio(aspectRatio: string) {
  const [width, height] = aspectRatio.split(":").map(Number);
  return Number.isFinite(width) && Number.isFinite(height) && width > height;
}

function skillRouteLayoutId(kind: SkillRouteItemKind, skillId: string, itemId: string) {
  return `studio-card-container-${kind}-${skillId}-${itemId}`;
}

function skillRouteImageLayoutId(kind: SkillRouteItemKind, skillId: string, itemId: string) {
  return `studio-image-inner-${kind}-${skillId}-${itemId}`;
}

function skillIdFromHash(hash: string) {
  const encoded = hash.match(/^#skill\/([^/?#]+)$/)?.[1];
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

function reverseRouteOrigin(origin: SkillRouteOrigin): SkillRouteOrigin {
  return { ...origin, fromSurface: origin.toSurface, toSurface: origin.fromSurface };
}

function BrandSymbol() {
  return (
    <svg className="brand-symbol" viewBox="0 0 64 64" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="6.5" strokeLinejoin="round">
        <rect x="18.5" y="18.5" width="27" height="27" rx="7.5" transform="rotate(45 32 32)" />
        <rect x="25.5" y="14.5" width="24" height="24" rx="7" transform="rotate(45 37.5 26.5)" opacity=".62" />
        <rect x="14.5" y="25.5" width="24" height="24" rx="7" transform="rotate(45 26.5 37.5)" opacity=".34" />
      </g>
    </svg>
  );
}

function DetailTabPanel({
  active,
  children,
  className,
  id,
  labelledBy,
  reduceMotion,
}: {
  active: boolean;
  children: ReactNode;
  className: string;
  id: string;
  labelledBy: string;
  reduceMotion: boolean;
}) {
  return (
    <motion.section
      id={id}
      className={`${className} detail-tab-panel${active ? " is-active" : " is-inactive"}`}
      role="tabpanel"
      aria-labelledby={labelledBy}
      aria-hidden={!active}
      inert={!active ? true : undefined}
      tabIndex={active ? 0 : -1}
      initial={false}
      animate={{
        opacity: active ? 1 : 0,
        transition: {
          duration: reduceMotion ? 0 : active ? 0.18 : 0.12,
          ease: active ? [0.22, 1, 0.36, 1] : [0.4, 0, 1, 1],
        },
      }}
    >
      {children}
    </motion.section>
  );
}

function createPreviewBridge(initial: StudioSnapshot): StudioBridge {
  let snapshot = structuredClone(initial);
  return {
    async refresh() {
      return structuredClone(snapshot);
    },
    async uploadFile(file) {
      const url = URL.createObjectURL(file);
      return {
        file_id: `preview-${crypto.randomUUID()}`,
        download_url: url,
        preview_url: url,
        file_name: file.name,
        mime_type: file.type,
        role: "reference",
      };
    },
    async generate(input) {
      const selected = snapshot.skills.find((entry) => entry.id === input.skillId)!;
      const now = new Date().toISOString();
      const run: StudioRun = {
        id: `run-preview-${crypto.randomUUID()}`,
        clientRequestId: input.clientRequestId,
        status: "agent_running",
        createdAt: now,
        updatedAt: now,
        snapshot: {
          skill: selected,
          prompt: input.prompt,
          aspectRatio: input.aspectRatio,
          references: input.references.map((file) => ({
            fileId: file.file_id,
            downloadUrl: file.download_url,
            fileName: file.file_name,
            mimeType: file.mime_type,
            role: file.role,
          })),
        },
        artifacts: [],
        events: [],
        error: null,
      };
      snapshot = { ...snapshot, runs: [run, ...snapshot.runs] };
      return { run, dispatchMode: "preview" };
    },
    async getRun(runId) {
      return structuredClone(snapshot.runs.find((run) => run.id === runId) ?? null);
    },
    async registerSkill() {
      return { skills: structuredClone(snapshot.skills), skill: structuredClone(snapshot.skills[0]) };
    },
    async installSkill() {
      return { skills: structuredClone(snapshot.skills), destination: "~/.codex/skills/preview" };
    },
  };
}

function readHostDisplayMode() {
  return document.documentElement.dataset.displayMode || "fullscreen";
}

function useHostDisplayMode() {
  const [displayMode, setDisplayMode] = useState(readHostDisplayMode);
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDisplayMode(readHostDisplayMode());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-display-mode"] });
    return () => observer.disconnect();
  }, []);
  return displayMode;
}

export function ImageSkillStudio({ initialState, bridge, previewMode = false, initialLoading = false }: ImageSkillStudioProps) {
  const previewBridge = useMemo(() => createPreviewBridge(initialState), [initialState]);
  const runtime = bridge ?? previewBridge;
  const displayMode = useHostDisplayMode();
  const copy = useStudioCopy();
  const restoreFullscreen = displayMode === "inline" || displayMode === "pip";
  const firstSkill = initialState.skills[0];
  const reduceRouteMotion = useReducedMotion();
  const [routePhase, setRoutePhase] = useState<RouteTransitionPhase>("idle");
  const routeGuiLeaving = routePhase === "exiting";
  const routeInteractionLocked = isRouteTransitioning(routePhase);
  const routeGuiExitDuration = reduceRouteMotion ? 0 : 0.055;
  const routeGuiEnterDelay = reduceRouteMotion ? 0 : 0.075;
  function guiOpacityMotion(hidden: boolean) {
    return {
      opacity: hidden ? 0 : 1,
      transition: {
        delay: hidden || reduceRouteMotion ? 0 : routeGuiEnterDelay,
        duration: reduceRouteMotion ? 0 : hidden ? routeGuiExitDuration : 0.11,
        ease: hidden ? [0.4, 0, 1, 1] as const : [0.22, 1, 0.36, 1] as const,
      },
    };
  }
  const routeGuiMotion = {
    initial: { opacity: reduceRouteMotion ? 1 : 0 },
    animate: guiOpacityMotion(routeGuiLeaving),
    exit: guiOpacityMotion(true),
  };
  const [snapshot, setSnapshot] = useState<StudioSnapshot>(initialState);
  const [initialDataLoading, setInitialDataLoading] = useState(initialLoading);
  const [route, setRoute] = useState<StudioRoute>("feed");
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>("feed");
  const [selectedSkillId, setSelectedSkillId] = useState(firstSkill?.id ?? "");
  const [, setSelectedRunId] = useState<string | null>(initialState.runs[0]?.id ?? null);
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(null);
  const [referenceLightbox, setReferenceLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [artworkViewer, setArtworkViewer] = useState<{ items: ArtworkViewerItem[]; index: number } | null>(null);
  const [routeOrigin, setRouteOrigin] = useState<SkillRouteOrigin | null>(null);
  const [feedCardOrderByCollection, setFeedCardOrderByCollection] = useState<Record<string, string[]>>({});
  const [composerOpen, setComposerOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState(
    firstSkill?.capabilities.aspectRatios.includes("3:4") ? "3:4" : firstSkill?.capabilities.aspectRatios[0] ?? "3:4",
  );
  const [references, setReferences] = useState<StudioFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [handoffSent, setHandoffSent] = useState(false);
  const [error, setError] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerPath, setRegisterPath] = useState("");
  const [registerOverwrite, setRegisterOverwrite] = useState(false);
  const [registerBusy, setRegisterBusy] = useState(false);
  const [registerNotice, setRegisterNotice] = useState("");
  const [installBusy, setInstallBusy] = useState(false);
  const [installNotice, setInstallNotice] = useState("");
  const [installCanOverwrite, setInstallCanOverwrite] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const composerReturnFocusRef = useRef<HTMLElement | null>(null);
  const feedScrollRef = useRef<HTMLDivElement>(null);
  const skillScrollRef = useRef<HTMLElement>(null);
  const detailViewBySkillRef = useRef(new Map<string, DetailViewState>());
  const detailCaptureRef = useRef<() => SkillRouteOrigin | null>(() => null);
  const initialRouteAppliedRef = useRef(false);
  const routeChangeTimerRef = useRef<number | null>(null);
  const routeUnlockTimerRef = useRef<number | null>(null);
  const routeRef = useRef<StudioRoute>("feed");
  const routeOriginRef = useRef<SkillRouteOrigin | null>(null);
  const routeTransitionEpochRef = useRef(0);
  const hasFeedHistoryRef = useRef(false);
  const routeChangeDelayMs = reduceRouteMotion ? 0 : 80;
  const routeForwardSettleMs = reduceRouteMotion ? 0 : 480;
  const routeReturnMorphMs = reduceRouteMotion ? 0 : 280;
  const routeReturnRevealMs = reduceRouteMotion ? 0 : 280;
  const detailChromeHidden = false;

  const closeComposer = useCallback(() => {
    if (!composerOpen) return;
    setComposerOpen(false);
  }, [composerOpen]);

  const restoreComposerFocus = useCallback(() => {
    composerReturnFocusRef.current?.focus();
  }, []);

  const skill = snapshot.skills.find((entry) => entry.id === selectedSkillId) ?? snapshot.skills[0];
  const restoreDetailScroll = useCallback((node: HTMLElement | null) => {
    skillScrollRef.current = node;
    if (!node || !skill) return;
    node.scrollTop = detailViewBySkillRef.current.get(skill.id)?.scrollTopByTab[activeDetailTab] ?? 0;
  }, [activeDetailTab, skill]);
  const restoreDetailRail = useCallback((tab: DetailTab, node: HTMLDivElement | null) => {
    if (!node || !skill) return;
    node.scrollLeft = detailViewBySkillRef.current.get(skill.id)?.railScrollLeftByTab?.[tab] ?? 0;
  }, [skill]);
  const restoreFeedRail = useCallback(
    (node: HTMLDivElement | null) => restoreDetailRail("feed", node),
    [restoreDetailRail],
  );
  const restoreCreationsRail = useCallback(
    (node: HTMLDivElement | null) => restoreDetailRail("creations", node),
    [restoreDetailRail],
  );
  const feedRuns = useMemo(() => snapshot.runs.filter(isPublishedRun).sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  ), [snapshot.runs]);
  const selectedSkillRuns = useMemo(
    () => feedRuns.filter((run) => run.snapshot.skill.id === skill?.id),
    [feedRuns, skill?.id],
  );
  const liveProjectedRuns = useMemo(() => {
    const preferredIds = routeOrigin?.kind === "run" && routeOrigin.skillId === skill?.id
      ? routeOrigin.items.map((item) => item.id)
      : [];
    const preferred = preferredIds
      .map((id) => selectedSkillRuns.find((run) => run.id === id))
      .filter((run): run is StudioRun => Boolean(run));
    return preferredIds.length ? preferred.slice(0, 4) : selectedSkillRuns.slice(0, 4);
  }, [routeOrigin, selectedSkillRuns, skill?.id]);
  const recentCollectionsBySkill = useMemo(() => groupRecentRunsBySkill(snapshot.skills, feedRuns, feedRuns.length) as Array<{
    skill: StudioSkill;
    runs: StudioRun[];
    total: number;
  }>, [feedRuns, snapshot.skills]);
  const activeRouteOrigin = useMemo(() => {
    if (
      route !== "skill"
      || activeDetailTab !== "creations"
      || !skill
      || routeOrigin?.kind !== "run"
      || routeOrigin.skillId !== skill.id
    ) return routeOrigin;
    const items = liveProjectedRuns.map((run) => ({
      id: run.id,
      src: artifactUrl(run) || skillPreview(skill),
      layoutId: skillRouteLayoutId("run", skill.id, run.id),
      imageLayoutId: skillRouteImageLayoutId("run", skill.id, run.id),
      alt: run.snapshot.prompt,
      meta: statusLabels[run.status] ?? "作品",
    }));
    return {
      ...routeOrigin,
      selectedItemId: items.some((item) => item.id === routeOrigin.selectedItemId)
        ? routeOrigin.selectedItemId
        : items.at(-1)?.id ?? routeOrigin.selectedItemId,
      items,
    };
  }, [activeDetailTab, liveProjectedRuns, route, routeOrigin, skill]);
  const feedRouteGuiHidden = routeGuiLeaving || routeInteractionLocked || route !== "feed";

  function routeSurfaceHasIdentity(surface: ProjectionSurface) {
    return Boolean(activeRouteOrigin)
      && (activeRouteOrigin?.fromSurface === surface || activeRouteOrigin?.toSurface === surface);
  }

  function routeItemForSkill(
    surface: ProjectionSurface,
    kind: SkillRouteItemKind,
    skillId: string,
    itemId: string,
  ) {
    if (!routeSurfaceHasIdentity(surface) || activeRouteOrigin?.skillId !== skillId || activeRouteOrigin.kind !== kind) return undefined;
    return activeRouteOrigin.items.find((item) => item.id === itemId);
  }

  function routeItemFor(surface: ProjectionSurface, kind: SkillRouteItemKind, itemId: string) {
    if (!skill) return undefined;
    return routeItemForSkill(surface, kind, skill.id, itemId);
  }

  function collectionPhase(kind: SkillRouteItemKind, skillId: string): FanCollectionPhase {
    return fanCollectionPhase({
      route,
      phase: routePhase,
      origin: activeRouteOrigin,
      kind,
      skillId,
    });
  }

  const detailExamples: StudioSkillExample[] = skill
    ? interleaveExampleModes(skillDisplaySlots(skill, snapshot.skills.indexOf(skill)))
    : [];
  const detailExampleEntries = detailExamples.map((example, index) => ({ example, index }));
  const detailRunEntries: Array<{ run: StudioRun; origin: SkillRouteItem | undefined }> = selectedSkillRuns.map((run) => ({
    run,
    origin: routeItemFor("skill-runs", "run", run.id),
  }));

  useLayoutEffect(() => {
    if (initialRouteAppliedRef.current) return;
    initialRouteAppliedRef.current = true;
    const frame = requestAnimationFrame(() => {
      const deepLinkedSkillId = skillIdFromHash(window.location.hash);
      const nextSkillId = deepLinkedSkillId;
      if (!nextSkillId || !initialState.skills.some((entry) => entry.id === nextSkillId)) {
        window.history.replaceState({ studioRoute: "feed" }, "", "#feed");
        return;
      }
      setSelectedSkillId(nextSkillId);
      hasFeedHistoryRef.current = false;
      setSelectedRunId(null);
      setSelectedExampleId(null);
      setRouteOrigin(null);
      setActiveDetailTab("feed");
      setComposerOpen(false);
      setRoute("skill");
      window.history.replaceState(
        { studioRoute: "skill", skillId: nextSkillId, detailTab: "feed" },
        "",
        window.location.hash,
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [initialState.skills]);

  useEffect(() => {
    routeRef.current = route;
    routeOriginRef.current = activeRouteOrigin;
  }, [activeRouteOrigin, route]);

  useEffect(() => {
    if (route !== "skill" || !activeRouteOrigin) return;
    const current = window.history.state && typeof window.history.state === "object" ? window.history.state : {};
    window.history.replaceState({ ...current, routeOrigin: activeRouteOrigin }, "", window.location.href);
  }, [activeRouteOrigin, route]);


  useEffect(() => {
    return runtime.subscribe?.((next) => {
      setInitialDataLoading(false);
      setSnapshot((current) => ({
        skills: next.skills?.length ? next.skills : current.skills,
        runs: (next.runs ?? current.runs).filter(isPublishedRun),
      }));
    });
  }, [runtime]);

  useEffect(() => {
    if (!referenceLightbox) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setReferenceLightbox(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [referenceLightbox]);

  useEffect(() => () => {
    if (routeChangeTimerRef.current) window.clearTimeout(routeChangeTimerRef.current);
    if (routeUnlockTimerRef.current) window.clearTimeout(routeUnlockTimerRef.current);
  }, []);

  const runAfterRouteGuiExit = useCallback((targetRoute: StudioRoute, commit: () => void) => {
    const transitionEpoch = ++routeTransitionEpochRef.current;
    if (routeChangeTimerRef.current) window.clearTimeout(routeChangeTimerRef.current);
    if (routeUnlockTimerRef.current) window.clearTimeout(routeUnlockTimerRef.current);
    if (targetRoute === "skill") {
      if (reduceRouteMotion) {
        commit();
        setRoutePhase("idle");
        return;
      }
      setRoutePhase("exiting");
      routeChangeTimerRef.current = window.setTimeout(() => {
        if (transitionEpoch !== routeTransitionEpochRef.current) return;
        commit();
        setRoutePhase("morphing");
        routeChangeTimerRef.current = null;
        routeUnlockTimerRef.current = window.setTimeout(() => {
          if (transitionEpoch !== routeTransitionEpochRef.current) return;
          setRoutePhase("idle");
          routeUnlockTimerRef.current = null;
        }, routeForwardSettleMs);
      }, routeChangeDelayMs);
      return;
    }
    setRoutePhase("exiting");
    routeChangeTimerRef.current = window.setTimeout(() => {
      if (transitionEpoch !== routeTransitionEpochRef.current) return;
      commit();
      if (reduceRouteMotion) {
        setRoutePhase("idle");
        routeChangeTimerRef.current = null;
        return;
      }
      setRoutePhase("morphing");
      routeChangeTimerRef.current = null;
      routeUnlockTimerRef.current = window.setTimeout(() => {
        if (transitionEpoch !== routeTransitionEpochRef.current) return;
        if (targetRoute !== "feed") {
          setRoutePhase("idle");
          routeUnlockTimerRef.current = null;
          return;
        }
        setRoutePhase("revealing");
        routeUnlockTimerRef.current = window.setTimeout(() => {
          if (transitionEpoch !== routeTransitionEpochRef.current) return;
          setRoutePhase("idle");
          routeUnlockTimerRef.current = null;
        }, routeReturnRevealMs);
      }, targetRoute === "feed" ? routeReturnMorphMs : routeForwardSettleMs);
    }, routeChangeDelayMs);
  }, [reduceRouteMotion, routeChangeDelayMs, routeForwardSettleMs, routeReturnMorphMs, routeReturnRevealMs]);

  useEffect(() => {
    if (!composerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeComposer();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [closeComposer, composerOpen]);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const state = event.state as {
        studioRoute?: StudioRoute;
        skillId?: string;
        runId?: string;
        exampleId?: string;
        detailTab?: DetailTab;
        routeOrigin?: SkillRouteOrigin;
        forwardRouteOrigin?: SkillRouteOrigin;
      } | null;
      const deepLinkedSkillId = skillIdFromHash(window.location.hash);
      const targetRoute = state?.studioRoute ?? (deepLinkedSkillId ? "skill" : "feed");
      const targetSkillId = state?.skillId ?? deepLinkedSkillId;
      const returningToFeed = routeRef.current === "skill" && targetRoute === "feed";
      const capturedReturnOrigin = returningToFeed ? detailCaptureRef.current() : null;
      const activeOrigin = capturedReturnOrigin ?? routeOriginRef.current;
      const returnOrigin = returningToFeed && activeOrigin
        ? activeOrigin.fromSurface.startsWith("skill-") ? activeOrigin : reverseRouteOrigin(activeOrigin)
        : null;
      const transitionOrigin = returningToFeed
        ? activeOrigin ? returnOrigin : null
        : state?.forwardRouteOrigin ?? state?.routeOrigin ?? (
          activeOrigin ? reverseRouteOrigin(activeOrigin) : null
        );
      if (transitionOrigin) setRouteOrigin(transitionOrigin);
      runAfterRouteGuiExit(targetRoute, () => {
        if (targetSkillId) setSelectedSkillId(targetSkillId);
        setSelectedRunId(state?.runId ?? null);
        const targetTab = state?.detailTab ?? (transitionOrigin?.kind === "run" ? "creations" : "feed");
        const rememberedView = targetSkillId ? detailViewBySkillRef.current.get(targetSkillId) : undefined;
        setSelectedExampleId(targetRoute === "skill" && targetTab === "feed"
          ? rememberedView ? rememberedView.selectedExampleId : state?.exampleId ?? null
          : null);
        setActiveDetailTab(targetTab);
        setRoute(targetRoute);
        hasFeedHistoryRef.current = targetRoute === "skill" && Boolean(state?.routeOrigin || state?.forwardRouteOrigin);
        setComposerOpen(false);
      });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [runAfterRouteGuiExit]);

  function chooseSkill(skillId: string) {
    const next = snapshot.skills.find((entry) => entry.id === skillId);
    if (!next) return;
    setSelectedSkillId(skillId);
    setSelectedExampleId(null);
    setInstallNotice("");
    setInstallCanOverwrite(false);
    setAspectRatio(next.capabilities.aspectRatios.includes("3:4") ? "3:4" : next.capabilities.aspectRatios[0]);
    if (!next.capabilities.references) setReferences([]);
  }

  function rememberReturnProjection(nextOrigin: SkillRouteOrigin) {
    const current = window.history.state && typeof window.history.state === "object" ? window.history.state : {};
    window.history.replaceState(
      {
        ...current,
        studioRoute: routeRef.current,
        skillId: routeRef.current === "feed" ? undefined : selectedSkillId,
        forwardRouteOrigin: reverseRouteOrigin(nextOrigin),
      },
      "",
      window.location.href,
    );
  }

  function captureRouteOrigin(
    skillId: string,
    kind: SkillRouteItemKind,
    selectedItem: FanCollectionItem,
    visibleItems: FanCollectionItem[],
    fromSurface: ProjectionSurface,
    toSurface: ProjectionSurface,
  ): SkillRouteOrigin {
    return {
      skillId,
      kind,
      selectedItemId: selectedItem.id,
      fromSurface,
      toSurface,
      items: visibleItems.map((item) => ({
        id: item.id,
        src: item.src,
        layoutId: item.layoutId ?? skillRouteLayoutId(kind, skillId, item.id),
        imageLayoutId: item.imageLayoutId ?? skillRouteImageLayoutId(kind, skillId, item.id),
        alt: item.alt,
        meta: item.meta,
      })),
    };
  }

  function collectionOrderKey(kind: SkillRouteItemKind, skillId: string) {
    return `${kind}:${skillId}`;
  }

  function orderCollectionItems<T extends { id: string }>(kind: SkillRouteItemKind, skillId: string, items: T[]) {
    const preferredIds = feedCardOrderByCollection[collectionOrderKey(kind, skillId)] ?? [];
    if (!preferredIds.length) return items;
    const itemsById = new Map(items.map((item) => [item.id, item]));
    const preferred = preferredIds.map((id) => itemsById.get(id)).filter((item): item is T => Boolean(item));
    return preferred.length ? preferred : items;
  }

  function detailItemsForTab(tab: DetailTab): FanCollectionItem[] {
    if (!skill) return [];
    if (tab === "feed") {
      return detailExampleEntries.map(({ example, index }) => ({
        id: example.id,
        src: examplePreview(example, skill, index),
        alt: example.prompt,
        meta: example.aspectRatio,
      }));
    }
    return selectedSkillRuns.map((run) => ({
      id: run.id,
      src: artifactUrl(run) || skillPreview(skill),
      alt: run.snapshot.prompt,
      meta: statusLabels[run.status] ?? "作品",
    }));
  }

  function saveCurrentDetailPanel() {
    if (!skill || !skillScrollRef.current) return [];
    const scroller = skillScrollRef.current;
    const kind: SkillRouteItemKind = activeDetailTab === "feed" ? "example" : "run";
    const rail = scroller.querySelector<HTMLDivElement>(activeDetailTab === "feed" ? ".skill-image-feed" : ".skill-results__feed");
    if (!rail) return [];
    const cards = [...rail.querySelectorAll<HTMLElement>(`[data-route-item-kind="${kind}"]`)].map((card) => {
      const rect = card.getBoundingClientRect();
      return {
        id: card.dataset.routeItemId ?? "",
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
      };
    }).filter((card) => card.id);
    const routeRect = scroller.getBoundingClientRect();
    const railRect = rail.getBoundingClientRect();
    const scrollerRect = {
      top: Math.max(routeRect.top, railRect.top),
      right: Math.min(routeRect.right, railRect.right),
      bottom: Math.min(routeRect.bottom, railRect.bottom),
      left: Math.max(routeRect.left, railRect.left),
    };
    const visibleItemIds = rankViewportCards(cards, {
      top: scrollerRect.top,
      right: scrollerRect.right,
      bottom: scrollerRect.bottom,
      left: scrollerRect.left,
    }, 4) as string[];
    const current = detailViewBySkillRef.current.get(skill.id) ?? {
      activeTab: activeDetailTab,
      scrollTopByTab: { feed: 0, creations: 0 },
      railScrollLeftByTab: { feed: 0, creations: 0 },
      selectedExampleId: null,
      visibleItemIdsByTab: { feed: [], creations: [] },
    };
    detailViewBySkillRef.current.set(skill.id, {
      activeTab: activeDetailTab,
      scrollTopByTab: { ...current.scrollTopByTab, [activeDetailTab]: scroller.scrollTop },
      railScrollLeftByTab: { ...current.railScrollLeftByTab, [activeDetailTab]: rail.scrollLeft },
      selectedExampleId,
      visibleItemIdsByTab: { ...current.visibleItemIdsByTab, [activeDetailTab]: visibleItemIds },
    });
    return visibleItemIds;
  }

  function captureDetailViewState() {
    if (!skill) return null;
    const kind: SkillRouteItemKind = activeDetailTab === "feed" ? "example" : "run";
    const visibleItemIds = saveCurrentDetailPanel();
    const allItems = detailItemsForTab(activeDetailTab);
    const itemsById = new Map(allItems.map((item) => [item.id, item]));
    const visibleItems = visibleItemIds.map((id) => itemsById.get(id)).filter((item): item is FanCollectionItem => Boolean(item));
    const projectedItems = visibleItems.length ? visibleItems : allItems.slice(0, 4);
    if (!projectedItems.length) return null;
    const selectedItem = projectedItems.find((item) => item.id === selectedExampleId) ?? projectedItems[0];
    const nextOrigin = captureRouteOrigin(
      skill.id,
      kind,
      selectedItem,
      projectedItems,
      kind === "run" ? "skill-runs" : "skill-examples",
      kind === "run" ? "feed-runs" : "feed-examples",
    );
    routeOriginRef.current = nextOrigin;
    setRouteOrigin(nextOrigin);
    setFeedCardOrderByCollection((currentOrder) => ({
      ...currentOrder,
      [collectionOrderKey(kind, skill.id)]: projectedItems.map((item) => item.id),
    }));
    requestAnimationFrame(() => {
      const feed = feedScrollRef.current;
      if (!feed) return;
      const target = [...feed.querySelectorAll<HTMLElement>("[data-route-collection]")]
        .find((entry) => entry.dataset.routeCollection === collectionOrderKey(kind, skill.id));
      if (!target) return;
      const feedRect = feed.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      if (targetRect.top < feedRect.top || targetRect.bottom > feedRect.bottom) {
        target.scrollIntoView({ behavior: "auto", block: "center", inline: "center" });
      }
    });
    return nextOrigin;
  }
  useLayoutEffect(() => {
    detailCaptureRef.current = captureDetailViewState;
  });

  function openSkill(
    skillId: string,
    kind: SkillRouteItemKind,
    selectedItem: FanCollectionItem,
    visibleItems: FanCollectionItem[],
    targetTab: DetailTab,
  ) {
    const nextSkill = snapshot.skills.find((entry) => entry.id === skillId);
    if (!nextSkill) return;
    const exampleId = kind === "example" ? selectedItem.id : undefined;
    const runId = kind === "run" ? selectedItem.id : undefined;
    const rememberedView = detailViewBySkillRef.current.get(skillId);
    const restoredExampleId = kind === "example"
      ? rememberedView ? rememberedView.selectedExampleId : exampleId ?? null
      : null;
    const fromSurface = kind === "run" ? "feed-runs" : "feed-examples";
    const toSurface = kind === "run" ? "skill-runs" : "skill-examples";
    const nextOrigin = captureRouteOrigin(
      skillId,
      kind,
      selectedItem,
      visibleItems,
      fromSurface,
      toSurface,
    );
    rememberReturnProjection(nextOrigin);
    hasFeedHistoryRef.current = true;
    setRouteOrigin(nextOrigin);
    runAfterRouteGuiExit("skill", () => {
      chooseSkill(skillId);
      setSelectedRunId(runId ?? null);
      setSelectedExampleId(restoredExampleId);
      setActiveDetailTab(targetTab);
      setComposerOpen(false);
      setRoute("skill");
      window.history.pushState(
        { studioRoute: "skill", skillId, runId, exampleId, detailTab: targetTab, routeOrigin: nextOrigin },
        "",
        `#skill/${encodeURIComponent(skillId)}`,
      );
    });
  }

  function openSkillWithoutProjection(skillId: string, targetTab: DetailTab) {
    const nextSkill = snapshot.skills.find((entry) => entry.id === skillId);
    if (!nextSkill) return;
    setRouteOrigin(null);
    hasFeedHistoryRef.current = true;
    runAfterRouteGuiExit("skill", () => {
      chooseSkill(skillId);
      setSelectedRunId(null);
      setSelectedExampleId(targetTab === "feed"
        ? detailViewBySkillRef.current.get(skillId)?.selectedExampleId ?? null
        : null);
      setActiveDetailTab(targetTab);
      setComposerOpen(false);
      setRoute("skill");
      window.history.pushState(
        { studioRoute: "skill", skillId, detailTab: targetTab },
        "",
        `#skill/${encodeURIComponent(skillId)}`,
      );
    });
  }

  function openFeed() {
    const hasReturnHistory = hasFeedHistoryRef.current;
    const capturedReturnOrigin = captureDetailViewState();
    if (hasReturnHistory) {
      window.history.back();
      return;
    }
    runAfterRouteGuiExit("feed", () => {
      setComposerOpen(false);
      setRoute("feed");
      hasFeedHistoryRef.current = false;
      if (!capturedReturnOrigin) setRouteOrigin(null);
      window.history.replaceState({ studioRoute: "feed" }, "", "#feed");
    });
  }

  async function submitRegisteredSkill() {
    if (!runtime.registerSkill || registerBusy) return;
    const sourcePath = registerPath.trim();
    if (!sourcePath) {
      setRegisterNotice("请填写 Skill 目录或 SKILL.md 的绝对路径。");
      return;
    }
    setRegisterBusy(true);
    setRegisterNotice("");
    try {
      const result = await runtime.registerSkill({ sourcePath, overwrite: registerOverwrite });
      if (result.skills?.length) setSnapshot((current) => ({ ...current, skills: result.skills }));
      setRegisterNotice(`已注册 ${result.skill?.displayName || result.skill?.id || "Skill"}。`);
      setRegisterPath("");
      setRegisterOverwrite(false);
    } catch (caught) {
      setRegisterNotice(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRegisterBusy(false);
    }
  }

  async function installSelectedSkill(overwrite = false) {
    if (!skill || !runtime.installSkill || installBusy) return;
    setInstallBusy(true);
    setInstallNotice("");
    try {
      const result = await runtime.installSkill({ skillId: skill.id, overwrite });
      if (result.skills?.length) setSnapshot((current) => ({ ...current, skills: result.skills }));
      setInstallNotice(`已安装到 ${result.destination || "~/.codex/skills"}。`);
      setInstallCanOverwrite(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setInstallNotice(message);
      setInstallCanOverwrite(/已经存在/.test(message));
    } finally {
      setInstallBusy(false);
    }
  }

  async function generate(draft?: { prompt?: string; aspectRatio?: string; references?: StudioFile[] }) {
    if (!skill || busy) return;
    const nextPrompt = (draft?.prompt ?? prompt).trim();
    const nextAspectRatio = draft?.aspectRatio ?? aspectRatio;
    const nextReferences = draft?.references ?? references;
    if (!nextPrompt) {
      setError(copy.writeAScene);
      document.querySelector<HTMLTextAreaElement>("#studio-prompt")?.focus();
      return;
    }
    setBusy(true);
    setError("");
    setHandoffSent(false);
    try {
      if (previewMode) {
        await copyText(nextPrompt, copy.copyFailed);
        setHandoffSent(true);
        closeComposer();
        return;
      }
      const result = await runtime.generate({
        skillId: skill.id,
        prompt: nextPrompt,
        aspectRatio: nextAspectRatio,
        clientRequestId: crypto.randomUUID(),
        references: nextReferences,
      });
      if (result.instruction && result.dispatchMode === "host_message") {
        const sent = await runtime.sendInstruction?.(result.instruction, { runId: result.run.id, references: nextReferences });
        if (sent?.isError) {
          setError(copy.handoffRejected);
          return;
        }
      }
      setHandoffSent(true);
      closeComposer();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  function referencesForExample(example: StudioSkillExample): StudioFile[] {
    const preview = example.referencePreview;
    if (!skill?.capabilities.references || !preview) return [];
    return [{
      file_id: `example-${skill.id}-${example.id}`,
      download_url: preview,
      preview_url: preview,
      data_url: preview.startsWith("data:") ? preview : undefined,
      file_name: `${example.id}.png`,
      mime_type: preview.startsWith("data:image/jpeg") ? "image/jpeg" : "image/png",
      role: example.referenceRole ?? "reference",
    }];
  }

  function openComposer(origin: ComposerOrigin, example?: StudioSkillExample) {
    composerReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (example) {
      const nextReferences = origin === "remix" ? referencesForExample(example) : [];
      setPrompt(previewMode
        ? buildWebGenerationPrompt({ skill, prompt: example.prompt, aspectRatio: example.aspectRatio, references: nextReferences })
        : example.prompt);
      setAspectRatio(example.aspectRatio);
      setReferences(nextReferences);
      setSelectedExampleId(example.id);
    } else if (previewMode && !prompt.startsWith(WEB_PROMPT_HEADING)) {
      setPrompt(buildWebGenerationPrompt({ skill, prompt, aspectRatio, references }));
    }
    setError("");
    setHandoffSent(false);
    setComposerOpen(true);
    requestAnimationFrame(() => {
      promptRef.current?.focus();
      promptRef.current?.setSelectionRange(promptRef.current.value.length, promptRef.current.value.length);
    });
  }

  async function addReference(file: File) {
    if (!skill?.capabilities.references || !runtime.uploadFile) {
      setError(copy.uploadUnsupported);
      return;
    }
    try {
      setError("");
      const uploaded = await runtime.uploadFile(file);
      setReferences((current) => [
        ...current,
        { ...uploaded, role: uploaded.role ?? "reference", preview_url: uploaded.preview_url ?? URL.createObjectURL(file) },
      ].slice(0, skill.capabilities.maxReferences));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.uploadFailed);
    }
  }

  function selectDetailTab(nextTab: DetailTab) {
    if (nextTab === activeDetailTab) return;
    saveCurrentDetailPanel();
    const rememberedView = skill ? detailViewBySkillRef.current.get(skill.id) : undefined;
    setActiveDetailTab(nextTab);
    setSelectedExampleId(nextTab === "feed" ? rememberedView?.selectedExampleId ?? null : null);
    const current = window.history.state && typeof window.history.state === "object" ? window.history.state : {};
    window.history.replaceState({ ...current, detailTab: nextTab }, "", window.location.href);
  }

  function handleDetailTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    const order: DetailTab[] = ["feed", "creations"];
    const currentIndex = order.indexOf(activeDetailTab);
    let nextTab: DetailTab | null = null;
    if (event.key === "ArrowRight") nextTab = order[(currentIndex + 1) % order.length];
    if (event.key === "ArrowLeft") nextTab = order[(currentIndex - 1 + order.length) % order.length];
    if (event.key === "Home") nextTab = order[0];
    if (event.key === "End") nextTab = order.at(-1) ?? null;
    if (!nextTab) return;
    event.preventDefault();
    selectDetailTab(nextTab);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`#detail-tab-${nextTab}`)?.focus());
  }

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
      <LayoutGroup id="studio-route">
        <main
          className="image-studio"
          data-route={route}
          data-route-transitioning={routeInteractionLocked ? "" : undefined}
        >
      <div className="studio-corner">
        {restoreFullscreen && runtime.requestFullscreen ? (
          <button
            type="button"
            className="icon-action"
            aria-label={copy.openFullscreen}
            onClick={() => void runtime.requestFullscreen?.()}
          >
            <Maximize2 size={16} />
          </button>
        ) : null}
        <StudioSettings />
      </div>
      <motion.div
        ref={feedScrollRef}
        key="feed"
        className={`studio-feed-route${route === "feed" ? " is-active" : " is-background"}`}
        layoutScroll
        aria-hidden={route !== "feed"}
        inert={route !== "feed" ? true : undefined}
      >
            <div className="studio-feed-chrome">
            <motion.div {...routeGuiMotion} animate={guiOpacityMotion(feedRouteGuiHidden)} className="brand-signature" role="img" aria-label="Image Skill Studio">
              <BrandSymbol />
              <span>Image Skill</span>
            </motion.div>
            </div>
            <section className="recent-work" aria-labelledby="recent-work-title">
              <motion.div {...routeGuiMotion} animate={guiOpacityMotion(feedRouteGuiHidden)} className="route-heading">
                <h1 id="recent-work-title">{copy.creations}</h1>
                <span>{feedRuns.length}</span>
              </motion.div>
              <motion.div
                className="recent-work__rail"
                layoutScroll
                aria-busy={initialDataLoading}
                aria-live="polite"
                aria-label={initialDataLoading ? "正在加载作品" : undefined}
              >
                <button
                  type="button"
                  className="recent-card recent-card--empty"
                  disabled={initialDataLoading || !snapshot.skills.length}
                  aria-label={copy.tryLuckAria}
                  onClick={() => {
                    const entry = snapshot.skills[Math.floor(Math.random() * snapshot.skills.length)];
                    if (!entry) return;
                    openSkillWithoutProjection(entry.id, "feed");
                  }}
                >
                  <span><Sparkles size={22} /><strong>{copy.tryLuck}</strong></span>
                </button>
                {initialDataLoading
                  ? Array.from({ length: 2 }, (_, index) => (
                      <div className="recent-work__skeleton is-single" aria-hidden="true" key={`creation-skeleton-${index}`}>
                        <span className="recent-work__skeleton-card" />
                        <span className="recent-work__skeleton-label" />
                      </div>
                    ))
                  : recentCollectionsBySkill.map(({ skill: entry, runs, total }, index) => {
                  const latest = runs.at(-1);
                  const items: FanCollectionItem[] = orderCollectionItems("run", entry.id, runs).map((run) => {
                    return {
                      id: run.id,
                      src: artifactUrl(run) || skillPreview(entry, index),
                      referenceSrc: referenceUrl(run) || undefined,
                      alt: run.snapshot.prompt,
                      meta: statusLabels[run.status] ?? "作品",
                      status: run.status === "succeeded" ? "succeeded" : run.status === "failed" ? "failed" : "running",
                      layoutId: skillRouteLayoutId("run", entry.id, run.id),
                      imageLayoutId: skillRouteImageLayoutId("run", entry.id, run.id),
                    };
                  });
                  const renderableItems = items.filter((item) => item.src);
                  if (!renderableItems.length) {
                    return (
                      <div className="recent-work__skeleton is-single is-static" role="img" aria-label={`${entry.displayName} 暂无预览`} key={entry.id}>
                        <span className="recent-work__skeleton-card" />
                        <span className="recent-work__skeleton-label"><strong>{entry.displayName}</strong></span>
                      </div>
                    );
                  }
                  return (
                    <FanCollection
                      key={entry.id}
                      className="recent-collection"
                      label={entry.displayName}
                      items={renderableItems}
                      total={total}
                      meta={latest ? statusLabels[latest.status] ?? "作品" : undefined}
                      phase={collectionPhase("run", entry.id)}
                      revealOrder={index}
                      routeKey={collectionOrderKey("run", entry.id)}
                      onSelect={(item, visibleItems) => openSkill(entry.id, "run", item, visibleItems, "creations")}
                    />
                  );
                })}
              </motion.div>
            </section>

            <section className="skill-feed" aria-labelledby="skill-feed-title">
              <motion.div {...routeGuiMotion} animate={guiOpacityMotion(feedRouteGuiHidden)} className="route-heading">
                <h2 id="skill-feed-title">Skills <span className="skill-feed__count">{snapshot.skills.length}</span></h2>
                <div className="route-heading__actions">
                  {!previewMode ? (
                    <button
                      type="button"
                      className="icon-action"
                      aria-label="注册 Skill"
                      aria-expanded={registerOpen}
                      aria-controls="skill-register-form"
                      onClick={() => {
                        setRegisterOpen((open) => !open);
                        setRegisterNotice("");
                      }}
                    >
                      <Plus size={16} />
                    </button>
                  ) : null}
                  <button type="button" className="icon-action" aria-label="刷新 Skill" onClick={async () => setSnapshot(await runtime.refresh())}>
                    <RefreshCw size={16} />
                  </button>
                </div>
              </motion.div>
              {!previewMode && registerOpen ? (
                <form
                  id="skill-register-form"
                  className="skill-register-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitRegisteredSkill();
                  }}
                >
                  <label className="sr-only" htmlFor="skill-register-path">Skill 绝对路径</label>
                  <input
                    id="skill-register-path"
                    type="text"
                    value={registerPath}
                    onChange={(event) => setRegisterPath(event.target.value)}
                    placeholder="Skill 目录或 SKILL.md 的绝对路径"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <label className="skill-register-form__overwrite">
                    <input
                      type="checkbox"
                      checked={registerOverwrite}
                      onChange={(event) => setRegisterOverwrite(event.target.checked)}
                    />
                    覆盖已注册
                  </label>
                  <button type="submit" className="studio-button studio-button--default studio-button--sm" disabled={registerBusy || !runtime.registerSkill}>
                    {registerBusy ? "校验中…" : "注册到 Studio"}
                  </button>
                  {registerNotice ? <p className="skill-register-form__notice" role="status">{registerNotice}</p> : null}
                </form>
              ) : null}
              <div className="skill-feed__cards">
                {initialDataLoading
                  ? Array.from({ length: 4 }, (_, index) => (
                      <div className="recent-work__skeleton skill-feed-collection" aria-hidden="true" key={`skill-skeleton-${index}`}>
                        <span className="recent-work__skeleton-card" />
                        <span className="recent-work__skeleton-label" />
                      </div>
                    ))
                  : snapshot.skills.map((entry, index) => {
                  const displayExamples = skillDisplaySlots(entry, index);
                  const distinctReferenceExamples: StudioSkillExample[] = [];
                  const repeatedReferenceExamples: StudioSkillExample[] = [];
                  const seenReferences = new Set<string>();
                  for (const example of displayExamples) {
                    const referenceKey = example.mode === "image-to-image" ? example.referencePreview : undefined;
                    if (referenceKey && seenReferences.has(referenceKey)) {
                      repeatedReferenceExamples.push(example);
                      continue;
                    }
                    if (referenceKey) seenReferences.add(referenceKey);
                    distinctReferenceExamples.push(example);
                  }
                  const examples = [...distinctReferenceExamples, ...repeatedReferenceExamples].slice(0, 4);
                  const items: FanCollectionItem[] = orderCollectionItems("example", entry.id, examples).map((example) => {
                    return {
                      id: example.id,
                      src: examplePreview(example, entry, index),
                      referenceSrc: example.referencePreview,
                      alt: example.prompt,
                      meta: example.aspectRatio,
                      layoutId: skillRouteLayoutId("example", entry.id, example.id),
                      imageLayoutId: skillRouteImageLayoutId("example", entry.id, example.id),
                    };
                  });
                  const renderableItems = items.filter((item) => item.src);
                  if (!renderableItems.length) {
                    return (
                      <div className="recent-work__skeleton skill-feed-collection is-static" role="img" aria-label={`${entry.displayName} 暂无预览`} key={entry.id}>
                        <span className="recent-work__skeleton-card" />
                        <span className="recent-work__skeleton-label"><strong>{entry.displayName}</strong></span>
                      </div>
                    );
                  }
                  return (
                    <FanCollection
                      key={entry.id}
                      className="skill-feed-collection"
                      label={entry.displayName}
                      items={renderableItems}
                      total={entry.examples?.length || entry.gallery?.length || 1}
                      meta={entry.category}
                      showSummary={false}
                      phase={collectionPhase("example", entry.id)}
                      revealOrder={recentCollectionsBySkill.length + index}
                      routeKey={collectionOrderKey("example", entry.id)}
                      sourceUrl={entry.upstream?.homepage || entry.author?.url}
                      onSelect={(item, visibleItems) => openSkill(entry.id, "example", item, visibleItems, "feed")}
                    />
                  );
                })}
              </div>
            </section>
          </motion.div>
        {route === "skill" ? (
          <motion.section
            ref={restoreDetailScroll}
            key={`skill-${skill.id}`}
            className="studio-skill-detail"
            layoutScroll
          >
            {skill ? (
              <div className="skill-detail-shell">
                <motion.header
                  className="skill-detail__workspace"
                  animate={guiOpacityMotion(detailChromeHidden)}
                  inert={detailChromeHidden ? true : undefined}
                >
                  <h1 className="sr-only" tabIndex={-1}>{skill.displayName}</h1>
                  <button type="button" className="hero-back-action" aria-label={copy.backToFeed} onClick={openFeed}><ArrowLeft size={19} /></button>
                  <div className="skill-detail-tabs" role="tablist" aria-label={copy.skillContent}>
                    <button
                      id="detail-tab-feed"
                      type="button"
                      role="tab"
                      aria-selected={activeDetailTab === "feed"}
                      aria-controls="detail-panel-feed"
                      tabIndex={activeDetailTab === "feed" ? 0 : -1}
                      disabled={routeInteractionLocked}
                      onClick={() => selectDetailTab("feed")}
                      onKeyDown={handleDetailTabKeyDown}
                    >Feed</button>
                    <button
                      id="detail-tab-creations"
                      type="button"
                      role="tab"
                      aria-selected={activeDetailTab === "creations"}
                      aria-controls="detail-panel-creations"
                      tabIndex={activeDetailTab === "creations" ? 0 : -1}
                      disabled={routeInteractionLocked}
                      onClick={() => selectDetailTab("creations")}
                      onKeyDown={handleDetailTabKeyDown}
                    >{copy.myGenerations}</button>
                  </div>
                  {!previewMode && skill.canInstall !== false && skill.origin !== "host" ? (
                    <div className="skill-install">
                      <button
                        type="button"
                        className="skill-install-action"
                        disabled={installBusy || routeInteractionLocked || !runtime.installSkill}
                        onClick={() => installSelectedSkill(installCanOverwrite)}
                      >
                        {installBusy ? <CircleDashed className="spin" size={15} /> : <FolderDown size={15} />}
                        {installCanOverwrite ? "覆盖安装" : "安装到 Codex"}
                      </button>
                      {installNotice ? <p className="skill-install__notice" role="status">{installNotice}</p> : null}
                    </div>
                  ) : null}
                </motion.header>

                <DetailTabPanel
                  active={activeDetailTab === "feed"}
                  id="detail-panel-feed"
                  className="skill-examples"
                  labelledBy="detail-tab-feed"
                  reduceMotion={Boolean(reduceRouteMotion)}
                >
                    <motion.div ref={restoreFeedRail} className="skill-examples__rail skill-image-feed" layoutScroll>
                      {detailExampleEntries.map(({ example, index }) => {
                        const originItem = routeItemFor("skill-examples", "example", example.id);
                        const referencePreview = example.referencePreview || example.referenceResourceUri;
                        return (
                          <motion.article
                            data-route-item-kind="example"
                            data-route-item-id={example.id}
                            layout
                            layoutId={originItem?.layoutId}
                            initial={false}
                            key={example.id}
                            className="skill-example-card"
                          >
                            <InteractiveTiltCard disabled={routeInteractionLocked || detailChromeHidden}>
                              <div
                                className="skill-example-card__flip"
                                style={{ aspectRatio: "3 / 4" }}
                              >
                                <div className="skill-example-card__face skill-example-card__front">
                                  <button
                                    type="button"
                                    className="skill-example-card__visual"
                                    aria-label={copy.viewArtwork(skill.displayName)}
                                    disabled={routeInteractionLocked}
                                    onClick={() => setArtworkViewer({
                                      index,
                                      items: skill.examples.map((entry, entryIndex) => ({
                                        id: entry.id,
                                        src: examplePreview(entry, skill, entryIndex),
                                        alt: entry.prompt,
                                        prompt: entry.prompt,
                                        aspectRatio: entry.aspectRatio,
                                        mode: entry.mode,
                                      })),
                                    })}
                                  >
                                    <motion.span
                                      className="skill-example-card__media"
                                      layout="position"
                                      layoutId={originItem?.imageLayoutId}
                                    >
                                      <img
                                        src={studioPreviewUrl(originItem?.src ?? examplePreview(example, skill, index), "card")}
                                        alt={example.prompt}
                                        loading={index < 2 ? "eager" : "lazy"}
                                        decoding="async"
                                        fetchPriority={index === 0 ? "high" : "auto"}
                                        onLoad={(event) => {
                                          const image = event.currentTarget;
                                          image.closest<HTMLElement>(".skill-example-card__media")?.classList.add("is-loaded");
                                          if (!image.naturalWidth || !image.naturalHeight) return;
                                          const ratio = image.naturalWidth / image.naturalHeight;
                                          const flip = image.closest<HTMLElement>(".skill-example-card__flip");
                                          const card = image.closest<HTMLElement>(".skill-example-card");
                                          if (flip) flip.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
                                          card?.classList.toggle("is-landscape", ratio > 1.12);
                                        }}
                                        onError={(event) => event.currentTarget.closest<HTMLElement>(".skill-example-card__media")?.classList.add("is-failed")}
                                      />
                                    </motion.span>
                                  </button>
                                  {example.mode === "image-to-image" && referencePreview && skill.id !== "ip-illustration-character-system" ? (
                                    <motion.button
                                      type="button"
                                      className="skill-example-card__reference"
                                      animate={guiOpacityMotion(detailChromeHidden)}
                                      aria-label={copy.enlargeReference(skill.displayName)}
                                      onClick={() => setReferenceLightbox({ src: referencePreview, alt: copy.referenceAlt(skill.displayName) })}
                                    >
                                      <img
                                        src={studioPreviewUrl(referencePreview, "reference")}
                                        alt=""
                                        loading="lazy"
                                        decoding="async"
                                        onLoad={(event) => event.currentTarget.closest<HTMLElement>(".skill-example-card__reference")?.classList.add("is-loaded")}
                                        onError={(event) => event.currentTarget.closest<HTMLElement>(".skill-example-card__reference")?.classList.add("is-failed")}
                                      />
                                      <small><Maximize2 size={8} /> REF</small>
                                    </motion.button>
                                  ) : null}
                                </div>
                              </div>
                            </InteractiveTiltCard>
                          </motion.article>
                        );
                      })}
                    </motion.div>
                </DetailTabPanel>

                <motion.aside
                  className={`skill-detail-composer${composerOpen ? " is-open" : " is-compact"}`}
                  animate={guiOpacityMotion(detailChromeHidden)}
                  inert={detailChromeHidden ? true : undefined}
                >
                  <MorphingComposer
                    open={composerOpen}
                    onOpenChange={(nextOpen) => {
                      if (nextOpen) openComposer("agent");
                      else closeComposer();
                    }}
                    onExitComplete={restoreComposerFocus}
                    brand={<BrandSymbol />}
                    title={previewMode ? copy.webPromptTitle : "Codex"}
                    status={previewMode
                      ? busy ? copy.webPromptCopying : handoffSent ? copy.webPromptCopied : prompt.trim() || copy.webPromptIdle
                      : busy ? copy.handingOff : handoffSent ? copy.composerHandedOff : copy.composerReady}
                    sent={handoffSent}
                    openLabel={previewMode ? copy.openGenerator : copy.composerOpenAria}
                    closeLabel={previewMode ? copy.closeGenerator : copy.composerCloseAria}
                    regionLabel={previewMode ? copy.webPromptTitle : undefined}
                    disabled={busy || detailChromeHidden}
                  >
                    <label className="sr-only" htmlFor="studio-prompt">{copy.prompt}</label>
                    <textarea
                      ref={promptRef}
                      id="studio-prompt"
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      placeholder={copy.promptPlaceholder}
                      rows={5}
                    />

                    <div className="compose-toolbar">
                      {skill.capabilities.references ? (
                        <div className="reference-strip">
                          <label className="reference-add" title={copy.addReference}>
                            <ImagePlus size={18} />
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              onChange={(event) => {
                                const file = event.currentTarget.files?.[0];
                                if (file) addReference(file);
                              }}
                            />
                          </label>
                          {references.map((reference) => (
                            <figure className="reference-thumb" key={reference.file_id}>
                              <img src={reference.preview_url || reference.download_url} alt={copy.referenceImage} />
                              <button type="button" aria-label={copy.removeReference} onClick={() => setReferences((current) => current.filter((entry) => entry.file_id !== reference.file_id))}><X size={11} /></button>
                            </figure>
                          ))}
                        </div>
                      ) : <span className="compose-toolbar__spacer" />}
                      <Button className="handoff-button" onClick={() => generate()} disabled={busy}>
                        {busy ? <CircleDashed className="spin" size={16} /> : <Sparkles size={16} />}
                        {busy ? (previewMode ? copy.webPromptCopying : copy.handingOff) : (previewMode ? copy.copyPrompt : copy.handOff)}
                        <ArrowUpRight size={16} />
                      </Button>
                    </div>
                    {error ? <p className="compose-error" role="alert">{error}</p> : null}
                  </MorphingComposer>
                </motion.aside>

                <DetailTabPanel
                  active={activeDetailTab === "creations"}
                  id="detail-panel-creations"
                  className="skill-results"
                  labelledBy="detail-tab-creations"
                  reduceMotion={Boolean(reduceRouteMotion)}
                >
                    {detailRunEntries.length ? (
                      <motion.div ref={restoreCreationsRail} className="skill-results__feed" role="list" layoutScroll>
                        {detailRunEntries.map(({ run, origin }, index) => {
                          const image = artifactUrl(run);
                          const running = !["succeeded", "failed", "cancelled"].includes(run.status);
                          const fallbackImage = image && origin?.src && image !== origin.src ? origin.src : "";
                          return (
                            <motion.article
                              key={run.id}
                              data-route-item-kind="run"
                              data-route-item-id={run.id}
                              className={`skill-result-card is-${run.status}`}
                              role="listitem"
                              aria-busy={running}
                              layout
                              layoutId={origin?.layoutId}
                              initial={false}
                            >
                              <button
                                type="button"
                                className="skill-result-card__visual"
                                aria-label={`查看作品：${run.snapshot.prompt}，${statusLabels[run.status] ?? run.status}`}
                                disabled={routeInteractionLocked}
                                onClick={() => setSelectedRunId(run.id)}
                              >
                                <motion.span
                                  className="skill-result-card__media"
                                  layout="position"
                                  layoutId={origin?.imageLayoutId}
                                >
                                  {fallbackImage ? (
                                    <img
                                      src={fallbackImage}
                                      alt=""
                                      loading="eager"
                                      decoding="async"
                                      data-progressive-thumbnail="true"
                                    />
                                  ) : null}
                                  {image || origin?.src ? (
                                    <img
                                      src={image || origin?.src}
                                      alt=""
                                      loading={index < 2 ? "eager" : "lazy"}
                                      decoding="async"
                                      data-progressive-detail="true"
                                      onLoad={async (event) => {
                                        const loadedImage = event.currentTarget;
                                        try {
                                          await loadedImage.decode();
                                        } catch {
                                          // The load event still guarantees a renderable image in browsers without decode support.
                                        }
                                        loadedImage.closest<HTMLElement>(".skill-result-card__media")?.classList.add("is-loaded");
                                      }}
                                      onError={(event) => event.currentTarget.closest<HTMLElement>(".skill-result-card__media")?.classList.add("is-failed")}
                                    />
                                  ) : null}
                                </motion.span>
                                {running ? (
                                  <motion.span
                                    className="skill-result-card__status"
                                    animate={guiOpacityMotion(detailChromeHidden)}
                                  ><CircleDashed className="spin" size={15} />{statusLabels[run.status] ?? "Codex 创作中"}</motion.span>
                                ) : null}
                              </button>
                              <motion.div
                                className="skill-result-card__caption"
                                animate={guiOpacityMotion(detailChromeHidden)}
                              >
                                <p>{run.snapshot.prompt}</p>
                                <span>{run.snapshot.aspectRatio}</span>
                                {image ? (
                                  <div>
                                    <Button variant="ghost" size="sm" onClick={() => exportRun(run, "prompt", runtime)}><Download size={14} /> 提示词 → 成图</Button>
                                    <Button variant="ghost" size="sm" disabled={!referenceUrl(run)} onClick={() => exportRun(run, "reference", runtime)}><Download size={14} /> 原图 → 成图</Button>
                                  </div>
                                ) : null}
                              </motion.div>
                            </motion.article>
                          );
                        })}
                      </motion.div>
                    ) : (
                      <div className="minimal-empty"><Sparkles size={24} /><span>{copy.noGenerations}</span></div>
                    )}
                </DetailTabPanel>
              </div>
            ) : (
              <div className="minimal-empty"><span>没有可用 Skill</span></div>
            )}
          </motion.section>
        ) : null}
          <AnimatePresence>
              {artworkViewer ? (
                <ArtworkLightbox
                  items={artworkViewer.items}
                  index={artworkViewer.index}
                  onIndexChange={(index) => setArtworkViewer((current) => current ? { ...current, index } : current)}
                  onClose={() => setArtworkViewer(null)}
                  onRemix={(item) => {
                    const example = skill?.examples.find((entry) => entry.id === item.id);
                    if (!example) return;
                    setArtworkViewer(null);
                    openComposer("remix", example);
                  }}
                  onCopyPrompt={(item) => copyText(item.prompt, "Unable to copy prompt")}
                  labels={{
                    close: copy.closeArtwork,
                    previous: copy.previousArtwork,
                    next: copy.nextArtwork,
                    position: copy.artworkPosition,
                    remix: copy.remix,
                    copyPrompt: copy.copyPrompt,
                  }}
                />
              ) : null}
              {referenceLightbox ? (
              <motion.div
                className="reference-lightbox"
                role="dialog"
                aria-modal="true"
                aria-label={referenceLightbox.alt}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onPointerDown={(event) => {
                  if (event.target === event.currentTarget) setReferenceLightbox(null);
                }}
              >
                <motion.figure
                  initial={{ opacity: 0, scale: 0.94, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ duration: reduceRouteMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  <button type="button" autoFocus aria-label={copy.closeReference} onClick={() => setReferenceLightbox(null)}><X size={18} /></button>
                  <img src={referenceLightbox.src} alt={referenceLightbox.alt} />
                  <figcaption>{referenceLightbox.alt}</figcaption>
                </motion.figure>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </main>
      </LayoutGroup>
    </MotionConfig>
  );
}

async function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function drawContained(ctx: CanvasRenderingContext2D, image: HTMLImageElement, box: { x: number; y: number; width: number; height: number }) {
  const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  ctx.drawImage(image, box.x + (box.width - width) / 2, box.y + (box.height - height) / 2, width, height);
}

function promptLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let current = "";
  for (const char of Array.from(text)) {
    if (ctx.measureText(current + char).width > maxWidth && current) {
      lines.push(current);
      current = char;
    } else current += char;
  }
  if (current) lines.push(current);
  return lines;
}

async function exportRun(run: StudioRun, template: "prompt" | "reference", runtime?: Pick<StudioBridge, "exportFile">) {
  const resultUrl = artifactUrl(run);
  if (!resultUrl || (template === "reference" && !referenceUrl(run))) return;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1440;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f8f3e9";
  ctx.fillRect(0, 0, 1080, 1440);
  ctx.fillStyle = "#171918";
  ctx.font = '700 46px "Songti SC", "Noto Serif CJK SC", serif';
  ctx.fillText(template === "prompt" ? "提示词 → 生成图" : "原图 → 生成图", 72, 104);
  ctx.fillStyle = "#62b2fe";
  ctx.beginPath();
  ctx.roundRect(72, 132, 120, 10, 5);
  ctx.fill();
  const generated = await loadImage(resultUrl);
  if (template === "prompt") {
    ctx.fillStyle = "#e9e2d6";
    ctx.beginPath(); ctx.roundRect(72, 184, 936, 340, 28); ctx.fill();
    let fontSize = 36;
    let lines: string[] = [];
    do {
      ctx.font = `500 ${fontSize}px "PingFang SC", "Noto Sans CJK SC", sans-serif`;
      lines = promptLines(ctx, run.snapshot.prompt, 824);
      fontSize -= 2;
    } while (lines.length > 7 && fontSize >= 22);
    ctx.fillStyle = "#171918";
    const lineHeight = Math.min(48, 260 / Math.max(lines.length, 1));
    lines.forEach((line, index) => ctx.fillText(line, 128, 245 + index * lineHeight));
    ctx.fillStyle = "#e0d9cd";
    ctx.beginPath(); ctx.roundRect(72, 574, 936, 690, 34); ctx.fill();
    drawContained(ctx, generated, { x: 94, y: 596, width: 892, height: 646 });
  } else {
    const original = await loadImage(referenceUrl(run));
    for (const [image, y] of [[original, 184], [generated, 782]] as const) {
      ctx.fillStyle = "#e0d9cd";
      ctx.beginPath(); ctx.roundRect(72, y, 936, 490, 34); ctx.fill();
      drawContained(ctx, image, { x: 94, y: y + 22, width: 892, height: 446 });
    }
    ctx.fillStyle = "#62b2fe";
    ctx.beginPath(); ctx.arc(540, 730, 35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#171918";
    ctx.font = "700 30px sans-serif";
    ctx.fillText("↓", 529, 741);
  }
  ctx.fillStyle = "#666a65";
  ctx.font = '500 23px "PingFang SC", sans-serif';
  ctx.fillText(`${run.snapshot.skill.displayName} · ${run.snapshot.aspectRatio} · CODEX IMAGEGEN`, 72, 1360);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;
  const filename = `${run.snapshot.skill.id}_${run.id.slice(4, 11)}_${template}-result.png`;
  if (runtime?.exportFile) {
    await runtime.exportFile(blob, filename);
    return;
  }
  const link = document.createElement("a");
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1_000);
}

export default ImageSkillStudio;
