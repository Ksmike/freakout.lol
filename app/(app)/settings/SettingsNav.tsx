"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LuBuilding2,
  LuCreditCard,
  LuKey,
  LuNetwork,
} from "react-icons/lu";
import type { AppLabels } from "@/labels/types";

type SettingsLabels = AppLabels["app"]["settings"];

const settingsNavItems = [
  { href: "/settings/account", labelKey: "accountNavLabel", icon: LuBuilding2 },
  {
    href: "/settings/billing",
    labelKey: "billingNavLabel",
    icon: LuCreditCard,
    requiresStripe: true,
  },
  { href: "/settings/api-keys", labelKey: "apiKeysNavLabel", icon: LuKey },
  { href: "/settings/workflows", labelKey: "workflowsNavLabel", icon: LuNetwork },
] as const;

export function SettingsNav({
  labels,
  showBilling,
}: {
  labels: SettingsLabels;
  showBilling: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside className="shrink-0 border-divider md:w-56 md:border-r md:pr-4">
      <nav className="flex gap-1 overflow-x-auto pb-3 md:flex-col md:overflow-visible md:pb-0">
        {settingsNavItems
          .filter((item) => !("requiresStripe" in item) || showBilling)
          .map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-content2 text-foreground"
                    : "text-foreground/70 hover:bg-content2 hover:text-foreground"
                }`}
              >
                <Icon className="size-4" aria-hidden="true" />
                {labels[item.labelKey]}
              </Link>
            );
          })}
      </nav>
    </aside>
  );
}
