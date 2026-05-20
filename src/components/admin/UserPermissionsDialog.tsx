import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { handleError } from '@/lib/errorUtils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, Loader2, Info } from 'lucide-react';
import {
  FEATURE_KEYS,
  FEATURE_LABELS,
  type FeatureKey,
} from '@/hooks/useFeaturePermission';

interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userRole: 'super_admin' | 'gerente' | 'user';
}

type State = Record<FeatureKey, boolean | null>;

function makeEmptyState(): State {
  const s: Partial<State> = {};
  for (const k of FEATURE_KEYS) s[k] = null;
  return s as State;
}

export function UserPermissionsDialog({
  open,
  onOpenChange,
  userId,
  userName,
  userRole,
}: UserPermissionsDialogProps) {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [overrides, setOverrides] = useState<State>(makeEmptyState());

  // Reset + fetch ao abrir
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setOverrides(makeEmptyState());

    (async () => {
      const { data, error } = await supabase
        .from('user_feature_permissions')
        .select('feature_key, can_edit')
        .eq('user_id', userId);

      if (cancelled) return;
      if (error) {
        handleError(error, 'Não foi possível carregar permissões');
        setLoading(false);
        return;
      }
      const next = makeEmptyState();
      for (const row of data || []) {
        if (FEATURE_KEYS.includes(row.feature_key as FeatureKey)) {
          next[row.feature_key as FeatureKey] = row.can_edit;
        }
      }
      setOverrides(next);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  // Resolve toggle inicial: override existente OU fallback por role
  const resolveEffective = (feature: FeatureKey): boolean => {
    const override = overrides[feature];
    if (override !== null) return override;
    if (userRole === 'super_admin') return true;
    if (userRole === 'gerente') return true;
    return false;
  };

  const handleToggle = async (feature: FeatureKey, nextValue: boolean) => {
    setSaving(true);
    const previousOverride = overrides[feature];

    // Estratégia: sempre escrever uma row de override. Pra gerente, isso permite
    // tanto manter true (no-op) quanto revogar (false). Pra user, vira o way de conceder.
    const payload = {
      user_id: userId,
      feature_key: feature,
      can_edit: nextValue,
      can_view: true,
      granted_by: currentUser?.id ?? null,
    };

    const { error } = await supabase
      .from('user_feature_permissions')
      .upsert(payload, { onConflict: 'user_id,feature_key' });

    if (error) {
      handleError(error, `Erro ao salvar permissão "${FEATURE_LABELS[feature].label}"`);
      // rollback otimista
      setOverrides({ ...overrides, [feature]: previousOverride });
    } else {
      setOverrides({ ...overrides, [feature]: nextValue });
      toast.success(`Permissão atualizada: ${FEATURE_LABELS[feature].label}`);
    }
    setSaving(false);
  };

  const handleResetToDefault = async (feature: FeatureKey) => {
    setSaving(true);
    const previousOverride = overrides[feature];
    const { error } = await supabase
      .from('user_feature_permissions')
      .delete()
      .eq('user_id', userId)
      .eq('feature_key', feature);

    if (error) {
      handleError(error, 'Erro ao remover override');
      setOverrides({ ...overrides, [feature]: previousOverride });
    } else {
      setOverrides({ ...overrides, [feature]: null });
      toast.success(`Permissão "${FEATURE_LABELS[feature].label}" voltou ao padrão do role`);
    }
    setSaving(false);
  };

  const isSuperAdminTarget = userRole === 'super_admin';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-primary" />
            Permissões de {userName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Configure quais áreas este usuário pode gerenciar.{' '}
            <Badge variant="secondary" className="text-[10px] ml-1">
              {userRole === 'super_admin' ? 'Super Admin' : userRole === 'gerente' ? 'Gerente' : 'Atendente'}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        {isSuperAdminTarget && (
          <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-xs flex items-start gap-2">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>Super Admin tem acesso a todas as áreas automaticamente. Não é necessário configurar.</span>
          </div>
        )}

        <div className="space-y-3 max-h-[60vh] overflow-y-auto py-2">
          {loading ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : (
            FEATURE_KEYS.map((feature) => {
              const meta = FEATURE_LABELS[feature];
              const effective = resolveEffective(feature);
              const hasOverride = overrides[feature] !== null;

              return (
                <div
                  key={feature}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-tight">
                      {meta.label}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      {meta.description}
                    </p>
                    {hasOverride && !isSuperAdminTarget && (
                      <button
                        type="button"
                        onClick={() => handleResetToDefault(feature)}
                        disabled={saving}
                        className="text-[10px] text-muted-foreground hover:text-foreground mt-1.5 underline underline-offset-2 disabled:opacity-50"
                      >
                        usar padrão do role
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!hasOverride && !isSuperAdminTarget && (
                      <Badge variant="outline" className="text-[9px] h-5">
                        padrão
                      </Badge>
                    )}
                    <Switch
                      checked={effective}
                      onCheckedChange={(v) => handleToggle(feature, v)}
                      disabled={saving || isSuperAdminTarget}
                      aria-label={`Permitir ${meta.label}`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
