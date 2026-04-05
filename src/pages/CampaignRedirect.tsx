import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const WA_ICON = (
  <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.608.608l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.365 0-4.557-.82-6.285-2.188l-.44-.352-3.2 1.072 1.072-3.2-.352-.44A9.956 9.956 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
  </svg>
);

export default function CampaignRedirect() {
  const [params] = useSearchParams();
  const name = params.get('n') || '';
  const waUrl = params.get('wa') || '';
  const refCode = params.get('ref') || '';
  const postUrl = params.get('p') || '';

  const [count, setCount] = useState(3);
  const [redirected, setRedirected] = useState(false);

  // Send client-side data async
  useEffect(() => {
    if (!refCode || !postUrl) return;
    const data = {
      ref_code: refCode,
      screen_width: screen.width,
      screen_height: screen.height,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    fetch(postUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => {});
  }, [refCode, postUrl]);

  // Countdown + redirect
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

  if (!waUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">
        <p>Link invalido.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-[#e5e5e5]">
      <div className="text-center px-8 py-10 max-w-[380px] w-[90%]">
        {/* WhatsApp logo */}
        <div className="w-14 h-14 mx-auto mb-6 bg-gradient-to-br from-[#25D366] to-[#128C7E] rounded-2xl flex items-center justify-center">
          {WA_ICON}
        </div>

        {/* Campaign name */}
        <h1 className="text-lg font-semibold text-white mb-1">{name}</h1>
        <p className="text-sm text-[#a3a3a3] mb-8">Redirecionando para WhatsApp...</p>

        {/* Spinner */}
        {!redirected && (
          <div className="w-9 h-9 border-[3px] border-[#262626] border-t-[#25D366] rounded-full animate-spin mx-auto mb-5" />
        )}

        {/* Countdown */}
        <div className="text-4xl font-bold text-[#25D366] mb-2">
          {redirected ? '✓' : count}
        </div>
        <p className="text-xs text-[#737373] mb-8">
          {redirected ? 'Redirecionado!' : `Abrindo WhatsApp em ${count} segundo${count !== 1 ? 's' : ''}`}
        </p>

        {/* Fallback button */}
        <a
          href={waUrl}
          className="inline-block px-6 py-3 bg-[#25D366] text-white rounded-xl text-sm font-semibold no-underline hover:bg-[#1da851] transition-colors"
        >
          Abrir WhatsApp manualmente
        </a>
      </div>
    </div>
  );
}
