export function GET(request: Request) {
  return Response.redirect(new URL("/widget.html", request.url), 307);
}
