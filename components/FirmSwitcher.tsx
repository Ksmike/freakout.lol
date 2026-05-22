"use client";

import { useState, useTransition } from "react";
import { LuBuilding2, LuChevronDown, LuCircleCheck } from "react-icons/lu";
import { switchFirm } from "@/lib/actions/firm";
import type { UserFirmSummary } from "@/lib/actions/firm";

type Props = {
  firms: UserFirmSummary[];
};

export function FirmSwitcher({ firms }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const activeFirm = firms.find((f) => f.isActive) ?? firms[0];
  if (!activeFirm || firms.length <= 1) return null;

  function handleSwitch(firmId: string) {
    if (firmId === activeFirm?.id) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await switchFirm(firmId);
    });
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-content2 disabled:opacity-60"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <LuBuilding2 className="size-3.5 shrink-0 text-foreground/50" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-left font-medium text-foreground">
          {activeFirm.name}
        </span>
        <LuChevronDown
          className={`size-3.5 shrink-0 text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* Dropdown */}
          <ul
            role="listbox"
            aria-label="Switch firm"
            className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-divider bg-content1 shadow-lg"
          >
            {firms.map((firm) => (
              <li key={firm.id} role="option" aria-selected={firm.isActive}>
                <button
                  type="button"
                  onClick={() => handleSwitch(firm.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-content2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {firm.name}
                    </p>
                    <p className="text-xs text-foreground/50 capitalize">
                      {firm.role.toLowerCase()} · {firm.plan}
                    </p>
                  </div>
                  {firm.isActive && (
                    <LuCircleCheck
                      className="size-4 shrink-0 text-success"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
