"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useNextShellTheme } from "@/components/next-dashboard/nextShellTheme";

export type CalendarArchiveOption = { value: string; label: string };

type NextCalendarArchiveDropdownProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: CalendarArchiveOption[];
  /** e.g. "Archive" */
  label?: string;
  className?: string;
  "aria-label"?: string;
  onOpenChange?: (open: boolean) => void;
};

export function NextCalendarArchiveDropdown({
  value,
  onValueChange,
  options,
  label = "Archive",
  className,
  "aria-label": ariaLabel,
  onOpenChange,
}: NextCalendarArchiveDropdownProps) {
  const { colors: C } = useNextShellTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const currentLabel = useMemo(() => options.find((o) => o.value === value)?.label ?? value, [options, value]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: C.muted }}>
        {label}
      </span>
      <div ref={rootRef} className={`relative min-w-[200px] ${className ?? ""}`}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded border px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] transition-opacity hover:opacity-90"
          style={{
            borderColor: open ? C.orange : C.borderSoft,
            color: C.text,
            background: C.panel,
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02)",
          }}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
        >
          <span className="truncate">{currentLabel}</span>
          <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} style={{ color: C.muted }} />
        </button>
        {open ? (
          <div
            className="absolute left-0 right-0 z-50 mt-1 max-h-[280px] overflow-auto rounded border py-1"
            style={{
              borderColor: C.borderSoft,
              background: C.panel,
              boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
            }}
            role="listbox"
          >
            {options.map((entry) => {
              const active = value === entry.value;
              return (
                <button
                  key={entry.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onValueChange(entry.value);
                    setOpen(false);
                  }}
                  className="flex w-full items-center px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors"
                  style={{
                    color: active ? C.yellow : C.soft,
                    background: active ? C.panelSoft : "transparent",
                    borderLeft: active ? `3px solid ${C.orange}` : "3px solid transparent",
                  }}
                >
                  {entry.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
