"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { refreshAllData, getRefreshProgress } from "@/lib/api";
import type { TaskProgress } from "@/types";

const REFRESH_POLL_MS = 1500;

export function useDataRefresh() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<"ok" | "error" | null>(null);
  const [progress, setProgress] = useState<TaskProgress | null>(null);
  const refreshDoneRef = useRef(false);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshResult(null);
    setProgress(null);
    refreshDoneRef.current = false;
    try {
      const result = await refreshAllData();
      refreshDoneRef.current = true;
      const success = result.errors.length === 0;
      setRefreshResult(success ? "ok" : "error");
      if (success) {
        void queryClient.invalidateQueries();
      }
    } catch {
      refreshDoneRef.current = true;
      setRefreshResult("error");
    } finally {
      setRefreshing(false);
      setTimeout(() => setRefreshResult(null), 4000);
    }
  }, [refreshing, queryClient]);

  useEffect(() => {
    if (!refreshing) return;
    const t = setInterval(async () => {
      if (refreshDoneRef.current) return;
      try {
        const p = await getRefreshProgress();
        setProgress(p);
        if (p.done) refreshDoneRef.current = true;
      } catch {
        /* ignore */
      }
    }, REFRESH_POLL_MS);
    return () => clearInterval(t);
  }, [refreshing]);

  return { refreshing, refreshResult, progress, handleRefresh };
}
