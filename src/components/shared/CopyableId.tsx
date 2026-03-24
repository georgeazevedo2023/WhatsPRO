import React, { useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface CopyableIdProps {
  label: string;
  id: string;
  icon: React.ElementType;
  className?: string;
}

export const CopyableId = ({ label, id, icon: Icon, className = '' }: CopyableIdProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(id);
    toast.success(`${label} copiado!`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleCopy}
            className={`group inline-flex items-center gap-2 bg-muted/30 hover:bg-primary/10 border border-border/40 hover:border-primary/40 rounded-lg px-3 py-2 transition-all duration-200 cursor-pointer w-full sm:w-auto ${className}`}
          >
            <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            <div className="flex flex-col items-start min-w-0 flex-1">
              <span className="text-[11px] text-muted-foreground/70 font-medium leading-none mb-0.5">{label}</span>
              <code className="text-xs font-mono text-foreground/80 group-hover:text-foreground transition-colors truncate max-w-full block">
                {id}
              </code>
            </div>
            {copied ? (
              <Check className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all shrink-0" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">Clique para copiar</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default CopyableId;
