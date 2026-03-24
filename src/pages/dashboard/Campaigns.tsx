import { Link } from 'react-router-dom';
import { useCampaignsList } from '@/hooks/useCampaigns';
import { CampaignTable } from '@/components/campaigns/CampaignTable';
import { Button } from '@/components/ui/button';
import { Plus, Megaphone, Loader2 } from 'lucide-react';

const Campaigns = () => {
  const { data: campaigns, isLoading } = useCampaignsList();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="w-6 h-6" />
            Campanhas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Links rastreaveis com QR Code e metricas por campanha
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link to="/dashboard/campaigns/new">
            <Plus className="w-4 h-4" />
            Nova campanha
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <CampaignTable campaigns={campaigns || []} />
      )}
    </div>
  );
};

export default Campaigns;
