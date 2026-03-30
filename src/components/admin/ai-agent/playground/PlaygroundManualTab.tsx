import { useEffect, useRef } from 'react';
import {
  type ChatMessage, type Overrides,
  TOOL_META, ALL_TOOLS, MODELS, PERSONAS,
} from '@/types/playground';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent } from '@/components/ui/card';
import {
  Bot, Send, User, Loader2, Clock, Zap,
  Wrench, MessageSquare, FileImage,
  ThumbsUp, ThumbsDown, ChevronDown,
  Copy, Play, Mic, UserCircle,
} from 'lucide-react';
import { toast } from 'sonner';

export interface PlaygroundManualTabProps {
  messages: ChatMessage[];
  sending: boolean;
  input: string;
  attachedImage: string | null;
  bufferMode: boolean;
  bufferSec: number;
  bufferCountdown: number;
  showOverrides: boolean;
  overrides: Overrides;
  selectedAgent: { name: string; model: string | null } | undefined;
  totalTokens: { input: number; output: number };
  avgLatency: number;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onClear: () => void;
  onAttachImage: (dataUrl: string) => void;
  onBufferModeChange: (v: boolean) => void;
  onBufferSecChange: (v: number) => void;
  onOverridesChange: (o: Overrides) => void;
  onShowOverridesToggle: () => void;
  onRateMessage: (id: string, rating: 'approved' | 'disapproved') => void;
  onReplayMessage: (idx: number) => void;
  onRunPersona: (persona: typeof PERSONAS[0]) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onExportConversation: (format: 'json' | 'md') => void;
}

