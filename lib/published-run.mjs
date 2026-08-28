export function isPublishedRun(run) {
  return Boolean(run?.id)
    && run.status === "succeeded"
    && Array.isArray(run.artifacts)
    && run.artifacts.length > 0
    && !String(run.id).startsWith("seed-");
}

export function publishedRuns(runs = []) {
  return runs.filter(isPublishedRun);
}
