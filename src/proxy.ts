import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Edge proxy (formerly "middleware" — renamed in Next.js 16): a cheap gate that
// bounces anonymous traffic from app routes to the login page. Full role checks
// happen server-side in each layout/page.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/students",
  "/menu",
  "/meals",
  "/predictions",
  "/models",
  "/alerts",
  "/inventory",
  "/purchases",
  "/waste",
  "/treatment",
  "/station",
  "/reports",
  "/settings",
];

async function isValid(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!isProtected) return NextResponse.next();

  const ok = await isValid(req.cookies.get("ww_session")?.value);
  if (ok) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