export const PlaygroundManualTab = ({
  messages, sending, input, attachedImage, bufferMode, bufferSec, bufferCountdown,
  showOverrides, overrides, selectedAgent, totalTokens, avgLatency,
  onInputChange, onSend, onClear, onAttachImage, onBufferModeChange, onBufferSecChange,
  onOverridesChange, onRateMessage, onReplayMessage, onRunPersona, onKeyDown,
}: PlaygroundManualTabProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Auto-scroll when messages change */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const renderChatMessages = () => (
    <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef}>
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3 text-muted-foreground">
          <MessageSquare className="w-10 h-10 opacity-20" />
          <p className="text-sm">Envie uma mensagem para testar o agente</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {messages.map((msg, idx) => {
            if (msg.role === 'system' && msg.tool_calls?.length) {
              return (
                <div key={msg.id} className="flex justify-center py-0.5">
                  <div className="flex flex-wrap gap-1 justify-center max-w-[95%]">
                    {msg.tool_calls.map((tc, i) => {
                      const meta = TOOL_META[tc.name] || { icon: Wrench, label: tc.name, color: 'text-muted-foreground bg-muted border-border' };
                      const Icon = meta.icon;
                      return (
                        <Collapsible key={i}>
                          <CollapsibleTrigger className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium ${meta.color} cursor-pointer hover:opacity-80 transition-all`}>
                            <Icon className="w-3 h-3" />{meta.label}<ChevronDown className="w-2.5 h-2.5 ml-0.5" />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-1">
                            <div className="text-[10px] bg-background/80 rounded-lg p-2 border border-border/50 max-w-xs">
                              <p className="font-mono font-semibold mb-0.5">{tc.name}()</p>
                              {Object.entries(tc.args || {}).map(([k, v]) => (<p key={k} className="text-muted-foreground"><span className="text-foreground">{k}:</span> {Array.isArray(v) ? (v as string[]).join(', ') : String(v)}</p>))}
                              {tc.result && <p className="mt-1 text-emerald-400 border-t border-border/30 pt-1">{tc.result}</p>}
                              {tc.duration_ms != null && <p className="text-muted-foreground">{tc.duration_ms}ms</p>}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                </div>
              );
            }
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex gap-2 justify-end">
                  <div className="max-w-[75%] space-y-0.5">
                    {msg.media_type === 'audio' && (<div className="flex items-center gap-2 bg-primary rounded-2xl rounded-tr-md px-3 py-2"><Mic className="w-3.5 h-3.5 text-primary-foreground/70" /><span className="text-xs text-primary-foreground/80">Audio</span></div>)}
                    {msg.content && msg.media_type !== 'audio' && (<div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-md px-3.5 py-2"><p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p></div>)}
                    <div className="flex items-center gap-1.5 justify-end pr-0.5">
                      <span className="text-[9px] text-muted-foreground">#{idx + 1} · {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      <button onClick={() => onReplayMessage(idx)} disabled={sending} className="p-0.5 rounded text-muted-foreground/30 hover:text-primary transition-colors disabled:opacity-30" title="Replay"><Play className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1"><User className="w-3 h-3 text-secondary-foreground" /></div>
                </div>
              );
            }
            return (
              <div key={msg.id} className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1"><Bot className="w-3 h-3 text-primary" /></div>
                <div className="max-w-[78%] space-y-0.5">
                  <div className={`bg-muted/80 rounded-2xl rounded-tl-md px-3.5 py-2 border ${msg.rating === 'approved' ? 'border-emerald-500/30' : msg.rating === 'disapproved' ? 'border-red-500/30' : 'border-transparent'}`}>
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  <div className="flex items-center gap-1.5 pl-0.5">
                    <span className="text-[9px] text-muted-foreground">#{idx + 1} · {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    {msg.latency_ms != null && <span className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Clock className="w-2 h-2" />{msg.latency_ms}ms</span>}
                    {msg.tokens && <span className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Zap className="w-2 h-2" />{msg.tokens.input + msg.tokens.output}</span>}
                    <span className="mx-0.5" />
                    <button onClick={() => onRateMessage(msg.id, 'approved')} className={`p-0.5 rounded transition-colors ${msg.rating === 'approved' ? 'text-emerald-400' : 'text-muted-foreground/30 hover:text-emerald-400'}`}><ThumbsUp className="w-3 h-3" /></button>
                    <button onClick={() => onRateMessage(msg.id, 'disapproved')} className={`p-0.5 rounded transition-colors ${msg.rating === 'disapproved' ? 'text-red-400' : 'text-muted-foreground/30 hover:text-red-400'}`}><ThumbsDown className="w-3 h-3" /></button>
                    <button onClick={() => { navigator.clipboard.writeText(msg.content); toast.success('Copiado'); }} className="p-0.5 rounded text-muted-foreground/30 hover:text-foreground transition-colors"><Copy className="w-3 h-3" /></button>
                  </div>
                </div>
              </div>
            );
          })}
          {sending && (
            <div className="flex gap-2 justify-start">
              <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-1"><Bot className="w-3 h-3 text-primary animate-pulse" /></div>
              <div className="bg-muted/80 rounded-2xl rounded-tl-md px-4 py-3"><div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:0ms]" /><div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:150ms]" /><div className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:300ms]" /></div></div>
            </div>
          )}
        </div>
      )}
    </ScrollArea>
  );

  const renderInputBar = () => (
    <div className={`border-t p-2.5 flex items-end gap-1.5 flex-shrink-0 ${bufferMode ? 'border-amber-500/30' : 'border-border/50'}`}>
      <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; if (!f.type.startsWith('image/')) { toast.error('Apenas imagens'); return; } onAttachImage(URL.createObjectURL(f)); e.target.value = ''; }} />
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={() => fileInputRef.current?.click()} disabled={sending}><FileImage className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent>Imagem</TooltipContent></Tooltip>
      <Textarea ref={inputRef} value={input} onChange={(e) => onInputChange(e.target.value)} onKeyDown={onKeyDown} placeholder="Digite uma mensagem... (Enter envia)" disabled={sending || !selectedAgent} rows={1} className="flex-1 min-h-[36px] max-h-[100px] resize-none border-0 bg-transparent focus-visible:ring-0 text-sm py-2" />
      <Button size="icon" className="h-8 w-8 shrink-0 rounded-xl" onClick={onSend} disabled={(!input.trim() && !attachedImage) || sending || !selectedAgent}>
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      </Button>
    </div>
  );

  return (
    <TabsContent value="manual" className="flex-1 min-h-0">
      {/* Overrides */}
      {showOverrides && (
        <Card className="flex-shrink-0 border-primary/20 bg-primary/5 mb-2">
          <CardContent className="p-3 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Modelo</label><Select value={overrides.model} onValueChange={v => onOverridesChange({ ...overrides, model: v })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{MODELS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Temperatura: {overrides.temperature.toFixed(1)}</label><Slider value={[overrides.temperature]} min={0} max={2} step={0.1} onValueChange={([v]) => onOverridesChange({ ...overrides, temperature: v })} className="mt-2" /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Max Tokens: {overrides.maxTokens}</label><Slider value={[overrides.maxTokens]} min={128} max={8192} step={128} onValueChange={([v]) => onOverridesChange({ ...overrides, maxTokens: v })} className="mt-2" /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Buffer/Debounce</label><div className="flex items-center gap-2 mt-1"><Switch checked={bufferMode} onCheckedChange={onBufferModeChange} /><span className="text-xs">{bufferMode ? `${bufferSec}s` : 'Off'}</span>{bufferMode && <Slider value={[bufferSec]} min={3} max={30} step={1} onValueChange={([v]) => onBufferSecChange(v)} className="w-20" />}</div></div>
            </div>
            <div><label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block">Tools ativas</label>
              <div className="flex flex-wrap gap-1.5">{ALL_TOOLS.map(name => { const meta = TOOL_META[name]; const Icon = meta.icon; const disabled = overrides.disabledTools.has(name); return (
                <button key={name} onClick={() => { const s = new Set(overrides.disabledTools); disabled ? s.delete(name) : s.add(name); onOverridesChange({ ...overrides, disabledTools: s }); }} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] transition-all ${disabled ? 'opacity-30 line-through border-border' : meta.color}`}><Icon className="w-3 h-3" />{meta.label}</button>
              ); })}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-2 flex-wrap flex-shrink-0 px-1 mb-2">
        <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-[11px]"><Bot className="w-3 h-3" />{selectedAgent?.name}</Badge>
        <Badge variant="outline" className="gap-1 px-2 py-0.5 text-[11px]"><Zap className="w-3 h-3" />{overrides.model}</Badge>
        {totalTokens.input + totalTokens.output > 0 && (
          <>
            <Badge variant="outline" className="px-2 py-0.5 text-[11px]">{(totalTokens.input + totalTokens.output).toLocaleString()} tok</Badge>
            {avgLatency > 0 && <Badge variant="outline" className="gap-1 px-2 py-0.5 text-[11px]"><Clock className="w-3 h-3" />{avgLatency}ms</Badge>}
          </>
        )}
        {bufferCountdown > 0 && <Badge variant="outline" className="gap-1 px-2 py-0.5 text-[11px] border-amber-500/30 text-amber-400">buffer {bufferCountdown}s</Badge>}
      </div>

      {/* Chat */}
      <div className="flex-1 border border-border/50 rounded-2xl bg-card/50 overflow-hidden flex flex-col min-h-0">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 text-muted-foreground p-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center">
              <Bot className="w-10 h-10 text-primary/40" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-foreground mb-1">Teste o agente em tempo real</p>
              <p className="text-sm text-muted-foreground">Envie uma mensagem ou escolha um perfil abaixo</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {PERSONAS.map(p => (
                <button key={p.name} onClick={() => onRunPersona(p)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-border/50 bg-background hover:bg-primary/5 hover:border-primary/30 transition-all">
                  <UserCircle className="w-3.5 h-3.5" />{p.name}
                </button>
              ))}
            </div>
          </div>
        ) : renderChatMessages()}
        {renderInputBar()}
      </div>
    </TabsContent>
  );
};
