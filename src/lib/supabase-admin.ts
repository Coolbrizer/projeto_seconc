import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

/**
 * Cliente Supabase com chave `service_role`. SOMENTE para uso no servidor:
 * essa chave ignora RLS e tem acesso total ao banco. Nunca expor ao browser.
 *
 * Retorna `null` quando a variável `SUPABASE_SERVICE_ROLE_KEY` (ou a URL)
 * não está configurada — o chamador decide se faz fallback ou exibe erro.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  cached =
    url && key
      ? createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;
  return cached;
}
