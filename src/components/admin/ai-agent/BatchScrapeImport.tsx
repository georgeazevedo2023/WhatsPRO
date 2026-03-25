import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Globe, Loader2, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { edgeFunctionFetch } from '@/lib/edgeFunctionClient';

interface BatchScrapeImportProps {
  agentId: string;
  onImported: () => void;
}

interface ScrapeJob {
  id: string;
  status: 'scanning' | 'processing' | 'completed' | 'failed';
  progress: number;
  total: number;
  imported: number;
  duplicates: number;
  errors: number;
  error_message?: string;
}

export function BatchScrapeImport({ agentId, onImported }: BatchScrapeImportProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<ScrapeJob | null>(null);
  const pollRef = useRef<number | null>(null);

  // Polling for job status
  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }

    pollRef.current = window.setInterval(async () => {
      try {
        const res = await edgeFunctionFetch(`scrape-products-batch?job_id=${job.id}`, { method: 'GET' });
        if (res.ok) {
          const data = await res.json();
          setJob(data);
          if (data.status === 'completed') {
            onImported();
            toast.success(`${data.imported} produtos importados!`);
          }
          if (data.status === 'failed') {
            toast.error(`Falha: ${data.error_message || 'Erro desconhecido'}`);
          }
        }
      } catch {}
    }, 3000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [job?.id, job?.status]);

  const startScraping = async () => {
    if (!url.startsWith('http')) { toast.error('URL deve começar com http:// ou https://'); return; }
    setLoading(true);
    try {
      const res = await edgeFunctionFetch('scrape-products-batch', {
        method: 'POST',
        body: JSON.stringify({ url, agent_id: agentId }),
      });
      const data = await res.json();
      if (data.ok && data.job_id) {
        setJob({ id: data.job_id, status: 'scanning', progress: 0, total: 0, imported: 0, duplicates: 0, errors: 0 });
        toast.success('Escaneamento iniciado!');
      } else {
        toast.error(data.error || 'Erro ao iniciar scraping');
      }
    } catch (err) {
      toast.error('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setJob(null); setUrl(''); };

  // No job — show URL input
  if (!job) return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://site.com.br/categoria/tintas"
          className="text-xs"
        />
        <Button size="sm" disabled={loading || !url} onClick={startScraping} className="gap-1.5 shrink-0">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
          Escanear
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Cole a URL de uma página de categoria ou listagem. O sistema encontra links de produtos e importa automaticamente (máx 100).
      </p>
    </div>
  );

  // Job in progress
  const pct = job.total > 0 ? Math.round((job.progress / job.total) * 100) : 0;

  if (job.status === 'scanning') return (
    <div className="space-y-3 py-2">
      <div className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <p className="text-sm">Escaneando página em busca de produtos...</p>
      </div>
    </div>
  );

  if (job.status === 'processing') return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span>Importando produtos...</span>
        <span>{job.progress}/{job.total}</span>
      </div>
      <Progress value={pct} className="h-2" />
      <div className="flex gap-3 text-xs text-muted-foreground">
        <span className="text-emerald-500">{job.imported} importados</span>
        <span className="text-orange-500">{job.duplicates} duplicados</span>
        <span className="text-red-500">{job.errors} erros</span>
      </div>
    </div>
  );

  // Completed or failed
  return (
    <div className="space-y-3">
      {job.status === 'completed' ? (
        <div className="flex items-center gap-2 text-emerald-500">
          <Check className="w-4 h-4" />
          <span className="text-sm font-medium">Concluído!</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-red-500">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{job.error_message || 'Falha no scraping'}</span>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-lg bg-emerald-500/10">
          <p className="text-lg font-bold text-emerald-500">{job.imported}</p>
          <p className="text-[10px] text-muted-foreground">Importados</p>
        </div>
        <div className="p-2 rounded-lg bg-orange-500/10">
          <p className="text-lg font-bold text-orange-500">{job.duplicates}</p>
          <p className="text-[10px] text-muted-foreground">Duplicados</p>
        </div>
        <div className="p-2 rounded-lg bg-red-500/10">
          <p className="text-lg font-bold text-red-500">{job.errors}</p>
          <p className="text-[10px] text-muted-foreground">Erros</p>
        </div>
      </div>
      <Button variant="outline" size="sm" className="w-full" onClick={reset}>Escanear outro site</Button>
    </div>
  );
}
