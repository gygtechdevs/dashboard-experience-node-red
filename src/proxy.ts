import { NextResponse, type NextRequest } from "next/server";
import { HOME_PATH, LOGIN_PATH, SESSION_COOKIE, SESSION_EXPIRED_PATH } from "@/lib/auth/constants";
import { parseSession } from "@/lib/auth/jwt";

/**
 * Optimistic gate (Next 16 "proxy", formerly middleware): only checks that a
 * non-expired token cookie exists. The gateway is the real authority and a 401
 * from it sends the user back to /login.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === SESSION_EXPIRED_PATH) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const authenticated = token !== undefined && parseSession(token) !== null;

  if (pathname === LOGIN_PATH) {
    return authenticated ? NextResponse.redirect(new URL(HOME_PATH, request.url)) : NextResponse.next();
  }

  if (!authenticated) {
    const response = NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    if (token !== undefined) response.cookies.delete(SESSION_COOKIE);
    return response;
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and static files (anything with an extension).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
