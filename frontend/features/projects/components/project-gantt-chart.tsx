"use client";

/**
 * FO-105 / FO-115 lightweight CSS/SVG Gantt chart.
 * Package decision: NO third-party Gantt library — React + Tailwind + SVG only.
 * Bars use planned dates; progress is an overlay; milestones are diamonds.
 * FO-115: horizontal pan (navigation only), sticky labels/headers, rich calendar,
 * task selection + detail popover. Drag-to-reschedule remains unsupported.
 */

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  buildRichTimelineHeader,
  computeBarPosition,
  computeTodayMarkerPercent,
  formatDelayLabel,
  getTaskBarAriaLabel,
  timelineWidthPx,
  type GanttDateRange,
  type GanttZoomScale,
} from "@/lib/projects/gantt";
import { formatDependencyReadinessMessage } from "@/lib/projects/dependencies";
import { formatPersonLabel, formatProjectDate } from "@/lib/projects/display";
import {
  formatProjectTaskProgress,
  formatProjectTaskStatusLabel,
  formatTaskPlannedScheduleLabel,
  isTaskScheduleUnscheduled,
} from "@/lib/projects/tasks-display";
import type {
  ProjectGanttDependency,
  ProjectGanttTask,
} from "@/types/projects";

import { ProjectTaskStatusBadge } from "./project-task-status-badge";

const ROW_HEIGHT = 44;
const LABEL_WIDTH = 220;
const HEADER_HEIGHT = 56;

function progressValue(value: string | number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
}

