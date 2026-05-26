"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { FiChevronLeft } from "react-icons/fi";
import { LuShield } from "react-icons/lu";
import { navItems } from "@/components/Sidebar";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { getProjectForSidebar } from "@/lib/actions/sidebar";

type ProjectSubNavItem = {
  label: string;
  suffix: string;
};

function buildProjectSubNav(input: {
  hasInsights: boolean;
  hasReports: boolean;
  hasEnquiries: boolean;
}): ProjectSubNavItem[] {
  return [
    { label: "General", suffix: "" },
    ...(input.hasInsights ? [{ label: "Insights", suffix: "/insights" }] : []),
    ...(input.hasReports ? [{ label: "Reports", suffix: "/report" }] : []),
    ...(input.hasEnquiries ? [{ label: "Enquiries", suffix: "/enquiries" }] : []),
  ];
}

export function MobileSidebar({
  showAdmin = false,
  adminLabel = "Admin",
}: {
  showAdmin?: boolean;
  adminLabel?: string;
}) {
  const [openPathname, setOpenPathname] = useState<string | null>(null);
  const [highlightSettings, setHighlightSettings] = useState(false);
  const pathname = usePathname();
  const isOpen = openPathname === pathname;
  const projectMatch = pathname.match(/^\/project\/([^/]+)/);
  const projectId = projectMatch?.[1] ?? null;
  const [projectSidebarData, setProjectSidebarData] = useState<{
    id: string;
    name: string;
    hasInsights: boolean;
    hasReports: boolean;
    hasEnquiries: boolean;
  } | null>(null);

  const refreshSidebarData = useCallback(() => {
    if (!projectId) return;
    getProjectForSidebar(projectId).then((project) => {
      setProjectSidebarData(project);
    });
  }, [projectId]);

  useEffect(() => {
    if (!isOpen) return;

    // Save current vertical scroll position and lock the page in place.
    // Keep horizontal origin at 0 to avoid iOS Safari viewport drift.
    const scrollY = window.scrollY;
    const { body, documentElement } = document;

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    documentElement.style.overflowX = "hidden";

    return () => {
      body.style.position = "";
      body.style.top = "";
      body.style.width = "";
      body.style.overflow = "";
      documentElement.style.overflow = "";
      documentElement.style.overflowX = "";
      // Restore scroll position after unlocking
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  // Fetch on projectId change
  useEffect(() => {
    if (projectId) refreshSidebarData();
  }, [projectId, refreshSidebarData]);

  // Listen for explicit sidebar refresh events
  useEffect(() => {
    function handleRefresh() {
      refreshSidebarData();
    }

    window.addEventListener("ddq:sidebar-refresh", handleRefresh);
    return () => {
      window.removeEventListener("ddq:sidebar-refresh", handleRefresh);
    };
  }, [refreshSidebarData]);

  // Re-fetch when the page becomes visible again
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && projectId) {
        refreshSidebarData();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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

  const activeProjectSidebarData = projectId ? projectSidebarData : null;
  const projectSubNav = buildProjectSubNav({
    hasInsights: activeProjectSidebarData?.hasInsights ?? false,
    hasReports: activeProjectSidebarData?.hasReports ?? false,
    hasEnquiries: activeProjectSidebarData?.hasEnquiries ?? false,
  });

  function openMenu() {
    setOpenPathname(pathname);
  }

  function closeMenu() {
    setOpenPathname(null);
  }

  return (
    <>
      {/* Hamburger */}
      <motion.button
        onClick={openMenu}
        animate={
          highlightSettings
            ? { x: [0, -4, 4, -2, 2, 0], scale: [1, 1.06, 1] }
            : { x: 0, scale: 1 }
        }
        transition={{ duration: 0.5, ease: "easeInOut" }}
        className="flex items-center justify-center rounded-md p-2 text-foreground/70 transition-colors hover:bg-content2 hover:text-foreground"
        aria-label="Open menu"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M3 5h14M3 10h14M3 15h14" />
        </svg>
      </motion.button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 touch-none"
          onClick={closeMenu}
          onTouchMove={(e) => e.preventDefault()}
          aria-hidden="true"
        />
      )}

      {/* Slide-out panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-[70] flex w-64 flex-col bg-background shadow-xl transition-transform duration-200 ease-in-out overscroll-contain ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        role={isOpen ? "dialog" : undefined}
        aria-modal={isOpen ? true : undefined}
      >
        <div className="flex items-center justify-between border-b border-divider px-4 py-4">
          <span className="text-base font-semibold text-foreground">.lol</span>
          <button
            onClick={closeMenu}
            className="rounded-md p-1.5 text-foreground/60 transition-colors hover:bg-content2 hover:text-foreground"
            aria-label="Close menu"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 p-4">
          {projectId ? (
            <>
              <Link
                href="/dashboard"
                onClick={closeMenu}
                className="mb-3 flex items-center gap-1 text-xs font-medium text-foreground/40 transition-colors hover:text-foreground/70"
              >
                <FiChevronLeft className="h-3.5 w-3.5" />
                Projects
              </Link>

              <p
                className="mb-1 truncate px-3 text-xs font-semibold uppercase tracking-wider text-foreground/40"
                title={activeProjectSidebarData?.name ?? undefined}
              >
                {activeProjectSidebarData?.name ?? <span className="opacity-60">Loading…</span>}
              </p>

              {projectSubNav.map(({ label, suffix }) => {
                const href = `/project/${projectId}${suffix}`;
                const isActive =
                  suffix === ""
                    ? pathname === `/project/${projectId}`
                    : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={closeMenu}
                    className={`ml-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-content2 text-foreground"
                        : "text-foreground/70 hover:bg-content2 hover:text-foreground"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}

              <div className="my-2 border-t border-divider" />

              <motion.div
                animate={
                  highlightSettings
                    ? {
                        x: [0, -4, 4, -2, 2, 0],
                        scale: [1, 1.02, 1],
                      }
                    : { x: 0, scale: 1 }
                }
                transition={{ duration: 0.52, ease: "easeInOut" }}
                className={highlightSettings ? "rounded-md ring-2 ring-warning/45" : ""}
              >
                <Link
                  href="/settings/account"
                  onClick={closeMenu}
                  className={`rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    isSettingsPath(pathname)
                      ? "bg-content2 text-foreground"
                      : "text-foreground/70 hover:bg-content2 hover:text-foreground"
                  }`}
                >
                  Settings
                </Link>
              </motion.div>

              {showAdmin && (
                <Link
                  href="/admin"
                  onClick={closeMenu}
                  className={`flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    pathname === "/admin" || pathname.startsWith("/admin/")
                      ? "bg-content2 text-foreground"
                      : "text-foreground/70 hover:bg-content2 hover:text-foreground"
                  }`}
                >
                  <LuShield className="size-4" aria-hidden="true" />
                  {adminLabel}
                </Link>
              )}
            </>
          ) : (
            <>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className={`rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActiveNavPath(pathname, item.href)
                      ? "bg-content2 text-foreground"
                      : "text-foreground/80 hover:bg-content2 hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              {showAdmin && (
                <>
                  <div className="my-2 border-t border-divider" />
                  <Link
                    href="/admin"
                    onClick={closeMenu}
                    className={`flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                      pathname === "/admin" || pathname.startsWith("/admin/")
                        ? "bg-content2 text-foreground"
                        : "text-foreground/80 hover:bg-content2 hover:text-foreground"
                    }`}
                  >
                    <LuShield className="size-4" aria-hidden="true" />
                    {adminLabel}
                  </Link>
                </>
              )}
            </>
          )}
        </nav>

        <div className="flex items-center justify-between border-t border-divider p-4">
          <LogoutButton />
          <ThemeSwitcher />
        </div>
      </aside>
    </>
  );
}

function isActiveNavPath(pathname: string, href: string): boolean {
  if (href.startsWith("/settings")) return isSettingsPath(pathname);

  return pathname === href;
}

function isSettingsPath(pathname: string): boolean {
  return pathname === "/settings" || pathname.startsWith("/settings/");
}
