const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  open: { label: "Aberto", color: "#2563eb", icon: "📩" },
  in_progress: { label: "Em Atendimento", color: "#d97706", icon: "🔧" },
  resolved: { label: "Resolvido", color: "#16a34a", icon: "✅" },
  closed: { label: "Encerrado", color: "#6b7280", icon: "🔒" },
  cancelled: { label: "Cancelado", color: "#dc2626", icon: "🚫" },
};

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
        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">Acesse a intranet para ver os detalhes completos do chamado.</p>
      </div>
      <p style="text-align:center;font-size:11px;color:#9ca3af;margin:16px 0;">Hospital Evandro Ribeiro — Intranet Interna · Não responda este e-mail.</p>
    </td></tr>
  </table>
</body>
</html>`;
}

export function chamadoStatusEmail(params: {
  userName: string;
  ticketNumber: number | string;
  ticketTitle: string;
  newStatus: string;
  solution?: string | null;
}): { subject: string; html: string } {
  const meta = STATUS_META[params.newStatus] ?? { label: params.newStatus, color: "#6b7280", icon: "ℹ️" };

  const solutionBlock = params.solution
    ? `<div style="margin-top:16px;padding:12px 16px;background:#f3f4f6;border-left:4px solid ${meta.color};border-radius:4px;">
         <p style="margin:0;font-size:13px;color:#374151;"><strong>Solução:</strong> ${params.solution}</p>
       </div>`
    : "";

  const content = `
    <div style="display:inline-block;padding:6px 14px;background:${meta.color}18;border:1px solid ${meta.color}40;border-radius:999px;margin-bottom:20px;">
      <span style="font-size:13px;font-weight:600;color:${meta.color};">${meta.icon} ${meta.label}</span>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
      <tr><td style="padding:12px 16px;">
        <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Chamado #${params.ticketNumber}</p>
        <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:500;">${params.ticketTitle}</p>
      </td></tr>
    </table>
    ${solutionBlock}`;

  return {
    subject: `${meta.icon} Chamado #${params.ticketNumber} — ${meta.label}`,
    html: layout(params.userName, "O status do seu chamado foi atualizado.", content),
  };
}

export function chamadoComentarioEmail(params: {
  userName: string;
  ticketNumber: number | string;
  ticketTitle: string;
  authorName: string;
  comment: string;
}): { subject: string; html: string } {
  const content = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px;">
      <tr><td style="padding:12px 16px;">
        <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Chamado #${params.ticketNumber}</p>
        <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:500;">${params.ticketTitle}</p>
      </td></tr>
    </table>
    <div style="padding:12px 16px;background:#eff6ff;border-left:4px solid #2563eb;border-radius:4px;">
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;"><strong>${params.authorName}</strong> respondeu:</p>
      <p style="margin:0;font-size:13px;color:#374151;white-space:pre-wrap;">${params.comment}</p>
    </div>`;

  return {
    subject: `💬 Nova resposta no chamado #${params.ticketNumber}`,
    html: layout(params.userName, "Seu chamado recebeu uma nova resposta.", content),
  };
}
