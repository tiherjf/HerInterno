import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getChatPermissions } from "@/lib/auth/staff";

const OPENCLAW_URL = process.env.OPENCLAW_URL || "http://127.0.0.1:18789";
const MODEL = "openai/gpt-5.5";
const UPSTREAM_TIMEOUT_MS = 30000;

// Stopwords em português (palavras com mais de 3 letras que não agregam na busca)
const STOPWORDS = new Set([
  "como", "para", "qual", "quais", "onde", "quando", "quem", "porque", "porquê",
  "você", "voce", "vocês", "voces", "sobre", "este", "esta", "isto", "esse",
  "essa", "isso", "aquele", "aquela", "aquilo", "aqui", "mais", "menos",
  "muito", "muita", "pouco", "pouca", "tenho", "quero", "queria", "preciso",
  "precisa", "gostaria", "fazer", "pode", "poderia", "favor", "olá", "bom",
  "boa", "dia", "tarde", "noite", "obrigado", "obrigada", "também", "tambem",
  "então", "entao", "está", "esta", "estou", "estão", "seria", "seja", "ser",
  "tem", "ter", "meu", "minha", "meus", "minhas", "seu", "sua", "seus", "suas",
  "com", "sem", "uma", "umas", "uns", "dos", "das", "nos", "nas", "pelo",
  "pela", "que", "não", "nao", "sim", "por", "hospital", "saber", "dizer",
  "informar", "existe", "possui", "temos", "algum", "alguma", "alguém",
]);

// Extrai palavras-chave da mensagem: minúsculas, sem pontuação, >3 chars, sem stopwords
function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[%(),.;:!?"'`{}\[\]]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  return Array.from(new Set(words)).slice(0, 6);
}

// Monta expressão OR do PostgREST com ilike sobre as colunas informadas
function buildIlikeOr(keywords: string[], columns: string[]): string {
  return keywords
    .flatMap((k) => columns.map((c) => `${c}.ilike.%${k}%`))
    .join(",");
}

