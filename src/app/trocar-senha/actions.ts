"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSessionUser } from "@/lib/auth";
import { SENHA_MIN_LENGTH, SENHA_PROVISORIA, trocarSenha } from "@/lib/usuarios";

export type TrocarSenhaActionState = {
  error?: string;
};

export async function trocarSenhaAction(
  _prevState: TrocarSenhaActionState,
  formData: FormData,
): Promise<TrocarSenhaActionState> {
  const user = await requireSessionUser();

  const novaSenha = String(formData.get("nova_senha") ?? "");
  const confirmar = String(formData.get("confirmar_senha") ?? "");

  if (!novaSenha || !confirmar) {
    return { error: "Preencha os dois campos de senha." };
  }
  if (novaSenha.length < SENHA_MIN_LENGTH) {
    return {
      error: `A nova senha precisa ter pelo menos ${SENHA_MIN_LENGTH} caracteres.`,
    };
  }
  if (novaSenha === SENHA_PROVISORIA) {
    return {
      error:
        "A nova senha não pode ser a senha provisória. Escolha uma senha pessoal.",
    };
  }
  if (novaSenha !== confirmar) {
    return { error: "As duas senhas não conferem." };
  }

  const result = await trocarSenha(user.email, novaSenha);
  if (!result.ok) {
    return {
      error:
        result.error === "indisponivel"
          ? "Banco indisponível. Aplique o schema e configure SUPABASE_SERVICE_ROLE_KEY."
          : result.error === "nao_encontrado"
            ? "Usuário não encontrado no banco."
            : (result.message ?? "Erro ao trocar a senha."),
    };
  }

  // O `mustChangePassword` é derivado da tabela; revalidar a home garante
  // que o próximo render dela leia o novo estado (`senha_provisoria = false`).
  revalidatePath("/");
  redirect("/");
}
