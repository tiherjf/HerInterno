import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { apiError } from "@/lib/api/error";
import { getRamaisData } from "@/lib/ramais/server";

export async function GET() {
  try {
    const profile = await requireStaff();
    return NextResponse.json(await getRamaisData(profile));
  } catch (err) {
    return apiError(err);
  }
}
