import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_PATH, SESSION_COOKIE } from "@/lib/auth/constants";

/** Clears the session cookie and sends the user to the login page. */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
