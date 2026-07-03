interface AlertItem {
  number?: string;
  title: string;
  detail: string;
  urgency: "alta" | "media" | "baixa";
}

const URGENCY_COLOR: Record<string, string> = {
  alta:  "#dc2626",
  media: "#d97706",
  baixa: "#2563eb",
};

export function qualidadeAlertaEmail(params: {
  recipientName: string;
  alerts: AlertItem[];
}): { subject: string; html: string } {
  const total = params.alerts.length;
  const high = params.alerts.filter(a => a.urgency === "alta").length;

  const rows = params.alerts.map(a => {
    const color = URGENCY_COLOR[a.urgency];
    return `
    <tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:12px 16px;">
        ${a.number ? `<p style="margin:0;font-size:11px;font-family:monospace;color:#9ca3af;">${a.number}</p>` : ""}
        <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${a.title}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${a.detail}</p>
      </td>
      <td style="padding:12px 16px;white-space:nowrap;">
        <span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${color}18;color:${color};font-size:12px;font-weight:600;border:1px solid ${color}40;">
          ${a.urgency === "alta" ? "🔴 Alta" : a.urgency === "media" ? "🟡 Média" : "🔵 Baixa"}
        </span>
      </td>
    </tr>`;
  }).join("");

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:32px auto;">
    <tr><td>
      <div style="background:linear-gradient(135deg,#7c3aed,#2563eb);padding:24px 32px;border-radius:12px 12px 0 0;">
        <p style="margin:0;color:#e0e7ff;font-size:13px;font-weight:500;">Hospital Evandro Ribeiro — Gestão da Qualidade</p>
        <h1 style="margin:4px 0 0;color:#fff;font-size:20px;font-weight:700;">⚠️ Alertas Pendentes</h1>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
        <p style="margin:0 0 20px;font-size:14px;color:#374151;">
          Olá, <strong>${params.recipientName}</strong>! Você tem <strong>${total} item${total !== 1 ? "s" : ""} pendente${total !== 1 ? "s" : ""}</strong>
          ${high > 0 ? `, sendo <span style="color:#dc2626;font-weight:700;">${high} de alta prioridade</span>` : ""} no módulo de qualidade.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:10px 16px;text-align:left;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Item</th>
              <th style="padding:10px 16px;text-align:left;font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Urgência</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">Acesse a intranet para tomar as ações necessárias.</p>
      </div>
      <p style="text-align:center;font-size:11px;color:#9ca3af;margin:16px 0;">Hospital Evandro Ribeiro — Não responda este e-mail.</p>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    subject: `⚠️ Qualidade — ${total} alerta${total !== 1 ? "s" : ""} pendente${total !== 1 ? "s" : ""}`,
    html,
  };
}
