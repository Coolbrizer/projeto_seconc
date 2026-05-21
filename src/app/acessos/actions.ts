"use server";

import { revalidatePath } from "next/cache";

import { requireAdminUser } from "@/lib/auth";
import {
  criarUsuario,
  listarUsuarios,
  redefinirSenha,
  type Usuario,
  type UsuarioRole,
  type UsuariosOpResult,
} from "@/lib/usuarios";

export type AcessosLoadResult =
  | { ok: true; usuarios: Usuario[] }
  | { ok: false; reason: "indisponivel" };

function normalizeRole(value: unknown): UsuarioRole {
  return value === "admin" ? "admin" : "gestor";
}

/**
 * Server action invocada pelo modal de Acessos para buscar a lista de usuários
 * cadastrados. Server Actions são alcançáveis via POST direto — sem a checagem
 * `requireAdminUser`, qualquer um conseguiria os e-mails / papéis cadastrados.
 */
export async function carregarUsuariosAction(): Promise<AcessosLoadResult> {
  await requireAdminUser();
  const usuarios = await listarUsuarios();
  if (usuarios === null) {
    return { ok: false, reason: "indisponivel" };
  }
  return { ok: true, usuarios };
}

export async function criarUsuarioAction(
  formData: FormData,
): Promise<UsuariosOpResult> {
  await requireAdminUser();
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const role = normalizeRole(formData.get("role"));
  if (!nome || !email) {
    return {
      ok: false,
      error: "desconhecido",
      message: "Nome e e-mail são obrigatórios.",
    };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "desconhecido", message: "E-mail inválido." };
  }
  const result = await criarUsuario(nome, email, role);
  if (result.ok) {
    revalidatePath("/");
  }
  return result;
}

export async function redefinirSenhaAction(
  email: string,
): Promise<UsuariosOpResult> {
  await requireAdminUser();
  if (!email) {
    return { ok: false, error: "desconhecido", message: "E-mail não informado." };
  }
  const result = await redefinirSenha(email);
  if (result.ok) {
    revalidatePath("/");
  }
  return result;
}
