/** Link que abre o chat já na conversa com a pessoa. */
export function linkConversa(profileId: string): string {
  return `/intranet/chat?com=${encodeURIComponent(profileId)}`;
}
