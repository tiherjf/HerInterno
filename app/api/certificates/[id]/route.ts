import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { userId, score } = await req.json();

    // Verificar que o usuário só gera o próprio certificado
    if (userId !== user.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const serviceClient = createServiceClient();

    // Buscar dados do treinamento e do usuário
    const [{ data: training }, { data: profile }] = await Promise.all([
      serviceClient.from("trainings").select("title, workload_hours").eq("id", params.id).single(),
      serviceClient.from("profiles").select("full_name").eq("id", userId).single(),
    ]);

    if (!training || !profile) {
      return NextResponse.json({ error: "Dados não encontrados" }, { status: 404 });
    }

    // Gerar PDF com pdf-lib
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([841.89, 595.28]); // A4 landscape
    const { width, height } = page.getSize();

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const primaryBlue = rgb(0.118, 0.251, 0.686); // #1e40af
    const darkGray = rgb(0.2, 0.2, 0.2);
    const medGray = rgb(0.5, 0.5, 0.5);
    const gold = rgb(0.8, 0.65, 0.1);

    // Borda decorativa
    page.drawRectangle({
      x: 20,
      y: 20,
      width: width - 40,
      height: height - 40,
      borderColor: primaryBlue,
      borderWidth: 3,
    });
    page.drawRectangle({
      x: 28,
      y: 28,
      width: width - 56,
      height: height - 56,
      borderColor: gold,
      borderWidth: 1,
    });

    // Cabeçalho
    page.drawText("HOSPITAL EVANDRO RIBEIRO", {
      x: width / 2 - 200,
      y: height - 90,
      size: 22,
      font: fontBold,
      color: primaryBlue,
    });
    page.drawText("Juiz de Fora, Minas Gerais", {
      x: width / 2 - 100,
      y: height - 115,
      size: 13,
      font: fontRegular,
      color: medGray,
    });

    // Linha separadora
    page.drawLine({
      start: { x: 60, y: height - 130 },
      end: { x: width - 60, y: height - 130 },
      thickness: 1,
      color: gold,
    });

    // Título do certificado
    page.drawText("CERTIFICADO DE CONCLUSÃO", {
      x: width / 2 - 175,
      y: height - 185,
      size: 24,
      font: fontBold,
      color: darkGray,
    });

    // Texto principal
    page.drawText("Certificamos que", {
      x: width / 2 - 65,
      y: height - 240,
      size: 14,
      font: fontRegular,
      color: darkGray,
    });

    const nameWidth = fontBold.widthOfTextAtSize(profile.full_name, 28);
    page.drawText(profile.full_name, {
      x: (width - nameWidth) / 2,
      y: height - 280,
      size: 28,
      font: fontBold,
      color: primaryBlue,
    });

    page.drawText("concluiu com êxito o treinamento", {
      x: width / 2 - 130,
      y: height - 315,
      size: 14,
      font: fontRegular,
      color: darkGray,
    });

    const trainingWidth = fontBold.widthOfTextAtSize(training.title, 18);
    page.drawText(training.title, {
      x: (width - trainingWidth) / 2,
      y: height - 350,
      size: 18,
      font: fontBold,
      color: darkGray,
    });

    // Informações adicionais
    const completionDate = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    page.drawText(
      `Carga horária: ${training.workload_hours}h  |  Nota obtida: ${score}%  |  Concluído em: ${completionDate}`,
      {
        x: width / 2 - 240,
        y: height - 400,
        size: 12,
        font: fontRegular,
        color: medGray,
      }
    );

    // Linha de assinatura
    page.drawLine({
      start: { x: width / 2 - 120, y: height - 450 },
      end: { x: width / 2 + 120, y: height - 450 },
      thickness: 1,
      color: darkGray,
    });
    page.drawText("Direção — Hospital Evandro Ribeiro", {
      x: width / 2 - 130,
      y: height - 470,
      size: 11,
      font: fontItalic,
      color: medGray,
    });

    // Rodapé
    page.drawText("Documento emitido eletronicamente pelo Sistema Intranet HER", {
      x: width / 2 - 190,
      y: 50,
      size: 9,
      font: fontRegular,
      color: medGray,
    });

    const pdfBytes = await pdfDoc.save();

    // Salvar no Supabase Storage
    const filename = `certificates/${userId}/${params.id}_${Date.now()}.pdf`;
    await serviceClient.storage
      .from("certificates")
      .upload(filename, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    const { data: publicUrl } = serviceClient.storage
      .from("certificates")
      .getPublicUrl(filename);

    return NextResponse.json({ url: publicUrl.publicUrl });
  } catch (error) {
    console.error("Certificate generation error:", error);
    return NextResponse.json({ error: "Erro ao gerar certificado" }, { status: 500 });
  }
}
