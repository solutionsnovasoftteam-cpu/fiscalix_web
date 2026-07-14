import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("fiscalix_session");
  if (!hasSession) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/dashboard/:path*", "/profile/:path*", "/companies/:path*", "/plans/:path*", "/reports/:path*", "/taxes/:path*", "/transactions/:path*", "/settings/:path*"] };
