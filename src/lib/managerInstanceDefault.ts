// Instância padrão das telas do grupo "Gestão" (Dashboard, Agente, Transbordo,
// Origem, Vendedor). FONTE ÚNICA — as 5 telas compartilham o localStorage
// 'wp-gestao-instance' + evento 'wp-instance-change' (widget Assistente IA);
// se cada uma escolhesse um default diferente, o widget ficaria em flip-flop.
// Casa pela instância de produção Eletropiso (558781592373); fallback p/ a 1ª.
// TODO(follow-up): trocar a magic-string por owner_jid/flag is_manager_default
// no DB (renomear a instância hoje faz cair silenciosamente no fallback).
const DEFAULT_INSTANCE_HINT = '558781592373';

export function resolveDefaultManagerInstance(
  instances: { id: string; name: string }[],
): string | null {
  return (
    instances.find((i) => i.name?.includes(DEFAULT_INSTANCE_HINT))?.id ??
    instances[0]?.id ??
    null
  );
}
