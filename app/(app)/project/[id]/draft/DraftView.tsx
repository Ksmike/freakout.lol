"use client";

import { useState } from "react";
import Link from "next/link";
import {
  LuArrowLeft,
  LuCircleCheck,
  LuCircle,
  LuMinus,
  LuTriangleAlert,
  LuChevronDown,
  LuChevronRight,
  LuFileText,
  LuUsers,
  LuCpu,
  LuTrendingUp,
  LuTarget,
  LuBriefcase,
  LuSearch,
  LuClipboardList,
  LuFileQuestion,
} from "react-icons/lu";
import type { DraftReport, DraftSection } from "@/lib/diligence/draft-renderer";
import type { AppLabels } from "@/labels/types";

type DraftLabels = AppLabels["app"]["draft"];

type Props = {
  projectId: string;
  projectName: string;
  draft: DraftReport | null;
  labels: DraftLabels;
};

// ─── Section icon map ─────────────────────────────────────────────────────────

const NODE_ICONS: Record<string, typeof LuFileText> = {
  "identity-ownership": LuUsers,
  "product-technology": LuCpu,
  "market-traction": LuTrendingUp,
  "execution-capability": LuTarget,
  "business-model-viability": LuBriefcase,
  "risk-analysis": LuTriangleAlert,
  "evidence-quality": LuSearch,
  "failure-modes": LuTriangleAlert,
};

function getSectionIcon(nodeSlug: string | null): typeof LuFileText {
  if (!nodeSlug) return LuClipboardList;
  return NODE_ICONS[nodeSlug] ?? LuFileText;
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null) return null;
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 70 ? "bg-success/10 text-success" :
    pct >= 40 ? "bg-warning/10 text-warning" :
    "bg-danger/10 text-danger";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {pct}% confidence
    </span>
  );
}

// ─── Requirements progress ────────────────────────────────────────────────────

function RequirementsProgress({ satisfied, total }: { satisfied: number; total: number }) {
  if (total === 0) return null;
  const pct = Math.round((satisfied / total) * 100);
  const color = pct >= 80 ? "bg-success" : pct >= 40 ? "bg-warning" : "bg-danger";
  return (
    <div className="flex items-center gap-2 text-xs text-foreground/50">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-content2">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span>{satisfied}/{total} requirements</span>
    </div>
  );
}

