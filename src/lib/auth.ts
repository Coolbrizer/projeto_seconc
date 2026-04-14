import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type AuthUser = {
  email: string;
  role: "gestor";
};

type SessionPayload = {
  email: string;
  exp: number;
};

const AUTH_USERS: Array<AuthUser & { password: string }> = [
  {
    email: "alexandredamasceno@mpf.mp.br",
    password: "31cpr2026",
    role: "gestor",
  },
  {
    email: "marcossilvestre@mpf.mp.br",
    password: "31cprPrincipe",
    role: "gestor",
  },
];

export const SESSION_COOKIE_NAME = "seconc_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 horas
const SESSION_SECRET = process.env.SESSION_SECRET ?? "seconc-dev-session-secret";

function toBase64Url(value: string) {
  return Buffer.from(value, "utf-8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf-8");
}

function sign(payloadEncoded: string) {
  return createHmac("sha256", SESSION_SECRET).update(payloadEncoded).digest("base64url");
}

function isSignatureValid(payloadEncoded: string, providedSignature: string) {
  const expectedSignature = sign(payloadEncoded);
  const expectedBuffer = Buffer.from(expectedSignature, "utf-8");
  const providedBuffer = Buffer.from(providedSignature, "utf-8");
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function encodeSessionToken(payload: SessionPayload) {
  const payloadEncoded = toBase64Url(JSON.stringify(payload));
  const signature = sign(payloadEncoded);
  return `${payloadEncoded}.${signature}`;
}

function decodeSessionToken(token: string): SessionPayload | null {
  const [payloadEncoded, signature] = token.split(".");
  if (!payloadEncoded || !signature) return null;
  if (!isSignatureValid(payloadEncoded, signature)) return null;
  try {
    const payload = JSON.parse(fromBase64Url(payloadEncoded)) as SessionPayload;
    if (!payload.email || !Number.isFinite(payload.exp)) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function findUserByEmail(email: string) {
  return AUTH_USERS.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export function validateCredentials(email: string, password: string): AuthUser | null {
  const user = findUserByEmail(email.trim());
  if (!user) return null;
  if (user.password !== password) return null;
  return { email: user.email, role: user.role };
}

export async function createSession(email: string) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = encodeSessionToken({ email, exp });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(exp * 1000),
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = decodeSessionToken(token);
  if (!payload) return null;
  const user = findUserByEmail(payload.email);
  if (!user) return null;
  return { email: user.email, role: user.role };
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
