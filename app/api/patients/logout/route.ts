import { NextResponse } from "next/server";
import { PATIENT_COOKIE } from "@/lib/auth/patient";

export async function POST() {
  const response = NextResponse.redirect(new URL("/pacientes/login", process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000"));
  response.cookies.delete(PATIENT_COOKIE);
  return response;
}
