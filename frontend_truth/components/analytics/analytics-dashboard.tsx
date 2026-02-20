"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export type DashboardData = {
  games: {
    total: number;
    byStatus: Record<string, number>;
    createdToday: number;
    finishedToday: number;
    createdThisWeek: number;
  };
  events: Record<string, number>;
  generatedAt: string;
};

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-[#00F0FF]/30 bg-[#0A1A1B]/80 p-5 backdrop-blur-sm">
      <p className="text-sm font-medium uppercase tracking-wider text-[#00F0FF]/80">
        {title}
      </p>
      <p className="mt-2 text-3xl font-bold text-[#F0F7F7]">{value}</p>
      {sub && <p className="mt-1 text-xs text-[#B0BFC0]">{sub}</p>}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["analytics-dashboard"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: DashboardData }>("analytics/dashboard");
      if (!res.success || !res.data) throw new Error("Failed to load dashboard");
      const payload = (res.data as { data?: DashboardData })?.data ?? res.data;
      return payload as DashboardData;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="font-orbitron text-3xl font-bold text-[#00F0FF]">
          Analytics Dashboard
        </h1>
        <p className="mt-4 text-[#B0BFC0]">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="font-orbitron text-3xl font-bold text-[#00F0FF]">
          Analytics Dashboard
        </h1>
        <p className="mt-4 text-red-400">
          Failed to load: {error instanceof Error ? error.message : "Unknown error"}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 rounded-lg bg-[#00F0FF]/20 px-4 py-2 font-medium text-[#00F0FF] hover:bg-[#00F0FF]/30"
        >
          Retry
        </button>
      </div>
    );
  }

  const d = data!;
  const statusEntries = Object.entries(d.games.byStatus).filter(
    ([status]) => status !== "PENDING" && status !== "FINISHED"
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-orbitron text-3xl font-bold text-[#00F0FF]">
          Analytics Dashboard
        </h1>
        <p className="text-xs text-[#B0BFC0]">
          Updated: {new Date(d.generatedAt).toLocaleString()}
        </p>
      </div>

      <section className="mt-8">
        <h2 className="mb-4 font-orbitron text-lg font-semibold text-[#F0F7F7]">
          Games
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total games" value={d.games.total} />
          <StatCard
            title="Created today"
            value={d.games.createdToday}
            sub="last 24h"
          />
          <StatCard
            title="Finished today"
            value={d.games.finishedToday}
            sub="last 24h"
          />
          <StatCard
            title="Created this week"
            value={d.games.createdThisWeek}
            sub="last 7 days"
          />
        </div>
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-[#00F0FF]/80">
            By status
          </p>
          <div className="flex flex-wrap gap-2">
            {statusEntries.map(([status, count]) => (
              <span
                key={status}
                className="rounded-lg bg-[#0E1415] px-3 py-1.5 text-sm text-[#F0F7F7]"
              >
                {status}: {count}
              </span>
            ))}
            {statusEntries.length === 0 && (
              <span className="text-sm text-[#B0BFC0]">No data</span>
            )}
          </div>
        </div>
      </section>

      {Object.keys(d.events).length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 font-orbitron text-lg font-semibold text-[#F0F7F7]">
            Recorded events
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(d.events).map(([eventType, count]) => (
              <span
                key={eventType}
                className="rounded-lg border border-[#00F0FF]/30 bg-[#0A1A1B]/80 px-3 py-1.5 text-sm text-[#F0F7F7]"
              >
                {eventType}: {count}
              </span>
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-xs text-[#B0BFC0]">
        Use this dashboard to monitor usage and react to user feedback. Add
        admin auth in production.
      </p>
    </div>
  );
}
