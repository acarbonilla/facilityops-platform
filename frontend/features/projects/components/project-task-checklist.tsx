"use client";

import { useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { FormField } from "@/components/common/form-field";
import {
  useCreateProjectTaskChecklistItem,
  useDeleteProjectTaskChecklistItem,
  useUpdateProjectTaskChecklistItem,
} from "@/hooks/use-projects";
import { formatProjectDateTime } from "@/lib/projects/display";
import { formatProjectTaskError } from "@/lib/projects/tasks-display";
import type { ProjectTaskChecklistItem } from "@/types/projects";

export function ProjectTaskChecklist({
  projectId,
  taskId,
  items,
  canEdit,
}: {
  projectId: string;
  taskId: string;
  items: ProjectTaskChecklistItem[];
  canEdit: boolean;
}) {
  const createMutation = useCreateProjectTaskChecklistItem(projectId, taskId);
  const updateMutation = useUpdateProjectTaskChecklistItem(projectId, taskId);
  const deleteMutation = useDeleteProjectTaskChecklistItem(projectId, taskId);
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sortedItems = [...items].sort((a, b) => {
    if (a.sequence !== b.sequence) {
      return a.sequence - b.sequence;
    }
    return a.created_at.localeCompare(b.created_at);
  });

  async function handleCreate() {
    const text = newText.trim();
    if (!text) {
      return;
    }
    setErrorMessage(null);
    try {
      await createMutation.mutateAsync({ text });
      setNewText("");
    } catch (error) {
      setErrorMessage(
        formatProjectTaskError(error, "Checklist item could not be created."),
      );
    }
  }

  async function handleToggle(item: ProjectTaskChecklistItem) {
    setErrorMessage(null);
    try {
      await updateMutation.mutateAsync({
        itemId: item.id,
        payload: { is_completed: !item.is_completed },
      });
    } catch (error) {
      setErrorMessage(
        formatProjectTaskError(error, "Checklist item could not be updated."),
      );
    }
  }

  async function handleSaveEdit(itemId: string) {
    const text = editingText.trim();
    if (!text) {
      return;
    }
    setErrorMessage(null);
    try {
      await updateMutation.mutateAsync({
        itemId,
        payload: { text },
      });
      setEditingId(null);
      setEditingText("");
    } catch (error) {
      setErrorMessage(
        formatProjectTaskError(error, "Checklist item could not be updated."),
      );
    }
  }

  async function handleDelete(itemId: string) {
    const confirmed = window.confirm("Delete this checklist item?");
    if (!confirmed) {
      return;
    }
    setErrorMessage(null);
    try {
      await deleteMutation.mutateAsync(itemId);
    } catch (error) {
      setErrorMessage(
        formatProjectTaskError(error, "Checklist item could not be deleted."),
      );
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          Checklist
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Track task steps manually. Completing checklist items does not change
          task progress.
        </p>
      </div>

      {errorMessage ? (
        <ErrorState title="Checklist update failed" message={errorMessage} />
      ) : null}

      {sortedItems.length === 0 ? (
        <EmptyState
          title="No checklist items"
          message="Add checklist items to track work steps for this task."
        />
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {sortedItems.map((item) => (
            <li className="flex flex-col gap-3 px-4 py-3" key={item.id}>
              <div className="flex items-start gap-3">
                <input
                  aria-label={`Mark ${item.text} complete`}
                  checked={item.is_completed}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                  disabled={!canEdit || updateMutation.isPending}
                  onChange={() => {
                    void handleToggle(item);
                  }}
                  type="checkbox"
                />
                <div className="min-w-0 flex-1">
                  {editingId === item.id ? (
                    <FormField label="Checklist text" htmlFor={`edit-${item.id}`}>
                      <input
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        id={`edit-${item.id}`}
                        onChange={(event) => setEditingText(event.target.value)}
                        value={editingText}
                      />
                    </FormField>
                  ) : (
                    <p
                      className={[
                        "text-sm font-medium text-slate-900",
                        item.is_completed ? "line-through text-slate-500" : "",
                      ].join(" ")}
                    >
                      {item.text}
                    </p>
                  )}
                  {item.is_completed && item.completed_at ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Completed {formatProjectDateTime(item.completed_at)}
                    </p>
                  ) : null}
                </div>
              </div>
              {canEdit ? (
                <div className="flex flex-wrap gap-2 pl-7">
                  {editingId === item.id ? (
                    <>
                      <button
                        className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                        onClick={() => {
                          void handleSaveEdit(item.id);
                        }}
                        type="button"
                      >
                        Save
                      </button>
                      <button
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          setEditingId(null);
                          setEditingText("");
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditingText(item.text);
                      }}
                      type="button"
                    >
                      Edit text
                    </button>
                  )}
                  <button
                    className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                    onClick={() => {
                      void handleDelete(item.id);
                    }}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <FormField label="New checklist item" htmlFor="new-checklist-item">
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                id="new-checklist-item"
                onChange={(event) => setNewText(event.target.value)}
                placeholder="Describe a work step"
                value={newText}
              />
            </FormField>
          </div>
          <button
            className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            disabled={createMutation.isPending || !newText.trim()}
            onClick={() => {
              void handleCreate();
            }}
            type="button"
          >
            {createMutation.isPending ? "Adding…" : "Add item"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
