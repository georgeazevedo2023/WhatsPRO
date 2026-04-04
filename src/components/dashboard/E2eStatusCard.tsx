import { memo, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, CheckCircle2, XCircle, SkipForward, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface E2eRunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  lastRun: string | null;
}

const E2eStatusCard = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<E2eRunSummary>({ total: 0, passed: 0, failed: 0, skipped: 0, lastRun: null });
  const [loading, setLoading] = useState(true);
  const [isLastBatchRegression, setIsLastBatchRegression] = useState(false);

  useEffect(() => {
    loadLatestRuns();
  }, []);

  const loadLatestRuns = async () => {
    try {
      // Get latest run timestamp
      const { data: latestRun } = await supabase
        .from('e2e_test_runs')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestRun) {
        setLoading(false);
        return;
      }

      // Get all runs from the latest batch (within 5 min window)
      const batchStart = new Date(new Date(latestRun.created_at).getTime() - 5 * 60 * 1000).toISOString();
      const { data: runs } = await supabase
        .from('e2e_test_runs')
        .select('passed, skipped, created_at')
        .gte('created_at', batchStart)
        .order('created_at', { ascending: false });

      if (runs?.length) {
        setSummary({
          total: runs.length,
          passed: runs.filter(r => r.passed).length,
          failed: runs.filter(r => !r.passed && !r.skipped).length,
          skipped: runs.filter(r => r.skipped).length,
          lastRun: runs[0].created_at,
        });
      }

      // Check last batch for regression flag
      const { data: lastBatchData } = await supabase
        .from('e2e_test_batches')
        .select('is_regression, composite_score, regression_context')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setIsLastBatchRegression(lastBatchData?.is_regression ?? false);
    } catch (err) {
      console.error('[E2eStatusCard] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !summary.lastRun) return null;

  const allPassed = summary.failed === 0;
  const statusColor = allPassed ? 'text-green-500' : 'text-red-500';
  const statusBg = allPassed ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20';

  return (
    <Card
      className="glass-card-hover cursor-pointer"
      onClick={() => navigate('/admin/ai-agent?tab=playground&subtab=e2e')}
    >
      <CardContent className="p-3 md:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <p className="text-[11px] md:text-xs text-muted-foreground truncate">E2E Tests</p>
            <p className={cn('text-xl md:text-2xl font-display font-bold leading-tight', statusColor)}>
              {summary.passed}/{summary.total}
            </p>
            <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-muted-foreground">
              {summary.failed > 0 && (
                <span className="flex items-center gap-0.5 text-red-500">
                  <XCircle className="w-3 h-3" /> {summary.failed}
                </span>
              )}
              {summary.skipped > 0 && (
                <span className="flex items-center gap-0.5">
                  <SkipForward className="w-3 h-3" /> {summary.skipped}
                </span>
              )}
              <span className="flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(summary.lastRun), { locale: ptBR, addSuffix: true })}
              </span>
              {isLastBatchRegression && (
                <span className="flex items-center gap-0.5 text-red-500 text-[10px]">
                  <AlertTriangle className="w-3 h-3" /> Regressão
                </span>
              )}
            </div>
          </div>
          <div className={cn('w-8 h-8 md:w-10 md:h-10 rounded-lg border flex items-center justify-center shrink-0', statusBg)}>
            {allPassed
              ? <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-green-500" />
              : <FlaskConical className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
            }
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default memo(E2eStatusCard);
