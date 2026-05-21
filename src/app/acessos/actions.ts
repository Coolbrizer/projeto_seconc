"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth";
import {
  criarUsuario,
  listarUsuarios,
  redefinirSenha,
  type Usuario,
  type UsuariosOpResult,
} from "@/lib/usuarios";

export type AcessosLoadResult =
  | { ok: true; usuarios: Usuario[] }
  | { ok: false; reason: "indisponivel" };

/**
 * Server action invocada pelo modal de Acessos para buscar a lista de usuários
 * cadastrados. Verifica sessão (toda server action é alcançável via POST
 * direto — sem essa checagem, qualquer um conseguiria os e-mails).
 */
export async function carregarUsuariosAction(): Promise<AcessosLoadResult> {
  await requireSessionUser();
  const usuarios = await listarUsuarios();
  if (usuarios === null) {
    return { ok: false, reason: "indisponivel" };
  }
  return { ok: true, usuarios };
}

export async function criarUsuarioAction(
  formData: FormData,
): Promise<UsuariosOpResult> {
  await requireSessionUser();
  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  if (!nome || !email) {
    return { ok: false, error: "desconhecido", message: "Nome e e-mail são obrigatórios." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "desconhecido", message: "E-mail inválido." };
  }
  const result = await criarUsuario(nome, email);
  if (result.ok) {
    revalidatePath("/");
  }
  return result;
}

export async function redefinirSenhaAction(
  email: string,
): Promise<UsuariosOpResult> {
  await requireSessionUser();
  if (!email) {
    return { ok: false, error: "desconhecido", message: "E-mail não informado." };
  }
  const result = await redefinirSenha(email);
  if (result.ok) {
    revalidatePath("/");
  }
  return result;
}
