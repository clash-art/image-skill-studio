export const STABLE_STUDIO_TOOLS = {
  open: "open_image_skill_studio",
  runPrepared: "run_prepared_image_generation",
  markHandoff: "mark_image_generation_handoff",
  listSkills: "list_image_skills",
  registerSkill: "register_image_skill",
  installSkill: "install_image_skill",
  fetchSkill: "fetch_image_skill",
  refreshCatalog: "refresh_image_skill_catalog",
  prepare: "prepare_image_generation",
  getRun: "get_image_generation_run",
  record: "record_image_generation",
};

export function createStudioIdentity(edition = "stable") {
  const isDev = edition === "dev";
  const suffix = isDev ? "_dev" : "";
  const tools = Object.fromEntries(
    Object.entries(STABLE_STUDIO_TOOLS).map(([key, name]) => [key, `${name}${suffix}`]),
  );
  return {
    edition,
    serverName: isDev ? "image-skill-studio-dev" : "image-skill-studio",
    displayName: isDev ? "Image Skill Studio (dev)" : "Image Skill Studio",
    resourceUri: isDev
      ? "ui://image-skill-studio-dev/v1/workbench.html"
      : "ui://image-skill-studio/v1/workbench.html",
    resourceName: isDev ? "image-skill-studio-dev-workbench" : "image-skill-studio-workbench",
    tools,
    openTitle: isDev ? "Open Image Skill Studio (dev)" : "Open Image Skill Studio",
    openDescription: isDev
      ? "Open the live checkout Image Skill Studio workbench."
      : "Open the interactive image generation Skill workbench and show recent generation runs.",
  };
}

export const STUDIO_RESOURCE_URI = createStudioIdentity("stable").resourceUri;

export function injectStudioIdentity(html, identity) {
  const payload = JSON.stringify({
    edition: identity.edition,
    displayName: identity.displayName,
    tools: identity.tools,
    resourceUri: identity.resourceUri,
  });
  const tag = `<script>window.__IMAGE_SKILL_STUDIO__=${payload}</script>`;
  const stripped = String(html).replace(/<script>window\.__IMAGE_SKILL_STUDIO__=[\s\S]*?<\/script>/, "");
  if (stripped.includes("</head>")) return stripped.replace("</head>", `${tag}</head>`);
  return `${tag}${stripped}`;
}
