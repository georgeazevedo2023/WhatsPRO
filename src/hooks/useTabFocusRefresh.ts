import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { probeSession, clearDeadSession } from '@/lib/sessionRecovery';

/**
 * Recupera dados/conexão quando o atendente volta pra aba depois de um tempo fora.
 *
 * ANTES (bug 2026-05-31, print do dono): fazia `window.location.reload()` — um
 * reload do SPA inteiro a cada retorno >3s. Isso DESMONTAVA a aplicação e perdia
 * o estado em memória: o atendente que tinha uma conversa aberta voltava pra
 * "Selecione uma conversa", além de perder scroll/contexto. O comentário antigo
 * dizia "é o que Slack/Discord fazem" — não é: esses apps reconectam o socket e
 * refazem o fetch em silêncio, sem recarregar a página.
 *
 * AGORA: recuperação graciosa SEM reload, preservando 100% do estado em memória
 * (conversa selecionada, scroll, rascunho):
 *   0. SONDA a sessão de auth (probeSession) ANTES de tudo. Confirmado em PROD: num
 *      token expirado pós-suspensão (>TTL), o getSession() interno do supabase-js
 *      TRAVA → pendurava o await de toda query REST → o ChatPanel estourava em 12s
 *      ("fetch_messages_timeout"). Sondar na ORIGEM única do resume protege todos os
 *      consumidores. Se a sessão está morta (evidência positiva), limpamos e o
 *      ProtectedRoute redireciona (sem reload).
 *   1. Reconecta o Realtime do Supabase (salvo sessão morta) — o browser fecha o
 *      WebSocket em abas suspensas; `connect()` é idempotente e rejoina autenticado
 *      quando a sessão se recompõe.
 *   2. Dispara `app:tab-resumed` (hooks de fetch manual refazem o fetch) APENAS com
 *      sessão CONFIRMADA válida. Em 'unknown' (getSession lento/travado, comum no
 *      token zumbi) NÃO refetcha — refetchar num token incerto reproduziria o
 *      fetch_messages_timeout. Preserva a conversa aberta; realtime/autoRefresh
 *      recompõem e o "Tentar novamente" do ChatPanel é a saída manual.
 * (Páginas em react-query já refazem via `refetchOnWindowFocus`.)
 */
export function useTabFocusRefresh() {
  const hiddenAtRef = useRef<number>(0);
  const resumingRef = useRef(false); // evita reentrância de visibilitychange empilhados

  useEffect(() => {
    const handleVisibility = async () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        return;
      }
      // Tab became visible — check how long it was hidden
      const awayMs = Date.now() - hiddenAtRef.current;
      if (awayMs < 3_000 || resumingRef.current) return; // <3s, ou já recuperando

      resumingRef.current = true;
      try {
        // 0) Sonda a sessão ANTES de qualquer refetch. Confirmado em PROD: num token
        //    expirado pós-suspensão, o getSession() interno do supabase-js TRAVA (o
        //    refresh fetch da auth-js não tem timeout + lock no-op não serializa) — é
        //    o que pendurava toda query REST e estourava o Promise.race de 12s do
        //    ChatPanel ("fetch_messages_timeout"). probeSession() raceia com 5s.
        const probe = await probeSession();
        if (probe === 'dead') {
          await clearDeadSession(); // → SIGNED_OUT → ProtectedRoute /login (sem reload)
          return;
        }
        // 1) Reconecta o WebSocket do Realtime (browser fecha em aba suspensa).
        //    Idempotente e seguro mesmo com token ainda incerto — o realtime usa o
        //    token que houver e rejoina autenticado quando a sessão se recompõe.
        try { supabase.realtime.connect(); } catch { /* idempotente — já conectado */ }
        // 2) Refetch manual SÓ com sessão CONFIRMADA válida. Se 'unknown' (getSession
        //    lento/travado — comum no token zumbi), NÃO dispara: refetchar num token
        //    incerto reproduziria o fetch_messages_timeout. O realtime + autoRefresh
        //    recompõem; o "Tentar novamente" do ChatPanel segue como saída manual.
        if (probe === 'valid') {
          window.dispatchEvent(new CustomEvent('app:tab-resumed', { detail: { awayMs } }));
        }
      } finally {
        resumingRef.current = false;
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);
}
