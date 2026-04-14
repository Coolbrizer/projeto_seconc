"use server";

import { redirect } from "next/navigation";
import { createSession, validateCredentials } from "@/lib/auth";

export type LoginActionState = {
  error?: string;
};

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const user = validateCredentials(email, password);
  if (!user) {
    return { error: "Credenciais inválidas." };
  }

  await createSession(user.email);
  redirect("/");
}
