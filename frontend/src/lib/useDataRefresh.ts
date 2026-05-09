"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { refreshAllData, getRefreshProgress } from "@/lib/api";
import type { TaskProgress } from "@/types";

const REFRESH_POLL_MS = 1500;

/**
 * Starts backend refresh (returns immediately) and polls `getRefreshProgress` until `done`.
 * On completion without fatal error, invalidates React Query caches.
 */
export function useDataRefresh() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<"ok" | "error" | null>(null);
  const [progress, setProgress] = useState<TaskProgress | null>(null);
  const completionHandledRef = useRef(false);

  useEffect(() => {
    if (!refreshing) return;
    completionHandledRef.current = false;

    const tick = async () => {
      if (completionHandledRef.current) return;
      try {
        const p = await getRefreshProgress();
        setProgress(p);
        if (!p.done) return;
        completionHandledRef.current = true;
        const success = !p.error;
        setRefreshResult(success ? "ok" : "error");
        if (success) void queryClient.invalidateQueries();
        setRefreshing(false);
        setTimeout(() => setRefreshResult(null), 4000);
      } catch {
        /* ignore transient poll errors */
      }
    };

    void tick();
    const t = setInterval(tick, REFRESH_POLL_MS);
    return () => clearInterval(t);
  }, [refreshing, queryClient]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshResult(null);
    setProgress(null);
    completionHandledRef.current = false;
    try {
      await refreshAllData();
    } catch {
      completionHandledRef.current = true;
      setRefreshResult("error");
      setRefreshing(false);
      setTimeout(() => setRefreshResult(null), 4000);
    }
  }, [refreshing]);

  return { refreshing, refreshResult, progress, handleRefresh };
}
