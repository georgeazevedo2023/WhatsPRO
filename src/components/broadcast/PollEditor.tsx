// M17 F4: Editor de Enquete para Broadcast
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Image as ImageIcon } from 'lucide-react';

export interface PollData {
  question: string;
  options: string[];
  selectableCount: 0 | 1;
  imageBeforePoll: boolean;
  imageUrl?: string;
  imageFile?: File;
}

export function createEmptyPoll(): PollData {
  return { question: '', options: ['', ''], selectableCount: 1, imageBeforePoll: false };
}

interface PollEditorProps {
  value: PollData;
  onChange: (v: PollData) => void;
  disabled?: boolean;
}

export function PollEditor({ value, onChange, disabled }: PollEditorProps) {
  const updateOption = (idx: number, text: string) => {
    const newOptions = [...value.options];
    newOptions[idx] = text;
    onChange({ ...value, options: newOptions });
  };

  const addOption = () => {
    if (value.options.length >= 12) return;
    onChange({ ...value, options: [...value.options, ''] });
  };

  const removeOption = (idx: number) => {
    if (value.options.length <= 2) return;
    const newOptions = value.options.filter((_, i) => i !== idx);
    onChange({ ...value, options: newOptions });
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onChange({ ...value, imageFile: file, imageUrl: URL.createObjectURL(file) });
    }
  };

  return (
    <div className="space-y-4">
      {/* Pergunta */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Pergunta da enquete</Label>
        <Textarea
          value={value.question}
          onChange={(e) => onChange({ ...value, question: e.target.value })}
          placeholder="Ex: Qual tema voce prefere?"
          maxLength={255}
          rows={2}
          disabled={disabled}
          className="resize-none text-sm"
        />
        <p className="text-[10px] text-muted-foreground text-right">{value.question.length}/255</p>
      </div>

      {/* Opcoes */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Opcoes ({value.options.length}/12)</Label>
        <div className="space-y-2">
          {value.options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-5 text-center">{idx + 1}</span>
              <Input
                value={opt}
                onChange={(e) => updateOption(idx, e.target.value)}
                placeholder={`Opcao ${idx + 1}`}
                maxLength={100}
                disabled={disabled}
                className="text-sm flex-1"
              />
              {value.options.length > 2 && (
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => removeOption(idx)}
                  disabled={disabled}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
        {value.options.length < 12 && (
          <Button variant="outline" size="sm" className="gap-1 text-xs mt-1" onClick={addOption} disabled={disabled}>
            <Plus className="h-3 w-3" /> Adicionar opcao
          </Button>
        )}
      </div>

      {/* Selecao unica/multipla */}
      <div className="flex items-center gap-2">
        <Switch
          checked={value.selectableCount === 0}
          onCheckedChange={(multi) => onChange({ ...value, selectableCount: multi ? 0 : 1 })}
          disabled={disabled}
          id="poll-multi"
        />
        <Label htmlFor="poll-multi" className="text-xs">Permitir selecao multipla</Label>
      </div>

      {/* D1: Imagem antes da enquete */}
      <Card className="border-dashed">
        <CardContent className="py-3 space-y-2">
          <div className="flex items-center gap-2">
            <Switch
              checked={value.imageBeforePoll}
              onCheckedChange={(v) => onChange({ ...value, imageBeforePoll: v })}
              disabled={disabled}
              id="poll-image"
            />
            <Label htmlFor="poll-image" className="text-xs flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              Enviar imagem antes da enquete
            </Label>
          </div>
          {value.imageBeforePoll && (
            <div className="space-y-1">
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageFile}
                disabled={disabled}
                className="text-xs"
              />
              {value.imageUrl && (
                <img src={value.imageUrl} alt="Preview" className="h-20 w-auto rounded object-cover" />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
