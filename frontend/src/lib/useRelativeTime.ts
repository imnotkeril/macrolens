"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

export function useRelativeTime(iso: string | undefined | null) {
  const [label, setLabel] = useState("—");

  useEffect(() => {
    if (!iso) {
      setLabel("—");
      return;
    }
    const tick = () => {
      try {
        setLabel(formatDistanceToNow(new Date(iso), { addSuffix: true }));
      } catch {
        setLabel("—");
      }
    };
    tick();
    const i = setInterval(tick, 60_000);
    return () => clearInterval(i);
  }, [iso]);

  return label;
}
