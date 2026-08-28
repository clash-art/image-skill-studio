import { env } from "cloudflare:workers";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function readStudioAsset(context: RouteContext, includeBody: boolean) {
  const { path } = await context.params;
  if (!path.length || path.some((segment) => !segment || segment === "." || segment === "..")) {
    return new Response("Invalid asset path", { status: 400 });
  }

  const object = await env.STUDIO_ASSETS.get(path.join("/"));
  if (!object) return new Response("Asset not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");

  return new Response(includeBody ? object.body : null, { headers });
}

export async function GET(_request: Request, context: RouteContext) {
  return readStudioAsset(context, true);
}

export async function HEAD(_request: Request, context: RouteContext) {
  return readStudioAsset(context, false);
}