// ─── Priority badge ───────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    blocker: "bg-danger text-white",
    high: "bg-danger/10 text-danger",
    medium: "bg-warning/10 text-warning",
    low: "bg-default/10 text-foreground/50",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[priority] ?? map.medium}`}>
      {priority}
    </span>
  );
}

// ─── Claim status icon ────────────────────────────────────────────────────────

function ClaimStatusIcon({ status }: { status: string }) {
  if (status === "SUPPORTED") return <LuCircleCheck className="size-3.5 shrink-0 text-success" aria-hidden="true" />;
  if (status === "CONTRADICTED") return <LuTriangleAlert className="size-3.5 shrink-0 text-danger" aria-hidden="true" />;
  return <LuMinus className="size-3.5 shrink-0 text-foreground/40" aria-hidden="true" />;
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({ section }: { section: DraftSection }) {
  const [expanded, setExpanded] = useState(true);
  const Icon = getSectionIcon(section.nodeSlug);
  const hasContent = section.summary || section.findings.length > 0 || section.claims.length > 0;

  return (
    <article className="rounded-xl border border-divider bg-content1 overflow-hidden">
      {/* Section header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-content2/30"
        aria-expanded={expanded}
      >
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-content2">
          <Icon className="size-4 text-foreground/60" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
            <ConfidenceBadge confidence={section.confidence} />
          </div>
          <div className="mt-1">
            <RequirementsProgress
              satisfied={section.requirementsSatisfied}
              total={section.requirementsTotal}
            />
          </div>
        </div>
        {expanded ? (
          <LuChevronDown className="mt-1 size-4 shrink-0 text-foreground/40" aria-hidden="true" />
        ) : (
          <LuChevronRight className="mt-1 size-4 shrink-0 text-foreground/40" aria-hidden="true" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-divider/50 px-4 pb-5 pt-4 space-y-4">
          {/* Summary */}
          {section.summary ? (
            <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">
              {section.summary}
            </p>
          ) : (
            <p className="text-sm text-foreground/40 italic">
              No summary available — diligence may not have completed for this section.
            </p>
          )}

          {/* Key claims */}
          {section.claims.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/40">
                Key claims
              </p>
              <ul className="space-y-1.5">
                {section.claims.map((claim) => (
                  <li key={claim.id} className="flex items-start gap-2 text-sm text-foreground/75">
                    <ClaimStatusIcon status={claim.status} />
                    <span className="leading-snug">{claim.claimText}</span>
                    {claim.confidence !== null && (
                      <span className="ml-auto shrink-0 text-xs text-foreground/40">
                        {Math.round(claim.confidence * 100)}%
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Findings */}
          {section.findings.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/40">
                Findings
              </p>
              <ul className="space-y-2">
                {section.findings.map((finding) => (
                  <li key={finding.id} className="rounded-lg border border-divider bg-content2/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{finding.title}</p>
                      {finding.severity && (
                        <PriorityBadge priority={finding.severity} />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-foreground/60 leading-snug">
                      {finding.summary}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Evidence gaps */}
          {section.gaps.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/40">
                Evidence gaps
              </p>
              <ul className="space-y-1.5">
                {section.gaps.map((gap, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <LuCircle className="mt-0.5 size-3.5 shrink-0 text-foreground/30" aria-hidden="true" />
                    <div>
                      <span className="font-medium text-foreground/70">{gap.title}</span>
                      {gap.description && (
                        <span className="text-foreground/50"> — {gap.description}</span>
                      )}
                    </div>
                    <PriorityBadge priority={gap.severity} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* No content at all */}
          {!hasContent && section.gaps.length === 0 && (
            <p className="text-sm text-foreground/40 italic">
              No evidence gathered for this section yet.
            </p>
          )}
        </div>
      )}
    </article>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function DraftView({ projectId, projectName, draft, labels }: Props) {
  if (!draft) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Link
          href={`/project/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-foreground/60 transition-colors hover:text-foreground"
        >
          <LuArrowLeft className="size-4" aria-hidden="true" />
          Back to project
        </Link>
        <div className="rounded-xl border border-divider bg-content1 p-6 text-center">
          <LuFileText className="mx-auto size-10 text-foreground/20" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-foreground">{labels.noDataHeading}</p>
          <p className="mt-1 text-sm text-foreground/60">{labels.noDataDescription}</p>
        </div>
      </div>
    );
  }

  const totalSections = draft.sections.filter((s) => s.nodeSlug !== null).length;
  const sectionsWithContent = draft.sections.filter(
    (s) => s.nodeSlug !== null && s.summary !== null
  ).length;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Back link */}
      <Link
        href={`/project/${projectId}`}
        className="inline-flex items-center gap-1.5 text-sm text-foreground/60 transition-colors hover:text-foreground"
      >
        <LuArrowLeft className="size-4" aria-hidden="true" />
        Back to project
      </Link>

      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">{draft.templateName}</h1>
        <p className="text-sm text-foreground/60">
          {projectName}
          {draft.completedAt && (
            <> — completed {new Date(draft.completedAt).toLocaleDateString()}</>
          )}
        </p>
      </header>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 rounded-xl border border-divider bg-content1 p-4">
        <div className="text-center">
          <p className="text-2xl font-semibold text-foreground">{sectionsWithContent}/{totalSections}</p>
          <p className="mt-0.5 text-xs text-foreground/50">{labels.sectionsLabel}</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-semibold text-foreground">
            {draft.overallConfidence !== null
              ? `${Math.round(draft.overallConfidence * 100)}%`
              : "—"}
          </p>
          <p className="mt-0.5 text-xs text-foreground/50">{labels.confidenceLabel}</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-semibold text-foreground">{draft.openQuestions.length}</p>
          <p className="mt-0.5 text-xs text-foreground/50">{labels.openQuestionsLabel}</p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {draft.sections.map((section) => (
          <SectionCard key={section.id} section={section} />
        ))}
      </div>

      {/* Open questions */}
      {draft.openQuestions.length > 0 && (
        <section className="rounded-xl border border-divider bg-content1 overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-divider px-4 py-3">
            <LuFileQuestion className="size-4 text-warning" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground">{labels.openQuestionsHeading}</h2>
            <span className="ml-auto rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
              {draft.openQuestions.length}
            </span>
          </div>
          <ul className="divide-y divide-divider/50">
            {draft.openQuestions.map((q, i) => (
              <li key={i} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{q.question}</p>
                  <PriorityBadge priority={q.priority} />
                </div>
                {q.rationale && (
                  <p className="mt-1 text-xs text-foreground/55 leading-snug">{q.rationale}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
