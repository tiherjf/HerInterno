/** Tipos da tela do chat interno (compartilhados entre regras puras e componentes). */

export type Status = "disponivel" | "ausente" | "ocupado";

export interface Pessoa {
  id: string;
  full_name: string;
  sector: string | null;
  role: string;
  phone_ext?: string | null;
}

export interface Mensagem {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  attachment_path?: string | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
  urgent?: boolean;
  urgent_reason?: string | null;
}

export interface Conversa {
  /** id do interlocutor */
  with: string;
  last_message: Mensagem;
  /** recebidas e não lidas */
  unread: number;
  /** há chamada urgente recebida ainda não lida */
  urgente: boolean;
}
