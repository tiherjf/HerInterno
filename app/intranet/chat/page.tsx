import ChatTela from "./ChatTela";

// ?com=<profileId> abre o chat já na conversa com a pessoa (atalho "Mandar mensagem").
export default function ChatPage({ searchParams }: { searchParams: { com?: string | string[] } }) {
  return <ChatTela key={String(searchParams.com ?? "")} initialCom={searchParams.com} />;
}
