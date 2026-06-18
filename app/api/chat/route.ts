import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getChatPermissions } from "@/lib/auth/staff";
import { createGLPITicket, getGLPITickets } from "@/lib/glpi";

const OPENCLAW_URL = process.env.OPENCLAW_URL || "http://127.0.0.1:18789";
const MODEL = "openai/gpt-5.5";

function buildSystemPrompt(
  role: string,
  fullName: string,
  permissions: ReturnType<typeof getChatPermissions>,
  extensions: string,
  knowledge: string
): string {
  const capabilities = [];
  if (permissions.queryExtensions) capabilities.push("- Consultar e informar ramais do hospital");
  if (permissions.answerHR) capabilities.push("- Responder dúvidas sobre RH (férias, ponto, benefícios, políticas)");
  if (permissions.answerIT) capabilities.push("- Fornecer suporte e informações de TI");
  if (permissions.openGLPITicket) capabilities.push("- Abrir chamados de suporte no GLPI");
  if (permissions.viewGLPITickets) capabilities.push("- Consultar status de chamados GLPI");
  if (permissions.answerTrainings) capabilities.push("- Informar sobre treinamentos disponíveis");
  if (permissions.manageUsers) capabilities.push("- Auxiliar no gerenciamento de usuários");
  capabilities.push("- Responder perguntas gerais de forma informativa");

  return `Você é o assistente virtual interno do Hospital Evandro Ribeiro, Juiz de Fora, MG.
Responda SEMPRE em português brasileiro.
Seja objetivo, profissional e cordial.

Usuário atual: ${fullName}
Perfil: ${role}
Unidade: Hospital Evandro Ribeiro

Suas capacidades para este usuário:
${capabilities.join("\n")}

${extensions ? `Lista de ramais principais:\n${extensions}\n` : ""}

${knowledge ? `Base de conhecimento RH/TI:\n${knowledge}\n` : ""}

Instruções especiais:
- Para abrir chamado GLPI: colete título, descrição e urgência (1=muito baixa, 2=baixa, 3=média, 4=alta, 5=muito alta) e responda com JSON no formato: {"action":"create_ticket","title":"...","description":"...","urgency":3}
- Para ver chamados: responda com JSON: {"action":"get_tickets"}
- Nunca invente informações médicas ou protocolos que você não conhece
- Para dúvidas específicas de pacientes ou prontuários, encaminhe ao setor competente`;
}

export async function POST(req: NextRequest) {
  try {
    // Validar autenticação Supabase
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Buscar perfil e permissões
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Perfil não encontrado" }, { status: 403 });
    }

    const permissions = getChatPermissions(profile.role);

    // Buscar ramais mais usados para contexto
    const { data: extensionsData } = await supabase
      .from("extensions")
      .select("name, sector, extension")
      .eq("active", true)
      .limit(20);

    const extensionsText = extensionsData
      ?.map((e) => `${e.name} (${e.sector}): ramal ${e.extension}`)
      .join("\n") || "";

    // Buscar base de conhecimento
    const { data: knowledgeData } = await supabase
      .from("chatbot_knowledge")
      .select("category, question, answer")
      .eq("active", true)
      .limit(30);

    const knowledgeText = knowledgeData
      ?.map((k) => `[${k.category.toUpperCase()}] P: ${k.question}\nR: ${k.answer}`)
      .join("\n\n") || "";

    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1]?.content || "";

    // Verificar se é ação GLPI
    const isGLPIAction =
      lastMessage.toLowerCase().includes("abrir chamado") ||
      lastMessage.toLowerCase().includes("criar ticket");
    const isViewTickets =
      lastMessage.toLowerCase().includes("ver chamado") ||
      lastMessage.toLowerCase().includes("meus chamados");

    // Construir system prompt
    const systemPrompt = buildSystemPrompt(
      profile.role,
      profile.full_name,
      permissions,
      extensionsText,
      knowledgeText
    );

    // Chamar OpenClaw com streaming
    const openClawResponse = await fetch(`${OPENCLAW_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        ],
      }),
    });

    if (!openClawResponse.ok) {
      return NextResponse.json(
        { error: "Erro ao conectar com o assistente IA" },
        { status: 502 }
      );
    }

    // Log de atividade
    await supabase.from("activity_logs").insert({
      user_id: user.id,
      user_type: "staff",
      action: "chat_message",
      module: "assistente",
      metadata: { role: profile.role, message_count: messages.length },
    });

    // Fazer streaming para o cliente
    const stream = new ReadableStream({
      async start(controller) {
        const reader = openClawResponse.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
              controller.enqueue(new TextEncoder().encode(trimmed + "\n"));
            }
          }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
