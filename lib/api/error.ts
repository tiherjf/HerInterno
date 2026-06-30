import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    public override message: string,
    public status: number = 400,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Loga o erro real no servidor e retorna mensagem genérica ao cliente.
 * Use em todo catch de route handler.
 */
export function apiError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
  console.error("[API Error]", detail);
  return NextResponse.json({ error: "Erro interno" }, { status: 500 });
}
