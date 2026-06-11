/** Helpers PUROS da busca server-side do Helpdesk (v7.79.0).
 *
 *  A busca da lista era 100% client-side sobre a página carregada (status filtrado
 *  no servidor + range de 50) — buscar o telefone de uma conversa resolvida/antiga
 *  dava 0 resultados (caso real: dono buscou 558196970061 e não achou a conversa
 *  do porcelanato). Com 3+ chars a busca agora TAMBÉM consulta o servidor em todos
 *  os status da caixa e injeta os resultados na lista.
 */

/** Remove chars que quebram a sintaxe do .or() do PostgREST (vírgula/parênteses
 *  são separadores/agrupadores de filtro) e % _ que são wildcards do LIKE. */
export function sanitizeSearchTerm(q: string): string {
  return q.replace(/[,()%_]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Só os dígitos — busca por telefone funciona com "+55 81 9697-0061" digitado. */
export function extractDigits(q: string): string {
  return q.replace(/\D/g, '');
}

/** Acrescenta os resultados do servidor que ainda não estão na lista (dedup por id).
 *  Não re-filtra: se o servidor achou, o usuário quer ver. */
export function mergeServerMatches<T extends { id: string }>(loaded: T[], matches: T[]): T[] {
  if (matches.length === 0) return loaded;
  const seen = new Set(loaded.map(c => c.id));
  const extras = matches.filter(m => !seen.has(m.id));
  return extras.length === 0 ? loaded : [...loaded, ...extras];
}
