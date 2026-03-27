import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building2, Clock, MapPin, Phone, CreditCard, Truck, Info } from 'lucide-react';

interface BusinessInfoConfigProps {
  config: Record<string, any>;
  onChange: (updates: Record<string, any>) => void;
}

export function BusinessInfoConfig({ config, onChange }: BusinessInfoConfigProps) {
  const bi = config.business_info || {};

  const update = (field: string, value: string) => {
    onChange({ business_info: { ...bi, [field]: value || undefined } });
  };

  const fields = [
    { key: 'hours', label: 'Horário de Funcionamento', icon: Clock, placeholder: 'Seg-Sex 8h-18h, Sáb 8h-12h', type: 'input' as const },
    { key: 'address', label: 'Endereço', icon: MapPin, placeholder: 'Rua Exemplo 123, Centro, Cidade-UF', type: 'input' as const },
    { key: 'phone', label: 'Telefone / WhatsApp', icon: Phone, placeholder: '(81) 99999-9999', type: 'input' as const },
    { key: 'payment_methods', label: 'Formas de Pagamento', icon: CreditCard, placeholder: 'PIX, cartão de crédito/débito, boleto, dinheiro', type: 'input' as const },
    { key: 'delivery_info', label: 'Informações de Entrega', icon: Truck, placeholder: 'Entrega própria para Recife e região metropolitana', type: 'input' as const },
    { key: 'extra', label: 'Outras Informações', icon: Info, placeholder: 'Estacionamento gratuito, Wi-Fi disponível, CNPJ...', type: 'textarea' as const },
  ];

  const filledCount = fields.filter(f => bi[f.key]?.trim()).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Informações da Empresa
            {filledCount > 0 && (
              <span className="text-xs font-normal text-muted-foreground ml-auto">{filledCount}/{fields.length} preenchidos</span>
            )}
          </CardTitle>
          <CardDescription>
            Dados que o agente de IA usará para responder perguntas dos leads. Campos vazios resultam em transferência para atendente humano.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.key} className={`space-y-1.5 ${f.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
                  <Label className="text-xs flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    {f.label}
                  </Label>
                  {f.type === 'textarea' ? (
                    <Textarea
                      value={bi[f.key] || ''}
                      onChange={(e) => update(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="min-h-[60px] resize-none text-sm"
                    />
                  ) : (
                    <Input
                      value={bi[f.key] || ''}
                      onChange={(e) => update(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="text-sm"
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-4">
            Quando o lead perguntar sobre algo preenchido aqui, o agente responde diretamente. Se o campo estiver vazio, o agente transfere para um atendente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
