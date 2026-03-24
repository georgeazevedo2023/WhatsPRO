import { Button } from '@/components/ui/button';
import { Server, Database } from 'lucide-react';
import type { Instance } from '@/types';

interface LeadDatabase {
  id: string;
  name: string;
  description: string | null;
  leads_count: number;
  created_at: string;
  updated_at: string;
}

interface BroadcasterHeaderProps {
  instance?: Instance | null;
  database?: LeadDatabase | LeadDatabase[] | null;
  onChangeInstance?: () => void;
  onChangeDatabase?: () => void;
  showDatabase?: boolean;
}

const BroadcasterHeader = ({
  instance,
  database,
  onChangeInstance,
  onChangeDatabase,
  showDatabase = true,
}: BroadcasterHeaderProps) => {
  if (!instance) return null;

  const databases = Array.isArray(database) ? database : database ? [database] : [];
  const totalLeads = databases.reduce((sum, d) => sum + (d.leads_count || 0), 0);
  const databaseLabel = databases.length === 0
    ? null
    : databases.length === 1
      ? databases[0].name
      : `${databases.length} bases`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2.5 bg-muted/40 rounded-lg border text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Server className="w-4 h-4 shrink-0" />
        <span className="font-medium text-foreground truncate">{instance.name}</span>
        {onChangeInstance && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
            onClick={onChangeInstance}
          >
            Trocar
          </Button>
        )}
      </div>

      {showDatabase && databaseLabel && (
        <>
          <div className="hidden sm:block w-px h-4 bg-border" />
          <div className="flex items-center gap-2 text-muted-foreground">
            <Database className="w-4 h-4 shrink-0" />
            <span className="font-medium text-foreground truncate">{databaseLabel}</span>
            <span className="text-xs shrink-0">({totalLeads})</span>
            {onChangeDatabase && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                onClick={onChangeDatabase}
              >
                Trocar
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default BroadcasterHeader;
