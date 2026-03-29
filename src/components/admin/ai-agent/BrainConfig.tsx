import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BrainCircuit, Settings2, Key, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Zap } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BrainConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
  fieldErrors?: Record<string, string>;
}

export function BrainConfig({ config, onChange, fieldErrors }: BrainConfigProps) {
  const [showKey, setShowKey] = useState(false);
  const [openaiKey, setOpenaiKey] = useState('');
  const [keyStatus, setKeyStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'testing' | 'valid' | 'invalid'>('idle');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local key state whenever the active agent changes
  useEffect(() => {
    if (config.openai_api_key) {
      setOpenaiKey(config.openai_api_key);
      setKeyStatus('saved');
    } else {
      setOpenaiKey('');
      setKeyStatus('idle');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.id]);

  const handleKeyChange = (value: string) => {
    setOpenaiKey(value);
    setKeyStatus('saving');
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const agentId = config.id as string | undefined;
    debounceTimer.current = setTimeout(async () => {
      // Keep parent config in sync for tab switching
      onChange({ openai_api_key: value });
      if (!agentId) { setKeyStatus('saved'); return; }
      try {
        const { error } = await supabase
          .from('ai_agents')
          .update({ openai_api_key: value })
          .eq('id', agentId);
        if (error) throw error;
        setKeyStatus('saved');
      } catch (err: any) {
        setKeyStatus('error');
        toast.error('Erro ao salvar chave: ' + (err?.message || String(err)));
      }
    }, 1500);
  };

  // Test the key by calling OpenAI models endpoint
  const testKey = async () => {
    if (!openaiKey.trim()) { toast.error('Cole a chave primeiro'); return; }
    setKeyStatus('testing');
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${openaiKey.trim()}` },
      });
      if (res.ok) {
        setKeyStatus('valid');
        toast.success('Chave OpenAI válida!');
      } else {
        let msg = `Erro ${res.status}`;
        try {
          const json = await res.json();
          msg = json?.error?.message || msg;
        } catch {}
        setKeyStatus('invalid');
        toast.error(`Chave inválida: ${msg}`);
      }
    } catch (err: any) {
      setKeyStatus('invalid');
      toast.error('Erro ao testar: ' + (err.message || 'Falha de rede'));
    }
  };

  const statusIcon = () => {
    switch (keyStatus) {
      case 'saving': case 'testing': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'saved': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'valid': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error': case 'invalid': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const statusText = () => {
    switch (keyStatus) {
      case 'saving': return 'Salvando...';
      case 'saved': return 'Salvo';
      case 'testing': return 'Testando...';
      case 'valid': return 'Válida!';
      case 'error': return 'Erro ao salvar';
      case 'invalid': return 'Inválida';
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* OpenAI API Key — auto-save to system_settings */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-500" />
            Chave da API OpenAI
            {statusIcon()}
            {statusText() && <span className="text-xs font-normal text-muted-foreground">{statusText()}</span>}
          </CardTitle>
          <CardDescription>Necessária para o modelo GPT-4.1 Mini funcionar como LLM principal do agente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? 'text' : 'password'}
                value={openaiKey}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder="Cole sua chave OpenAI aqui..."
                className="font-mono text-xs pr-9"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={testKey}
              disabled={keyStatus === 'testing' || !openaiKey.trim()}
              className="shrink-0"
            >
              {keyStatus === 'testing'
                ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
                : <Zap className="w-4 h-4 mr-1" />}
              Testar
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Auto-salva ao digitar. Chave salva por agente — as Edge Functions a utilizam automaticamente.
            A chave Gemini continua sendo usada para transcrição de áudio e TTS.
          </p>
        </CardContent>
      </Card>

      {/* Prompt principal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-primary" />
            Prompt do Orquestrador
          </CardTitle>
          <CardDescription>Instruções principais que guiam o comportamento do agente em todas as interações</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">System Prompt</Label>
            <Textarea
              value={config.system_prompt || ''}
              onChange={(e) => onChange({ system_prompt: e.target.value })}
              placeholder={`Você é um assistente de vendas especializado em [segmento].

Seu objetivo é:
1. Qualificar o interesse do lead
2. Apresentar produtos relevantes
3. Responder dúvidas com base no catálogo
4. Transferir para atendente quando necessário

Informações da empresa:
- Nome: [Empresa]
- Horário: Seg-Sex 8h-18h
- Endereço: [Endereço]
- WhatsApp do gerente: [Número]`}
              className="min-h-[200px] resize-y font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              {(config.system_prompt || '').length} caracteres — Quanto mais detalhado, melhor o agente se comporta
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Parâmetros do modelo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-primary" />
            Parâmetros do Modelo
          </CardTitle>
          <CardDescription>Ajuste o modelo e criatividade das respostas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Modelo</Label>
              <Select value={config.model || 'gpt-4.1-mini'} onValueChange={(v) => onChange({ model: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini (principal, rápido)</SelectItem>
                  <SelectItem value="gpt-4.1-nano">GPT-4.1 Nano (ultra-rápido, econômico)</SelectItem>
                  <SelectItem value="gpt-4.1">GPT-4.1 (avançado)</SelectItem>
                  <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash (fallback)</SelectItem>
                  <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro (avançado)</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors?.model && <p className="text-destructive text-xs mt-1">{fieldErrors.model}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max Tokens</Label>
              <Input
                type="number"
                value={config.max_tokens || 1024}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v)) onChange({ max_tokens: v });
                }}
                min={100}
                max={8192}
              />
              {fieldErrors?.max_tokens && <p className="text-destructive text-xs mt-1">{fieldErrors.max_tokens}</p>}
              <p className="text-[11px] text-muted-foreground">Tamanho máximo da resposta (100-8192)</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Temperatura: {(config.temperature || 0.7).toFixed(1)}</Label>
              <span className="text-[11px] text-muted-foreground">
                {(config.temperature || 0.7) <= 0.3 ? 'Preciso' : (config.temperature || 0.7) >= 0.8 ? 'Criativo' : 'Balanceado'}
              </span>
            </div>
            <Slider
              value={[config.temperature || 0.7]}
              onValueChange={([v]) => onChange({ temperature: v })}
              min={0}
              max={1}
              step={0.1}
              className="w-full"
            />
            {fieldErrors?.temperature && <p className="text-destructive text-xs mt-1">{fieldErrors.temperature}</p>}
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0 — Determinístico</span>
              <span>1 — Criativo</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Debounce (segundos)</Label>
              <Input
                type="number"
                value={config.debounce_seconds || 10}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v)) onChange({ debounce_seconds: Math.min(30, Math.max(3, v)) });
                }}
                min={3}
                max={30}
              />
              <p className="text-[11px] text-muted-foreground">Tempo de espera para agrupar mensagens (3-30s)</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contexto (mensagens)</Label>
              <Input
                type="number"
                value={config.context_short_messages || 10}
                onChange={(e) => onChange({ context_short_messages: parseInt(e.target.value) || 10 })}
                min={3}
                max={50}
              />
              <p className="text-[11px] text-muted-foreground">Últimas N mensagens enviadas ao modelo</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
