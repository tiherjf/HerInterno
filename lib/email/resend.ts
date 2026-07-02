import { Resend } from "resend";

function getClient() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const resend = getClient();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: "Intranet HER <noreply@hospitalevandroribeiro.com.br>",
      to,
      subject,
      html,
    });
  } catch {
    // falha silenciosa — não quebra o fluxo principal
  }
}
