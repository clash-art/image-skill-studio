import { isPublishedRun, publishedRuns } from "./published-run.mjs";

export function applyStudioToolResult(current, next) {
  if (!next || typeof next !== "object") return current;
  const hasSkills = Array.isArray(next.skills) && next.skills.length > 0;
  const hasRuns = Array.isArray(next.runs);
  const recorded = next.run && typeof next.run === "object" && next.run.id && isPublishedRun(next.run)
    ? next.run
    : null;
  if (!hasSkills && !hasRuns && !recorded) return current;

  const skills = hasSkills ? next.skills : current.skills;
  const runs = hasRuns
    ? publishedRuns(next.runs)
    : recorded
      ? [recorded, ...publishedRuns(current.runs).filter((run) => run.id !== recorded.id)]
      : publishedRuns(current.runs);
  return { skills, runs };
}
