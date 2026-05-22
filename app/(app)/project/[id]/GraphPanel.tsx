"use client";

import { useState, useTransition } from "react";
import {
  LuNetwork,
  LuCircleCheck,
  LuCircle,
  LuMinus,
  LuChevronDown,
  LuChevronRight,
  LuTriangleAlert,
} from "react-icons/lu";
import { updateEvidenceMapping } from "@/lib/actions/graph";
import type { GapSummary, MappingSummary } from "@/lib/models/GraphModel";
import type { AppLabels } from "@/labels/types";

// Mirror the Prisma enum as plain strings for the client bundle
const EvidenceRequirementStatus = {
  OPEN: "OPEN",
  PARTIAL: "PARTIAL",
  SATISFIED: "SATISFIED",
  WAIVED: "WAIVED",
} as const;
type EvidenceRequirementStatus = typeof EvidenceRequirementStatus[keyof typeof EvidenceRequirementStatus];

type GraphLabels = AppLabels["app"]["graphWorkflow"];

type Props = {
  projectId: string;
  graphName: string;
  gaps: GapSummary[];
  mappings: MappingSummary[];
  labels: GraphLabels;
};

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function PriorityBadge({ priority, labels }: { priority: string; labels: GraphLabels }) {
  const map: Record<string, { label: string; className: string }> = {
    high: { label: labels.gapPriorityHigh, className: "bg-danger/10 text-danger" },
    medium: { label: labels.gapPriorityMedium, className: "bg-warning/10 text-warning" },
    low: { label: labels.gapPriorityLow, className: "bg-default/10 text-foreground/50" },
  };
  const { label, className } = map[priority] ?? map.medium;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function StatusIcon({ status }: { status: EvidenceRequirementStatus }) {
  switch (status) {
    case EvidenceRequirementStatus.SATISFIED:
      return <LuCircleCheck className="size-4 text-success" aria-hidden="true" />;
    case EvidenceRequirementStatus.PARTIAL:
      return <LuMinus className="size-4 text-warning" aria-hidden="true" />;
    case EvidenceRequirementStatus.WAIVED:
      return <LuMinus className="size-4 text-foreground/40" aria-hidden="true" />;
    default:
      return <LuCircle className="size-4 text-foreground/30" aria-hidden="true" />;
  }
}

function GapRow({
  gap,
  projectId,
  labels,
}: {
  gap: GapSummary;
  projectId: string;
  labels: GraphLabels;
}) {
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [expanded, setExpanded] = useState(false);

  function handleMark(status: EvidenceRequirementStatus) {
    startTransition(async () => {
      await updateEvidenceMapping({
        projectId,
        requirementId: gap.requirementId,
        status,
        analystNote: note || undefined,
      });
    });
  }

  return (
    <li className="border-b border-divider/50 last:border-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-content2/40"
        aria-expanded={expanded}
      >
        <StatusIcon status={gap.status} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{gap.requirementTitle}</p>
          <p className="mt-0.5 text-xs text-foreground/50">{gap.nodeLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PriorityBadge priority={gap.priority} labels={labels} />
          {expanded ? (
            <LuChevronDown className="size-4 text-foreground/40" aria-hidden="true" />
          ) : (
            <LuChevronRight className="size-4 text-foreground/40" aria-hidden="true" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-divider/30 bg-content2/20 px-4 py-3 space-y-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Analyst note (optional)..."
            rows={2}
            className="w-full rounded-md border border-divider bg-background px-3 py-2 text-xs text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleMark(EvidenceRequirementStatus.SATISFIED)}
              className="flex items-center gap-1.5 rounded-md bg-success/10 px-3 py-1.5 text-xs font-medium text-success transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              <LuCircleCheck className="size-3.5" aria-hidden="true" />
              {labels.markSatisfiedCta}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleMark(EvidenceRequirementStatus.WAIVED)}
              className="flex items-center gap-1.5 rounded-md border border-divider px-3 py-1.5 text-xs font-medium text-foreground/60 transition-colors hover:bg-content2 disabled:opacity-50"
            >
              <LuMinus className="size-3.5" aria-hidden="true" />
              {labels.markWaivedCta}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function GraphPanel({ projectId, graphName, gaps, mappings, labels }: Props) {
  const [showAll, setShowAll] = useState(false);

  const sortedGaps = [...gaps].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
  );

  const satisfiedCount = mappings.filter(
    (m) => m.status === EvidenceRequirementStatus.SATISFIED
  ).length;
  const totalCount = mappings.length + gaps.length;
  const pct = totalCount > 0 ? Math.round((satisfiedCount / totalCount) * 100) : 0;

  const visibleGaps = showAll ? sortedGaps : sortedGaps.slice(0, 5);
  const hasMore = sortedGaps.length > 5;

  return (
    <div className="rounded-xl border border-divider bg-content1">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-divider px-4 py-3">
        <div className="flex items-center gap-2">
          <LuNetwork className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">{graphName}</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-foreground/60">
          <span>{satisfiedCount}/{totalCount}</span>
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-content2">
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Requirements satisfied"
            />
          </div>
          <span>{pct}%</span>
        </div>
      </div>

      {/* Gaps list */}
      <div>
        <div className="flex items-center gap-2 px-4 py-2.5">
          <LuTriangleAlert className="size-3.5 text-warning" aria-hidden="true" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
            {labels.gapsHeading}
          </h3>
          {sortedGaps.length > 0 && (
            <span className="ml-auto rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
              {sortedGaps.length}
            </span>
          )}
        </div>

        {sortedGaps.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-foreground/50">{labels.gapsEmpty}</p>
        ) : (
          <>
            <ul>
              {visibleGaps.map((gap) => (
                <GapRow
                  key={gap.requirementId}
                  gap={gap}
                  projectId={projectId}
                  labels={labels}
                />
              ))}
            </ul>
            {hasMore && (
              <div className="border-t border-divider/30 px-4 py-2">
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {showAll
                    ? "Show fewer"
                    : `Show ${sortedGaps.length - 5} more`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
