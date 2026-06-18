import { NextRequest, NextResponse } from "next/server";
import { DEV_USERS, DEV_COOKIE } from "@/lib/auth/dev-mode";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Apenas em modo desenvolvimento" }, { status: 403 });
  }

  const { user } = await req.json();
  const session = DEV_USERS[user];

  if (!session) {
    return NextResponse.json({ error: "Usuário de teste não encontrado" }, { status: 404 });
  }

  const redirectPath =
    session.type === "patient" ? "/pacientes" : "/intranet";

  const response = NextResponse.json({ ok: true, redirect: redirectPath });
  response.cookies.set(DEV_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 horas
    path: "/",
  });

  return response;
}

export async function DELETE() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Apenas em modo desenvolvimento" }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(DEV_COOKIE);
  return response;
}
