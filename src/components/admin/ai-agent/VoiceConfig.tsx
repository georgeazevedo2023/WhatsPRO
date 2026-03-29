import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, Play, Loader2, Square } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const VOICE_OPTIONS = [
  { value: 'Kore', label: 'Kore — Feminina (BR)' },
  { value: 'Aoede', label: 'Aoede — Feminina' },
  { value: 'Charon', label: 'Charon — Masculina' },
  { value: 'Fenrir', label: 'Fenrir — Masculina' },
  { value: 'Puck', label: 'Puck — Masculina' },
  { value: 'Leda', label: 'Leda — Feminina' },
];

const DEFAULT_PREVIEW_TEXT = 'Olá! Sou o assistente virtual. Como posso te ajudar hoje?';

interface VoiceConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
  fieldErrors?: Record<string, string>;
}

export function VoiceConfig({ config, onChange, fieldErrors }: VoiceConfigProps) {
  const [previewText, setPreviewText] = useState(DEFAULT_PREVIEW_TEXT);
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [audioRef] = useState<{ current: HTMLAudioElement | null }>({ current: null });

  const generatePreview = async () => {
    const text = previewText.trim();
    if (!text) { toast.error('Digite um texto para gerar o áudio'); return; }

    setGenerating(true);
    setAudioUrl(null);
    try {
      // Fetch Gemini API key from system_settings
      const { data: keyRow } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'GEMINI_API_KEY')
        .maybeSingle();

      const apiKey = keyRow?.value;
      if (!apiKey) { toast.error('GEMINI_API_KEY não configurada nos secrets'); return; }

      const voiceName = config.voice_name || 'Kore';
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `Leia o seguinte texto em português brasileiro com tom natural e amigável: "${text}"` }] }],
            generationConfig: {
              response_modalities: ['AUDIO'],
              speech_config: { voice_config: { prebuilt_voice_config: { voice_name: voiceName } } },
            },
          }),
        }
      );

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Gemini TTS retornou ${res.status}: ${errText.substring(0, 100)}`);
      }

      const data = await res.json();
      const audioPart = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
      if (!audioPart?.inlineData?.data) throw new Error('Nenhum áudio retornado pelo Gemini');

      // Convert base64 PCM to WAV (24kHz 16-bit mono — same as ai-agent)
      const raw = atob(audioPart.inlineData.data);
      const pcmBytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) pcmBytes[i] = raw.charCodeAt(i);

      const wavHeader = new ArrayBuffer(44);
      const view = new DataView(wavHeader);
      const sr = 24000, ch = 1, bps = 16;
      view.setUint32(0, 0x52494646, false); view.setUint32(4, 36 + pcmBytes.length, true); view.setUint32(8, 0x57415645, false);
      view.setUint32(12, 0x666D7420, false); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
      view.setUint16(22, ch, true); view.setUint32(24, sr, true); view.setUint32(28, sr * ch * (bps / 8), true);
      view.setUint16(32, ch * (bps / 8), true); view.setUint16(34, bps, true);
      view.setUint32(36, 0x64617461, false); view.setUint32(40, pcmBytes.length, true);

      const wavBytes = new Uint8Array(44 + pcmBytes.length);
      wavBytes.set(new Uint8Array(wavHeader), 0);
      wavBytes.set(pcmBytes, 44);

      const blob = new Blob([wavBytes], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      // Cleanup previous URL
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(url);
      toast.success('Áudio gerado!');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao gerar preview de áudio');
      console.error('[VoiceConfig] TTS preview error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const playAudio = () => {
    if (!audioUrl) return;
    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      return;
    }
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.onended = () => setPlaying(false);
    audio.onerror = () => { setPlaying(false); toast.error('Erro ao reproduzir áudio'); };
    audio.play();
    setPlaying(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="w-4 h-4 text-primary" />
            Resposta por Áudio (TTS)
          </CardTitle>
          <CardDescription>
            Quando ativado, se o lead enviar áudio, o agente responde com áudio.
            Respostas acima do limite de caracteres são enviadas como texto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Ativar TTS (Text-to-Speech)</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Gemini gera áudio para respostas curtas</p>
            </div>
            <Switch
              checked={config.voice_enabled || false}
              onCheckedChange={(v) => onChange({ voice_enabled: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Responder áudio com áudio</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quando o lead enviar áudio, o agente responde em áudio (mesmo sem TTS global ativado)
              </p>
            </div>
            <Switch
              checked={config.voice_reply_to_audio ?? true}
              onCheckedChange={(v) => onChange({ voice_reply_to_audio: v })}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Voz do Agente</Label>
            <Select value={config.voice_name || 'Kore'} onValueChange={(v) => onChange({ voice_name: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICE_OPTIONS.map(v => (
                  <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Voz utilizada pelo Gemini TTS para gerar áudio.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tamanho máximo para áudio (caracteres)</Label>
            <Input
              type="number" min={10} max={500}
              value={config.voice_max_text_length || 150}
              onChange={(e) => onChange({ voice_max_text_length: parseInt(e.target.value) || 150 })}
            />
            {fieldErrors?.voice_max_text_length && <p className="text-destructive text-xs mt-1">{fieldErrors.voice_max_text_length}</p>}
            <p className="text-[11px] text-muted-foreground">
              Respostas com até {config.voice_max_text_length || 150} caracteres são enviadas como áudio.
              Acima disso, envia como texto. Recomendado: 150.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Voice Preview */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Play className="w-4 h-4 text-primary" />
            Ouvir Amostra
          </CardTitle>
          <CardDescription>
            Teste como a voz <strong>{VOICE_OPTIONS.find(v => v.value === (config.voice_name || 'Kore'))?.label || config.voice_name}</strong> soa com um texto personalizado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Texto para gerar áudio</Label>
            <Textarea
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              placeholder="Digite o texto que deseja ouvir..."
              className="min-h-[60px] resize-none text-sm"
              maxLength={500}
            />
            <p className="text-[10px] text-muted-foreground text-right">{previewText.length}/500</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={generatePreview}
              disabled={generating || !previewText.trim()}
            >
              {generating ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</>
              ) : (
                <><Mic className="w-3.5 h-3.5" /> Gerar Áudio</>
              )}
            </Button>

            {audioUrl && (
              <Button
                size="sm"
                variant={playing ? 'destructive' : 'default'}
                className="gap-1.5 text-xs"
                onClick={playAudio}
              >
                {playing ? (
                  <><Square className="w-3.5 h-3.5" /> Parar</>
                ) : (
                  <><Play className="w-3.5 h-3.5" /> Ouvir</>
                )}
              </Button>
            )}
          </div>

          {audioUrl && (
            <audio src={audioUrl} className="w-full mt-2 h-8" controls />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
