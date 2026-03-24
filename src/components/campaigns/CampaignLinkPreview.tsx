import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface CampaignLinkPreviewProps {
  url: string;
  label?: string;
}

export function CampaignLinkPreview({ url, label = 'Link de rastreamento' }: CampaignLinkPreviewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-muted-foreground">{label}</label>}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
        <code className="flex-1 text-sm truncate select-all">{url}</code>
        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={handleCopy}>
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}
