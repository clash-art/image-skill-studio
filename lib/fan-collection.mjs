const FAN_X = {
  1: [0],
  2: [-12, 12],
  3: [-20, 0, 20],
  4: [-26, -9, 9, 26],
};

const FAN_Y = {
  1: [0],
  2: [4, 4],
  3: [8, 0, 8],
  4: [12, 3, 3, 12],
};

const FAN_ROTATION = {
  1: [0],
  2: [-6, 6],
  3: [-9, 0, 9],
  4: [-12, -4, 4, 12],
};

export function fanPlacement(index, count) {
  const safeCount = Math.min(4, Math.max(1, count));
  const safeIndex = Math.min(safeCount - 1, Math.max(0, index));
  return {
    x: FAN_X[safeCount][safeIndex],
    y: FAN_Y[safeCount][safeIndex],
    rotation: FAN_ROTATION[safeCount][safeIndex],
    zIndex: safeIndex + 1,
  };
}

export function groupRecentRunsBySkill(skills, runs, limit = 4) {
  const skillsById = new Map(skills.map((skill) => [skill.id, skill]));
  const groups = new Map();
  for (const run of runs) {
    const skillId = run.snapshot?.skill?.id;
    const skill = skillsById.get(skillId);
    if (!skill) continue;
    let group = groups.get(skillId);
    if (!group) {
      group = { skill, runs: [], total: 0 };
      groups.set(skillId, group);
    }
    group.total += 1;
    if (group.runs.length < limit) group.runs.push(run);
  }
  return [...groups.values()].map((group) => ({ ...group, runs: group.runs.reverse() }));
}
