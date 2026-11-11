import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { getMenuForRole } from "@/lib/menu/server";
import { apiError } from "@/lib/api/error";
import type { StaffRole } from "@/lib/menu/types";
import {
  normalizeSearchTerm,
  searchGroupsForMenu,
  type SearchGroupKey,
  type SearchHit,
} from "@/lib/busca/query";

export const dynamic = "force-dynamic";

const PER_GROUP = 5;

type Supabase = ReturnType<typeof createClient>;

// Uma função por grupo; cada uma devolve no máximo PER_GROUP resultados.
// Usa o cliente do usuário, então as políticas de RLS continuam valendo.
const SEARCHERS: Record<SearchGroupKey, (db: Supabase, like: string, q: string) => Promise<SearchHit[]>> = {
  ramais: async (db, like, q) => {
    const { data, error } = await db
      .from("ramais")
      .select("id, numero, descricao, ramal_setores(name)")
      .eq("active", true)
      .or(`numero.ilike.${like},descricao.ilike.${like}`)
      .limit(PER_GROUP);
    if (error) throw error;
    return (data ?? []).map((r) => {
      const setor = (r.ramal_setores as unknown as { name: string } | null)?.name;
      return {
        group: "ramais" as const,
        id: r.id,
        title: `${r.numero}${r.descricao ? ` · ${r.descricao}` : ""}`,
        subtitle: setor,
        href: `/intranet/ramais?q=${encodeURIComponent(q)}`,
      };
    });
  },
  noticias: async (db, like) => {
    const { data, error } = await db
      .from("news")
      .select("id, title, category")
      .eq("status", "published")
      .or(`title.ilike.${like},summary.ilike.${like}`)
      .order("published_at", { ascending: false })
      .limit(PER_GROUP);
    if (error) throw error;
    return (data ?? []).map((n) => ({
      group: "noticias" as const,
      id: n.id,
      title: n.title,
      subtitle: n.category,
      href: `/intranet/noticias/${n.id}`,
    }));
  },
  "corpo-clinico": async (db, like, q) => {
    const { data, error } = await db
      .from("corpo_clinico")
      .select("id, nome, especialidade")
      .eq("ativo", true)
      .or(`nome.ilike.${like},especialidade.ilike.${like}`)
      .limit(PER_GROUP);
    if (error) throw error;
    return (data ?? []).map((p) => ({
      group: "corpo-clinico" as const,
      id: p.id,
      title: p.nome,
      subtitle: p.especialidade ?? undefined,
      href: `/intranet/corpo-clinico?q=${encodeURIComponent(q)}`,
    }));
  },
  procedimentos: async (db, like, q) => {
    const { data, error } = await db
      .from("procedimentos")
      .select("id, nome, categoria")
      .eq("ativo", true)
      .ilike("nome", like)
      .limit(PER_GROUP);
    if (error) throw error;
    return (data ?? []).map((p) => ({
      group: "procedimentos" as const,
      id: p.id,
      title: p.nome,
      subtitle: p.categoria ?? undefined,
      href: `/intranet/procedimentos?q=${encodeURIComponent(q)}`,
    }));
  },
  documentos: async (db, like, q) => {
    const { data, error } = await db
      .from("documents")
      .select("id, title, category")
      .ilike("title", like)
      .limit(PER_GROUP);
    if (error) throw error;
    return (data ?? []).map((d) => ({
      group: "documentos" as const,
      id: d.id,
      title: d.title,
      subtitle: d.category ?? undefined,
      href: `/intranet/documentos?q=${encodeURIComponent(q)}`,
    }));
  },
};

// GET /api/busca?q=termo → { hits: SearchHit[] }
export async function GET(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const q = normalizeSearchTerm(req.nextUrl.searchParams.get("q"));
    if (!q) return NextResponse.json({ hits: [] });

    const menu = await getMenuForRole(profile.role as StaffRole);
    const groups = searchGroupsForMenu(menu.map((m) => m.key));
    const db = createClient();
    const like = `%${q}%`;

    // Um grupo com erro (tabela ausente, RLS) vira lista vazia sem derrubar os outros
    const results = await Promise.all(
      groups.map((g) =>
        SEARCHERS[g](db, like, q).catch((err) => {
          console.error(`[busca:${g}]`, err);
          return [] as SearchHit[];
        })
      )
    );
    return NextResponse.json({ hits: results.flat() });
  } catch (err) {
    return apiError(err);
  }
}
