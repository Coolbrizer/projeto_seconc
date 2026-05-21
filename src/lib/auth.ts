import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { validarLogin } from "@/lib/usuarios";

export type AuthUser = {
  email: string;
  role: "gestor";
};

type SessionPayload = {
  email: string;
  exp: number;
};

/**
 * Lista de fallback usada apenas quando a tabela `public.usuarios` não está
 * disponível (banco sem o schema aplicado, `SUPABASE_SERVICE_ROLE_KEY` ausente,
 * etc.). Quando a migração estiver completa e os dois usuários abaixo já
 * existirem na tabela, este array pode ser esvaziado com segurança.
 */
const AUTH_USERS_FALLBACK: Array<AuthUser & { password: string }> = [
  {
    email: "alexandredamasceno@mpf.mp.br",
    password: "Rpvl2027@",
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

function resolveSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) return envSecret;
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    console.warn(
      "[auth] SESSION_SECRET ausente ou com menos de 16 chars em produção. Defina uma chave forte em process.env.SESSION_SECRET para assinar sessões.",
    );
  }
  return "seconc-dev-session-secret";
}

const SESSION_SECRET = resolveSessionSecret();

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

function findFallbackUserByEmail(email: string) {
  return (
    AUTH_USERS_FALLBACK.find(
      (user) => user.email.toLowerCase() === email.toLowerCase(),
    ) ?? null
  );
}

/**
 * Valida credenciais. Tenta primeiro a tabela `public.usuarios` (via RPC com
 * bcrypt no Postgres). Se a tabela ainda não está disponível ou a consulta
 * falha por motivo de infraestrutura, recorre à lista hardcoded de fallback.
 *
 * - DB válido → sucesso.
 * - DB diz "usuário não bate" → ainda tenta o fallback (suporte à transição).
 * - DB indisponível ou erro → fallback.
 */
export async function validateCredentials(
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const trimmedEmail = email.trim();

  try {
    const dbResult = await validarLogin(trimmedEmail, password);
    if (dbResult !== "indisponivel" && dbResult !== null) {
      return { email: dbResult.email, role: "gestor" };
    }
    // dbResult === null (credenciais não batem) ou "indisponivel" → tenta fallback.
  } catch (err) {
    console.warn("[auth] Falha ao validar via tabela usuarios; usando fallback.", err);
  }

  const fallback = findFallbackUserByEmail(trimmedEmail);
  if (!fallback) return null;
  if (fallback.password !== password) return null;
  return { email: fallback.email, role: fallback.role };
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
  // Confiamos no token (assinado por HMAC com TTL de 12h). Não revalidamos a
  // existência no banco a cada request para evitar uma consulta extra por
  // página renderizada. Caso seja necessário revogar acesso antes do TTL,
  // basta limpar/rotacionar `SESSION_SECRET`.
  return { email: payload.email, role: "gestor" };
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
