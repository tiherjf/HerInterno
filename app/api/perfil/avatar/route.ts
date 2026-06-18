import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    const formData = await req.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    if (file.size > 2 * 1024 * 1024)
      return NextResponse.json({ error: "Imagem muito grande (máx 2MB)" }, { status: 400 });

    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
    const path = `${profile.id}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const supabase = createServiceClient();
    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, buffer, { contentType: file.type, upsert: true });

    if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    // Bust cache with timestamp query param
    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", profile.id);

    return NextResponse.json({ avatar_url: avatarUrl });
  } catch (err) {
    return NextResponse.json({ error: "Erro ao fazer upload" }, { status: 500 });
  }
}
