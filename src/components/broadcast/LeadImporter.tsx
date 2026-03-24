import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardPaste, FileSpreadsheet, Users, Plus } from 'lucide-react';
import type { Instance } from '@/types';
import type { Lead } from '@/pages/dashboard/LeadsBroadcaster';
import PasteTab from './lead-importer/PasteTab';
import CsvTab from './lead-importer/CsvTab';
import GroupsTab from './lead-importer/GroupsTab';
import ManualTab from './lead-importer/ManualTab';

interface LeadImporterProps {
  instance: Instance;
  onLeadsImported: (leads: Lead[]) => void;
}

const LeadImporter = ({ instance, onLeadsImported }: LeadImporterProps) => {
  const [activeTab, setActiveTab] = useState<'paste' | 'csv' | 'groups' | 'manual'>('paste');

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'paste' | 'csv' | 'groups' | 'manual')}>
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="paste" className="gap-2">
          <ClipboardPaste className="w-4 h-4" />
          <span className="hidden sm:inline">Colar Lista</span>
          <span className="sm:hidden">Colar</span>
        </TabsTrigger>
        <TabsTrigger value="csv" className="gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          <span className="hidden sm:inline">Arquivo CSV</span>
          <span className="sm:hidden">CSV</span>
        </TabsTrigger>
        <TabsTrigger value="groups" className="gap-2">
          <Users className="w-4 h-4" />
          <span className="hidden sm:inline">De Grupos</span>
          <span className="sm:hidden">Grupos</span>
        </TabsTrigger>
        <TabsTrigger value="manual" className="gap-2">
          <Plus className="w-4 h-4" />
          Manual
        </TabsTrigger>
      </TabsList>

      <TabsContent value="paste">
        <PasteTab onLeadsImported={onLeadsImported} />
      </TabsContent>

      <TabsContent value="csv">
        <CsvTab onLeadsImported={onLeadsImported} />
      </TabsContent>

      <TabsContent value="groups">
        <GroupsTab instance={instance} onLeadsImported={onLeadsImported} />
      </TabsContent>

      <TabsContent value="manual">
        <ManualTab onLeadsImported={onLeadsImported} />
      </TabsContent>
    </Tabs>
  );
};

export default LeadImporter;
