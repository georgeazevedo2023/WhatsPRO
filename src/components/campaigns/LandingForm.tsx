import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface FormField {
  id: string;
  position: number;
  field_type: string;
  label: string;
  required: boolean;
  validation_rules: Record<string, unknown> | null;
  error_message: string | null;
  field_key: string;
}

interface LandingFormProps {
  formName: string;
  welcomeMessage?: string;
  fields: FormField[];
  onSubmit: (data: Record<string, string>) => Promise<void>;
}

// ── Validators ──────────────────────────────────────────────────────
function validateCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  for (let t = 9; t < 11; t++) {
    let sum = 0;
    for (let i = 0; i < t; i++) sum += Number(digits[i]) * (t + 1 - i);
    const rem = (sum * 10) % 11;
    if ((rem === 10 ? 0 : rem) !== Number(digits[t])) return false;
  }
  return true;
}

function validateField(type: string, value: string, rules: Record<string, unknown> | null): string | null {
  if (!value.trim()) return null; // required check handled separately
  switch (type) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'Email invalido';
    case 'phone':
      return value.replace(/\D/g, '').length >= 10 ? null : 'Telefone invalido (min 10 digitos com DDD)';
    case 'cpf':
      return validateCpf(value) ? null : 'CPF invalido';
    case 'cep':
      return /^\d{5}-?\d{3}$/.test(value) ? null : 'CEP invalido (8 digitos)';
    case 'number': {
      const n = Number(value);
      if (isNaN(n)) return 'Numero invalido';
      if (rules?.min != null && n < Number(rules.min)) return `Minimo: ${rules.min}`;
      if (rules?.max != null && n > Number(rules.max)) return `Maximo: ${rules.max}`;
      return null;
    }
    default:
      return null;
  }
}

function getInputType(fieldType: string): string {
  switch (fieldType) {
    case 'email': return 'email';
    case 'phone': return 'tel';
    case 'number': case 'scale': return 'number';
    case 'date': return 'date';
    case 'time': return 'time';
    default: return 'text';
  }
}

function getPlaceholder(fieldType: string): string {
  switch (fieldType) {
    case 'email': return 'seu@email.com';
    case 'phone': return '(11) 98765-4321';
    case 'cpf': return '000.000.000-00';
    case 'cep': return '00000-000';
    default: return '';
  }
}

export function LandingForm({ formName, welcomeMessage, fields, onSubmit }: LandingFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    for (const field of fields) {
      const val = values[field.field_key] || '';
      if (field.required && !val.trim()) {
        newErrors[field.field_key] = field.error_message || 'Campo obrigatorio';
        continue;
      }
      if (val.trim()) {
        const err = validateField(field.field_type, val, field.validation_rules);
        if (err) newErrors[field.field_key] = err;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(values);
      setSubmitted(true);
    } catch {
      setErrors({ _form: 'Erro ao enviar. Tente novamente.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <div className="text-3xl mb-3">✓</div>
        <p className="text-sm text-[#a3a3a3]">Enviado! Redirecionando para WhatsApp...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      {welcomeMessage && (
        <p className="text-sm text-[#a3a3a3] text-center mb-2">{welcomeMessage}</p>
      )}

      {fields.map(field => {
        const isSelect = field.field_type === 'select';
        const isYesNo = field.field_type === 'yes_no';
        const options = (field.validation_rules?.options as string[]) || [];

        return (
          <div key={field.id} className="space-y-1">
            <label className="text-sm font-medium text-[#e5e5e5]">
              {field.label} {field.required && <span className="text-red-400">*</span>}
            </label>

            {isSelect ? (
              <select
                value={values[field.field_key] || ''}
                onChange={e => handleChange(field.field_key, e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-[#1a1a1a] border border-[#333] text-[#e5e5e5] text-sm focus:border-[#25D366] focus:outline-none transition-colors"
              >
                <option value="">Selecione...</option>
                {options.map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
            ) : isYesNo ? (
              <div className="flex gap-2">
                {['Sim', 'Não'].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleChange(field.field_key, opt)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${values[field.field_key] === opt ? 'bg-[#25D366] text-white border-[#25D366]' : 'bg-[#1a1a1a] text-[#a3a3a3] border-[#333] hover:border-[#555]'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : field.field_type === 'long_text' ? (
              <textarea
                value={values[field.field_key] || ''}
                onChange={e => handleChange(field.field_key, e.target.value)}
                rows={3}
                placeholder={getPlaceholder(field.field_type)}
                className="w-full px-3 py-2.5 rounded-lg bg-[#1a1a1a] border border-[#333] text-[#e5e5e5] text-sm focus:border-[#25D366] focus:outline-none transition-colors resize-none"
              />
            ) : (
              <input
                type={getInputType(field.field_type)}
                value={values[field.field_key] || ''}
                onChange={e => handleChange(field.field_key, e.target.value)}
                placeholder={getPlaceholder(field.field_type)}
                className="w-full px-3 py-2.5 rounded-lg bg-[#1a1a1a] border border-[#333] text-[#e5e5e5] text-sm focus:border-[#25D366] focus:outline-none transition-colors"
              />
            )}

            {errors[field.field_key] && (
              <p className="text-xs text-red-400">{errors[field.field_key]}</p>
            )}
          </div>
        );
      })}

      {errors._form && <p className="text-xs text-red-400 text-center">{errors._form}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 bg-[#25D366] text-white rounded-xl text-sm font-semibold hover:bg-[#1da851] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : 'Enviar e abrir WhatsApp'}
      </button>
    </form>
  );
}
