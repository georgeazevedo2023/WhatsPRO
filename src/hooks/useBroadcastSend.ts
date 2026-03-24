import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getAccessToken as getAuthToken, getSessionUserId } from '@/hooks/useAuthSession';
import { toast } from 'sonner';
import { saveToHelpdesk } from '@/lib/saveToHelpdesk';
import { uploadCarouselImage, base64ToFile } from '@/lib/uploadCarouselImage';
import type { SendProgress } from '@/components/broadcast/BroadcastProgressModal';
import type { CarouselData } from '@/components/broadcast/CarouselEditor';
import type { Instance, Group } from '@/types';
import type { ScheduleConfig } from '@/components/group/ScheduleMessageDialog';
import type { MediaType } from '@/lib/broadcastSender';
import {
  MAX_MESSAGE_LENGTH, GROUP_DELAY_MS,
  sendToNumber, sendMediaToNumber, sendCarouselToNumber,
  fileToBase64, getRandomDelay as getRandomDelayMs,
} from '@/lib/broadcastSender';

// ── Param / Return types ─────────────────────────────────────────────

export interface UseBroadcastSendParams {
  instance: Instance;
  selectedGroups: Group[];
  excludeAdmins: boolean;
  randomDelay: 'none' | '5-10' | '10-20';
  uniqueRegularMembers: { jid: string; groupName: string }[];
  selectedParticipants: Set<string>;
  onComplete?: () => void;
}

export interface SendTextParams { message: string }
export interface SendMediaParams {
  mediaData: string;
  mediaType: MediaType;
  caption: string;
  isPtt: boolean;
  filename: string;
  mediaUrl: string;
}
export interface SendCarouselParams { carouselData: CarouselData }

export interface UseBroadcastSendReturn {
  progress: SendProgress;
  elapsedTime: number;
  remainingTime: number | null;
  estimatedTime: { min: number; max: number } | null;
  isSending: boolean;
  isScheduling: boolean;
  formatDuration: (s: number) => string;
  handlePause: () => void;
  handleResume: () => void;
  handleCancel: () => void;
  handleCloseProgress: () => void;
  sendText: (p: SendTextParams) => Promise<void>;
  sendMedia: (p: SendMediaParams) => Promise<void>;
  sendCarousel: (p: SendCarouselParams) => Promise<void>;
  scheduleText: (p: SendTextParams & { config: ScheduleConfig }) => Promise<void>;
  scheduleMedia: (p: SendMediaParams & { config: ScheduleConfig }) => Promise<void>;
}

// ── Helper utilities ─────────────────────────────────────────────────

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return minutes === 0 ? `${hours}h` : `${hours}h${minutes}min`;
  return `${minutes} min`;
};

// ── Hook ─────────────────────────────────────────────────────────────

