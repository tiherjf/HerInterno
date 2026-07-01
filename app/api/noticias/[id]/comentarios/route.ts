import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireStaff();
    const supabase = createClient();
    const { data, error } = await supabase
      .from("news_comments")
      .select("id, author_name, content, created_at, author_id")
      .eq("news_id", params.id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ comments: data ?? [] });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const { content } = await req.json();
    if (!content?.trim() || content.trim().length > 1000) {
      return NextResponse.json({ error: "Comentário inválido (1-1000 caracteres)" }, { status: 400 });
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("news_comments")
      .insert({
        news_id: params.id,
        author_id: profile.id,
        author_name: profile.full_name,
        content: content.trim(),
      })
      .select("id, author_name, content, created_at, author_id")
      .single();

    if (error) throw error;
    return NextResponse.json({ comment: data }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const profile = await requireStaff();
    const { commentId } = await req.json();
    if (!commentId) return NextResponse.json({ error: "commentId obrigatório" }, { status: 400 });

    const isAdminOrTi = ["admin", "ti"].includes(profile.role);
    const supabase = isAdminOrTi ? createServiceClient() : createClient();

    const { error } = await supabase
      .from("news_comments")
      .delete()
      .eq("id", commentId)
      .eq("news_id", params.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
