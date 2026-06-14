"use client";

import { useEffect, useState } from "react";
import {
  formatDistanceToNow,
  formatDuration,
  intervalToDuration,
} from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Download } from "lucide-react";

interface AnalyticsDashboardProps {
  documentId: string;
  filename: string;
}

interface AnalyticsData {
  document: { id: string; filename: string };
  summary: {
    totalViews: number;
    uniqueViewers: number;
    totalDuration: number;
    avgDuration: number;
  };
  chartData: Array<{ date: string; views: number }>;
  pageViewData: Array<{
    pageNumber: number;
    views: number;
    totalSeconds: number;
  }>;
  recentSessions: Array<{
    id: string;
    startedAt: string;
    durationSeconds: number;
    viewerEmail: string | null;
  }>;
}

export function AnalyticsDashboard({
  documentId,
  filename,
}: AnalyticsDashboardProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const res = await fetch(`/api/analytics/${documentId}`);
        if (!res.ok) throw new Error("Failed to load analytics");
        const result = await res.json();
        if (!cancelled) {
          setData(result);
          setLastUpdatedAt(new Date());
        }
      } catch {
        // Silent fail on auto-refresh; keep existing data.
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();
    const interval = setInterval(loadData, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [documentId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) return null;

  function formatSeconds(seconds: number): string {
    const duration = intervalToDuration({ start: 0, end: seconds * 1000 });
    return formatDuration(duration, { format: ["minutes", "seconds"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold">{filename}</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-600" />
              Live
            </span>
          </div>
          <p className="text-muted-foreground">
            Document analytics and viewer activity
            {lastUpdatedAt && (
              <span className="ml-2 text-xs">
                Updated {lastUpdatedAt.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href={`/api/analytics/${documentId}/export`} download>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </a>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="stat-total-views">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total views
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.summary.totalViews}</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-unique-viewers">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unique viewers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.summary.uniqueViewers}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-total-time">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatSeconds(data.summary.totalDuration)}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-avg-time">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatSeconds(data.summary.avgDuration)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Views over time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.chartData}>
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey="views"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Time per page</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead>Views</TableHead>
                <TableHead>Total time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.pageViewData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground"
                  >
                    No page-level data yet
                  </TableCell>
                </TableRow>
              ) : (
                data.pageViewData.map((pv) => (
                  <TableRow key={pv.pageNumber}>
                    <TableCell>Page {pv.pageNumber}</TableCell>
                    <TableCell>{pv.views}</TableCell>
                    <TableCell>{formatSeconds(pv.totalSeconds)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Viewer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentSessions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground"
                  >
                    No views yet
                  </TableCell>
                </TableRow>
              ) : (
                data.recentSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      {formatDistanceToNow(new Date(session.startedAt))} ago
                    </TableCell>
                    <TableCell>
                      {formatSeconds(session.durationSeconds)}
                    </TableCell>
                    <TableCell>{session.viewerEmail ?? "Anonymous"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
