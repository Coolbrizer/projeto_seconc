import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  createdAt: string;
};

/** Resultado possível para criação/redefinição de senha. */
export type UsuariosOpResult =
  | { ok: true }
  | { ok: false; error: "indisponivel" | "duplicado" | "nao_encontrado" | "desconhecido"; message?: string };

/**
 * Senha provisória aplicada tanto na criação de novos usuários quanto no reset
 * pelo painel "Acessos". Mantida aqui para haver uma única fonte da verdade.
 */
export const SENHA_PROVISORIA = "123456";

function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const obj = err as Record<string, unknown>;
  const code = typeof obj.code === "string" ? obj.code : "";
  const msg = typeof obj.message === "string" ? obj.message : "";
  // 42P01 = undefined_table; 42883 = undefined_function
  return code === "42P01" || code === "42883" || /relation .* does not exist/i.test(msg) || /function .* does not exist/i.test(msg);
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const obj = err as Record<string, unknown>;
  return obj.code === "23505";
}

/**
 * Lista todos os usuários cadastrados, ordenados por e-mail.
 * Retorna `null` se o cliente admin não estiver configurado ou a tabela
 * ainda não existir — assim o chamador pode exibir uma mensagem específica.
 */
export async function listarUsuarios(): Promise<Usuario[] | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from("usuarios")
    .select("id, nome, email, created_at")
    .order("email", { ascending: true });
  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  return (data ?? []).map((row) => ({
    id: row.id as string,
    nome: row.nome as string,
    email: row.email as string,
    createdAt: row.created_at as string,
  }));
}

/** Cria um usuário com a senha provisória padrão. */
export async function criarUsuario(
  nome: string,
  email: string,
): Promise<UsuariosOpResult> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return { ok: false, error: "indisponivel", message: "Cliente admin do Supabase não configurado." };
  }
  const { error } = await admin.rpc("usuarios_criar", {
    p_nome: nome.trim(),
    p_email: email.trim().toLowerCase(),
    p_senha: SENHA_PROVISORIA,
  });
  if (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "duplicado", message: "Já existe um usuário com este e-mail." };
    }
    if (isMissingTableError(error)) {
      return { ok: false, error: "indisponivel", message: "Tabela `usuarios` ou função RPC não encontrada no banco." };
    }
    return { ok: false, error: "desconhecido", message: error.message };
  }
  return { ok: true };
}

/** Reseta a senha de um usuário para a senha provisória padrão. */
export async function redefinirSenha(email: string): Promise<UsuariosOpResult> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return { ok: false, error: "indisponivel", message: "Cliente admin do Supabase não configurado." };
  }
  const { data, error } = await admin.rpc("usuarios_redefinir_senha", {
    p_email: email.trim().toLowerCase(),
    p_nova_senha: SENHA_PROVISORIA,
  });
  if (error) {
    if (isMissingTableError(error)) {
      return { ok: false, error: "indisponivel", message: "Tabela `usuarios` ou função RPC não encontrada no banco." };
    }
    return { ok: false, error: "desconhecido", message: error.message };
  }
  if (data === false) {
    return { ok: false, error: "nao_encontrado", message: "Usuário não encontrado." };
  }
  return { ok: true };
}

/**
 * Valida credenciais consultando a tabela `usuarios` (via RPC com `crypt()`).
 * - Retorna o usuário quando válido.
 * - Retorna `null` quando o e-mail/senha não bate.
 * - Retorna `"indisponivel"` quando a tabela ou o cliente admin não estão
 *   disponíveis — o chamador pode então recorrer ao fallback hardcoded.
 */
export async function validarLogin(
  email: string,
  senha: string,
): Promise<Usuario | null | "indisponivel"> {
  const admin = getSupabaseAdmin();
  if (!admin) return "indisponivel";
  const { data, error } = await admin.rpc("usuarios_validar_login", {
    p_email: email.trim(),
    p_senha: senha,
  });
  if (error) {
    if (isMissingTableError(error)) return "indisponivel";
    throw error;
  }
  if (!Array.isArray(data) || data.length === 0) return null;
  const row = data[0] as { id: string; nome: string; email: string };
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    createdAt: "",
  };
}
