const GLPI_URL = process.env.GLPI_URL || "http://192.168.0.250/glpi";
const GLPI_TOKEN = process.env.GLPI_API_TOKEN || "ySFl4wGAOsk3IFDVWNwyjePNg51KeSfr4UlkRLc2";

export interface GLPITicket {
  title: string;
  description: string;
  urgency?: number; // 1-5
  userName?: string;
}

export interface GLPITicketResult {
  id: number;
  title: string;
}

export async function createGLPITicket(ticket: GLPITicket): Promise<GLPITicketResult> {
  const response = await fetch(`${GLPI_URL}/api/createTicket`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GLPI_TOKEN}`,
    },
    body: JSON.stringify({
      name: ticket.title,
      content: ticket.description,
      urgency: ticket.urgency || 3,
      type: 1, // Incident
      requesters: ticket.userName ? [{ name: ticket.userName }] : [],
    }),
  });

  if (!response.ok) {
    throw new Error(`GLPI error: ${response.statusText}`);
  }

  const data = await response.json();
  return { id: data.id, title: ticket.title };
}

export async function getGLPITickets(userName: string) {
  const response = await fetch(
    `${GLPI_URL}/api/Ticket?searchText[name]=${encodeURIComponent(userName)}&range=0-9`,
    {
      headers: {
        Authorization: `Bearer ${GLPI_TOKEN}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`GLPI error: ${response.statusText}`);
  }

  return response.json();
}
