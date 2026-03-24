import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/lib/errorUtils';

/**
 * Hook for toggling label assignment on a conversation.
 * Handles DB insert/delete + loading state.
 */
export function useToggleLabel(conversationId: string, onChanged?: () => void) {
  const [togglingLabelId, setTogglingLabelId] = useState<string | null>(null);

  const toggleLabel = useCallback(async (labelId: string, isCurrentlyAssigned: boolean) => {
    setTogglingLabelId(labelId);
    try {
      if (isCurrentlyAssigned) {
        const { error } = await supabase
          .from('conversation_labels')
          .delete()
          .eq('conversation_id', conversationId)
          .eq('label_id', labelId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('conversation_labels')
          .insert({ conversation_id: conversationId, label_id: labelId });
        if (error) throw error;
      }
      onChanged?.();
    } catch (err) {
      handleError(err, 'Erro ao alterar etiqueta', 'Toggle label');
    } finally {
      setTogglingLabelId(null);
    }
  }, [conversationId, onChanged]);

  return { togglingLabelId, toggleLabel };
}