function buildSystemPrompt(
  role: string,
  fullName: string,
  permissions: ReturnType<typeof getChatPermissions>,
  relevantContext: string
): string {
  const capabilities = [];
  if (permissions.queryExtensions) capabilities.push("- Consultar e informar ramais do hospital");
  if (permissions.answerHR) capabilities.push("- Responder dúvidas sobre RH (férias, ponto, benefícios, políticas)");
  if (permissions.answerIT) capabilities.push("- Fornecer suporte e informações de TI");
  if (permissions.openGLPITicket) capabilities.push("- Abrir chamados internos (TI, manutenção ou marketing)");
  if (permissions.answerTrainings) capabilities.push("- Informar sobre treinamentos disponíveis");
  if (permissions.manageUsers) capabilities.push("- Auxiliar no gerenciamento de usuários");
  capabilities.push("- Indicar documentos da Base de Documentos e da Qualidade");
  capabilities.push("- Responder perguntas gerais de forma informativa");

  const ticketInstructions = permissions.openGLPITicket
    ? `
Abertura de chamados internos:
- Quando o usuário quiser abrir um chamado (TI, manutenção ou marketing), confirme o entendimento na resposta e acrescente AO FINAL da resposta um bloco cercado EXATAMENTE neste formato (sem texto depois dele):
\`\`\`action
{"type":"create_ticket","team":"ti","title":"...","description":"...","priority":"medium"}
\`\`\`
- Campos obrigatórios: type sempre "create_ticket"; team é "ti", "manutencao" ou "marketing"; title curto e claro; description detalhada; priority é "low", "medium" ou "high".
- Para chamados de MANUTENÇÃO, pergunte primeiro a localização do problema (setor/sala) e inclua o campo adicional "location" no JSON.
- Se faltar informação essencial (o que aconteceu, onde), pergunte antes de gerar o bloco.
- O bloco NÃO abre o chamado sozinho: o sistema exibirá um cartão de confirmação para o usuário. NUNCA afirme que o chamado já foi aberto.`
    : "";

  return `Você é o assistente virtual interno do Hospital Evandro Ribeiro, Juiz de Fora, MG.
Responda SEMPRE em português brasileiro.
Seja objetivo, profissional e cordial. Use Markdown simples (negrito, listas) quando ajudar na leitura.

Usuário atual: ${fullName}
Perfil: ${role}
Unidade: Hospital Evandro Ribeiro

Suas capacidades para este usuário:
${capabilities.join("\n")}

${relevantContext ? `Contexto relevante (use estas informações e cite as fontes pelo nome quando responder):\n${relevantContext}\n` : ""}
${ticketInstructions}

Instruções gerais:
- Se o contexto relevante não cobrir a pergunta, diga que não encontrou a informação e sugira o setor ou documento adequado — nunca invente.
- Nunca invente informações médicas ou protocolos que você não conhece.
- Para dúvidas específicas de pacientes ou prontuários, encaminhe ao setor competente.`;
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

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Mensagens inválidas" }, { status: 400 });
    }

    const lastUserMessage: string =
      [...messages].reverse().find((m: { role: string }) => m.role === "user")?.content || "";
    const keywords = extractKeywords(lastUserMessage);

    // ─── RAG-lite: buscar contexto relevante conforme palavras-chave ───────
    const contextParts: string[] = [];

    // Documentos da Base de Documentos (título ou tags)
    const documentsPromise = keywords.length
      ? supabase
          .from("documents")
          .select("title, category, sector")
          .eq("active", true)
          .or(
            [
              buildIlikeOr(keywords, ["title"]),
              ...keywords.map((k) => `tags.cs.{${k}}`),
            ].join(",")
          )
          .limit(5)
      : Promise.resolve({ data: null });

    // Documentos da Qualidade publicados (título ou código)
    const qualityPromise = keywords.length
      ? supabase
          .from("quality_documents")
          .select("code, title, doc_type, category")
          .eq("status", "publicado")
          .or(buildIlikeOr(keywords, ["title", "code"]))
          .limit(5)
      : Promise.resolve({ data: null });

    // Base de conhecimento: filtrada por relevância (colunas: category, question, answer)
    const knowledgeBase = supabase
      .from("chatbot_knowledge")
      .select("category, question, answer")
      .eq("active", true);
    const knowledgePromise = keywords.length
      ? knowledgeBase.or(buildIlikeOr(keywords, ["question", "answer", "category"])).limit(8)
      : knowledgeBase.limit(8);

    // Ramais: só injeta se a mensagem menciona ramal/telefone/setor/contato
    const mentionsExtension = /ramal|ramais|telefone|contato|ligar|setor/i.test(lastUserMessage);
    const extensionsPromise =
      mentionsExtension && permissions.queryExtensions
        ? (keywords.length
            ? supabase
                .from("extensions")
                .select("name, sector, extension")
                .eq("active", true)
                .or(buildIlikeOr(keywords, ["name", "sector"]))
                .limit(20)
            : supabase
                .from("extensions")
                .select("name, sector, extension")
                .eq("active", true)
                .limit(20))
        : Promise.resolve({ data: null });

    const [documentsRes, qualityRes, knowledgeRes, extensionsRes] = await Promise.all([
      documentsPromise,
      qualityPromise,
      knowledgePromise,
      extensionsPromise,
    ]);

    if (documentsRes.data?.length) {
      contextParts.push(
        "Documentos internos (o arquivo está disponível na Base de Documentos da intranet):\n" +
          documentsRes.data
            .map(
              (d) =>
                `- "${d.title}" (${d.category || "Documento"}${d.sector ? `, setor ${d.sector}` : ""})`
            )
            .join("\n")
      );
    }

    if (qualityRes.data?.length) {
      contextParts.push(
        "Documentos da Qualidade publicados (disponíveis no módulo Qualidade da intranet):\n" +
          qualityRes.data
            .map(
              (q) =>
                `- ${q.code ? `[${q.code}] ` : ""}"${q.title}" (${q.doc_type}${q.category ? `, ${q.category}` : ""})`
            )
            .join("\n")
      );
    }

    if (knowledgeRes.data?.length) {
      contextParts.push(
        "Base de conhecimento interna (perguntas e respostas oficiais):\n" +
          knowledgeRes.data
            .map((k) => `[${k.category.toUpperCase()}] P: ${k.question}\nR: ${k.answer}`)
            .join("\n\n")
      );
    }

    // Fallback: mensagem menciona ramal mas o filtro por palavra-chave não achou nada
    let extensionsData = extensionsRes.data;
    if (mentionsExtension && permissions.queryExtensions && !extensionsData?.length && keywords.length) {
      const { data: fallback } = await supabase
        .from("extensions")
        .select("name, sector, extension")
        .eq("active", true)
        .limit(20);
      extensionsData = fallback;
    }

    if (extensionsData?.length) {
      contextParts.push(
        "Ramais do hospital (fonte: lista de ramais da intranet):\n" +
          extensionsData
            .map((e) => `- ${e.name} (${e.sector}): ramal ${e.extension}`)
            .join("\n")
      );
    }

    // Construir system prompt
    const systemPrompt = buildSystemPrompt(
      profile.role,
      profile.full_name,
      permissions,
      contextParts.join("\n\n")
    );

    // Chamar OpenClaw com streaming (timeout de conexão de 30s)
    const abortController = new AbortController();
    const connectTimer = setTimeout(() => abortController.abort(), UPSTREAM_TIMEOUT_MS);

    let openClawResponse: Response;
    try {
      openClawResponse = await fetch(`${OPENCLAW_URL}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
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
    } catch {
      clearTimeout(connectTimer);
      return NextResponse.json(
        { error: "O assistente IA está indisponível no momento. Tente novamente em instantes." },
        { status: 504 }
      );
    }
    clearTimeout(connectTimer);

    if (!openClawResponse.ok || !openClawResponse.body) {
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

        try {
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
        } catch {
          // Conexão com upstream interrompida: encerra o stream normalmente
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
