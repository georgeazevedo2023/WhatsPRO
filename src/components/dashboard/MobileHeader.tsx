import { Button } from '@/components/ui/button';
import { MessageSquareMore, Menu, Search } from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';
import { useAuth } from '@/contexts/AuthContext';

interface MobileHeaderProps {
  onOpenMenu: () => void;
  onOpenSearch?: () => void;
}

const MobileHeader = ({ onOpenMenu, onOpenSearch }: MobileHeaderProps) => {
  const { isSuperAdmin } = useAuth();
  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-primary/10 sidebar-glass shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <MessageSquareMore className="w-4 h-4 text-primary" />
        </div>
        <span className="font-display font-bold text-lg">WhatsPRO</span>
      </div>
      <div className="flex items-center gap-1">
        {isSuperAdmin && <NotificationBell />}
        {onOpenSearch && (
          <Button variant="ghost" size="icon" onClick={onOpenSearch} aria-label="Buscar">
            <Search className="w-5 h-5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onOpenMenu}>
          <Menu className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
};

export default MobileHeader;
