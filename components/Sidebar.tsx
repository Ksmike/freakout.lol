"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiChevronLeft } from "react-icons/fi";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { FirmSwitcher } from "@/components/FirmSwitcher";
import { getProjectForSidebar, getRecentProjects, type RecentProject } from "@/lib/actions/sidebar";
import type { UserFirmSummary } from "@/lib/actions/firm";

export const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Settings", href: "/settings" },
];

type ProjectSubNavItem = {
  label: string;
  suffix: string;
};

function buildProjectSubNav(input: {
  hasInsights: boolean;
  hasReports: boolean;
  hasEnquiries: boolean;
  hasDraft: boolean;
}): ProjectSubNavItem[] {
  return [
    { label: "General", suffix: "" },
    ...(input.hasDraft ? [{ label: "Draft", suffix: "/draft" }] : []),
    ...(input.hasInsights ? [{ label: "Insights", suffix: "/insights" }] : []),
    ...(input.hasReports ? [{ label: "Reports", suffix: "/report" }] : []),
    ...(input.hasEnquiries ? [{ label: "Enquiries", suffix: "/enquiries" }] : []),
  ];
}

export function Sidebar({ firms = [] }: { firms?: UserFirmSummary[] }) {
  const pathname = usePathname();
  const projectMatch = pathname.match(/^\/project\/([^/]+)/);
  const projectId = projectMatch?.[1] ?? null;
  const [highlightSettings, setHighlightSettings] = useState(false);
  const [projectSidebarData, setProjectSidebarData] = useState<{
    id: string;
    name: string;
    hasInsights: boolean;
    hasReports: boolean;
    hasEnquiries: boolean;
    hasDraft: boolean;
  } | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshSidebarData = useCallback(() => {
    if (!projectId) return;
    getProjectForSidebar(projectId).then((project) => {
      setProjectSidebarData(project);
    });
  }, [projectId]);

  // Fetch recent projects for the default nav
  useEffect(() => {
    if (projectId) return;
    getRecentProjects().then(setRecentProjects);
  }, [projectId]);

  // Fetch on projectId change
  useEffect(() => {
    if (projectId) refreshSidebarData();
  }, [projectId, refreshSidebarData]);

  // Listen for explicit sidebar refresh events (dispatched when project state changes)
  useEffect(() => {
    function handleRefresh() {
      refreshSidebarData();
    }

    window.addEventListener("ddq:sidebar-refresh", handleRefresh);
    return () => {
      window.removeEventListener("ddq:sidebar-refresh", handleRefresh);
    };
  }, [refreshSidebarData]);

  // Re-fetch when the page becomes visible again (e.g., user switches back to tab)
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && projectId) {
        refreshSidebarData();
      }
    }

    function handleFocus() {
      if (projectId) {
        refreshSidebarData();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [projectId, refreshSidebarData]);

  // Poll for updates while on a project page (every 15s) to catch async state changes
  useEffect(() => {
    if (!projectId) {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      return;
    }

    refreshTimerRef.current = setInterval(() => {
      refreshSidebarData();
    }, 15_000);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [projectId, refreshSidebarData]);

  useEffect(() => {
    function handleHighlightSettings() {
      setHighlightSettings(true);
      window.setTimeout(() => setHighlightSettings(false), 2200);
    }

    window.addEventListener("ddq:highlight-settings-nav", handleHighlightSettings);
    return () => {
      window.removeEventListener("ddq:highlight-settings-nav", handleHighlightSettings);
    };
  }, []);

  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-divider bg-content1 p-4">
      <nav className="flex flex-1 flex-col">
        {projectId ? (
          <ProjectNav
            projectId={projectId}
            projectSidebarData={projectSidebarData}
            pathname={pathname}
            highlightSettings={highlightSettings}
          />
        ) : (
          <DefaultNav pathname={pathname} recentProjects={recentProjects} />
        )}
      </nav>
      <div className="space-y-1 border-t border-divider pt-3">
        {firms.length > 1 && <FirmSwitcher firms={firms} />}
        <div className="flex items-center justify-between">
          <LogoutButton />
          <ThemeSwitcher />
        </div>
      </div>
    </aside>
  );
}

