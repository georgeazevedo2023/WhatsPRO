import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getSessionUserId, getAccessToken } from '@/hooks/useAuthSession';
import { toast } from 'sonner';
import { handleError } from '@/lib/errorUtils';
import type { CarouselData } from '@/components/broadcast/CarouselEditor';

export interface MessageTemplate {
  id: string;
  user_id: string;
  name: string;
  content: string | null;
  message_type: string;
  media_url: string | null;
  filename: string | null;
  category: string | null;
  carousel_data: CarouselData | null;
  created_at: string;
  updated_at: string;
}

interface UseMessageTemplatesReturn {
  templates: MessageTemplate[];
  categories: string[];
  isLoading: boolean;
  createTemplate: (template: {
    name: string;
    content?: string;
    message_type: string;
    media_url?: string;
    filename?: string;
    category?: string;
    carousel_data?: CarouselData;
  }) => Promise<MessageTemplate | null>;
  updateTemplate: (id: string, updates: {
    name?: string;
    content?: string;
    category?: string;
  }) => Promise<boolean>;
  deleteTemplate: (id: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useMessageTemplates(): UseMessageTemplatesReturn {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const categories = useMemo(() => {
    const cats = templates
      .map(t => t.category)
      .filter((c): c is string => c !== null && c !== '');
    return [...new Set(cats)].sort();
  }, [templates]);

  const fetchTemplates = async () => {
    try {
      await getAccessToken(); // throws if no session

      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .order('category', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map data with carousel_data parsing
      const mappedData = (data || []).map(item => ({
        ...item,
        carousel_data: item.carousel_data as unknown as CarouselData | null,
      })) as MessageTemplate[];

      setTemplates(mappedData);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const createTemplate = async (template: {
    name: string;
    content?: string;
    message_type: string;
    media_url?: string;
    filename?: string;
    category?: string;
    carousel_data?: CarouselData;
  }): Promise<MessageTemplate | null> => {
    try {
      const userId = await getSessionUserId();

      const insertData = {
        user_id: userId,
        name: template.name,
        content: template.content || null,
        message_type: template.message_type,
        media_url: template.media_url || null,
        filename: template.filename || null,
        category: template.category || null,
        carousel_data: template.carousel_data ? JSON.parse(JSON.stringify(template.carousel_data)) : null,
      };

      const { data, error } = await supabase
        .from('message_templates')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      const newTemplate = {
        ...data,
        carousel_data: data.carousel_data as unknown as CarouselData | null,
      } as MessageTemplate;
      setTemplates(prev => [newTemplate, ...prev]);
      toast.success('Template salvo!');
      return newTemplate;
    } catch (error) {
      handleError(error, 'Erro ao salvar template', 'Error creating template');
      return null;
    }
  };

  const updateTemplate = async (id: string, updates: {
    name?: string;
    content?: string;
    category?: string | null;
  }): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('message_templates')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      setTemplates(prev => prev.map(t => 
        t.id === id ? { ...t, ...updates } : t
      ));
      toast.success('Template atualizado');
      return true;
    } catch (error) {
      handleError(error, 'Erro ao atualizar template', 'Error updating template');
      return false;
    }
  };

  const deleteTemplate = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTemplates(prev => prev.filter(t => t.id !== id));
      toast.success('Template excluído');
      return true;
    } catch (error) {
      handleError(error, 'Erro ao excluir template', 'Error deleting template');
      return false;
    }
  };

  return {
    templates,
    categories,
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    refetch: fetchTemplates,
  };
}
