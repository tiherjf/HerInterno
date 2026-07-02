const STATUS_META: Record<string, { label: string; color: string; icon: string; body: string }> = {
  manager_approved: {
    label: "Aprovada pelo Gestor",
    color: "#2563eb",
    icon: "✅",
    body: "Sua justificativa foi <strong>aprovada pelo gestor</strong> e aguarda a revisão final do RH.",
  },
  manager_rejected: {
    label: "Recusada pelo Gestor",
    color: "#dc2626",
    icon: "❌",
    body: "Sua justificativa foi <strong>recusada pelo gestor</strong>.",
  },
  approved: {
    label: "Aprovada pelo RH",
    color: "#16a34a",
    icon: "✅",
    body: "Sua justificativa foi <strong>aprovada pelo RH</strong> e está concluída.",
  },
  rejected: {
    label: "Recusada pelo RH",
    color: "#dc2626",
    icon: "❌",
    body: "Sua justificativa foi <strong>recusada pelo RH</strong>.",
  },
};

export function pontoStatusEmail(params: {
  userName: string;
  typeName: string;
  occurrenceDate: string;
  newStatus: string;
  observation?: string | null;
}): { subject: string; html: string } {
  const meta = STATUS_META[params.newStatus] ?? {
    label: params.newStatus,
    color: "#6b7280",
    icon: "ℹ️",
    body: "O status da sua justificativa foi atualizado.",
  };

  const formattedDate = new Date(params.occurrenceDate + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const observationBlock = params.observation
    ? `<div style="margin-top:16px;padding:12px 16px;background:#f3f4f6;border-left:4px solid ${meta.color};border-radius:4px;">
         <p style="margin:0;font-size:13px;color:#374151;"><strong>Observação:</strong> ${params.observation}</p>
       </div>`
    : "";

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:32px auto;">
    <tr><td>
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#7c3aed,#2563eb);padding:24px 32px;border-radius:12px 12px 0 0;">
        <p style="margin:0;color:#e0e7ff;font-size:13px;font-weight:500;">Hospital Evandro Ribeiro</p>
        <h1 style="margin:4px 0 0;color:#fff;font-size:20px;font-weight:700;">Intranet — Ponto</h1>
      </div>
      <!-- Body -->
      <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
        <p style="margin:0 0 4px;font-size:15px;color:#111827;">Olá, <strong>${params.userName}</strong>!</p>
        <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">Sua justificativa de ponto foi atualizada.</p>

        <!-- Status badge -->
        <div style="display:inline-block;padding:6px 14px;background:${meta.color}18;border:1px solid ${meta.color}40;border-radius:999px;margin-bottom:20px;">
          <span style="font-size:13px;font-weight:600;color:${meta.color};">${meta.icon} ${meta.label}</span>
        </div>

        <!-- Justification details -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:16px;">
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Tipo</p>
              <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:500;">${params.typeName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 16px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;">Data da ocorrência</p>
              <p style="margin:4px 0 0;font-size:14px;color:#111827;font-weight:500;">${formattedDate}</p>
            </td>
          </tr>
        </table>

        <p style="margin:0;font-size:14px;color:#374151;">${meta.body}</p>
        ${observationBlock}

        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">Acesse a intranet para ver os detalhes completos da sua justificativa.</p>
      </div>
      <!-- Footer -->
      <p style="text-align:center;font-size:11px;color:#9ca3af;margin:16px 0;">Hospital Evandro Ribeiro — Intranet Interna · Não responda este e-mail.</p>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject: `${meta.icon} Justificativa de Ponto — ${meta.label}`, html };
}
