import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

export async function GET(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const svc = createServiceClient();
    const url = new URL(req.url);
    const docType = url.searchParams.get("type");
    const status = url.searchParams.get("status");

    let query = svc
      .from("quality_documents")
      .select(`
        id, code, title, doc_type, category, version, status,
        requires_reading, valid_from, valid_until, file_url,
        published_at, created_at, updated_at,
        creator:created_by(full_name),
        approver:approved_by(full_name)
      `)
      .order("doc_type")
      .order("title");

    if (docType) query = query.eq("doc_type", docType);
    if (status) query = query.eq("status", status);
    else query = query.neq("status", "obsoleto"); // hide obsolete by default

    const { data: docs, error } = await query;
    if (error) throw error;

    // Check which docs current user has confirmed reading
    if (docs && docs.length > 0) {
      const ids = docs.map((d: { id: string }) => d.id);
      const { data: reads } = await svc
        .from("quality_document_reads")
        .select("document_id")
        .eq("user_id", profile.id)
        .in("document_id", ids);
      const readSet = new Set((reads ?? []).map((r: { document_id: string }) => r.document_id));
      const result = docs.map((d: { id: string }) => ({ ...d, user_has_read: readSet.has(d.id) }));
      return NextResponse.json({ documents: result });
    }

    return NextResponse.json({ documents: docs ?? [] });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti", "rh"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    const svc = createServiceClient();
    const body = await req.json();
    const { code, title, doc_type, category, content, file_url, requires_reading, valid_from, valid_until } = body;

    if (!title?.trim() || !doc_type) {
      return NextResponse.json({ error: "Título e tipo são obrigatórios" }, { status: 400 });
    }

    const { data, error } = await svc
      .from("quality_documents")
      .insert({
        code: code?.trim() || null,
        title: title.trim(),
        doc_type,
        category: category?.trim() || null,
        content: content?.trim() || null,
        file_url: file_url?.trim() || null,
        requires_reading: requires_reading === true,
        valid_from: valid_from || null,
        valid_until: valid_until || null,
        status: "rascunho",
        version: "1.0",
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, document: data }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