function TaskDetailPopover({
  projectId,
  task,
  onClose,
}: {
  projectId: string;
  task: ProjectGanttTask;
  onClose: () => void;
}) {
  return (
    <div
      aria-label={`Details for ${task.task_code}`}
      className="absolute left-3 top-3 z-50 w-80 max-w-[calc(100%-1.5rem)] rounded-lg border border-slate-300 bg-white p-4 shadow-lg motion-safe:animate-in"
      role="dialog"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {task.task_code}
            {task.is_milestone ? " · Milestone" : ""}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-slate-950">
            {task.name}
          </h3>
        </div>
        <button
          aria-label="Close task details"
          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
        <div>
          <dt className="font-semibold text-slate-500">Status</dt>
          <dd className="mt-0.5">
            {formatProjectTaskStatusLabel(task.status)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">Progress</dt>
          <dd className="mt-0.5">
            {formatProjectTaskProgress(task.progress_percentage)}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="font-semibold text-slate-500">PIC</dt>
          <dd className="mt-0.5">
            {formatPersonLabel(task.person_in_charge_email)}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="font-semibold text-slate-500">
            {task.is_milestone ? "Milestone date" : "Planned schedule"}
          </dt>
          <dd className="mt-0.5">
            {formatTaskPlannedScheduleLabel({
              planned_start: task.planned_start,
              planned_end: task.planned_end,
              is_milestone: task.is_milestone,
            })}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="font-semibold text-slate-500">Dependency readiness</dt>
          <dd className="mt-0.5">
            {formatDependencyReadinessMessage({
              is_dependency_ready: task.is_dependency_ready,
              blocking_predecessor_count: task.blocking_predecessor_count,
              blocking_predecessors: [],
              predecessor_count: task.predecessor_count,
            })}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="font-semibold text-slate-500">Schedule health</dt>
          <dd className="mt-0.5">
            {formatDelayLabel({
              isDelayed: task.is_delayed,
              isCompletedLate: task.is_completed_late,
              delayDays: task.delay_days,
            })}
          </dd>
        </div>
      </dl>
      <Link
        className="mt-4 inline-flex rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        href={`/projects/${projectId}/tasks/${task.id}`}
      >
        Open task
      </Link>
    </div>
  );
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startScrollLeft: number;
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const scheduled = useMemo(
    () => tasks.filter((task) => task.is_scheduled),
    [tasks],
  );

  const header = useMemo(
    () => buildRichTimelineHeader(range, zoom),
    [range, zoom],
  );
  const widthPx = timelineWidthPx(range, zoom);
  const todayPercent = computeTodayMarkerPercent(range);
  const height = Math.max(scheduled.length * ROW_HEIGHT, ROW_HEIGHT);

  const rowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    scheduled.forEach((task, index) => map.set(task.id, index));
    return map;
  }, [scheduled]);

  const selectedTask = useMemo(
    () => scheduled.find((task) => task.id === selectedTaskId) ?? null,
    [scheduled, selectedTaskId],
  );

  const relatedIds = useMemo(() => {
    if (!selectedTaskId) return new Set<string>();
    const ids = new Set<string>([selectedTaskId]);
    for (const dep of dependencies) {
      if (dep.predecessor_task_id === selectedTaskId) {
        ids.add(dep.successor_task_id);
      }
      if (dep.successor_task_id === selectedTaskId) {
        ids.add(dep.predecessor_task_id);
      }
    }
    return ids;
  }, [dependencies, selectedTaskId]);

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
      const highlighted =
        Boolean(selectedTaskId) &&
        (dep.predecessor_task_id === selectedTaskId ||
          dep.successor_task_id === selectedTaskId);

      return [
        {
          id: dep.id,
          path: `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`,
          highlighted,
        },
      ];
    });
  }, [
    dependencies,
    range,
    rowIndexById,
    scheduled,
    selectedTaskId,
    widthPx,
  ]);

  const clearSelection = useCallback(() => setSelectedTaskId(null), []);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        clearSelection();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearSelection]);

  const onPanPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-gantt-interactive='true']")) {
      return;
    }
    const scroller = scrollRef.current;
    if (!scroller) return;
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: scroller.scrollLeft,
    };
    scroller.setPointerCapture(event.pointerId);
    setIsPanning(true);
  };

  const onPanPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    const scroller = scrollRef.current;
    if (!pan || !scroller || pan.pointerId !== event.pointerId) return;
    const delta = event.clientX - pan.startX;
    // Drag right → earlier dates (decrease scrollLeft); drag left → later.
    scroller.scrollLeft = pan.startScrollLeft - delta;
  };

  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    panRef.current = null;
    setIsPanning(false);
    try {
      scrollRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };

  const onTaskKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    taskId: string,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedTaskId(taskId);
    }
  };

  if (scheduled.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        No scheduled tasks with planned dates to show on the chart. Unscheduled
        tasks are listed below.
      </p>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {selectedTask ? (
        <TaskDetailPopover
          onClose={clearSelection}
          projectId={projectId}
          task={selectedTask}
        />
      ) : null}

      <div
        aria-label="Interactive project Gantt timeline. Drag empty timeline to pan dates. Schedule edits remain on the task form."
        className={`max-h-[70vh] overflow-auto ${isPanning ? "cursor-grabbing select-none" : "cursor-grab"}`}
        onPointerCancel={endPan}
        onPointerDown={onPanPointerDown}
        onPointerMove={onPanPointerMove}
        onPointerUp={endPan}
        ref={scrollRef}
        role="region"
      >
        <div
          className="relative"
          style={{ width: LABEL_WIDTH + widthPx, minWidth: "100%" }}
        >
          {/* Sticky calendar + task header */}
          <div
            className="sticky top-0 z-40 flex border-b border-slate-200 bg-slate-50"
            style={{ height: HEADER_HEIGHT }}
          >
            <div
              className="sticky left-0 z-50 flex shrink-0 items-end border-r border-slate-300 bg-slate-100 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
              style={{ width: LABEL_WIDTH }}
            >
              Task
            </div>
            <div
              className="relative shrink-0"
              style={{ width: widthPx, height: HEADER_HEIGHT }}
            >
              {header.bands.map((band) => (
                <div
                  className="absolute top-0 flex h-5 items-center border-l border-slate-300 px-1 text-[10px] font-semibold tracking-wide text-slate-600"
                  key={`band-${band.label}-${band.leftPercent}`}
                  style={{
                    left: `${band.leftPercent}%`,
                    width: `${band.widthPercent}%`,
                  }}
                >
                  <span className="truncate">{band.label}</span>
                </div>
              ))}
              {header.cells.map((cell) => (
                <div
                  className={`absolute bottom-0 border-l border-slate-200 px-0.5 pb-1 ${
                    cell.isWeekend ? "bg-slate-100/80" : ""
                  }`}
                  key={`cell-${cell.date.toISOString()}`}
                  style={{
                    left: `${cell.leftPercent}%`,
                    width: `${cell.widthPercent}%`,
                    top: header.bands.length ? 20 : 0,
                  }}
                >
                  <div className="truncate text-[10px] font-semibold text-slate-700">
                    {cell.label}
                  </div>
                  {cell.subLabel ? (
                    <div className="truncate text-[10px] text-slate-500">
                      {cell.subLabel}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="flex">
            {/* Sticky task labels */}
            <ul
              className="sticky left-0 z-30 shrink-0 border-r border-slate-300 bg-white"
              style={{ width: LABEL_WIDTH }}
            >
              {scheduled.map((task) => {
                const selected = task.id === selectedTaskId;
                const related = relatedIds.has(task.id);
                return (
                  <li
                    className={`flex items-center border-b border-slate-100 px-3 ${
                      selected
                        ? "bg-blue-50"
                        : related
                          ? "bg-slate-50"
                          : "bg-white"
                    }`}
                    key={task.id}
                    style={{ height: ROW_HEIGHT }}
                  >
                    <button
                      aria-pressed={selected}
                      className="min-w-0 truncate text-left text-sm font-medium text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500"
                      data-gantt-interactive="true"
                      onClick={() =>
                        setSelectedTaskId((current) =>
                          current === task.id ? null : task.id,
                        )
                      }
                      onKeyDown={(event) => onTaskKeyDown(event, task.id)}
                      type="button"
                    >
                      <span className="text-slate-500">{task.task_code}</span>{" "}
                      {task.name}
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Timeline body */}
            <div
              className="relative shrink-0"
              style={{ width: widthPx, height }}
            >
              {header.cells.map((cell) => (
                <div
                  aria-hidden
                  className={`absolute bottom-0 top-0 border-l ${
                    cell.isWeekend
                      ? "border-slate-200 bg-slate-50/70"
                      : "border-slate-100"
                  }`}
                  key={`grid-${cell.date.toISOString()}`}
                  style={{
                    left: `${cell.leftPercent}%`,
                    width: `${cell.widthPercent}%`,
                  }}
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
                  <marker
                    id="gantt-arrow-active"
                    markerHeight="6"
                    markerWidth="6"
                    orient="auto"
                    refX="5"
                    refY="3"
                    viewBox="0 0 6 6"
                  >
                    <path d="M0,0 L6,3 L0,6 Z" fill="#1d4ed8" />
                  </marker>
                </defs>
                {connectors.map((connector) => (
                  <path
                    d={connector.path}
                    fill="none"
                    key={connector.id}
                    markerEnd={
                      connector.highlighted
                        ? "url(#gantt-arrow-active)"
                        : "url(#gantt-arrow)"
                    }
                    stroke={connector.highlighted ? "#1d4ed8" : "#64748b"}
                    strokeWidth={connector.highlighted ? 2.25 : 1.5}
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
                const selected = task.id === selectedTaskId;
                const related = relatedIds.has(task.id);

                return (
                  <div
                    className={`absolute left-0 right-0 ${
                      selected
                        ? "bg-blue-50/60"
                        : related
                          ? "bg-slate-50/40"
                          : ""
                    }`}
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
                        <button
                          aria-label={getTaskBarAriaLabel(task)}
                          className={`relative ml-[-8px] h-4 w-4 rotate-45 border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            selected
                              ? "border-indigo-900 bg-indigo-600"
                              : "border-indigo-700 bg-indigo-500"
                          }`}
                          data-gantt-interactive="true"
                          onClick={() =>
                            setSelectedTaskId((current) =>
                              current === task.id ? null : task.id,
                            )
                          }
                          onKeyDown={(event) => onTaskKeyDown(event, task.id)}
                          title={`Milestone · ${delayText}`}
                          type="button"
                        />
                      ) : (
                        <button
                          aria-label={getTaskBarAriaLabel(task)}
                          className={`relative h-6 w-full overflow-hidden rounded-md border text-left focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            selected
                              ? "border-blue-900 bg-blue-300"
                              : "border-blue-700 bg-blue-200"
                          }`}
                          data-gantt-interactive="true"
                          onClick={() =>
                            setSelectedTaskId((current) =>
                              current === task.id ? null : task.id,
                            )
                          }
                          onKeyDown={(event) => onTaskKeyDown(event, task.id)}
                          title={`${task.name} · ${delayText}`}
                          type="button"
                        >
                          <span
                            aria-hidden
                            className="absolute inset-y-0 left-0 bg-blue-600"
                            style={{ width: `${progress}%` }}
                          />
                          <span className="absolute inset-0 flex items-center px-2 text-[10px] font-semibold text-slate-950">
                            {formatProjectTaskProgress(
                              task.progress_percentage,
                            )}
                          </span>
                        </button>
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
      <p className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Drag the empty timeline to pan dates. Scrollbars, Previous/Next, and
        Today remain available. Task schedules are edited on the task form —
        pan never changes dates.
      </p>
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
              Schedule
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
                  {isTaskScheduleUnscheduled(task)
                    ? "Unscheduled"
                    : formatTaskPlannedScheduleLabel({
                        planned_start: task.planned_start,
                        planned_end: task.planned_end,
                        is_milestone: task.is_milestone,
                      })}
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
