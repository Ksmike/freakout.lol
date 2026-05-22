import Link from "next/link";
import {
  FiArrowRight,
  FiCheck,
  FiInbox,
  FiGitMerge,
  FiZap,
} from "react-icons/fi";
import type { IconType } from "react-icons";
import { getLabelsForLocale } from "@/labels";

const WORKFLOW_ICONS: IconType[] = [FiInbox, FiGitMerge, FiZap];

const TAXONOMY_STYLES: Record<
  string,
  { bg: string; text: string; dot: string }
> = {
  "Control Evidence": {
    bg: "bg-primary/10",
    text: "text-primary",
    dot: "bg-primary",
  },
  "Requirement Gap": {
    bg: "bg-warning/10",
    text: "text-warning",
    dot: "bg-warning",
  },
  "Source Conflict": {
    bg: "bg-danger/10",
    text: "text-danger",
    dot: "bg-danger",
  },
  "Unverified Claim": {
    bg: "bg-secondary/10",
    text: "text-secondary",
    dot: "bg-secondary",
  },
  "Reviewer Action": {
    bg: "bg-content2",
    text: "text-foreground/70",
    dot: "bg-foreground/30",
  },
  "Ready for Export": {
    bg: "bg-success/10",
    text: "text-success",
    dot: "bg-success",
  },
};

export default function HomePage() {
  const { labels } = getLabelsForLocale("en");
  const m = labels.marketing;

  return (
    <div className="w-full">
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0f0e0d]">
        {/* Coral radial glow */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-primary/20 blur-[160px]" />
        </div>
        {/* Dot-grid texture */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden
        />

        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pb-32 sm:pt-24">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 backdrop-blur-sm sm:mb-8 sm:px-4">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            {m.hero.badge}
          </div>

          {/* H1 */}
          <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-white sm:text-5xl sm:leading-[1.1] lg:text-[4.5rem]">
            <span className="bg-gradient-to-r from-[#f0917a] via-[#e8755a] to-[#d4503a] bg-clip-text text-transparent">
              {m.hero.title}
            </span>
          </h1>

          {/* Sub-copy */}
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-white/50 sm:mt-8 sm:text-base lg:text-lg">
            {m.hero.description}
          </p>

          {/* Segment pills */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:mt-8">
            {m.hero.segmentLabels.map((label) => (
              <span
                key={label}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/45 sm:px-3 sm:text-xs"
              >
                {label}
              </span>
            ))}
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-col items-center gap-3 sm:mt-10 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              href="/register"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition-opacity hover:opacity-90 sm:w-auto"
            >
              {m.hero.trialCta}
              <FiArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="w-full rounded-md border border-white/15 bg-white/5 px-6 py-3 text-center text-sm font-semibold text-white/70 backdrop-blur-sm transition-colors hover:bg-white/10 sm:w-auto"
            >
              {m.hero.demoCta}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Metrics strip ─────────────────────────────────────────── */}
      <section className="border-y border-white/5 bg-[#0f0e0d]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-10">
            {m.metrics.map((metric, i) => (
              <div
                key={metric.label}
                className={`text-center ${i > 0 ? "border-t border-white/8 pt-8 sm:border-l sm:border-t-0 sm:pt-0" : ""}`}
              >
                <p className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  {metric.value}
                </p>
                <p className="mt-2 text-sm text-white/40">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gradient seam */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      {/* ── Workflow ──────────────────────────────────────────────── */}
      <section id="workflow" className="bg-content1 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 sm:mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              The process
            </p>
            <h2 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl">
              {m.workflow.heading}
            </h2>
          </div>

          <div className="grid gap-0 md:grid-cols-3 md:gap-8">
            {m.workflow.steps.map((step, i) => {
              const Icon = WORKFLOW_ICONS[i];
              return (
                <article
                  key={step.title}
                  className="group relative border-t border-divider py-8 md:border-l md:border-t-0 md:pl-8 md:pt-0 first:border-t-0 md:first:border-l-0 md:first:pl-0"
                >
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 transition-colors group-hover:bg-primary/15">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-2xl font-bold text-foreground/10">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/55">
                    {step.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Coverage ──────────────────────────────────────────────── */}
      <section id="coverage" className="bg-background py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-10 md:grid-cols-2 md:items-start md:gap-16">
            {/* Left: feature list */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                Intelligence
              </p>
              <h2 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl">
                {m.coverage.heading}
              </h2>
              <p className="mt-4 text-foreground/60">{m.coverage.description}</p>
              <ul className="mt-8 space-y-3.5">
                {m.coverage.items.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <FiCheck className="h-3 w-3 text-primary" />
                    </span>
                    <span className="text-sm leading-relaxed text-foreground/75">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: dark outcome card */}
            <aside className="overflow-hidden rounded-2xl bg-[#0f0e0d] shadow-2xl">
              <div className="border-b border-white/5 px-7 py-5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <h3 className="text-sm font-semibold text-white">
                    {m.coverage.outcomesTitle}
                  </h3>
                </div>
              </div>
              <div className="space-y-4 p-7">
                {m.coverage.outcomesParagraphs.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-sm leading-relaxed text-white/50"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ── Taxonomy ──────────────────────────────────────────────── */}
      <section className="border-t border-divider bg-content1 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Classification
          </p>
          <h2 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl">
            {m.taxonomy.heading}
          </h2>
          <p className="mt-4 max-w-2xl text-sm text-foreground/60 sm:text-base">
            {m.taxonomy.description}
          </p>
          <div className="mt-8 flex flex-wrap gap-2 sm:mt-10 sm:gap-3">
            {m.taxonomy.items.map((label) => {
              const s = TAXONOMY_STYLES[label] ?? {
                bg: "bg-content2",
                text: "text-foreground/60",
                dot: "bg-foreground/25",
              };
              return (
                <span
                  key={label}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${s.bg} ${s.text}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0f0e0d] py-16 text-center sm:py-28">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px]" />
        </div>
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-2xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-white sm:text-4xl lg:text-5xl">
            {m.cta.heading}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm text-white/50 sm:mt-5 sm:text-base">
            {m.cta.description}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:mt-10 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              href="/register"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/30 transition-opacity hover:opacity-90 sm:w-auto"
            >
              {m.cta.createWorkspaceCta}
              <FiArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="mailto:hello@ddqualify.com"
              className="w-full rounded-md border border-white/15 bg-white/5 px-7 py-3.5 text-center text-sm font-semibold text-white/70 backdrop-blur-sm transition-colors hover:bg-white/10 sm:w-auto"
            >
              {m.cta.contactSalesCta}
            </a>
          </div>
          <p className="mt-8 text-xs text-white/25 sm:mt-10">{m.cta.footnote}</p>
        </div>
      </section>
    </div>
  );
}
