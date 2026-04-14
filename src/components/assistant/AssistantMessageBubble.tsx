// M19 S5: Bolha de mensagem do assistente IA
import type { AssistantMessage } from '@/hooks/useAssistantChat';
import { Sparkles, User } from 'lucide-react';

interface Props {
  message: AssistantMessage;
}

export default function AssistantMessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
        isUser ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
      }`}>
        {isUser ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
      </div>

      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
        isUser
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted'
      }`}>
        {/* Texto principal */}
        <div className="whitespace-pre-wrap">{message.content}</div>

        {/* Tabela inline se format_type === 'table' */}
        {message.format_type === 'table' && Array.isArray(message.data) && message.data.length > 0 && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  {Object.keys(message.data[0]).map(key => (
                    <th key={key} className="text-left py-1 px-2 border-b border-primary/10 font-medium">
                      {key.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {message.data.slice(0, 10).map((row, i) => (
                  <tr key={i}>
                    {Object.values(row as Record<string, unknown>).map((val, j) => (
                      <td key={j} className="py-1 px-2 border-b border-primary/5">
                        {typeof val === 'number' ? val.toLocaleString('pt-BR') : String(val ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Número destacado */}
        {message.format_type === 'number' && message.data && !Array.isArray(message.data) && (
          <div className="mt-1 text-lg font-semibold text-primary">
            {Object.entries(message.data)
              .filter(([, v]) => typeof v === 'number')
              .map(([k, v]) => (
                <span key={k} className="mr-3">
                  {(v as number).toLocaleString('pt-BR')}
                </span>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
