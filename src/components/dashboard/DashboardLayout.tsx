import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileHeader from './MobileHeader';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import { GlobalSearchDialog } from '@/components/helpdesk/GlobalSearchDialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import AssistantChatWidget from '@/components/assistant/AssistantChatWidget';

const DashboardLayout = () => {
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compact, setCompact] = useState(() => localStorage.getItem('wp-compact') === '1');
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('compact', compact);
    localStorage.setItem('wp-compact', compact ? '1' : '0');
  }, [compact]);

  // Ctrl+K / Cmd+K to open global search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const openSearch = useCallback(() => setSearchOpen(true), []);

  if (isMobile) {
    return (
      <div className="flex flex-col h-[100dvh] bg-aurora">
        <MobileHeader onOpenMenu={() => setMobileMenuOpen(true)} onOpenSearch={openSearch} />

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="p-0 w-72 border-r border-primary/10">
            <Sidebar isMobile onNavigate={() => setMobileMenuOpen(false)} onOpenSearch={openSearch} />
          </SheetContent>
        </Sheet>

        <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

        <main className="flex-1 overflow-y-auto">
          <div className="min-h-full p-4">
            <Outlet context={{ compact, setCompact }} />
          </div>
        </main>
        <AssistantChatWidget />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-aurora">
      <Sidebar onOpenSearch={openSearch} />
      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <main className="flex-1 overflow-y-auto">
        <div className="min-h-full p-6">
          <Breadcrumbs />
          <Outlet context={{ compact, setCompact }} />
        </div>
      </main>
      <AssistantChatWidget />
    </div>
  );
};

export default DashboardLayout;
