import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getDevSession, devSessionToPatient, isDev } from "./dev-mode";

const SECRET = new TextEncoder().encode(
  process.env.JWT_PATIENT_SECRET || "fallback-dev-secret-change-in-prod"
);

export const PATIENT_COOKIE = "patient_token";

export interface PatientPayload {
  sub: string;
  cpf: string;
  name: string;
}

export async function signPatientToken(payload: PatientPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(SECRET);
}

export async function verifyPatientToken(token: string): Promise<PatientPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as PatientPayload;
  } catch {
    return null;
  }
}

export async function getPatientFromCookie(): Promise<PatientPayload | null> {
  // Dev mode: retorna paciente fake
  if (isDev) {
    const devSession = getDevSession();
    if (devSession?.type === "patient") {
      return devSessionToPatient(devSession);
    }
  }

  const cookieStore = cookies();
  const token = cookieStore.get(PATIENT_COOKIE)?.value;
  if (!token) return null;
  return verifyPatientToken(token);
}

export async function requirePatient() {
  const patient = await getPatientFromCookie();
  if (!patient) {
    const { redirect } = await import("next/navigation");
    redirect("/pacientes/login");
  }
  return patient!;
}
