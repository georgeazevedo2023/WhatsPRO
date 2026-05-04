/**
 * D30 (D-alpha): resolução do departamento de handoff em cascata.
 *
 *   profileData.handoff_department_id
 *     -> funnelData.handoff_department_id
 *     -> inbox.default_department_id   (NOVO em Sprint A.3)
 *     -> null  (caller deve tocar sino do gestor — sem dept = sem fila)
 *
 * Lê do nível mais específico (perfil do agente do funil ativo) ao mais genérico
 * (configuração da caixa). NUNCA consulta o agente direto — agentes não têm
 * departamento global no schema atual.
 */

export type DepartmentResolutionInput = {
  profile?: { handoff_department_id?: string | null } | null
  funnel?: { handoff_department_id?: string | null } | null
  inbox?: { default_department_id?: string | null } | null
}

export type DepartmentResolution = {
  departmentId: string | null
  source: 'profile' | 'funnel' | 'inbox' | 'none'
}

export function resolveHandoffDepartment(
  input: DepartmentResolutionInput,
): DepartmentResolution {
  const profileDept = input.profile?.handoff_department_id ?? null
  if (profileDept) return { departmentId: profileDept, source: 'profile' }

  const funnelDept = input.funnel?.handoff_department_id ?? null
  if (funnelDept) return { departmentId: funnelDept, source: 'funnel' }

  const inboxDept = input.inbox?.default_department_id ?? null
  if (inboxDept) return { departmentId: inboxDept, source: 'inbox' }

  return { departmentId: null, source: 'none' }
}
