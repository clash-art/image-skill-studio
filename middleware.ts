import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { SITE_LOCALE_HEADER } from "@/lib/site-locale-server";
import { localeFromPathname } from "@/lib/site-i18n";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = localeFromPathname(pathname);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(SITE_LOCALE_HEADER, locale);

  if (locale === "zh" && pathname.startsWith("/zh/")) {
    const rewrittenPath = pathname.replace(/^\/zh/, "") || "/";
    const url = request.nextUrl.clone();
    url.pathname = rewrittenPath;
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next|studio/image/assets|favicon\\.svg|manifest\\.webmanifest|widget\\.html).*)"],
};
