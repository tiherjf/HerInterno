export interface ChamadoSlaAlertaTicket {
  number: number | string;
  title: string;
  deadline: string | Date;
  requesterName?: string | null;
  pctElapsed: number; // % do prazo de SLA já consumido (>= 100 = estourado)
}

function layout(userName: string, intro: string, content: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:32px auto;">
    <tr><td>
      <div style="background:linear-gradient(135deg,#7c3aed,#2563eb);padding:24px 32px;border-radius:12px 12px 0 0;">
        <p style="margin:0;color:#e0e7ff;font-size:13px;font-weight:500;">Hospital Evandro Ribeiro</p>
        <h1 style="margin:4px 0 0;color:#fff;font-size:20px;font-weight:700;">Intranet — Chamados</h1>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
        <p style="margin:0 0 4px;font-size:15px;color:#111827;">Olá, <strong>${userName}</strong>!</p>
        <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">${intro}</p>
        ${content}
        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">Acesse a intranet para atender os chamados listados acima.</p>
      </div>
      <p style="text-align:center;font-size:11px;color:#9ca3af;margin:16px 0;">Hospital Evandro Ribeiro — Intranet Interna · Não responda este e-mail.</p>
    </td></tr>
  </table>
</body>
</html>`;
}

function formatDeadline(deadline: string | Date): string {
  const d = deadline instanceof Date ? deadline : new Date(deadline);
  if (isNaN(d.getTime())) return String(deadline);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * E-mail de alerta de SLA para o agente: lista os chamados com prazo prestes
 * a estourar (>= 75% do SLA consumido — âmbar) ou já estourado (vermelho).
 * Um único e-mail pode listar vários chamados do mesmo destinatário.
 */
export function chamadoSlaAlertaEmail(params: {
  recipientName: string;
  tickets: ChamadoSlaAlertaTicket[];
}): { subject: string; html: string } {
  const overdue = params.tickets.filter((t) => t.pctElapsed >= 100).length;
  const nearDue = params.tickets.length - overdue;

  const cards = params.tickets
    .map((t) => {
      const isOverdue = t.pctElapsed >= 100;
      const accent = isOverdue ? "#dc2626" : "#d97706"; // vermelho / âmbar
      const badgeBg = isOverdue ? "#fef2f2" : "#fffbeb";
      const badgeLabel = isOverdue
        ? "⛔ SLA estourado"
        : `⚠️ ${Math.min(99, Math.round(t.pctElapsed))}% do prazo consumido`;
      const requesterLine = t.requesterName
        ? `<p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Solicitante: ${t.requesterName}</p>`
        : "";

      return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-left:4px solid ${accent};border-radius:8px;margin-bottom:12px;">
      <tr><td style="padding:12px 16px;">
        <div style="display:inline-block;padding:2px 10px;background:${badgeBg};border:1px solid ${accent}40;border-radius:999px;margin-bottom:6px;">
          <span style="font-size:12px;font-weight:600;color:${accent};">${badgeLabel}</span>
        </div>
        <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Chamado #${t.number}</p>
        <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:500;">${t.title}</p>
        ${requesterLine}
        <p style="margin:6px 0 0;font-size:13px;color:${accent};font-weight:600;">Prazo: ${formatDeadline(t.deadline)}</p>
      </td></tr>
    </table>`;
    })
    .join("");

  const parts: string[] = [];
  if (overdue > 0) parts.push(`${overdue} com SLA estourado`);
  if (nearDue > 0) parts.push(`${nearDue} próximo${nearDue > 1 ? "s" : ""} de estourar`);
  const intro = `Você tem ${params.tickets.length === 1 ? "1 chamado" : `${params.tickets.length} chamados`} exigindo atenção: ${parts.join(" e ")}.`;

  const subject =
    overdue > 0
      ? `⛔ Alerta de SLA — ${params.tickets.length === 1 ? "chamado com prazo estourado" : `${params.tickets.length} chamados exigem atenção`}`
      : `⚠️ Alerta de SLA — ${params.tickets.length === 1 ? "chamado próximo do prazo" : `${params.tickets.length} chamados próximos do prazo`}`;

  return { subject, html: layout(params.recipientName, intro, cards) };
}
