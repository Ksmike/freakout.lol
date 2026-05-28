"use client";

import { toast } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LuBot, LuBuilding2, LuCirclePlay, LuFactory, LuFileText, LuGitBranch, LuHandshake, LuHistory, LuLock, LuPackage, LuRefreshCw, LuTrendingUp, LuUpload, LuUser, LuX } from "react-icons/lu";
import {
  startProjectDueDiligence,
  retryProjectDueDiligence,
  cancelProjectDueDiligence,
} from "@/lib/actions/project";
import type {
  ApiKeyProvider,
  DiligenceJobStatus,
  DiligenceStageName,
  DiligenceStageStatus,
  ProjectDocumentProcessingStatus,
} from "@/lib/generated/prisma/client";
import type { ProjectStatus } from "@/lib/models/ProjectModel";
import type { ApiKeyStatus } from "@/lib/actions/apiKeys";
import { ALLOWED_DOCUMENT_ACCEPT } from "@/lib/blob/documents";

type ProjectInspectDocument = {
  id: string;
  filename: string;
  pathname: string;
  size: number;
  uploadedAt: string;
  processingStatus: ProjectDocumentProcessingStatus;
  processingError: string | null;
  lastProcessedAt: string | null;
  reprocessCount: number;
};

type DiligenceJobSummary = {
  id: string;
  status: DiligenceJobStatus;
  selectedProvider: ApiKeyProvider;
  selectedModel: string;
  currentStage: DiligenceStageName | null;
  progressPercent: number;
  tokenUsageTotal: number;
  estimatedCostUsd: number | null;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
  stageRuns: Array<{
    stage: DiligenceStageName;
    status: DiligenceStageStatus;
    attempts: number;
    errorMessage: string | null;
    updatedAt: Date;
  }>;
};

type DiligenceInsightsSummary = {
  risks: Array<{ id: string; title: string; summary: string; confidence: number | null }>;
  claims: Array<{ id: string; claimText: string; confidence: number | null }>;
  entities: Array<{ id: string; name: string; kind: string; confidence: number | null }>;
  contradictions: Array<{
    id: string;
    statementA: string;
    statementB: string;
    confidence: number | null;
  }>;
};

type DiligenceSnapshotSummary = {
  id: string;
  status: DiligenceJobStatus;
  createdAt: Date;
  completedAt: Date | null;
  progressPercent: number;
  tokenUsageTotal: number;
  estimatedCostUsd: number | null;
  insights: DiligenceInsightsSummary;
};

type ProjectDocumentsPanelLabels = {
  documentsHeading: string;
  fileInputLabel: string;
  uploadInProgress: string;
  dropzoneTitle: string;
  dropzoneHint: string;
  uploadQueueHeading: string;
  uploadStatusQueued: string;
  uploadStatusUploading: string;
  uploadStatusUploaded: string;
  uploadStatusFailed: string;
  clearUploadCta: string;
  emptyDocuments: string;
  loadingDocuments: string;
  loadError: string;
  uploadError: string;
  viewFileCta: string;
  deleteFileCta: string;
  deleteInProgress: string;
  deleteError: string;
  reprocessFileCta: string;
  reprocessInProgress: string;
  reprocessError: string;
  fileStatusLabel: string;
  fileProcessingStatuses: Record<ProjectDocumentProcessingStatus, string>;
  beDiligentCta: string;
  providerSelectionLabel: string;
  modelInputLabel: string;
  modelInputPlaceholder: string;
  fallbackProvidersLabel: string;
  retryDiligenceCta: string;
  cancelDiligenceCta: string;
  cancelDiligenceConfirm: string;
  cancelDiligenceToast: string;
  cancelDiligenceErrorToast: string;
  diligenceProgressHeading: string;
  diligenceStatusLabel: string;
  diligenceCurrentStageLabel: string;
  diligenceJobIdLabel: string;
  diligenceTokenUsageLabel: string;
  diligenceCostEstimateLabel: string;
  diligenceLastErrorLabel: string;
  diligenceNoJobMessage: string;
  diligenceFailedStageLabel: string;
  diligenceAttemptsLabel: string;
  diligenceJobCreatedToast: string;
  diligenceRunningToast: string;
  diligenceCompletedToast: string;
  diligenceRetryToast: string;
  diligenceRetryErrorToast: string;
  diligenceStatuses: Record<DiligenceJobStatus, string>;
  diligenceStages: Record<DiligenceStageName, string>;
  setupApiKeysMessage: string;
  setupApiKeysToast: string;
  setupApiKeysNotification: string;
  setupApiKeysLinkCta: string;
  diligenceStartToast: string;
  insightsHeading: string;
  insightsEmpty: string;
  insightsRisksHeading: string;
  insightsClaimsHeading: string;
  insightsEntitiesHeading: string;
  insightsContradictionsHeading: string;
  snapshotHistoryHeading: string;
  snapshotHistoryDescription: string;
  snapshotLabel: string;
  currentSnapshotLabel: string;
  lockedSnapshotLabel: string;
  editableSnapshotLabel: string;
  snapshotCompletedLabel: string;
  snapshotFilesLabel: string;
  snapshotOverviewLabel: string;
  snapshotNoNewFiles: string;
  activeSnapshotHint: string;
};

type ProjectDocumentsPanelProps = {
  projectId: string;
  projectStatus: ProjectStatus;
  hasAnyApiKeys: boolean;
  apiKeyStatuses: ApiKeyStatus[];
  diligenceJob: DiligenceJobSummary | null;
  diligenceSnapshots: DiligenceSnapshotSummary[];
  labels: ProjectDocumentsPanelLabels;
};

