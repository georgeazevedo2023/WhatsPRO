import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldBan, Plus, X, Phone } from 'lucide-react';

interface BlockedNumbersConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
}

export function BlockedNumbersConfig({ config, onChange }: BlockedNumbersConfigProps) {
  const numbers: string[] = config.blocked_numbers || [];
  const [newNumber, setNewNumber] = useState('');
  const [numberError, setNumberError] = useState('');

  const addNumber = () => {
    const num = newNumber.trim().replace(/\D/g, '');
    if (!num || !/^\d{10,15}$/.test(num)) {
      setNumberError('Número inválido — use DDI+DDD+número (10-15 dígitos)');
      return;
    }
    if (numbers.includes(num)) return;
    onChange({ blocked_numbers: [...numbers, num] });
    setNewNumber('');
    setNumberError('');
  };

  const removeNumber = (num: string) => {
    onChange({ blocked_numbers: numbers.filter(n => n !== num) });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldBan className="w-4 h-4 text-orange-500" />
            Números Bloqueados
          </CardTitle>
          <CardDescription>
            Números que a IA nunca deve responder nesta instância. Use para equipe interna, fornecedores ou números de teste.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Number list */}
          {numbers.length > 0 ? (
            <div className="space-y-2">
              {numbers.map(num => (
                <div key={num} className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm font-mono">{num.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4')}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeNumber(num)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <ShieldBan className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Nenhum número bloqueado</p>
            </div>
          )}

          {/* Add number */}
          <div className="border-t pt-4">
            <Label className="text-xs text-muted-foreground mb-2 block">Adicionar número</Label>
            <div className="flex items-center gap-2">
              <Input
                value={newNumber}
                onChange={e => { setNewNumber(e.target.value); if (numberError) setNumberError(''); }}
                placeholder="5511999999999"
                className="h-8 text-sm flex-1 font-mono"
                onKeyDown={e => e.key === 'Enter' && addNumber()}
              />
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={addNumber} disabled={!newNumber.trim()}>
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </Button>
            </div>
            {numberError && <p className="text-destructive text-xs mt-1">{numberError}</p>}
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Digite o número com código do país (ex: 5511999999999). A IA não responderá mensagens deste número.
            </p>
          </div>

          {/* Summary */}
          {numbers.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
              <Badge variant="secondary" className="text-[9px]">{numbers.length}</Badge>
              <span>número{numbers.length > 1 ? 's' : ''} bloqueado{numbers.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
