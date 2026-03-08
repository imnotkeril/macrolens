"use client";

import { useQuery } from "@tanstack/react-query";
import type { Alert } from "@/types";
import { getAlerts, getAlertCount } from "@/lib/api";
import { cn, severityColor } from "@/lib/utils";
import { format } from "date-fns";

interface AlertPanelProps {
  variant?: "card" | "inline";
}

export function AlertPanel({ variant = "card" }: AlertPanelProps) {
  const { data: alerts } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => getAlerts(true),
  });

  const { data: count } = useQuery({
    queryKey: ["alert-count"],
    queryFn: getAlertCount,
  });

  const hasAlerts = alerts && alerts.length > 0;

  if (variant === "inline") {
    return (
      <div className="flex flex-shrink-0 items-center gap-3 animate-fade-in">
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Alerts</span>
        {count && count.unread > 0 ? (
          <>
            <span className="badge bg-accent-red/10 text-accent-red border-accent-red/20 text-[10px]">
              {count.unread}
            </span>
            <div className="flex flex-wrap items-center gap-2 max-w-[280px]">
              {alerts?.slice(0, 2).map((alert) => (
                <span key={alert.id} className="text-[11px] font-light text-text-secondary truncate" title={alert.title}>
                  {alert.title}
                </span>
              ))}
            </div>
          </>
        ) : (
          <span className="text-[11px] font-light text-text-muted">None</span>
        )}
      </div>
    );
  }

  return (
    <div className="card animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <span className="card-header mb-0">Alerts</span>
        {count && count.unread > 0 && (
          <span className="badge bg-accent-red/10 text-accent-red border-accent-red/20 text-[10px]">
            {count.unread} unread
          </span>
        )}
      </div>

      {!hasAlerts ? (
        <p className="text-sm font-light text-text-muted">No unread alerts</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {alerts.slice(0, 8).map((alert) => (
            <AlertItem key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}

function AlertItem({ alert }: { alert: Alert }) {
  return (
    <div className={cn("rounded-lg border p-3", severityColor(alert.severity))}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-xs font-medium">{alert.title}</h4>
        <span className="text-[10px] text-text-muted whitespace-nowrap">
          {format(new Date(alert.created_at), "MMM d, HH:mm")}
        </span>
      </div>
      <p className="mt-1 text-[11px] font-light opacity-80 line-clamp-2">{alert.message}</p>
    </div>
  );
}
