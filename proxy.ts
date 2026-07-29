import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("fiscalix_session");
  if (!hasSession) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/centro-fiscal/:path*",
    "/companies/:path*",
    "/dashboard/:path*",
    "/expenses/:path*",
    "/income/:path*",
    "/integrations/:path*",
    "/payroll/:path*",
    "/plans/:path*",
    "/profile/:path*",
    "/receipts/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/support/:path*",
    "/taxes/:path*",
    "/transactions/:path*",
    "/web-fiscal/:path*",
  ],
};
