import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LandingForm } from '@/components/campaigns/LandingForm';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://euljumeflwtljegknawy.supabase.co';

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

const WA_ICON = (
  <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.608.608l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.365 0-4.557-.82-6.285-2.188l-.44-.352-3.2 1.072 1.072-3.2-.352-.44A9.956 9.956 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
  </svg>
);

// ── Redirect Mode (countdown → WhatsApp) ────────────────────────────
function RedirectView({ name, waUrl, refCode, postUrl }: { name: string; waUrl: string; refCode: string; postUrl: string }) {
  const [count, setCount] = useState(3);
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    if (!refCode || !postUrl) return;
    fetch(postUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref_code: refCode,
        screen_width: screen.width,
        screen_height: screen.height,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    }).catch(() => {});
  }, [refCode, postUrl]);

  useEffect(() => {
    if (!waUrl) return;
    const iv = setInterval(() => {
      setCount(prev => {
        if (prev <= 1) {
          clearInterval(iv);
          setRedirected(true);
          window.location.href = waUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [waUrl]);

  return (
    <>
      <h1 className="text-lg font-semibold text-white mb-1">{name}</h1>
      <p className="text-sm text-[#a3a3a3] mb-8">Redirecionando para WhatsApp...</p>
      {!redirected && (
        <div className="w-9 h-9 border-[3px] border-[#262626] border-t-[#25D366] rounded-full animate-spin mx-auto mb-5" />
      )}
      <div className="text-4xl font-bold text-[#25D366] mb-2">{redirected ? '✓' : count}</div>
      <p className="text-xs text-[#737373] mb-8">
        {redirected ? 'Redirecionado!' : `Abrindo WhatsApp em ${count} segundo${count !== 1 ? 's' : ''}`}
      </p>
      <a href={waUrl} className="inline-block px-6 py-3 bg-[#25D366] text-white rounded-xl text-sm font-semibold no-underline hover:bg-[#1da851] transition-colors">
        Abrir WhatsApp manualmente
      </a>
    </>
  );
}

// ── Form Mode (fields → submit → redirect) ──────────────────────────
function FormView({ name, waUrl, refCode, formSlug, postUrl, bioPage, bioBtn }: { name: string; waUrl: string; refCode: string; formSlug: string; postUrl: string; bioPage?: string; bioBtn?: string }) {
  const [fields, setFields] = useState<FormField[]>([]);
  const [welcomeMsg, setWelcomeMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const formStartedSent = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/form-public?slug=${formSlug}`);
        if (!res.ok) { setError('Formulario nao encontrado'); setLoading(false); return; }
        const data = await res.json();
        setFields(data.fields || []);
        setWelcomeMsg(data.form?.welcome_message || '');
      } catch {
        setError('Erro ao carregar formulario');
      }
      setLoading(false);
    })();
  }, [formSlug]);

  /** Fire once on first field interaction — tracks form abandonment */
  const handleFieldInteraction = useCallback(() => {
    if (formStartedSent.current || !postUrl || !refCode) return;
    formStartedSent.current = true;
    fetch(postUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref_code: refCode, event: 'form_started' }),
    }).catch(() => {});
  }, [postUrl, refCode]);

  const handleSubmit = useCallback(async (formData: Record<string, string>) => {
    // Find phone field
    const phoneKey = fields.find(f => f.field_type === 'phone')?.field_key || 'telefone';
    const phone = formData[phoneKey] || '';

    const res = await fetch(`${SUPABASE_URL}/functions/v1/form-public`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: formSlug,
        ref_code: refCode,
        phone,
        data: formData,
        ...(bioPage ? { bio_page: bioPage } : {}),
        ...(bioBtn ? { bio_btn: bioBtn } : {}),
      }),
    });

    if (!res.ok) throw new Error('Submit failed');

    // Redirect to WhatsApp after brief delay
    setTimeout(() => { window.location.href = waUrl; }, 1500);
  }, [formSlug, refCode, waUrl, fields]);

  if (loading) {
    return (
      <>
        <h1 className="text-lg font-semibold text-white mb-4">{name}</h1>
        <div className="w-8 h-8 border-[3px] border-[#262626] border-t-[#25D366] rounded-full animate-spin mx-auto" />
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1 className="text-lg font-semibold text-white mb-4">{name}</h1>
        <p className="text-sm text-red-400">{error}</p>
        <a href={waUrl} className="inline-block mt-6 px-6 py-3 bg-[#25D366] text-white rounded-xl text-sm font-semibold no-underline hover:bg-[#1da851] transition-colors">
          Ir para WhatsApp
        </a>
      </>
    );
  }

  return (
    <>
      <h1 className="text-lg font-semibold text-white mb-4">{name}</h1>
      <LandingForm formName={name} welcomeMessage={welcomeMsg} fields={fields} onSubmit={handleSubmit} onFieldInteraction={handleFieldInteraction} />
    </>
  );
}

// ── Main Component ──────────────────────────────────────────────────
export default function CampaignRedirect() {
  const [params] = useSearchParams();
  const name = params.get('n') || '';
  const waUrl = params.get('wa') || '';
  const refCode = params.get('ref') || '';
  const postUrl = params.get('p') || '';
  const mode = params.get('mode') || 'redirect';
  const formSlug = params.get('fs') || '';
  const bioPage = params.get('bio_page') || '';
  const bioBtn = params.get('bio_btn') || '';

  if (!waUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">
        <p>Link invalido.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-[#e5e5e5]">
      <div className="text-center px-8 py-10 max-w-[420px] w-[90%]">
        <div className="w-14 h-14 mx-auto mb-6 bg-gradient-to-br from-[#25D366] to-[#128C7E] rounded-2xl flex items-center justify-center">
          {WA_ICON}
        </div>

        {mode === 'form' && formSlug ? (
          <FormView name={name} waUrl={waUrl} refCode={refCode} formSlug={formSlug} postUrl={postUrl} bioPage={bioPage || undefined} bioBtn={bioBtn || undefined} />
        ) : (
          <RedirectView name={name} waUrl={waUrl} refCode={refCode} postUrl={postUrl} />
        )}
      </div>
    </div>
  );
}