type UploadItemStatus = "queued" | "uploading" | "uploaded" | "failed";

type UploadItem = {
  key: string;
  filename: string;
  size: number;
  status: UploadItemStatus;
  error?: string;
};

function buildDocumentReadUrl(projectId: string, filename: string): string {
  const encodedFilename = filename
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/projects/${projectId}/documents/${encodedFilename}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round((bytes / 1024) * 10) / 10} KB`;
  }
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

function formatCurrency(value: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "$0.00";
  }
  return `$${value.toFixed(4)}`;
}

function toTime(value: Date | string | null): number | null {
  if (!value) {
    return null;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function formatDate(value: Date | string | null): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value)
  );
}

const listItemTransition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.6,
} as const;

const listItemAnimation = {
  initial: { opacity: 0, y: 10, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.985 },
};

function uploadStatusClassName(status: UploadItemStatus): string {
  if (status === "uploaded") return "bg-success/15 text-success";
  if (status === "failed") return "bg-danger/15 text-danger";
  if (status === "uploading") return "bg-warning/15 text-warning";
  return "bg-content2 text-foreground/80";
}

function documentStatusClassName(status: ProjectDocumentProcessingStatus): string {
  if (status === "PROCESSED") return "bg-success/15 text-success";
  if (status === "FAILED") return "bg-danger/15 text-danger";
  if (status === "PROCESSING") return "bg-warning/15 text-warning";
  return "bg-content2 text-foreground/80";
}

type EntityKindIconMeta = {
  label: string;
  Icon: typeof LuBuilding2;
  className: string;
};

const ENTITY_KIND_ICONS: Record<string, EntityKindIconMeta> = {
  company: { label: "Company", Icon: LuBuilding2, className: "bg-primary/15 text-primary" },
  person: { label: "Person", Icon: LuUser, className: "bg-secondary/15 text-secondary" },
  product: { label: "Product", Icon: LuPackage, className: "bg-primary/15 text-primary" },
  market: { label: "Market", Icon: LuTrendingUp, className: "bg-warning/15 text-warning" },
  investor: { label: "Investor", Icon: LuHandshake, className: "bg-secondary/15 text-secondary" },
  competitor: { label: "Competitor", Icon: LuFactory, className: "bg-danger/15 text-danger" },
  financial_metric: { label: "Financial", Icon: LuTrendingUp, className: "bg-success/15 text-success" },
};

function getEntityKindIcon(kind: string): EntityKindIconMeta {
  const normalized = kind.trim().toLowerCase();
  return ENTITY_KIND_ICONS[normalized] ?? {
    label: kind.charAt(0).toUpperCase() + kind.slice(1),
    Icon: LuFileText,
    className: "bg-content2 text-foreground/70",
  };
}

function isDiligenceStatusActive(status: DiligenceJobStatus): boolean {
  return status === "QUEUED" || status === "RUNNING" || status === "WAITING_INPUT";
}

function diligenceCardMotionState(
  job: DiligenceJobSummary | null
): "idle" | "active" | "completed" | "failed" {
  if (!job) {
    return "idle";
  }
  if (isDiligenceStatusActive(job.status)) {
    return "active";
  }
  if (job.status === "COMPLETED") {
    return "completed";
  }
  if (job.status === "FAILED" || job.status === "CANCELED") {
    return "failed";
  }
  return "idle";
}

function stageStatusClassName(
  status: DiligenceStageStatus,
  isCurrentStage: boolean
): string {
  if (status === "COMPLETED") {
    return "border-success/40 bg-success/10";
  }
  if (status === "FAILED") {
    return "border-danger/40 bg-danger/10";
  }
  if (status === "RUNNING") {
    return "border-warning/40 bg-warning/10";
  }
  if (isCurrentStage) {
    return "border-primary/40 bg-primary/10";
  }
  return "border-divider bg-background";
}

function stageStatusTextClassName(status: DiligenceStageStatus): string {
  if (status === "COMPLETED") {
    return "text-success";
  }
  if (status === "FAILED") {
    return "text-danger";
  }
  if (status === "RUNNING") {
    return "text-warning";
  }
  return "text-foreground/70";
}

export function ProjectDocumentsPanel({
  projectId,
  projectStatus,
  hasAnyApiKeys,
  apiKeyStatuses,
  diligenceJob,
  diligenceSnapshots,
  labels,
}: ProjectDocumentsPanelProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState<ProjectInspectDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [deletingPaths, setDeletingPaths] = useState<string[]>([]);
  const [reprocessingPaths, setReprocessingPaths] = useState<string[]>([]);
  const [isStartingDiligence, setIsStartingDiligence] = useState(false);
  const [isRetryingDiligence, setIsRetryingDiligence] = useState(false);
  const [isCancellingDiligence, setIsCancellingDiligence] = useState(false);
  const [showApiKeyNotice, setShowApiKeyNotice] = useState(false);
  const [beDiligentShakeNonce, setBeDiligentShakeNonce] = useState(0);
  const canStartDiligence =
    projectStatus === "draft" ||
    projectStatus === "reviewed" ||
    projectStatus === "complete";
  const isDiligenceInProgress =
    diligenceJob?.status === "QUEUED" ||
    diligenceJob?.status === "RUNNING" ||
    diligenceJob?.status === "WAITING_INPUT";
  const diligenceCardState = diligenceCardMotionState(diligenceJob);

  const enabledApiProviders = apiKeyStatuses
    .filter((status) => status.isSet && status.enabled)
    .map((status) => status.provider);

  const [selectedProvider, setSelectedProvider] = useState<ApiKeyProvider | null>(
    enabledApiProviders[0] ?? null
  );

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const firstProvider = enabledApiProviders[0] ?? null;
    if (!firstProvider) {
      return "";
    }
    return (
      apiKeyStatuses.find((status) => status.provider === firstProvider)
        ?.defaultModel ?? ""
    );
  });

  const [selectedFallbackProviders, setSelectedFallbackProviders] = useState<
    ApiKeyProvider[]
  >([]);
  const resolvedSelectedProvider = selectedProvider ?? enabledApiProviders[0] ?? null;

  const documentsApiUrl = useMemo(
    () => `/api/projects/${projectId}/documents`,
    [projectId]
  );

  const loadDocuments = useCallback(async (): Promise<void> => {
    setErrorMessage(null);

    try {
      const response = await fetch(documentsApiUrl, { method: "GET" });
      if (!response.ok) {
        throw new Error(labels.loadError);
      }
      const body = (await response.json()) as { documents?: ProjectInspectDocument[] };
      setDocuments(body.documents ?? []);
    } catch {
      setErrorMessage(labels.loadError);
    } finally {
      setIsLoading(false);
    }
  }, [documentsApiUrl, labels.loadError]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadDocuments();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [loadDocuments]);

  // Poll for diligence job status updates while the job is active
  useEffect(() => {
    if (!isDiligenceInProgress) return;

    const interval = setInterval(() => {
      router.refresh();
    }, 5_000);

    return () => {
      clearInterval(interval);
    };
  }, [isDiligenceInProgress, router]);

  async function uploadFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    const batchPrefix = `${Date.now()}`;
    const filesToUpload = files.map((file, index) => ({
      key: `${batchPrefix}-${index}-${file.lastModified}-${file.size}`,
      file,
    }));
    const initialQueue: UploadItem[] = filesToUpload.map(({ file, key }) => ({
      key,
      filename: file.name,
      size: file.size,
      status: "queued",
    }));
    setUploadItems((currentItems) => [...initialQueue, ...currentItems]);

    let hasUploadFailure = false;

    try {
      for (const queuedFile of filesToUpload) {
        setUploadItems((currentItems) =>
          currentItems.map((item) =>
            item.key === queuedFile.key ? { ...item, status: "uploading" } : item
          )
        );

        const formData = new FormData();
        formData.set("file", queuedFile.file);

        const response = await fetch(documentsApiUrl, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          hasUploadFailure = true;
          setUploadItems((currentItems) =>
            currentItems.map((item) =>
              item.key === queuedFile.key
                ? {
                    ...item,
                    status: "failed",
                    error: body?.error ?? labels.uploadError,
                  }
                : item
            )
          );
          continue;
        }

        setUploadItems((currentItems) =>
          currentItems.map((item) =>
            item.key === queuedFile.key ? { ...item, status: "uploaded" } : item
          )
        );
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await loadDocuments();

      if (hasUploadFailure) {
        setErrorMessage(labels.uploadError);
      } else {
        // Clear completed uploads after a brief delay so user sees "uploaded" status
        setTimeout(() => {
          setUploadItems((currentItems) =>
            currentItems.filter((item) => item.status !== "uploaded")
          );
        }, 2000);
      }
    } catch {
      setErrorMessage(labels.uploadError);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteDocument(document: ProjectInspectDocument) {
    const documentUrl = buildDocumentReadUrl(projectId, document.filename);
    setDeletingPaths((currentPaths) => [...currentPaths, document.pathname]);
    setErrorMessage(null);

    try {
      const response = await fetch(documentUrl, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(labels.deleteError);
      }

      setDocuments((currentDocuments) =>
        currentDocuments.filter((item) => item.pathname !== document.pathname)
      );
    } catch {
      setErrorMessage(labels.deleteError);
    } finally {
      setDeletingPaths((currentPaths) =>
        currentPaths.filter((path) => path !== document.pathname)
      );
    }
  }

  async function handleReprocessDocument(document: ProjectInspectDocument) {
    const documentUrl = buildDocumentReadUrl(projectId, document.filename);
    setReprocessingPaths((currentPaths) => [...currentPaths, document.pathname]);
    setErrorMessage(null);

    try {
      const response = await fetch(documentUrl, { method: "PATCH" });
      if (!response.ok) {
        throw new Error(labels.reprocessError);
      }

      setDocuments((currentDocuments) =>
        currentDocuments.map((item) =>
          item.pathname === document.pathname
            ? {
                ...item,
                processingStatus: "QUEUED",
                processingError: null,
                reprocessCount: item.reprocessCount + 1,
              }
            : item
        )
      );
      toast.success(labels.reprocessInProgress);
      router.refresh();
    } catch {
      setErrorMessage(labels.reprocessError);
    } finally {
      setReprocessingPaths((currentPaths) =>
        currentPaths.filter((path) => path !== document.pathname)
      );
    }
  }

  const uploadStatusText: Record<UploadItemStatus, string> = {
    queued: labels.uploadStatusQueued,
    uploading: labels.uploadStatusUploading,
    uploaded: labels.uploadStatusUploaded,
    failed: labels.uploadStatusFailed,
  };
  const visibleUploadItems = uploadItems.filter((item) => item.status !== "uploaded");
  const completedSnapshots = useMemo(
    () =>
      diligenceSnapshots.map((snapshot, index) => {
        const previousCompletedAt =
          index > 0 ? toTime(diligenceSnapshots[index - 1]?.completedAt) : null;
        const completedAt = toTime(snapshot.completedAt);
        const snapshotDocuments = documents.filter((document) => {
          const uploadedAt = toTime(document.uploadedAt);
          if (uploadedAt === null || completedAt === null) {
            return false;
          }
          return (
            (previousCompletedAt === null || uploadedAt > previousCompletedAt) &&
            uploadedAt <= completedAt
          );
        });

        return {
          ...snapshot,
          number: index + 1,
          documents: snapshotDocuments,
        };
      }),
    [diligenceSnapshots, documents]
  );
  const displayedCompletedSnapshots = useMemo(
    () => [...completedSnapshots].reverse(),
    [completedSnapshots]
  );
  const latestCompletedSnapshot =
    completedSnapshots[completedSnapshots.length - 1] ?? null;
  const latestCompletedAt = useMemo(() => {
    const latestSnapshot = diligenceSnapshots[diligenceSnapshots.length - 1];
    return toTime(latestSnapshot?.completedAt ?? null);
  }, [diligenceSnapshots]);
  const activeDocuments = useMemo(
    () =>
      documents.filter((document) => {
        const uploadedAt = toTime(document.uploadedAt);
        return (
          uploadedAt !== null &&
          (latestCompletedAt === null || uploadedAt > latestCompletedAt)
        );
      }),
    [documents, latestCompletedAt]
  );
  const activeSnapshotNumber = completedSnapshots.length + 1;
  const hasCompletedSnapshots = completedSnapshots.length > 0;
  const runnableDocuments = hasCompletedSnapshots ? activeDocuments : documents;
  const showDiligenceStageDetails = diligenceJob?.status !== "COMPLETED";
  const showDiligenceWorker = !diligenceJob || diligenceJob.status !== "COMPLETED";

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
    const droppedFiles = Array.from(event.dataTransfer.files);
    void uploadFiles(droppedFiles);
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const pickedFiles = Array.from(event.target.files ?? []);
    void uploadFiles(pickedFiles);
  }

  function handleClearUploadItem(uploadItemKey: string) {
    setUploadItems((currentItems) =>
      currentItems.filter((item) => item.key !== uploadItemKey)
    );
    setErrorMessage(null);
  }

  async function handleBeDiligent() {
    if (!hasAnyApiKeys) {
      setShowApiKeyNotice(true);
      setBeDiligentShakeNonce((currentNonce) => currentNonce + 1);
      window.dispatchEvent(new CustomEvent("ddq:highlight-settings-nav"));
      return;
    }
    if (!canStartDiligence) {
      return;
    }

    if (!resolvedSelectedProvider) {
      toast.danger(labels.setupApiKeysMessage);
      return;
    }

    setIsStartingDiligence(true);
    try {
      const result = await startProjectDueDiligence(projectId, {
        selectedProvider: resolvedSelectedProvider,
        selectedModel,
        fallbackProviders: selectedFallbackProviders,
      });
      if (result.error) {
        toast.danger(result.error);
        return;
      }
      toast.success(labels.diligenceJobCreatedToast);
      toast.success(labels.diligenceStartToast);
      window.dispatchEvent(new CustomEvent("ddq:sidebar-refresh"));
      router.refresh();
    } finally {
      setIsStartingDiligence(false);
    }
  }

  async function handleRetryDiligence() {
    if (!diligenceJob) {
      return;
    }

    setIsRetryingDiligence(true);
    try {
      const result = await retryProjectDueDiligence(diligenceJob.id);
      if (result.error) {
        toast.danger(result.error || labels.diligenceRetryErrorToast);
        return;
      }
      toast.success(labels.diligenceRetryToast);
      router.refresh();
    } finally {
      setIsRetryingDiligence(false);
    }
  }

  async function handleCancelDiligence() {
    if (!diligenceJob) {
      return;
    }
    if (!window.confirm(labels.cancelDiligenceConfirm)) {
      return;
    }

    setIsCancellingDiligence(true);
    try {
      const result = await cancelProjectDueDiligence(diligenceJob.id);
      if (result.error) {
        toast.danger(result.error || labels.cancelDiligenceErrorToast);
        return;
      }
      toast.success(labels.cancelDiligenceToast);
      router.refresh();
    } finally {
      setIsCancellingDiligence(false);
    }
  }

  function handleProviderChange(provider: ApiKeyProvider) {
    setSelectedProvider(provider);
    setSelectedFallbackProviders((currentFallbacks) =>
      currentFallbacks.filter((value) => value !== provider)
    );

    const providerModel = apiKeyStatuses.find(
      (status) => status.provider === provider
    )?.defaultModel;
    if (providerModel) {
      setSelectedModel(providerModel);
    }
  }

  function toggleFallbackProvider(provider: ApiKeyProvider) {
    setSelectedFallbackProviders((currentFallbacks) => {
      if (currentFallbacks.includes(provider)) {
        return currentFallbacks.filter((value) => value !== provider);
      }
      return [...currentFallbacks, provider];
    });
  }

  function renderUploadDropzone() {
    if (isDiligenceInProgress) {
      return null;
    }

    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          isDragActive ? "border-primary bg-primary/10" : "border-divider bg-background"
        }`}
      >
        <LuUpload aria-hidden="true" className="mx-auto mb-2 size-5 text-primary" />
        <p className="text-sm font-medium text-foreground">{labels.dropzoneTitle}</p>
        <p className="mt-1 text-xs text-foreground/70">{labels.dropzoneHint}</p>
        {isUploading && (
          <p className="mt-3 text-xs font-medium text-warning">
            {labels.uploadInProgress}
          </p>
        )}
        <label
          htmlFor="files"
          className="mt-4 inline-block cursor-pointer rounded-md border border-divider bg-content1 px-3 py-2 text-xs font-medium text-foreground hover:bg-content2"
        >
          {labels.fileInputLabel}
        </label>
        <input
          ref={fileInputRef}
          id="files"
          name="files"
          type="file"
          multiple
          accept={ALLOWED_DOCUMENT_ACCEPT}
          onChange={handleInputChange}
          className="sr-only"
        />
      </div>
    );
  }

  function renderUploadQueue() {
    if (isDiligenceInProgress || visibleUploadItems.length === 0) {
      return null;
    }

    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          {labels.uploadQueueHeading}
        </p>
        <motion.ul layout className="space-y-2">
          <AnimatePresence initial={false}>
            {visibleUploadItems.map((item) => (
              <motion.li
                layout
                key={item.key}
                initial={listItemAnimation.initial}
                animate={listItemAnimation.animate}
                exit={listItemAnimation.exit}
                transition={listItemTransition}
                className="rounded-md border border-divider bg-background px-3 py-2 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.filename}</p>
                    <p className="text-xs text-foreground/60">{formatSize(item.size)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={`${item.key}-${item.status}`}
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -5, scale: 0.95 }}
                        transition={{ duration: 0.18 }}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          uploadStatusClassName(item.status)
                        } ${item.status === "uploading" ? "animate-pulse" : ""}`}
                      >
                        {uploadStatusText[item.status]}
                      </motion.span>
                    </AnimatePresence>
                    {item.status === "failed" && (
                      <button
                        type="button"
                        onClick={() => handleClearUploadItem(item.key)}
                        className="inline-flex items-center gap-1 rounded-md border border-divider px-2 py-1 text-xs font-medium text-foreground/70 hover:bg-content2 hover:text-foreground"
                      >
                        <LuX aria-hidden="true" className="size-3.5" />
                        {labels.clearUploadCta}
                      </button>
                    )}
                  </div>
                </div>
                {item.error && <p className="mt-2 text-xs text-danger">{item.error}</p>}
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      </div>
    );
  }

  function renderDocumentList(input: {
    documents: ProjectInspectDocument[];
    locked: boolean;
  }) {
    if (input.documents.length === 0) {
      return <p className="text-sm text-foreground/70">{labels.emptyDocuments}</p>;
    }

    return (
      <motion.ul layout className="space-y-2">
        <AnimatePresence initial={false}>
          {input.documents.map((document) => (
            <motion.li
              layout
              key={document.pathname}
              initial={listItemAnimation.initial}
              animate={listItemAnimation.animate}
              exit={listItemAnimation.exit}
              transition={listItemTransition}
              className="flex flex-col gap-2 rounded-md border border-divider bg-background px-3 py-2 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {document.filename}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-foreground/60">{formatSize(document.size)}</p>
                  <span className="text-xs text-foreground/50">
                    {labels.fileStatusLabel}:
                  </span>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={`${document.pathname}-${document.processingStatus}`}
                      initial={{ opacity: 0, y: 4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.95 }}
                      transition={{ duration: 0.18 }}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        documentStatusClassName(document.processingStatus)
                      } ${
                        document.processingStatus === "PROCESSING" ? "animate-pulse" : ""
                      }`}
                    >
                      {labels.fileProcessingStatuses[document.processingStatus]}
                    </motion.span>
                  </AnimatePresence>
                </div>
                {document.processingError && (
                  <p className="mt-1 text-xs text-danger">{document.processingError}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 sm:shrink-0">
                <a
                  href={buildDocumentReadUrl(projectId, document.filename)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {labels.viewFileCta}
                </a>
                {!input.locked && document.processingStatus === "PROCESSED" && (
                  <button
                    type="button"
                    onClick={() => void handleReprocessDocument(document)}
                    disabled={reprocessingPaths.includes(document.pathname)}
                    className="text-xs font-medium text-warning hover:underline disabled:opacity-50"
                  >
                    {reprocessingPaths.includes(document.pathname)
                      ? labels.reprocessInProgress
                      : labels.reprocessFileCta}
                  </button>
                )}
                {!input.locked && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteDocument(document)}
                    disabled={deletingPaths.includes(document.pathname)}
                    className="text-xs font-medium text-danger hover:underline disabled:opacity-50"
                  >
                    {deletingPaths.includes(document.pathname)
                      ? labels.deleteInProgress
                      : labels.deleteFileCta}
                  </button>
                )}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
    );
  }

  function renderSnapshotOverview(insights: DiligenceInsightsSummary) {
    const hasInsights =
      insights.risks.length > 0 ||
      insights.claims.length > 0 ||
      insights.entities.length > 0 ||
      insights.contradictions.length > 0;

    if (!hasInsights) {
      return <p className="text-sm text-foreground/70">{labels.insightsEmpty}</p>;
    }

    return (
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">
            {labels.insightsRisksHeading}
          </h4>
          {insights.risks.length === 0 ? (
            <p className="text-xs text-foreground/60">{labels.insightsEmpty}</p>
          ) : (
            <ul className="space-y-1">
              {insights.risks.map((risk) => (
                <li
                  key={risk.id}
                  className="rounded-md border border-divider bg-background px-2.5 py-2"
                >
                  <p className="text-xs font-medium text-foreground">{risk.title}</p>
                  <p className="mt-1 text-xs text-foreground/70">{risk.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">
            {labels.insightsClaimsHeading}
          </h4>
          {insights.claims.length === 0 ? (
            <p className="text-xs text-foreground/60">{labels.insightsEmpty}</p>
          ) : (
            <ul className="space-y-1">
              {insights.claims.map((claim) => (
                <li
                  key={claim.id}
                  className="rounded-md border border-divider bg-background px-2.5 py-2 text-xs text-foreground"
                >
                  {claim.claimText}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">
            {labels.insightsEntitiesHeading}
          </h4>
          {insights.entities.length === 0 ? (
            <p className="text-xs text-foreground/60">{labels.insightsEmpty}</p>
          ) : (
            <ul className="space-y-1">
              {insights.entities.map((entity) => {
                const kindMeta = getEntityKindIcon(entity.kind);
                return (
                  <li
                    key={entity.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-divider bg-background px-2.5 py-2"
                  >
                    <span className="truncate text-xs font-medium text-foreground">
                      {entity.name}
                    </span>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${kindMeta.className}`}>
                      <kindMeta.Icon aria-hidden="true" className="size-3" />
                      {kindMeta.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">
            {labels.insightsContradictionsHeading}
          </h4>
          {insights.contradictions.length === 0 ? (
            <p className="text-xs text-foreground/60">{labels.insightsEmpty}</p>
          ) : (
            <ul className="space-y-1">
              {insights.contradictions.map((contradiction) => (
                <li
                  key={contradiction.id}
                  className="rounded-md border border-divider bg-background px-2.5 py-2"
                >
                  <p className="text-xs text-foreground">{contradiction.statementA}</p>
                  <p className="mt-1 text-xs text-danger">{contradiction.statementB}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {runnableDocuments.length > 0 && (
        <div className="order-0 flex justify-end">
          <motion.button
            type="button"
            onClick={() => void handleBeDiligent()}
            disabled={isStartingDiligence || !canStartDiligence}
            animate={
              beDiligentShakeNonce > 0
                ? { x: [0, -7, 7, -6, 6, -3, 3, 0] }
                : { x: 0 }
            }
            transition={{ duration: 0.45, ease: "easeInOut" }}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-60 ${
              hasAnyApiKeys
                ? "bg-success/20 text-success hover:opacity-90"
                : "bg-warning/20 text-warning hover:opacity-90"
            }`}
          >
            <LuCirclePlay aria-hidden="true" className="size-4" />
            {labels.beDiligentCta}
          </motion.button>
        </div>
      )}

      {latestCompletedSnapshot && (
        <motion.section
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className="order-2 space-y-4 rounded-xl border border-divider bg-content1 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-foreground">
              {labels.insightsHeading}
            </h3>
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
              {labels.snapshotLabel} {latestCompletedSnapshot.number}
            </span>
          </div>
          {renderSnapshotOverview(latestCompletedSnapshot.insights)}
        </motion.section>
      )}

      <section className="order-3 space-y-4 rounded-xl border border-divider bg-content1 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {labels.snapshotHistoryHeading}
            </h2>
            <p className="mt-1 text-sm text-foreground/60">
              {labels.snapshotHistoryDescription}
            </p>
          </div>
          <LuHistory aria-hidden="true" className="size-5 shrink-0 text-primary" />
        </div>

        {errorMessage && (
          <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {errorMessage}
          </p>
        )}

        {isLoading ? (
          <p className="text-sm text-foreground/70">{labels.loadingDocuments}</p>
        ) : (
          <div className="relative space-y-4 pl-5">
            {hasCompletedSnapshots && (
              <span className="absolute bottom-8 left-2 top-2 w-px bg-divider" />
            )}

            <motion.article
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="relative space-y-4 rounded-xl border border-warning/35 bg-warning/5 p-4"
            >
              {hasCompletedSnapshots && (
                <span className="absolute -left-[1.18rem] top-5 size-3 rounded-full border-2 border-content1 bg-warning" />
              )}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-foreground">
                      {hasCompletedSnapshots
                        ? `${labels.snapshotLabel} ${activeSnapshotNumber}`
                        : labels.currentSnapshotLabel}
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-content1 px-2 py-0.5 text-[11px] font-medium text-foreground/70">
                      <LuGitBranch aria-hidden="true" className="size-3" />
                      {labels.editableSnapshotLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-foreground/60">
                    {labels.activeSnapshotHint}
                  </p>
                </div>
              </div>

              {renderUploadDropzone()}
              {renderUploadQueue()}

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">
                  {labels.snapshotFilesLabel}
                </h4>
                {activeDocuments.length === 0 && hasCompletedSnapshots ? (
                  <p className="text-sm text-foreground/70">
                    {labels.snapshotNoNewFiles}
                  </p>
                ) : (
                  renderDocumentList({
                    documents: activeDocuments,
                    locked: false,
                  })
                )}
              </div>
            </motion.article>

            {displayedCompletedSnapshots.map((snapshot, index) => {
              const toneClassName =
                index % 2 === 0
                  ? "border-primary/35 bg-primary/5"
                  : "border-secondary/35 bg-secondary/5";

              return (
                <motion.article
                  key={snapshot.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, ease: "easeOut" }}
                  className={`relative space-y-4 rounded-xl border p-4 ${toneClassName}`}
                >
                  <span className="absolute -left-[1.18rem] top-5 size-3 rounded-full border-2 border-content1 bg-primary" />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground">
                          {labels.snapshotLabel} {snapshot.number}
                        </h3>
                        <span className="inline-flex items-center gap-1 rounded-full bg-content1 px-2 py-0.5 text-[11px] font-medium text-foreground/70">
                          <LuLock aria-hidden="true" className="size-3" />
                          {labels.lockedSnapshotLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-foreground/60">
                        {labels.snapshotCompletedLabel}:{" "}
                        {formatDate(snapshot.completedAt)}
                      </p>
                    </div>
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                      {labels.diligenceStatuses[snapshot.status]}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">
                      {labels.snapshotOverviewLabel}
                    </h4>
                    {renderSnapshotOverview(snapshot.insights)}
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">
                      {labels.snapshotFilesLabel}
                    </h4>
                    {renderDocumentList({
                      documents: snapshot.documents,
                      locked: true,
                    })}
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </section>

      {runnableDocuments.length > 0 && canStartDiligence && enabledApiProviders.length > 0 && (
        <section className="order-4 space-y-3 rounded-xl border border-divider bg-content1 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-foreground/70">{labels.providerSelectionLabel}</span>
              <select
                value={resolvedSelectedProvider ?? ""}
                onChange={(event) =>
                  handleProviderChange(event.target.value as ApiKeyProvider)
                }
                className="w-full rounded-md border border-divider bg-background px-3 py-2 text-sm text-foreground"
              >
                {enabledApiProviders.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-foreground/70">{labels.modelInputLabel}</span>
              <input
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value)}
                placeholder={labels.modelInputPlaceholder}
                className="w-full rounded-md border border-divider bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-foreground/70">{labels.fallbackProvidersLabel}</p>
            <div className="flex flex-wrap gap-2">
              {enabledApiProviders
                .filter((provider) => provider !== resolvedSelectedProvider)
                .map((provider) => (
                  <label
                    key={provider}
                    className="flex items-center gap-2 rounded-md border border-divider bg-background px-2.5 py-1.5 text-xs text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFallbackProviders.includes(provider)}
                      onChange={() => toggleFallbackProvider(provider)}
                    />
                    <span>{provider}</span>
                  </label>
                ))}
            </div>
          </div>
        </section>
      )}

      <AnimatePresence initial={false}>
        {showApiKeyNotice && !hasAnyApiKeys && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.985 }}
            transition={{ duration: 0.22 }}
            className="order-5 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-2 text-sm text-warning">
              <span>{labels.setupApiKeysNotification}</span>
              <Link
                href="/settings/api-keys"
                className="font-semibold underline underline-offset-2 hover:opacity-85"
              >
                {labels.setupApiKeysLinkCta}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showDiligenceWorker && (
        <motion.section
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className="order-1 space-y-3 rounded-xl border border-divider bg-content1 p-4"
        >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <motion.span
              animate={
                isDiligenceInProgress
                  ? { rotate: [0, -8, 8, -5, 5, 0], scale: [1, 1.06, 1] }
                  : { rotate: 0, scale: 1 }
              }
              transition={
                isDiligenceInProgress
                  ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.2 }
              }
            >
              <LuBot aria-hidden="true" className="size-4 text-primary" />
            </motion.span>
            <h3 className="text-base font-semibold text-foreground">
              {labels.diligenceProgressHeading}
            </h3>
          </div>

          <AnimatePresence mode="wait">
            {diligenceJob && (
              <motion.span
                key={diligenceJob.status}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  diligenceCardState === "completed"
                    ? "bg-success/15 text-success"
                    : diligenceCardState === "failed"
                      ? "bg-danger/15 text-danger"
                      : diligenceCardState === "active"
                        ? "bg-warning/15 text-warning"
                        : "bg-content2 text-foreground/80"
                }`}
              >
                {labels.diligenceStatuses[diligenceJob.status]}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {!diligenceJob ? (
            <motion.p
              key="no-job"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="text-sm text-foreground/70"
            >
              {labels.diligenceNoJobMessage}
            </motion.p>
          ) : (
            <motion.div
              key={diligenceJob.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <p className="text-foreground/70">
                  {labels.diligenceStatusLabel}: {labels.diligenceStatuses[diligenceJob.status]}
                </p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`${diligenceJob.id}-${diligenceJob.stageRuns.find((sr) => sr.status === "RUNNING")?.stage ?? diligenceJob.currentStage ?? "none"}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="text-foreground/70"
                  >
                    {labels.diligenceCurrentStageLabel}:{" "}
                    {(() => {
                      const runningStage = diligenceJob.stageRuns.find(
                        (sr) => sr.status === "RUNNING"
                      );
                      const activeStage = runningStage?.stage ?? diligenceJob.currentStage;
                      return activeStage
                        ? labels.diligenceStages[activeStage]
                        : "-";
                    })()}
                  </motion.p>
                </AnimatePresence>
                <p className="min-w-0 text-foreground/70">
                  {labels.diligenceJobIdLabel}:{" "}
                  <span className="break-all font-mono">{diligenceJob.id}</span>
                </p>
                <motion.p
                  key={`${diligenceJob.id}-tokens-${diligenceJob.tokenUsageTotal}`}
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="text-foreground/70"
                >
                  {labels.diligenceTokenUsageLabel}: {diligenceJob.tokenUsageTotal}
                </motion.p>
                <motion.p
                  key={`${diligenceJob.id}-cost-${diligenceJob.estimatedCostUsd ?? "none"}`}
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="text-foreground/70"
                >
                  {labels.diligenceCostEstimateLabel}:{" "}
                  {formatCurrency(diligenceJob.estimatedCostUsd)}
                </motion.p>
              </div>

              <AnimatePresence>
                {diligenceJob.errorMessage && (
                  <motion.p
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger"
                  >
                    {labels.diligenceLastErrorLabel}: {diligenceJob.errorMessage}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Dead-letter panel — shown when job is FAILED with a failed stage */}
              <AnimatePresence>
                {diligenceJob.status === "FAILED" && (() => {
                  const failedStage = [...diligenceJob.stageRuns]
                    .reverse()
                    .find((sr) => sr.status === "FAILED");
                  if (!failedStage) return null;
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.22 }}
                      className="rounded-lg border border-danger/30 bg-danger/5 p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-danger/70">
                            {labels.diligenceFailedStageLabel}
                          </p>
                          <p className="mt-0.5 text-sm font-medium text-foreground">
                            {labels.diligenceStages[failedStage.stage]}
                          </p>
                          {failedStage.attempts > 1 && (
                            <p className="mt-0.5 text-xs text-foreground/50">
                              {labels.diligenceAttemptsLabel}: {failedStage.attempts}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleRetryDiligence()}
                          disabled={isRetryingDiligence}
                          className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:opacity-90 disabled:opacity-60"
                        >
                          <LuRefreshCw
                            aria-hidden="true"
                            className={`size-3.5 ${isRetryingDiligence ? "animate-spin" : ""}`}
                          />
                          {labels.retryDiligenceCta}
                        </button>
                      </div>
                      {failedStage.errorMessage && (
                        <p className="rounded-md bg-danger/10 px-2.5 py-2 text-xs text-danger break-words leading-relaxed font-mono">
                          {failedStage.errorMessage}
                        </p>
                      )}
                    </motion.div>
                  );
                })()}
              </AnimatePresence>

              {showDiligenceStageDetails && (
                <div className="h-2 overflow-hidden rounded-full bg-content2">
                  <motion.div
                    className={`h-full bg-primary ${
                      isDiligenceInProgress ? "animate-pulse" : ""
                    }`}
                    animate={{ width: `${diligenceJob.progressPercent}%` }}
                    transition={{ type: "spring", stiffness: 140, damping: 24 }}
                  />
                </div>
              )}

              {showDiligenceStageDetails && diligenceJob.stageRuns.length > 0 && (
                <motion.ul layout className="space-y-1">
                  {diligenceJob.stageRuns.map((stageRun) => {
                    const isCurrentStage = stageRun.status === "RUNNING";
                    const hasFailed = stageRun.status === "FAILED";
                    return (
                      <motion.li
                        key={stageRun.stage}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`rounded-md border px-2.5 py-1.5 text-xs ${stageStatusClassName(
                          stageRun.status,
                          isCurrentStage
                        )}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-foreground">
                            {labels.diligenceStages[stageRun.stage]}
                          </span>
                          <div className="flex shrink-0 items-center gap-2">
                            {stageRun.attempts > 1 && (
                              <span className="text-foreground/50">
                                {stageRun.attempts}×
                              </span>
                            )}
                            <motion.span
                              key={`${stageRun.stage}-${stageRun.status}-${stageRun.attempts}`}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.14 }}
                              className={stageStatusTextClassName(stageRun.status)}
                            >
                              {stageRun.status}
                            </motion.span>
                          </div>
                        </div>
                        {hasFailed && stageRun.errorMessage && (
                          <p className="mt-1.5 break-words text-danger/80 leading-snug">
                            {stageRun.errorMessage}
                          </p>
                        )}
                      </motion.li>
                    );
                  })}
                </motion.ul>
              )}

              {(diligenceJob.status === "FAILED" ||
                diligenceJob.status === "WAITING_INPUT" ||
                diligenceJob.status === "RUNNING" ||
                diligenceJob.status === "QUEUED") && (
                <motion.div layout className="flex flex-wrap justify-end gap-2">
                  {(diligenceJob.status === "FAILED" ||
                    diligenceJob.status === "WAITING_INPUT") && (
                    <button
                      type="button"
                      onClick={() => void handleRetryDiligence()}
                      disabled={isRetryingDiligence}
                      className="inline-flex items-center gap-2 rounded-md bg-primary/15 px-3 py-2 text-sm font-medium text-primary hover:opacity-90 disabled:opacity-60"
                    >
                      <LuRefreshCw
                        aria-hidden="true"
                        className={`size-4 ${isRetryingDiligence ? "animate-spin" : ""}`}
                      />
                      {labels.retryDiligenceCta}
                    </button>
                  )}
                  {(diligenceJob.status === "RUNNING" ||
                    diligenceJob.status === "QUEUED") && (
                    <motion.button
                      type="button"
                      onClick={() => void handleCancelDiligence()}
                      disabled={isCancellingDiligence}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="inline-flex items-center gap-2 rounded-md bg-danger/15 px-3 py-2 text-sm font-medium text-danger hover:opacity-90 disabled:opacity-60"
                    >
                      {labels.cancelDiligenceCta}
                    </motion.button>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        </motion.section>
      )}

    </div>
  );
}
