import React from 'react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  desc: string;
  actionLabel?: string;
  actionIcon?: React.ElementType;
  onAction?: () => void;
}

export const EmptyState = ({ icon: Icon, title, desc, actionLabel, actionIcon: ActionIcon, onAction }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
      <Icon className="w-8 h-8 text-muted-foreground" />
    </div>
    <h3 className="font-semibold mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground mb-4">{desc}</p>
    {actionLabel && onAction && (
      <Button variant="outline" size="sm" onClick={onAction} className="gap-2">
        {ActionIcon && <ActionIcon className="w-4 h-4" />}
        {actionLabel}
      </Button>
    )}
  </div>
);

export default EmptyState;