export function useBroadcastSend(params: UseBroadcastSendParams): UseBroadcastSendReturn {
  const {
    instance, selectedGroups, excludeAdmins, randomDelay,
    uniqueRegularMembers, selectedParticipants, onComplete,
  } = params;

  const [progress, setProgress] = useState<SendProgress>({
    currentGroup: 0, totalGroups: 0,
    currentMember: 0, totalMembers: 0,
    groupName: '', status: 'idle', results: [], startedAt: null,
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isScheduling, setIsScheduling] = useState(false);

  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);

  // ── Timer ────────────────────────────────────────────────────────
  useEffect(() => {
    let id: NodeJS.Timeout | null = null;
    if ((progress.status === 'sending' || progress.status === 'paused') && progress.startedAt) {
      id = setInterval(() => {
        if (progress.status === 'sending') {
          setElapsedTime(Math.floor((Date.now() - progress.startedAt!) / 1000));
        }
      }, 1000);
    } else if (progress.status === 'idle') {
      setElapsedTime(0);
    }
    return () => { if (id) clearInterval(id); };
  }, [progress.status, progress.startedAt]);

  // ── Pause / resume / cancel ──────────────────────────────────────
  const handlePause = useCallback(() => {
    isPausedRef.current = true;
    setProgress(p => ({ ...p, status: 'paused' }));
  }, []);

  const handleResume = useCallback(() => {
    isPausedRef.current = false;
    setProgress(p => ({ ...p, status: 'sending' }));
  }, []);

  const handleCancel = useCallback(() => {
    isCancelledRef.current = true;
    isPausedRef.current = false;
  }, []);

  const handleCloseProgress = useCallback(() => {
    setProgress(p => ({ ...p, status: 'idle', results: [], startedAt: null }));
    setElapsedTime(0);
  }, []);

  // ── Internal helpers ─────────────────────────────────────────────
  const waitWhilePaused = async () => {
    while (isPausedRef.current) await delay(100);
  };

  const getGroupDelay = () => getRandomDelayMs(randomDelay, GROUP_DELAY_MS);

  /** Returns true if cancelled (caller should return early). */
  const checkCancelled = async (
    results: SendProgress['results'],
    logFn: (successCount: number, failCount: number) => Promise<void>,
  ): Promise<boolean> => {
    if (!isCancelledRef.current) return false;
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    setProgress(p => ({ ...p, status: 'cancelled', results }));
    await logFn(successCount, failCount);
    return true;
  };

  // ── Broadcast log persistence ────────────────────────────────────
  const saveBroadcastLog = async (p: {
    messageType: string; content: string | null; mediaUrl: string | null;
    groupsTargeted: number; recipientsTargeted: number;
    recipientsSuccess: number; recipientsFailed: number;
    status: 'completed' | 'cancelled' | 'error';
    startedAt: number; errorMessage?: string;
    groupNames?: string[]; carouselData?: CarouselData | null;
  }) => {
    try {
      const userId = await getSessionUserId();
      const completedAt = Date.now();
      let storedCarouselData = null;
      if (p.carouselData) {
        const processedCards = await Promise.all(
          p.carouselData.cards.map(async (card, idx) => {
            let imageForStorage = card.image || '';
            try {
              if (card.imageFile) {
                imageForStorage = await uploadCarouselImage(card.imageFile);
              } else if (card.image && card.image.startsWith('data:')) {
                const file = await base64ToFile(card.image, `card-${idx}.jpg`);
                imageForStorage = await uploadCarouselImage(file);
              }
            } catch { /* keep original */ }
            return {
              id: card.id, text: card.text, image: imageForStorage,
              buttons: card.buttons.map(btn => ({
                id: btn.id, type: btn.type, label: btn.label,
                value: btn.url || btn.phone || '',
              })),
            };
          }),
        );
        storedCarouselData = { message: p.carouselData.message, cards: processedCards };
      }

      await supabase.from('broadcast_logs').insert({
        user_id: userId,
        instance_id: instance.id,
        instance_name: instance.name,
        message_type: p.messageType,
        content: p.content,
        media_url: p.mediaUrl,
        groups_targeted: p.groupsTargeted,
        recipients_targeted: p.recipientsTargeted,
        recipients_success: p.recipientsSuccess,
        recipients_failed: p.recipientsFailed,
        exclude_admins: excludeAdmins,
        random_delay: randomDelay,
        status: p.status,
        started_at: new Date(p.startedAt).toISOString(),
        completed_at: new Date(completedAt).toISOString(),
        duration_seconds: Math.floor((completedAt - p.startedAt) / 1000),
        error_message: p.errorMessage || null,
        group_names: p.groupNames || selectedGroups.map(g => g.name),
        carousel_data: storedCarouselData,
      });
    } catch (err) {
      console.error('Error saving broadcast log:', err);
    }
  };

  // ── Generic send loop (individual participants) ──────────────────
  const runIndividualLoop = async (
    accessToken: string,
    membersToSend: { jid: string; groupName: string }[],
    sendFn: (jid: string) => Promise<unknown>,
    helpdeskFn: (jid: string, phone: string) => void | Promise<void>,
    logParams: { messageType: string; content: string | null; mediaUrl: string | null; carouselData?: CarouselData | null },
  ) => {
    const results: SendProgress['results'] = [];
    let successCount = 0;
    let failCount = 0;
    const startedAt = Date.now();

    setProgress({
      currentGroup: 1, totalGroups: 1,
      currentMember: 0, totalMembers: membersToSend.length,
      groupName: `${selectedGroups.length} grupo(s) - Envio individual`,
      status: 'sending', results: [], startedAt,
    });

    for (let j = 0; j < membersToSend.length; j++) {
      // cancel check (before + after pause)
      for (let c = 0; c < 2; c++) {
        if (c === 1) await waitWhilePaused();
        if (isCancelledRef.current) {
          results.push({ groupName: `Cancelado após ${successCount} envio(s)`, success: true });
          setProgress(p => ({ ...p, status: 'cancelled', results }));
          toast.info(`Envio cancelado. ${successCount} mensagem(ns) enviada(s).`);
          await saveBroadcastLog({
            ...logParams, groupsTargeted: selectedGroups.length,
            recipientsTargeted: membersToSend.length,
            recipientsSuccess: successCount, recipientsFailed: failCount,
            status: 'cancelled', startedAt,
          });
          return;
        }
      }

      try {
        await sendFn(membersToSend[j].jid);
        successCount++;
        const phone = membersToSend[j].jid.replace('@s.whatsapp.net', '');
        Promise.resolve(helpdeskFn(membersToSend[j].jid, phone)).catch((err: unknown) => console.error('[helpdesk save error]', err));
      } catch (err) {
        console.error(`Erro ao enviar para ${membersToSend[j].jid}:`, err);
        failCount++;
      }

      setProgress(p => ({ ...p, currentMember: j + 1 }));
      if (j < membersToSend.length - 1) await delay(getRandomDelayMs(randomDelay));
    }

    results.push({
      groupName: `Envio individual (${membersToSend.length} contatos únicos)`,
      success: failCount === 0,
    });
    setProgress(p => ({ ...p, status: 'success', results }));
    await saveBroadcastLog({
      ...logParams, groupsTargeted: selectedGroups.length,
      recipientsTargeted: membersToSend.length,
      recipientsSuccess: successCount, recipientsFailed: failCount,
      status: 'completed', startedAt,
    });

    if (failCount > 0) {
      toast.warning(`Enviado para ${successCount} contato(s). ${failCount} falha(s).`);
    } else {
      toast.success(`Mensagem enviada para ${successCount} contato(s) únicos!`);
    }
  };

  // ── Generic send loop (group-level) ──────────────────────────────
  const runGroupLoop = async (
    accessToken: string,
    sendFn: (groupId: string) => Promise<unknown>,
    logParams: { messageType: string; content: string | null; mediaUrl: string | null; carouselData?: CarouselData | null },
  ) => {
    const results: SendProgress['results'] = [];
    const startedAt = Date.now();

    setProgress({
      currentGroup: 0, totalGroups: selectedGroups.length,
      currentMember: 0, totalMembers: 0,
      groupName: '', status: 'sending', results: [], startedAt,
    });

    for (let i = 0; i < selectedGroups.length; i++) {
      for (let c = 0; c < 2; c++) {
        if (c === 1) await waitWhilePaused();
        if (isCancelledRef.current) {
          const sentCount = results.filter(r => r.success).length;
          const failedCount = results.filter(r => !r.success).length;
          setProgress(p => ({ ...p, status: 'cancelled', results }));
          toast.info(`Envio cancelado. ${sentCount} grupo(s) enviado(s).`);
          await saveBroadcastLog({
            ...logParams, groupsTargeted: selectedGroups.length,
            recipientsTargeted: selectedGroups.length,
            recipientsSuccess: sentCount, recipientsFailed: failedCount,
            status: 'cancelled', startedAt,
          });
          return;
        }
      }

      const group = selectedGroups[i];
      try {
        setProgress(p => ({
          ...p, currentGroup: i + 1, groupName: group.name,
          currentMember: 0, totalMembers: 1,
        }));
        await sendFn(group.id);
        setProgress(p => ({ ...p, currentMember: 1 }));
        results.push({ groupName: group.name, success: true });
      } catch (error) {
        console.error(`Erro ao enviar para grupo ${group.name}:`, error);
        results.push({
          groupName: group.name, success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }

      if (i < selectedGroups.length - 1) await delay(getGroupDelay());
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    setProgress(p => ({ ...p, status: 'success', results }));
    await saveBroadcastLog({
      ...logParams, groupsTargeted: selectedGroups.length,
      recipientsTargeted: selectedGroups.length,
      recipientsSuccess: successCount, recipientsFailed: failCount,
      status: 'completed', startedAt,
    });

    if (failCount > 0) {
      toast.warning(`Enviado para ${successCount} grupo(s). ${failCount} falha(s).`);
    } else {
      toast.success(`Mensagem enviada para ${successCount} grupo(s)!`);
    }
  };

  // ── getSession helper ────────────────────────────────────────────
  const getAccessToken = async (): Promise<string | null> => {
    try {
      return await getAuthToken();
    } catch {
      setProgress(p => ({ ...p, status: 'error' }));
      return null;
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // Public send methods
  // ══════════════════════════════════════════════════════════════════

  const sendText = useCallback(async ({ message }: SendTextParams) => {
    const trimmed = message.trim();
    if (!trimmed) { toast.error('Digite uma mensagem'); return; }
    if (trimmed.length > MAX_MESSAGE_LENGTH) { toast.error(`Mensagem muito longa (máximo ${MAX_MESSAGE_LENGTH} caracteres)`); return; }
    if (selectedGroups.length === 0) { toast.error('Selecione pelo menos um grupo'); return; }

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;
      isCancelledRef.current = false;

      const logParams = { messageType: 'text', content: trimmed, mediaUrl: null };

      if (excludeAdmins) {
        const members = uniqueRegularMembers.filter(m => selectedParticipants.has(m.jid));
        if (members.length === 0) { toast.error('Selecione pelo menos um participante'); return; }
        await runIndividualLoop(
          accessToken, members,
          (jid) => sendToNumber(instance.id, jid, trimmed, accessToken),
          (jid, phone) => { saveToHelpdesk(instance.id, jid, phone, null, { content: trimmed, media_type: 'text' }); },
          logParams,
        );
      } else {
        await runGroupLoop(
          accessToken,
          (groupId) => sendToNumber(instance.id, groupId, trimmed, accessToken),
          logParams,
        );
      }
      onComplete?.();
    } catch (error) {
      console.error('Error sending broadcast:', error);
      toast.error('Erro ao enviar mensagens');
      setProgress(p => ({ ...p, status: 'error' }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.id, selectedGroups, excludeAdmins, uniqueRegularMembers, selectedParticipants, randomDelay]);

  const sendMedia = useCallback(async ({ mediaData, mediaType, caption, isPtt, filename, mediaUrl }: SendMediaParams) => {
    if (!mediaData) { toast.error('Selecione um arquivo ou informe uma URL'); return; }
    if (selectedGroups.length === 0) { toast.error('Selecione pelo menos um grupo'); return; }
    if (mediaType === 'file' && !filename.trim()) { toast.error('Informe o nome do arquivo'); return; }

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;
      isCancelledRef.current = false;

      const sendType = mediaType === 'audio' && isPtt ? 'ptt' : mediaType === 'file' ? 'document' : mediaType;
      const docName = mediaType === 'file' ? filename.trim() : '';
      const logParams = { messageType: sendType, content: caption.trim() || null, mediaUrl: mediaUrl.trim() || null };

      if (excludeAdmins) {
        const members = uniqueRegularMembers.filter(m => selectedParticipants.has(m.jid));
        if (members.length === 0) { toast.error('Selecione pelo menos um participante'); return; }
        await runIndividualLoop(
          accessToken, members,
          (jid) => sendMediaToNumber(instance.id, jid, mediaData, sendType, caption.trim(), docName, accessToken),
          (jid, phone) => {
            saveToHelpdesk(instance.id, jid, phone, null, {
              content: caption.trim() || null,
              media_type: sendType === 'ptt' ? 'audio' : sendType === 'document' ? 'document' : sendType,
              media_url: mediaUrl.trim() || null,
            });
          },
          logParams,
        );
      } else {
        await runGroupLoop(
          accessToken,
          (groupId) => sendMediaToNumber(instance.id, groupId, mediaData, sendType, caption.trim(), docName, accessToken),
          logParams,
        );
      }
      onComplete?.();
    } catch (error) {
      console.error('Error sending media broadcast:', error);
      toast.error('Erro ao enviar mídia');
      setProgress(p => ({ ...p, status: 'error' }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.id, selectedGroups, excludeAdmins, uniqueRegularMembers, selectedParticipants, randomDelay]);

  const sendCarousel = useCallback(async ({ carouselData }: SendCarouselParams) => {
    if (carouselData.cards.length < 2) { toast.error('O carrossel precisa ter pelo menos 2 cards'); return; }
    const hasInvalid = carouselData.cards.some(c => (!c.image && !c.imageFile) || !c.text.trim());
    if (hasInvalid) { toast.error('Todos os cards devem ter imagem e texto'); return; }
    const hasInvalidButtons = carouselData.cards.some(c =>
      c.buttons.some(btn => !btn.label.trim() || (btn.type === 'URL' && !btn.url?.trim()) || (btn.type === 'CALL' && !btn.phone?.trim()))
    );
    if (hasInvalidButtons) { toast.error('Preencha todos os campos dos botões'); return; }
    if (selectedGroups.length === 0) { toast.error('Selecione pelo menos um grupo'); return; }
    if (excludeAdmins && selectedParticipants.size === 0) { toast.error('Selecione pelo menos um participante'); return; }

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;
      isCancelledRef.current = false;

      const logParams = { messageType: 'carousel', content: carouselData.message || null, mediaUrl: null, carouselData };

      const saveCarouselToHelpdesk = async (jid: string, phone: string) => {
        try {
          const helpdeskCards = await Promise.all(
            carouselData.cards.map(async (c) => {
              let imageUrl = c.image || '';
              if (c.imageFile) imageUrl = await uploadCarouselImage(c.imageFile);
              else if (c.image && c.image.startsWith('data:')) {
                const file = await base64ToFile(c.image, `card-${c.id}.jpg`);
                imageUrl = await uploadCarouselImage(file);
              }
              return {
                id: c.id, text: c.text, image: imageUrl,
                buttons: c.buttons.map(b => ({ id: b.id, type: b.type, label: b.label, value: b.url || b.phone || '' })),
              };
            }),
          );
          saveToHelpdesk(instance.id, jid, phone, null, {
            content: carouselData.message || '📋 Carrossel enviado',
            media_type: 'carousel',
            media_url: JSON.stringify({ message: carouselData.message, cards: helpdeskCards }),
          });
        } catch (err) {
          console.error('[useBroadcastSend] Error uploading carousel images for helpdesk:', err);
        }
      };

      if (excludeAdmins) {
        const members = uniqueRegularMembers.filter(m => selectedParticipants.has(m.jid));
        await runIndividualLoop(
          accessToken, members,
          (jid) => sendCarouselToNumber(instance.id, jid, carouselData, accessToken, fileToBase64),
          (jid, phone) => { saveCarouselToHelpdesk(jid, phone); },
          logParams,
        );
      } else {
        await runGroupLoop(
          accessToken,
          (groupId) => sendCarouselToNumber(instance.id, groupId, carouselData, accessToken, fileToBase64),
          logParams,
        );
      }
      onComplete?.();
    } catch (error) {
      console.error('Error sending carousel broadcast:', error);
      toast.error('Erro ao enviar carrossel');
      setProgress(p => ({ ...p, status: 'error' }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.id, selectedGroups, excludeAdmins, uniqueRegularMembers, selectedParticipants, randomDelay]);

  // ══════════════════════════════════════════════════════════════════
  // Scheduling
  // ══════════════════════════════════════════════════════════════════

  const scheduleText = useCallback(async ({ message, config }: SendTextParams & { config: ScheduleConfig }) => {
    const trimmed = message.trim();
    if (!trimmed) { toast.error('Digite uma mensagem'); return; }
    if (selectedGroups.length === 0) { toast.error('Selecione pelo menos um grupo'); return; }

    setIsScheduling(true);
    try {
      const userId = await getSessionUserId();

      const results = await Promise.all(selectedGroups.map(group => {
        const regularMembers = group.participants.filter(p => !p.isAdmin && !p.isSuperAdmin);
        const recipients = excludeAdmins && regularMembers.length > 0
          ? regularMembers.map(m => ({ jid: m.jid })) : null;
        return supabase.from('scheduled_messages').insert({
          user_id: userId,
          instance_id: instance.id,
          group_jid: group.id, group_name: group.name,
          exclude_admins: excludeAdmins, recipients,
          message_type: 'text', content: trimmed,
          scheduled_at: config.scheduledAt.toISOString(),
          next_run_at: config.scheduledAt.toISOString(),
          is_recurring: config.isRecurring,
          recurrence_type: config.isRecurring ? config.recurrenceType : null,
          recurrence_interval: config.recurrenceInterval,
          recurrence_days: config.recurrenceDays.length > 0 ? config.recurrenceDays : null,
          recurrence_end_at: config.recurrenceEndAt?.toISOString() || null,
          recurrence_count: config.recurrenceCount || null,
          random_delay: config.randomDelay, status: 'pending',
        });
      }));

      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw new Error(`Falha ao agendar ${errors.length} grupo(s)`);
      toast.success(`${selectedGroups.length} agendamento(s) criado(s)!`);
      onComplete?.();
    } catch (error) {
      console.error('Error scheduling broadcast:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao agendar');
    } finally {
      setIsScheduling(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.id, selectedGroups, excludeAdmins]);

  const scheduleMedia = useCallback(async ({ mediaUrl, mediaType, caption, isPtt, filename, config }: SendMediaParams & { config: ScheduleConfig }) => {
    const trimmedUrl = mediaUrl.trim();
    if (!trimmedUrl) { toast.error('Para agendar mídia, informe uma URL (não arquivo local)'); return; }
    if (selectedGroups.length === 0) { toast.error('Selecione pelo menos um grupo'); return; }
    if (mediaType === 'file' && !filename.trim()) { toast.error('Informe o nome do arquivo'); return; }

    setIsScheduling(true);
    try {
      const userId = await getSessionUserId();

      const sendType = mediaType === 'audio' && isPtt ? 'ptt' : mediaType === 'file' ? 'document' : mediaType;

      const results = await Promise.all(selectedGroups.map(group => {
        const regularMembers = group.participants.filter(p => !p.isAdmin && !p.isSuperAdmin);
        const recipients = excludeAdmins && regularMembers.length > 0
          ? regularMembers.map(m => ({ jid: m.jid })) : null;
        return supabase.from('scheduled_messages').insert({
          user_id: userId,
          instance_id: instance.id,
          group_jid: group.id, group_name: group.name,
          exclude_admins: excludeAdmins, recipients,
          message_type: sendType, content: caption.trim() || null,
          media_url: trimmedUrl,
          filename: mediaType === 'file' ? filename.trim() : null,
          scheduled_at: config.scheduledAt.toISOString(),
          next_run_at: config.scheduledAt.toISOString(),
          is_recurring: config.isRecurring,
          recurrence_type: config.isRecurring ? config.recurrenceType : null,
          recurrence_interval: config.recurrenceInterval,
          recurrence_days: config.recurrenceDays.length > 0 ? config.recurrenceDays : null,
          recurrence_end_at: config.recurrenceEndAt?.toISOString() || null,
          recurrence_count: config.recurrenceCount || null,
          random_delay: config.randomDelay, status: 'pending',
        });
      }));

      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw new Error(`Falha ao agendar ${errors.length} grupo(s)`);
      toast.success(`${selectedGroups.length} agendamento(s) de mídia criado(s)!`);
      onComplete?.();
    } catch (error) {
      console.error('Error scheduling media broadcast:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao agendar mídia');
    } finally {
      setIsScheduling(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance.id, selectedGroups, excludeAdmins]);

  // ── Computed values ──────────────────────────────────────────────
  const isSending = progress.status === 'sending' || progress.status === 'paused';

  const targetCount = excludeAdmins ? selectedParticipants.size : selectedGroups.length;

  const estimatedTime = (() => {
    if (randomDelay === 'none' || targetCount <= 1) return null;
    const n = targetCount - 1;
    if (randomDelay === '5-10') return { min: n * 5, max: n * 10 };
    return { min: n * 10, max: n * 20 };
  })();

  const remainingTime = (() => {
    if (!progress.startedAt || elapsedTime === 0) return null;
    const totalItems = excludeAdmins ? progress.totalMembers : progress.totalGroups;
    const done = excludeAdmins ? progress.currentMember : progress.currentGroup;
    if (done === 0 || done >= totalItems) return null;
    return Math.ceil((elapsedTime / done) * (totalItems - done));
  })();

  return {
    progress, elapsedTime, remainingTime, estimatedTime,
    isSending, isScheduling, formatDuration,
    handlePause, handleResume, handleCancel, handleCloseProgress,
    sendText, sendMedia, sendCarousel,
    scheduleText, scheduleMedia,
  };
}
