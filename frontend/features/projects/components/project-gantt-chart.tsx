"use client";

/**
 * FO-105 lightweight CSS/SVG Gantt chart.
 * Package decision: NO third-party Gantt library — React + Tailwind + SVG only.
 * Bars use planned dates; progress is an overlay; milestones are diamonds.
 * Drag-to-reschedule is intentionally unsupported (edit via task forms).
 */

import Link from "next/link";
import { useMemo } from "react";

import {
  buildTimelineTicks,
  computeBarPosition,
  computeTodayMarkerPercent,
  formatDelayLabel,
  timelineWidthPx,
  type GanttDateRange,
  type GanttZoomScale,
} from "@/lib/projects/gantt";
import { formatDependencyReadinessMessage } from "@/lib/projects/dependencies";
import { formatPersonLabel, formatProjectDate } from "@/lib/projects/display";
import { formatProjectTaskProgress } from "@/lib/projects/tasks-display";
import type {
  ProjectGanttDependency,
  ProjectGanttTask,
} from "@/types/projects";

import { ProjectTaskStatusBadge } from "./project-task-status-badge";

const ROW_HEIGHT = 44;
const LABEL_WIDTH = 220;

function progressValue(value: string | number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
}

export function ProjectGanttChart({
  projectId,
  tasks,
  dependencies,
  range,
  zoom,
}: {
  projectId: string;
  tasks: ProjectGanttTask[];
  dependencies: ProjectGanttDependency[];
  range: GanttDateRange;
  zoom: GanttZoomScale;
}) {
  const scheduled = useMemo(
    () => tasks.filter((task) => task.is_scheduled),
    [tasks],
  );

  const ticks = useMemo(() => buildTimelineTicks(range, zoom), [range, zoom]);
  const widthPx = timelineWidthPx(range, zoom);
  const todayPercent = computeTodayMarkerPercent(range);
  const height = Math.max(scheduled.length * ROW_HEIGHT, ROW_HEIGHT);

  const rowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    scheduled.forEach((task, index) => map.set(task.id, index));
    return map;
  }, [scheduled]);

  const connectors = useMemo(() => {
    return dependencies.flatMap((dep) => {
      const predIndex = rowIndexById.get(dep.predecessor_task_id);
      const succIndex = rowIndexById.get(dep.successor_task_id);
      if (predIndex === undefined || succIndex === undefined) {
        return [];
      }
      const pred = scheduled[predIndex]!;
      const succ = scheduled[succIndex]!;
      const predBar = computeBarPosition(
        range,
        pred.planned_start,
        pred.planned_end,
      );
      const succBar = computeBarPosition(
        range,
        succ.planned_start,
        succ.planned_end,
      );
      if (!predBar || !succBar) {
        return [];
      }

      const x1 = ((predBar.leftPercent + predBar.widthPercent) / 100) * widthPx;
      const y1 = predIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
      const x2 = (succBar.leftPercent / 100) * widthPx;
      const y2 = succIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
      const midX = x1 + Math.max(12, (x2 - x1) / 2);

      return [
        {
          id: dep.id,
          path: `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`,
        },
      ];
    });
  }, [dependencies, range, rowIndexById, scheduled, widthPx]);

  if (scheduled.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        No scheduled tasks with planned dates to show on the chart. Unscheduled
        tasks are listed below.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex min-w-0">
        <div
          className="shrink-0 border-r border-slate-200 bg-slate-50"
          style={{ width: LABEL_WIDTH }}
        >
          <div className="flex h-12 items-end border-b border-slate-200 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Task
          </div>
          <ul>
            {scheduled.map((task) => (
              <li
                className="flex h-11 items-center border-b border-slate-100 px-3"
                key={task.id}
                style={{ height: ROW_HEIGHT }}
              >
                <Link
                  className="min-w-0 truncate text-sm font-medium text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500"
                  href={`/projects/${projectId}/tasks/${task.id}`}
                >
                  <span className="text-slate-500">{task.task_code}</span>{" "}
                  {task.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <div style={{ width: widthPx, minWidth: "100%" }}>
            <div className="relative h-12 border-b border-slate-200 bg-slate-50">
              {ticks.map((tick) => (
                <div
                  className="absolute bottom-0 top-0 border-l border-slate-200"
                  key={tick.date.toISOString()}
                  style={{ left: `${tick.leftPercent}%` }}
                >
                  <span className="absolute bottom-2 left-1 whitespace-nowrap text-[10px] font-medium text-slate-500">
                    {tick.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="relative" style={{ height }}>
              {ticks.map((tick) => (
                <div
                  aria-hidden
                  className="absolute bottom-0 top-0 border-l border-slate-100"
                  key={`grid-${tick.date.toISOString()}`}
                  style={{ left: `${tick.leftPercent}%` }}
                />
              ))}

              {todayPercent !== null ? (
                <div
                  className="pointer-events-none absolute bottom-0 top-0 z-20 w-0.5 bg-rose-600"
                  style={{ left: `${todayPercent}%` }}
                >
                  <span className="absolute left-1 top-1 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Today
                  </span>
                </div>
              ) : null}

              <svg
                aria-hidden
                className="pointer-events-none absolute inset-0 z-10"
                height={height}
                width={widthPx}
              >
                <defs>
                  <marker
                    id="gantt-arrow"
                    markerHeight="6"
                    markerWidth="6"
                    orient="auto"
                    refX="5"
                    refY="3"
                    viewBox="0 0 6 6"
                  >
                    <path d="M0,0 L6,3 L0,6 Z" fill="#64748b" />
                  </marker>
                </defs>
                {connectors.map((connector) => (
                  <path
                    d={connector.path}
                    fill="none"
                    key={connector.id}
                    markerEnd="url(#gantt-arrow)"
                    stroke="#64748b"
                    strokeWidth="1.5"
                  />
                ))}
              </svg>

              {scheduled.map((task, index) => {
                const bar = computeBarPosition(
                  range,
                  task.planned_start,
                  task.planned_end,
                );
                if (!bar) return null;
                const progress = progressValue(task.progress_percentage);
                const delayText = formatDelayLabel({
                  isDelayed: task.is_delayed,
                  isCompletedLate: task.is_completed_late,
                  delayDays: task.delay_days,
                });

                return (
                  <div
                    className="absolute left-0 right-0"
                    key={task.id}
                    style={{
                      top: index * ROW_HEIGHT,
                      height: ROW_HEIGHT,
                    }}
                  >
                    <div
                      className="absolute top-2"
                      style={{
                        left: `${bar.leftPercent}%`,
                        width: task.is_milestone
                          ? undefined
                          : `${Math.max(bar.widthPercent, 0.8)}%`,
                      }}
                    >
                      {task.is_milestone ? (
                        <div
                          aria-label={`${task.task_code} milestone`}
                          className="relative ml-[-8px] h-4 w-4 rotate-45 border border-indigo-700 bg-indigo-500"
                          title={`Milestone · ${delayText}`}
                        />
                      ) : (
                        <div
                          aria-label={`${task.task_code} ${formatProjectTaskProgress(task.progress_percentage)}`}
                          className="relative h-6 overflow-hidden rounded-md border border-blue-700 bg-blue-200"
                          title={`${task.name} · ${delayText}`}
                        >
                          <div
                            className="h-full bg-blue-600"
                            style={{ width: `${progress}%` }}
                          />
                          <span className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold text-slate-950 mix-blend-normal">
                            {formatProjectTaskProgress(task.progress_percentage)}
                          </span>
                        </div>
                      )}
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {task.is_delayed ? (
                          <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-900">
                            Delayed
                          </span>
                        ) : null}
                        {!task.is_dependency_ready ? (
                          <span className="rounded bg-rose-100 px-1 text-[10px] font-semibold text-rose-900">
                            Dependency blocked
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProjectGanttScheduleTable({
  projectId,
  tasks,
  taskCodeById,
}: {
  projectId: string;
  tasks: ProjectGanttTask[];
  taskCodeById: Map<string, string>;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <caption className="sr-only">
          Accessible project schedule equivalent to the Gantt chart
        </caption>
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-3" scope="col">
              Code
            </th>
            <th className="px-3 py-3" scope="col">
              Name
            </th>
            <th className="px-3 py-3" scope="col">
              Status
            </th>
            <th className="px-3 py-3" scope="col">
              PIC
            </th>
            <th className="px-3 py-3" scope="col">
              Planned start
            </th>
            <th className="px-3 py-3" scope="col">
              Planned end
            </th>
            <th className="px-3 py-3" scope="col">
              Delayed
            </th>
            <th className="px-3 py-3" scope="col">
              Dependency readiness
            </th>
            <th className="px-3 py-3" scope="col">
              Predecessors
            </th>
            <th className="px-3 py-3" scope="col">
              Successors
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tasks.map((task) => {
            const predCodes = task.predecessor_ids
              .map((id) => taskCodeById.get(id) ?? id)
              .join(", ");
            const succCodes = task.successor_ids
              .map((id) => taskCodeById.get(id) ?? id)
              .join(", ");
            return (
              <tr className="align-top" key={task.id}>
                <td className="px-3 py-3 font-medium text-slate-900">
                  <Link
                    className="text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500"
                    href={`/projects/${projectId}/tasks/${task.id}`}
                  >
                    {task.task_code}
                  </Link>
                </td>
                <td className="px-3 py-3 text-slate-800">
                  {task.name}
                  {task.is_milestone ? (
                    <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                      Milestone
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <ProjectTaskStatusBadge status={task.status} />
                </td>
                <td className="px-3 py-3 text-slate-700">
                  {formatPersonLabel(task.person_in_charge_email)}
                </td>
                <td className="px-3 py-3 text-slate-700">
                  {formatProjectDate(task.planned_start)}
                </td>
                <td className="px-3 py-3 text-slate-700">
                  {formatProjectDate(task.planned_end)}
                </td>
                <td className="px-3 py-3 text-slate-700">
                  {formatDelayLabel({
                    isDelayed: task.is_delayed,
                    isCompletedLate: task.is_completed_late,
                    delayDays: task.delay_days,
                  })}
                </td>
                <td className="px-3 py-3 text-slate-700">
                  {formatDependencyReadinessMessage({
                    is_dependency_ready: task.is_dependency_ready,
                    blocking_predecessor_count: task.blocking_predecessor_count,
                    blocking_predecessors: [],
                    predecessor_count: task.predecessor_count,
                  })}
                </td>
                <td className="px-3 py-3 text-slate-700">
                  {predCodes || "None"}
                </td>
                <td className="px-3 py-3 text-slate-700">
                  {succCodes || "None"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
