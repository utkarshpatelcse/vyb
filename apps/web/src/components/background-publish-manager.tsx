"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  dismissBackgroundPublishTask,
  getBackgroundPublishTasks,
  isBackgroundPublishTaskActive,
  restoreBackgroundPublishQueue,
  subscribeBackgroundPublishTasks,
  type BackgroundPublishTask
} from "../lib/background-publish";

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="vyb-publish-spinner-icon">
      <circle cx="12" cy="12" r="9" className="vyb-publish-spinner-ring" />
      <path d="M12 3a9 9 0 0 1 9 9" className="vyb-publish-spinner-head" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="vyb-publish-close-icon">
      <path
        d="m7 7 10 10M17 7 7 17"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`vyb-publish-chevron${expanded ? " is-expanded" : ""}`}
    >
      <path
        d="m6 9 6 6 6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function kindLabel(kind: BackgroundPublishTask["kind"]) {
  if (kind === "vibe") {
    return "V";
  }

  if (kind === "story") {
    return "S";
  }

  return "P";
}

function statusTone(task: BackgroundPublishTask) {
  if (task.status === "success") {
    return "success";
  }

  if (task.status === "error") {
    return "error";
  }

  return "active";
}

export function BackgroundPublishManager() {
  const router = useRouter();
  const [tasks, setTasks] = useState(() => getBackgroundPublishTasks());
  const [isExpanded, setIsExpanded] = useState(false);
  const refreshedTaskIdsRef = useRef(new Set<string>());

  useEffect(() => {
    void restoreBackgroundPublishQueue();
    return subscribeBackgroundPublishTasks((nextTasks) => {
      setTasks(nextTasks);
    });
  }, []);

  const activeTasks = useMemo(
    () => tasks.filter((task) => isBackgroundPublishTaskActive(task.status)),
    [tasks]
  );
  const completedTasks = useMemo(
    () => tasks.filter((task) => !isBackgroundPublishTaskActive(task.status)),
    [tasks]
  );
  const visibleTasks = useMemo(
    () => [...activeTasks, ...completedTasks].slice(0, 4),
    [activeTasks, completedTasks]
  );
  const summaryTask = activeTasks[0] ?? completedTasks[0] ?? null;

  useEffect(() => {
    if (activeTasks.length > 0) {
      setIsExpanded(true);
    }
  }, [activeTasks.length]);

  useEffect(() => {
    let shouldRefresh = false;

    for (const task of tasks) {
      if (task.status === "success" && !refreshedTaskIdsRef.current.has(task.id)) {
        refreshedTaskIdsRef.current.add(task.id);
        shouldRefresh = true;
      }
    }

    if (shouldRefresh) {
      router.refresh();
    }
  }, [router, tasks]);

  useEffect(() => {
    if (activeTasks.length === 0) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [activeTasks.length]);

  if (tasks.length === 0 || !summaryTask) {
    return null;
  }

  const summaryCount = activeTasks.length > 0 ? activeTasks.length : completedTasks.length;

  return (
    <section
      className={`vyb-publish-hub${isExpanded ? " is-expanded" : ""}`}
      aria-live="polite"
      aria-label="Background publishing status"
    >
      <button
        type="button"
        className="vyb-publish-hub-toggle"
        onClick={() => setIsExpanded((current) => !current)}
        aria-expanded={isExpanded}
      >
        <span className={`vyb-publish-hub-pulse is-${statusTone(summaryTask)}`} />
        <div className="vyb-publish-hub-copy">
          <strong>{activeTasks.length > 0 ? "Posting in background" : "Recent publishing updates"}</strong>
          <span>{summaryTask.detail}</span>
        </div>
        <span className="vyb-publish-hub-count">{summaryCount}</span>
        <ChevronIcon expanded={isExpanded} />
      </button>

      {isExpanded ? (
        <div className="vyb-publish-hub-panel">
          {visibleTasks.map((task) => {
            const isActive = isBackgroundPublishTaskActive(task.status);

            return (
              <article key={task.id} className={`vyb-publish-task is-${statusTone(task)}`}>
                <div className="vyb-publish-task-kind">{kindLabel(task.kind)}</div>

                <div className="vyb-publish-task-copy">
                  <div className="vyb-publish-task-head">
                    <strong>{task.title}</strong>
                    <span>{task.kind === "post" ? "Moment" : task.kind === "story" ? "Story" : "Vibe"}</span>
                  </div>

                  <p>{task.detail}</p>

                  {isActive ? (
                    <div className="vyb-publish-task-progress" aria-hidden="true">
                      <span style={{ width: `${Math.round(task.progress * 100)}%` }} />
                    </div>
                  ) : (
                    <div className={`vyb-publish-task-status is-${statusTone(task)}`}>
                      {task.status === "success" ? "Live on campus" : "Needs attention"}
                    </div>
                  )}

                  {!isActive && task.status === "error" && task.logs.length > 0 ? (
                    <div className="vyb-publish-task-logs">
                      {task.logs.slice(-4).map((line) => (
                        <code key={line}>{line}</code>
                      ))}
                    </div>
                  ) : null}
                </div>

                {isActive ? (
                  <span className="vyb-publish-task-spinner" aria-hidden="true">
                    <SpinnerIcon />
                  </span>
                ) : (
                  <button
                    type="button"
                    className="vyb-publish-task-dismiss"
                    onClick={() => dismissBackgroundPublishTask(task.id)}
                    aria-label={`Dismiss ${task.title}`}
                  >
                    <CloseIcon />
                  </button>
                )}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
