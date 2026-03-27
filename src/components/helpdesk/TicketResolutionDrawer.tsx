import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Drawer, DrawerContent, DrawerTrigger, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Headphones, Ban, Loader2, DollarSign, Tag } from 'lucide-react';
import { toast } from 'sonner';
import type { Conversation } from '@/types';

/* ═══════════════════════════════════════════ */
/*  Types                                      */
/* ═══════════════════════════════════════════ */

type Category = 'VENDA' | 'PERDIDO' | 'SUPORTE' | 'SPAM';
type LostReason = 'PRECO' | 'CONCORRENTE' | 'ESTOQUE' | 'SEM_RESPOSTA';

interface TicketResolutionDrawerProps {
  conversation: Conversation;
  onResolved: (conversationId: string, status: string) => void;
  trigger: React.ReactNode;
}

const CATEGORIES: { value: Category; label: string; icon: typeof CheckCircle2; color: string; bgColor: string }[] = [
  { value: 'VENDA', label: 'Venda Fechada', icon: DollarSign, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20' },
  { value: 'PERDIDO', label: 'Não Converteu', icon: XCircle, color: 'text-red-400', bgColor: 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20' },
  { value: 'SUPORTE', label: 'Suporte Resolvido', icon: Headphones, color: 'text-blue-400', bgColor: 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20' },
  { value: 'SPAM', label: 'Spam / Irrelevante', icon: Ban, color: 'text-zinc-400', bgColor: 'bg-zinc-500/10 border-zinc-500/30 hover:bg-zinc-500/20' },
];

const LOST_REASONS: { value: LostReason; label: string }[] = [
  { value: 'PRECO', label: 'Preço alto' },
  { value: 'CONCORRENTE', label: 'Concorrente' },
  { value: 'ESTOQUE', label: 'Sem estoque' },
  { value: 'SEM_RESPOSTA', label: 'Sem resposta' },
];

const KANBAN_COLUMN_MAP: Record<Category, string> = {
  VENDA: 'Fechado Ganho',
  PERDIDO: 'Perdido',
  SUPORTE: 'Resolvido',
  SPAM: 'Resolvido',
};

const TAG_MAP: Record<Category, string> = {
  VENDA: 'resultado:venda',
  PERDIDO: 'resultado:perdido',
  SUPORTE: 'resultado:suporte',
  SPAM: 'resultado:spam',
};

/* ═══════════════════════════════════════════ */
/*  Currency mask                              */
/* ═══════════════════════════════════════════ */

const MAX_SALE_VALUE = 999_999_99; // R$ 999.999,99 in cents

function formatCurrency(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const cents = Math.min(parseInt(digits, 10), MAX_SALE_VALUE);
  const num = cents / 100;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseCurrency(formatted: string): number {
  const digits = formatted.replace(/\D/g, '');
  if (!digits) return 0;
  const cents = Math.min(parseInt(digits, 10), MAX_SALE_VALUE);
  const value = cents / 100;
  return Number.isFinite(value) ? value : 0;
}

/* ═══════════════════════════════════════════ */
/*  Component                                  */
/* ═══════════════════════════════════════════ */

export function TicketResolutionDrawer({ conversation, onResolved, trigger }: TicketResolutionDrawerProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [lostReason, setLostReason] = useState<LostReason | null>(null);
  const [valueDisplay, setValueDisplay] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCategory(null);
    setLostReason(null);
    setValueDisplay('');
    setNotes('');
  };

  const canSubmit = (() => {
    if (!category) return false;
    if (category === 'VENDA' && parseCurrency(valueDisplay) <= 0) return false;
    if (category === 'PERDIDO' && !lostReason) return false;
    if (category === 'SUPORTE' && notes.trim().length < 5) return false;
    return true;
  })();

  const submitLabel = (() => {
    if (!category) return 'Selecione o resultado';
    switch (category) {
      case 'VENDA': return `Confirmar Venda ${valueDisplay || ''}`;
      case 'PERDIDO': return 'Marcar como Perdido';
      case 'SUPORTE': return 'Resolver Atendimento';
      case 'SPAM': return 'Marcar como Spam';
    }
  })();

  const submitColor = (() => {
    if (!category) return '';
    switch (category) {
      case 'VENDA': return 'bg-emerald-600 hover:bg-emerald-700';
      case 'PERDIDO': return 'bg-red-600 hover:bg-red-700';
      case 'SUPORTE': return 'bg-blue-600 hover:bg-blue-700';
      case 'SPAM': return 'bg-zinc-600 hover:bg-zinc-700';
    }
  })();

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !category || submitting) return;

    // Double-check saleValue for VENDA before proceeding
    if (category === 'VENDA') {
      const saleValue = parseCurrency(valueDisplay);
      if (!Number.isFinite(saleValue) || saleValue <= 0) {
        toast.error('Informe um valor de venda válido');
        return;
      }
    }

    setSubmitting(true);

    try {
      const contactId = conversation.contact_id;

      // 1. Build tags
      const newTags: string[] = [TAG_MAP[category]];
      if (category === 'PERDIDO' && lostReason) newTags.push(`motivo:${lostReason.toLowerCase()}`);
      if (category === 'VENDA' && parseCurrency(valueDisplay) > 0) newTags.push(`valor:${parseCurrency(valueDisplay)}`);

      // Merge with existing tags
      const existingTags: string[] = (conversation as any).tags || [];
      const tagMap = new Map<string, string>();
      for (const t of existingTags) tagMap.set(t.split(':')[0], t);
      for (const t of newTags) tagMap.set(t.split(':')[0], t);
      const mergedTags = Array.from(tagMap.values());

      // 2. Update conversation: status + tags
      await supabase
        .from('conversations')
        .update({ status: 'resolvida', tags: mergedTags })
        .eq('id', conversation.id);

      // 3. Move kanban card (if exists)
      const targetColumnName = KANBAN_COLUMN_MAP[category];
      if (contactId && (category === 'VENDA' || category === 'PERDIDO')) {
        // Find card for this contact
        const { data: card } = await supabase
          .from('kanban_cards')
          .select('id, board_id, column_id')
          .eq('contact_id', contactId)
          .maybeSingle();

        if (card) {
          // Find target column in the same board
          const { data: targetCol } = await supabase
            .from('kanban_columns')
            .select('id')
            .eq('board_id', card.board_id)
            .ilike('name', `%${targetColumnName}%`)
            .maybeSingle();

          if (targetCol) {
            await supabase
              .from('kanban_cards')
              .update({ column_id: targetCol.id })
              .eq('id', card.id);
          }
        }
      }

      // 4. Update lead profile (if VENDA)
      if (category === 'VENDA' && contactId) {
        const saleValue = parseCurrency(valueDisplay);
        await supabase
          .from('lead_profiles')
          .upsert({
            contact_id: contactId,
            average_ticket: saleValue,
            last_purchase: new Date().toISOString(),
            notes: notes || null,
          }, { onConflict: 'contact_id' });
      }

      // 5. Notify UI
      onResolved(conversation.id, 'resolvida');

      // 6. Broadcast status change
      import('@/lib/helpdeskBroadcast').then(({ broadcastStatusChanged }) => {
        broadcastStatusChanged(conversation.id, 'resolvida');
      }).catch(() => {});

      toast.success(
        category === 'VENDA' ? `Venda de ${valueDisplay} registrada!` :
        category === 'PERDIDO' ? 'Atendimento encerrado como perdido' :
        category === 'SUPORTE' ? 'Suporte finalizado' :
        'Marcado como spam',
        { description: 'Conversa resolvida' + (category === 'VENDA' || category === 'PERDIDO' ? ' · Card movido no Kanban' : '') }
      );

      setOpen(false);
      reset();
    } catch (err) {
      console.error('Error resolving ticket:', err);
      toast.error('Erro ao finalizar atendimento');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, category, lostReason, valueDisplay, notes, conversation, onResolved, submitting]);

  return (
    <Drawer open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className="max-h-[80vh]">
        <div className="mx-auto w-full max-w-md flex flex-col max-h-[calc(80vh-2rem)]">
          <DrawerHeader className="px-4 pt-2 pb-2 flex-shrink-0">
            <DrawerTitle className="text-base">Finalizar Atendimento</DrawerTitle>
            <DrawerDescription className="text-xs">Selecione o resultado e finalize</DrawerDescription>
          </DrawerHeader>

          {/* Scrollable content area — ensures inputs stay visible above mobile keyboard */}
          <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-3">

            {/* Step 1: Category — compact after selection */}
            {!category ? (
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Resultado</label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => { setCategory(cat.value); setLostReason(null); }}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all min-h-[44px] border-border bg-card hover:bg-muted active:scale-95`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* After selecting: show compact selected badge + change button */
              <div className="flex items-center gap-2">
                {(() => {
                  const cat = CATEGORIES.find(c => c.value === category)!;
                  const Icon = cat.icon;
                  return (
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium ${cat.bgColor} ${cat.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                      {cat.label}
                    </div>
                  );
                })()}
                <button
                  type="button"
                  onClick={() => { setCategory(null); setLostReason(null); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  trocar
                </button>
              </div>
            )}

            {/* Step 2: Conditional fields */}
            {category && (
              <div className="space-y-3">

                {/* VENDA: Currency input */}
                {category === 'VENDA' && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Valor da Venda *</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={valueDisplay}
                        onChange={(e) => setValueDisplay(formatCurrency(e.target.value))}
                        onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                        placeholder="R$ 0,00"
                        className="pl-9 h-12 text-xl font-bold"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                )}

                {/* PERDIDO: Reason chips */}
                {category === 'PERDIDO' && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Motivo *</label>
                    <div className="flex flex-wrap gap-1.5">
                      {LOST_REASONS.map(r => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => setLostReason(r.value)}
                          className={`px-3 py-2 rounded-lg border text-sm transition-all min-h-[44px] active:scale-95 ${
                            lostReason === r.value
                              ? 'bg-red-500/10 border-red-500/30 text-red-400 ring-1 ring-red-500/30'
                              : 'border-border hover:bg-muted'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Observações {category === 'SUPORTE' ? '*' : '(opcional)'}
                  </label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                    placeholder={
                      category === 'SUPORTE' ? 'Descreva a resolução...' :
                      category === 'VENDA' ? 'Detalhes da venda...' :
                      'Notas...'
                    }
                    rows={2}
                    className="resize-none text-sm"
                  />
                </div>

                {/* Tags preview */}
                <div className="flex items-center gap-1 flex-wrap">
                  <Tag className="w-3 h-3 text-muted-foreground" />
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">{TAG_MAP[category]}</Badge>
                  {category === 'PERDIDO' && lostReason && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">motivo:{lostReason.toLowerCase()}</Badge>
                  )}
                  {category === 'VENDA' && parseCurrency(valueDisplay) > 0 && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">valor:{parseCurrency(valueDisplay)}</Badge>
                  )}
                  {(category === 'VENDA' || category === 'PERDIDO') && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-primary">kanban → {KANBAN_COLUMN_MAP[category]}</Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Submit button — fixed bottom with safe area padding */}
          <div className="flex-shrink-0 px-4 pt-3 pb-4 border-t bg-background" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className={`w-full h-12 text-sm font-semibold ${submitColor}`}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Finalizando...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-2" />{submitLabel}</>
              )}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
