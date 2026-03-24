import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';

interface CampaignQrCodeProps {
  url: string;
  campaignName: string;
  size?: number;
}

export function CampaignQrCode({ url, campaignName, size = 256 }: CampaignQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!url) return;
    setLoading(true);
    QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then(setDataUrl)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [url, size]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = `qr-${campaignName.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = dataUrl;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-white p-3 inline-block">
        <img src={dataUrl} alt={`QR Code - ${campaignName}`} width={size} height={size} />
      </div>
      <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
        <Download className="w-4 h-4" />
        Baixar QR Code
      </Button>
    </div>
  );
}
