"use client";

import { useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { FormField } from "@/components/common/form-field";
import { useCreateProjectIssueComment } from "@/hooks/use-projects";
import {
  formatPersonLabel,
  formatProjectDateTime,
} from "@/lib/projects/display";
import { formatProjectIssueError } from "@/lib/projects/issues-display";
import type { ProjectIssueComment } from "@/types/projects";

export function ProjectIssueComments({
  projectId,
  issueId,
  comments,
  canComment,
}: {
  projectId: string;
  issueId: string;
  comments: ProjectIssueComment[];
  canComment: boolean;
}) {
  const createMutation = useCreateProjectIssueComment(projectId, issueId);
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreate() {
    const trimmed = body.trim();
    if (!trimmed) {
      return;
    }
    setErrorMessage(null);
    try {
      await createMutation.mutateAsync({
        body: trimmed,
        is_internal: isInternal,
      });
      setBody("");
      setIsInternal(true);
    } catch (error) {
      setErrorMessage(
        formatProjectIssueError(error, "Comment could not be created."),
      );
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          Comments
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Internal notes default to private project-team visibility.
        </p>
      </div>

      {errorMessage ? (
        <ErrorState title="Comment failed" message={errorMessage} />
      ) : null}

      {comments.length === 0 ? (
        <EmptyState
          title="No comments yet"
          message="Add a comment to leave coordination notes on this issue."
        />
      ) : (
        <ol className="space-y-3">
          {comments.map((comment) => (
            <li
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              key={comment.id}
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {formatPersonLabel(comment.author_email, "Unknown author")}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                    {comment.body}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-slate-500">
                    {formatProjectDateTime(comment.created_at)}
                  </p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-600">
                    {comment.is_internal ? "Internal" : "Visible"}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {canComment ? (
        <div className="space-y-3">
          <FormField label="New comment" htmlFor="issue-comment-body">
            <textarea
              className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              id="issue-comment-body"
              onChange={(event) => setBody(event.target.value)}
              value={body}
            />
          </FormField>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              checked={isInternal}
              className="h-4 w-4 rounded border-slate-300"
              onChange={(event) => setIsInternal(event.target.checked)}
              type="checkbox"
            />
            Internal comment
          </label>
          <div>
            <button
              className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              disabled={createMutation.isPending || !body.trim()}
              onClick={() => {
                void handleCreate();
              }}
              type="button"
            >
              {createMutation.isPending ? "Posting…" : "Post comment"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
