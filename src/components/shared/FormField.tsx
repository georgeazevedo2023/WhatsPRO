import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  icon?: React.ElementType;
  className?: string;
}

export const FormField = ({
  id, label, value, onChange, error, required, type = 'text',
  placeholder, disabled, icon: Icon, className,
}: FormFieldProps) => (
  <div className={cn('space-y-1.5', className)}>
    <Label htmlFor={id} className="text-xs text-muted-foreground">
      {label}{required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
    <div className="relative">
      {Icon && (
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      )}
      <Input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={cn(
          Icon && 'pl-11',
          'bg-muted/40 border-border/60 focus:bg-background',
          error && 'border-destructive focus-visible:ring-destructive'
        )}
      />
    </div>
    {error && (
      <p className="text-[11px] text-destructive mt-0.5">{error}</p>
    )}
  </div>
);

export default FormField;
