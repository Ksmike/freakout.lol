import {
  LuCircleCheck,
  LuCircleHelp,
  LuCircleX,
  LuEye,
  LuLightbulb,
  LuLock,
  LuShieldCheck,
  LuSparkles,
  LuTriangleAlert,
} from "react-icons/lu";
import Link from "next/link";
import type { AppLabels } from "@/labels/types";
import type { RestrictedDiligenceInsights } from "@/lib/models/DiligenceJobModel";

type InsightsLabels = AppLabels["app"]["insights"];
type PaywallLabels = AppLabels["app"]["paywall"];

type Props = {
  projectName: string;
  labels: InsightsLabels;
  paywallLabels: PaywallLabels;
  data: RestrictedDiligenceInsights | null;
};

/**
 * Static sample findings used to populate the teaser view.
 * None of this is real user data — it's purely illustrative.
 */
const SAMPLE_FINDINGS = [
  {
    type: "RISK",
    title: "Key-Person Dependency in Technical Architecture",
    summary:
      "Core platform knowledge concentrated in a single engineer, creating bus-factor risk for the technical roadmap.",
    severity: "high",
  },
  {
    type: "RISK",
    title: "Data Sensitivity Concerns",
    summary:
      "Customer data handling practices may not align with enterprise compliance requirements in target markets.",
    severity: "high",
  },
  {
    type: "RISK",
    title: "Hiring Shortfalls",
    summary:
      "Engineering hiring targets missed in recent quarters, indicating potential challenges scaling the team.",
    severity: "medium",
  },
  {
    type: "OPPORTUNITY",
    title: "Untapped Enterprise Segment",
    summary:
      "Strong product-market fit signals in mid-market suggest upside potential in enterprise expansion.",
    severity: "medium",
  },
];

const SAMPLE_CLAIMS = [
  {
    claimText:
      "The addressable market for diligence software is estimated at $500M ARR.",
    status: "CONTRADICTED",
    confidence: 0.1,
  },
  {
    claimText: "The company's NRR exceeds 130% across all cohorts.",
    status: "CONTRADICTED",
    confidence: 0.1,
  },
  {
    claimText:
      "Major clients signed multi-year contracts in Q3, validating the enterprise motion.",
    status: "INCONCLUSIVE",
    confidence: 0.4,
  },
  {
    claimText:
      "Revenue grew 3x year-over-year driven by organic product-led growth.",
    status: "SUPPORTED",
    confidence: 0.85,
  },
];

const findingTypeIcons = {
  RISK: LuTriangleAlert,
  OPPORTUNITY: LuLightbulb,
  WARNING: LuTriangleAlert,
  OBSERVATION: LuEye,
};

const findingTypeColors: Record<string, string> = {
  RISK: "text-danger",
  OPPORTUNITY: "text-success",
  WARNING: "text-warning",
  OBSERVATION: "text-foreground/60",
};

const claimStatusIcons = {
  SUPPORTED: LuCircleCheck,
  CONTRADICTED: LuCircleX,
  INCONCLUSIVE: LuCircleHelp,
};

const claimStatusColors: Record<string, string> = {
  SUPPORTED: "text-success",
  CONTRADICTED: "text-danger",
  INCONCLUSIVE: "text-warning",
};

export function RestrictedInsightsView({
  projectName,
  labels,
  paywallLabels,
  data,
}: Props) {
  if (!data) {
    return (
      <div className="min-w-0 w-full space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">
          {labels.heading}
        </h1>
        <p className="text-foreground/60">{labels.empty}</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full space-y-8 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {labels.heading}
        </h1>
        <p className="mt-1 break-words text-sm text-foreground/60">
          {projectName} - {labels.description}
        </p>
      </div>

      {/* Blurred content with paywall overlay on top */}
      <div className="relative">
        {/* Blurred background content */}
        <div
          aria-hidden="true"
          className="pointer-events-none select-none space-y-8"
        >
          {/* Teaser findings */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <LuTriangleAlert className="size-5" aria-hidden="true" />
              {labels.findingsHeading}
              <span className="text-sm font-normal text-foreground/50">
                ({data.findings.length})
              </span>
            </h2>

            <div className="mt-3 blur-[6px]">
              <div className="grid gap-3 md:grid-cols-2">
                {SAMPLE_FINDINGS.map((finding, index) => {
                  const Icon =
                    findingTypeIcons[
                      finding.type as keyof typeof findingTypeIcons
                    ] ?? LuEye;
                  const color =
                    findingTypeColors[finding.type] ?? "text-foreground/60";

                  return (
                    <div
                      key={index}
                      className="rounded-lg border border-divider bg-content1 p-4"
                    >
                      <div className="flex items-center gap-2">
                        <Icon
                          className={`size-4 ${color}`}
                          aria-hidden="true"
                        />
                        <span
                          className={`text-xs font-medium uppercase ${color}`}
                        >
                          {finding.type}
                        </span>
                      </div>
                      <h3 className="mt-2 text-sm font-semibold text-foreground">
                        {finding.title}
                      </h3>
                      <p className="mt-1 text-sm text-foreground/70">
                        {finding.summary}
                      </p>
                      <p className="mt-3 border-t border-divider/50 pt-2 text-xs">
                        <span className="font-medium text-foreground/60">
                          {labels.severityLabel}:{" "}
                        </span>
                        <SeverityBadge severity={finding.severity} />
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Teaser claims */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <LuShieldCheck className="size-5" aria-hidden="true" />
              {labels.claimsHeading}
              <span className="text-sm font-normal text-foreground/50">
                ({data.claims.length})
              </span>
            </h2>

            <div className="mt-3 blur-[6px]">
              <div className="space-y-2">
                {SAMPLE_CLAIMS.map((claim, index) => {
                  const Icon =
                    claimStatusIcons[
                      claim.status as keyof typeof claimStatusIcons
                    ] ?? LuCircleHelp;
                  const color =
                    claimStatusColors[claim.status] ?? "text-foreground/60";

                  return (
                    <div
                      key={index}
                      className="flex items-start gap-3 rounded-lg border border-divider bg-content1 p-4"
                    >
                      <Icon
                        className={`mt-0.5 size-4 shrink-0 ${color}`}
                        aria-hidden="true"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-foreground">
                          {claim.claimText}
                        </p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-foreground/50">
                          <span className={color}>{claim.status}</span>
                          <span className="text-xs font-medium">
                            {Math.round(claim.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* Paywall overlay — positioned on top of blurred content, scrolls with it */}
        <div className="absolute inset-0 flex items-start justify-center pt-16">
          <div className="sticky top-24 z-10 mx-auto w-full max-w-md rounded-xl border border-divider bg-background/95 p-6 shadow-lg backdrop-blur-sm">
            <div className="flex flex-col items-center text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <LuLock className="size-6 text-primary" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-foreground">
                {paywallLabels.heading}
              </h2>
              <p className="mt-2 text-sm text-foreground/70">
                {paywallLabels.description}
              </p>
              <ul className="mt-4 space-y-2 text-left text-sm text-foreground/80">
                {paywallLabels.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <LuSparkles
                      className="mt-0.5 size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/settings/billing"
                className="mt-6 inline-flex rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                {paywallLabels.upgradeCta}
              </Link>
              <p className="mt-3 text-xs text-foreground/50">
                {paywallLabels.priceNote}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-danger/10 text-danger",
    high: "bg-danger/10 text-danger",
    medium: "bg-warning/10 text-warning",
    low: "bg-success/10 text-success",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[severity] ?? "bg-default/10 text-foreground/50"}`}
    >
      {severity}
    </span>
  );
}
