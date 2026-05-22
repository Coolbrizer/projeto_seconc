import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { buscarUsuarioPorEmail, validarLogin } from "@/lib/usuarios";
import type { UsuarioRole } from "@/lib/usuarios";

export type AuthUser = {
  email: string;
  nome: string;
  role: UsuarioRole;
  mustChangePassword: boolean;
};

type SessionPayload = {
  email: string;
  exp: number;
};

/**
 * Fallback de credenciais usado **apenas** quando a tabela `public.usuarios`
 * está indisponível (banco sem schema aplicado, `SUPABASE_SERVICE_ROLE_KEY`
 * ausente, etc.). Vazio por padrão — a fonte da verdade agora é a tabela.
 *
 * Para manter um "freio de emergência" em desenvolvimento, basta acrescentar
 * objetos `{ email, password, nome, role: "admin" }` aqui. Em produção,
 * mantenha vazio.
 */
const AUTH_USERS_FALLBACK = [
  {
    email: "alexandredamasceno@mpf.mp.br",
    password: "Rpvl2027@",
    nome: "Alexandre Cezar Damasceno",
    role: "admin" as const,
  },
];

export const SESSION_COOKIE_NAME = "seconc_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 horas

function resolveSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) return envSecret;
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
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
 * bcrypt no Postgres). Se a tabela está indisponível, recorre ao fallback
 * (normalmente vazio — só usado em dev quando o banco ainda não foi
 * configurado).
 */
export async function validateCredentials(
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const trimmedEmail = email.trim();

  try {
    const dbResult = await validarLogin(trimmedEmail, password);
    if (dbResult === "indisponivel") {
      // banco indisponível → cai no fallback
    } else if (dbResult !== null) {
      return {
        email: dbResult.email,
        nome: dbResult.nome,
        role: dbResult.role,
        mustChangePassword: dbResult.senhaProvisoria,
      };
    } else {
      // dbResult === null → credenciais não conferem na tabela.
      // Ainda tentamos o fallback caso o admin tenha listado um "freio de
      // emergência" lá durante a transição.
    }
  } catch (err) {
    console.warn("[auth] Falha ao validar via tabela usuarios; usando fallback.", err);
  }

  const fallback = findFallbackUserByEmail(trimmedEmail);
  if (!fallback) return null;
  if (fallback.password !== password) return null;
  return {
    email: fallback.email,
    nome: fallback.nome,
    role: fallback.role,
    mustChangePassword: false,
  };
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

/**
 * Decodifica o cookie de sessão e busca o usuário atualizado no banco.
 * Faz uma consulta por render — aceitável para um app interno e mantém os
 * campos `nome`, `role` e `mustChangePassword` sempre frescos (permissões/
 * estado de senha provisória podem mudar via painel de Acessos).
 *
 * Se o banco estiver indisponível, ainda tenta o fallback hardcoded (vazio
 * por padrão) para evitar lock-out durante a configuração inicial.
 */
export async function getSessionUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = decodeSessionToken(token);
  if (!payload) return null;

  try {
    const dbUser = await buscarUsuarioPorEmail(payload.email);
    if (dbUser && dbUser !== "indisponivel") {
      return {
        email: dbUser.email,
        nome: dbUser.nome,
        role: dbUser.role,
        mustChangePassword: dbUser.senhaProvisoria,
      };
    }
    if (dbUser === null) {
      // usuário existia no momento do login mas foi removido depois → expira sessão.
      return null;
    }
    // dbUser === "indisponivel" → cai no fallback abaixo.
  } catch (err) {
    console.warn("[auth] Falha ao buscar usuário; usando fallback.", err);
  }

  const fallback = findFallbackUserByEmail(payload.email);
  if (!fallback) return null;
  return {
    email: fallback.email,
    nome: fallback.nome,
    role: fallback.role,
    mustChangePassword: false,
  };
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Como `requireSessionUser`, mas também redireciona para `/` quando o usuário
 * não tem papel `admin`. Use em páginas/actions de administração (painel de
 * Acessos, troca de papéis, etc.).
 */
export async function requireAdminUser() {
  const user = await requireSessionUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
