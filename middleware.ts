import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { jwtVerify } from "jose";

const PATIENT_SECRET = new TextEncoder().encode(
  process.env.JWT_PATIENT_SECRET || "fallback-dev-secret-change-in-prod"
);

const DEV_COOKIE = "dev_session";
const isDev = process.env.NODE_ENV === "development";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Em dev, /dev-login é sempre acessível
  if (pathname.startsWith("/dev-login") || pathname.startsWith("/api/dev/")) {
    if (!isDev) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.next();
  }

  // --- Rotas de pacientes ---
  if (pathname.startsWith("/pacientes") && !pathname.startsWith("/pacientes/login")) {
    // Dev mode: usa APENAS cookie dev_session
    if (isDev) {
      const devCookie = request.cookies.get(DEV_COOKIE)?.value;
      if (devCookie) {
        try {
          const session = JSON.parse(devCookie);
          if (session.type === "patient") return NextResponse.next();
        } catch {}
      }
      return NextResponse.redirect(new URL("/dev-login", request.url));
    }

    // Produção: JWT próprio
    const token = request.cookies.get("patient_token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/pacientes/login", request.url));
    }
    try {
      await jwtVerify(token, PATIENT_SECRET);
      return NextResponse.next();
    } catch {
      const response = NextResponse.redirect(new URL("/pacientes/login", request.url));
      response.cookies.delete("patient_token");
      return response;
    }
  }

  // --- Rotas de intranet e admin ---
  if (pathname.startsWith("/intranet") || pathname.startsWith("/admin")) {
    // Dev mode: usa APENAS cookie dev_session, nunca toca no Supabase
    if (isDev) {
      const devCookie = request.cookies.get(DEV_COOKIE)?.value;
      if (devCookie) {
        try {
          const session = JSON.parse(devCookie);
          if (session.type === "staff") {
            if (pathname.startsWith("/admin") && !["admin", "ti"].includes(session.role)) {
              return NextResponse.redirect(new URL("/intranet", request.url));
            }
            return NextResponse.next();
          }
        } catch {}
      }
      // Sem sessão dev válida → volta para seletor de usuários
      return NextResponse.redirect(new URL("/dev-login", request.url));
    }

    // Produção: Supabase Auth
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.redirect(new URL("/login", request.url));
      }

      if (pathname.startsWith("/admin")) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (!profile || !["admin", "ti"].includes(profile.role)) {
          return NextResponse.redirect(new URL("/intranet", request.url));
        }
      }
    } catch {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return supabaseResponse;
  }

  // Redirecionar raiz
  if (pathname === "/") {
    if (isDev) {
      return NextResponse.redirect(new URL("/dev-login", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dev-login/:path*",
    "/intranet/:path*",
    "/admin/:path*",
    "/pacientes/:path*",
    "/api/dev/:path*",
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
};
