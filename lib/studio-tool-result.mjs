export function applyStudioToolResult(current, next) {
  if (!next || typeof next !== "object") return current;
  const hasSkills = Array.isArray(next.skills) && next.skills.length > 0;
  const hasRuns = Array.isArray(next.runs);
  const recorded = next.run && typeof next.run === "object" && next.run.id ? next.run : null;
  if (!hasSkills && !hasRuns && !recorded) return current;

  const skills = hasSkills ? next.skills : current.skills;
  const runs = hasRuns
    ? next.runs
    : recorded
      ? [recorded, ...current.runs.filter((run) => run.id !== recorded.id)]
      : current.runs;
  return { skills, runs };
}
