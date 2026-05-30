/**
 * Pure follow-up pause guard.
 *
 * SHADOW means the AI is observing after handoff. It does not always mean
 * follow-ups are allowed. Premium handoffs can explicitly pause follow-ups with
 * `followups_paused:true`.
 */

export function areFollowUpsPaused(tags: string[] | null | undefined): boolean {
  if (!Array.isArray(tags)) return false
  return tags.some((tag) => {
    if (typeof tag !== 'string') return false
    const [key, rawValue = ''] = tag.split(':')
    return key.trim() === 'followups_paused' && rawValue.trim().toLowerCase() === 'true'
  })
}

export function shouldProcessFollowUpCandidate(candidate: {
  tags?: string[] | null
}): boolean {
  return !areFollowUpsPaused(candidate.tags)
}