function DefaultNav({ pathname, recentProjects }: { pathname: string; recentProjects: RecentProject[] }) {
  return (
    <div className="flex flex-col gap-1">
      <NavLink
        href="/dashboard"
        label="Dashboard"
        isActive={pathname === "/dashboard"}
      />
      {recentProjects.length > 0 && (
        <div className="flex flex-col gap-0.5 pb-1">
          {recentProjects.map((project) => {
            const href = `/project/${project.id}`;
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={project.id}
                href={href}
                className={`ml-3 truncate rounded-md px-3 py-1.5 text-xs transition-colors ${
                  isActive
                    ? "bg-content2 font-medium text-foreground"
                    : "text-foreground/55 hover:bg-content2 hover:text-foreground/80"
                }`}
                title={project.name}
              >
                {project.name}
              </Link>
            );
          })}
        </div>
      )}
      <NavLink
        href="/settings"
        label="Settings"
        isActive={pathname === "/settings"}
      />
    </div>
  );
}

function ProjectNav({
  projectId,
  projectSidebarData,
  pathname,
  highlightSettings,
}: {
  projectId: string;
  projectSidebarData: {
    id: string;
    name: string;
    hasInsights: boolean;
    hasReports: boolean;
    hasEnquiries: boolean;
    hasDraft: boolean;
  } | null;
  pathname: string;
  highlightSettings: boolean;
}) {
  const activeProjectSidebarData = projectId ? projectSidebarData : null;

  const projectSubNav = buildProjectSubNav({
    hasInsights: activeProjectSidebarData?.hasInsights ?? false,
    hasReports: activeProjectSidebarData?.hasReports ?? false,
    hasEnquiries: activeProjectSidebarData?.hasEnquiries ?? false,
    hasDraft: activeProjectSidebarData?.hasDraft ?? false,
  });

  return (
    <div className="flex flex-col gap-0.5">
      {/* Back to projects */}
      <Link
        href="/dashboard"
        className="mb-3 flex items-center gap-1 text-xs font-medium text-foreground/40 transition-colors hover:text-foreground/70"
      >
        <FiChevronLeft className="h-3.5 w-3.5" />
        Projects
      </Link>

      {/* Project name label */}
      <p
        className="mb-1 truncate px-3 text-xs font-semibold uppercase tracking-wider text-foreground/40"
        title={activeProjectSidebarData?.name ?? undefined}
      >
        {activeProjectSidebarData?.name ?? <span className="opacity-60">Loading…</span>}
      </p>

      {/* Sub-nav items */}
      {projectSubNav.map(({ label, suffix }) => {
        const href = `/project/${projectId}${suffix}`;
        const isActive =
          suffix === ""
            ? pathname === `/project/${projectId}`
            : pathname.startsWith(href);
        return (
          <NavLink key={href} href={href} label={label} isActive={isActive} indent />
        );
      })}

      <div className="my-3 border-t border-divider" />

      <motion.div
        animate={
          highlightSettings
            ? {
                x: [0, -5, 5, -3, 3, 0],
                scale: [1, 1.02, 1],
              }
            : { x: 0, scale: 1 }
        }
        transition={{ duration: 0.55, ease: "easeInOut" }}
        className={highlightSettings ? "rounded-md ring-2 ring-warning/45" : ""}
      >
        <NavLink
          href="/settings"
          label="Settings"
          isActive={pathname === "/settings"}
        />
      </motion.div>
    </div>
  );
}

function NavLink({
  href,
  label,
  isActive,
  indent,
}: {
  href: string;
  label: string;
  isActive: boolean;
  indent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${indent ? "ml-2" : ""} ${
        isActive
          ? "bg-content2 text-foreground"
          : "text-foreground/70 hover:bg-content2 hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}
