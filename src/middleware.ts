import { NextResponse, type NextRequest } from "next/server";

// Barreira de borda: sem cookie → /login. A validação real da sessão (banco) ocorre no servidor em requireUser().
const COOKIE = process.env.NODE_ENV === "production" ? "__Host-carvex_session" : "carvex_session";
const PUBLIC = ["/login"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (!req.cookies.get(COOKIE)) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
