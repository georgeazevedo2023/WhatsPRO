import { useParams } from 'react-router-dom';
import { useCampaign } from '@/hooks/useCampaigns';
import { CampaignForm } from '@/components/campaigns/CampaignForm';
import { Loader2 } from 'lucide-react';

const CampaignCreate = () => {
  const { id } = useParams<{ id: string }>();
  const { data: campaign, isLoading } = useCampaign(id);

  if (id && isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return <CampaignForm campaign={campaign} />;
};

export default CampaignCreate;
