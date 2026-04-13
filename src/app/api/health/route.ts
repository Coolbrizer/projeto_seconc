import { getSupabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

/**
 * GET /api/health — diagnóstico: o servidor consegue ler o Supabase com as env atuais?
 * Não expõe chaves. Remova ou restrinja se não quiser URL pública.
 */
export async function GET() {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const hasKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
  const supabase = getSupabase();

  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        step: "client",
        hasUrl,
        hasKey,
        message: "Cliente Supabase não criado (faltam URL ou anon key nas variáveis de ambiente).",
      },
      { status: 200 },
    );
  }

  const { data, error } = await supabase.from("pgto_uf_2025").select("*").limit(2);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        step: "query",
        hasUrl,
        hasKey,
        supabaseError: error.message,
        code: error.code,
      },
      { status: 200 },
    );
  }

  const first = data?.[0] as Record<string, unknown> | undefined;
  const keys = first ? Object.keys(first) : [];

  return NextResponse.json({
    ok: true,
    step: "ok",
    rowsSample: data?.length ?? 0,
    columnKeys: keys.slice(0, 15),
    hasUfKey: keys.some((k) => k.toLowerCase() === "uf"),
  });
}
