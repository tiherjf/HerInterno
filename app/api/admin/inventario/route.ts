import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const supabase = createServiceClient();
    const url = new URL(req.url);
    const search = url.searchParams.get("q") ?? "";
    const status = url.searchParams.get("status") ?? "";
    const type = url.searchParams.get("type") ?? "";

    let query = supabase
      .from("asset_inventory")
      .select(`
        id, name, asset_type, brand, model, serial_number, asset_tag,
        location, status, purchase_date, warranty_expiry,
        operating_system, ip_address, notes, created_at, updated_at,
        purchase_value, useful_life_months,
        assigned:profiles!assigned_to(id, full_name, sector)
      `)
      .order("name");

    if (search) query = query.or(`name.ilike.%${search}%,brand.ilike.%${search}%,model.ilike.%${search}%,serial_number.ilike.%${search}%,asset_tag.ilike.%${search}%,location.ilike.%${search}%`);
    if (status) query = query.eq("status", status);
    if (type) query = query.eq("asset_type", type);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ assets: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireStaff();
    if (!["admin", "ti"].includes(profile.role)) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const body = await req.json();
    const {
      name, asset_type, brand, model, serial_number, asset_tag,
      location, assigned_to, status, purchase_date, warranty_expiry,
      operating_system, ip_address, notes, purchase_value, useful_life_months,
    } = body;

    if (!name?.trim() || !asset_type?.trim()) {
      return NextResponse.json({ error: "Nome e tipo são obrigatórios" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("asset_inventory")
      .insert({
        name: name.trim(),
        asset_type: asset_type.trim(),
        brand: brand || null,
        model: model || null,
        serial_number: serial_number || null,
        asset_tag: asset_tag || null,
        location: location || null,
        assigned_to: assigned_to || null,
        status: status || "active",
        purchase_date: purchase_date || null,
        warranty_expiry: warranty_expiry || null,
        operating_system: operating_system || null,
        ip_address: ip_address || null,
        notes: notes || null,
        purchase_value: purchase_value ? Number(purchase_value) : null,
        useful_life_months: useful_life_months ? Number(useful_life_months) : 60,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, asset: data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
