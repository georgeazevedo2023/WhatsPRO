import { supabase } from '@/integrations/supabase/client';

/**
 * Ponte de push do APP Android (v7.117.0, fase 3 do APK).
 *
 * O site roda DENTRO do APK (Capacitor server.url remoto): o bridge nativo
 * injeta `window.Capacitor` e o plugin @capacitor/push-notifications fica em
 * Capacitor.Plugins. Fora do APK (browser normal) tudo aqui é no-op silencioso.
 *
 * Fluxo: pede permissão (Android 13+ mostra o prompt) → registra no FCM →
 * upsert do token em `push_devices` (RLS own-rows; upsert por token = trocar
 * de usuário no mesmo aparelho reassina o token pro novo dono — lição do agro:
 * logout DEVE desligar o push do dono anterior, ver disableAppPush).
 * Sem google-services.json no APK o register() falha e caímos no catch:
 * o app funciona inteiro, só não vibra no bolso.
 */

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  Plugins?: {
    PushNotifications?: {
      requestPermissions: () => Promise<{ receive: string }>;
      register: () => Promise<void>;
      createChannel?: (c: { id: string; name: string; description?: string; importance: number; visibility?: number }) => Promise<void>;
      addListener: (event: string, cb: (data: never) => void) => void;
      removeAllListeners?: () => Promise<void>;
    };
  };
};

function getPushPlugin() {
  const cap = (window as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.PushNotifications ?? null;
}

/** Versão do APK a partir do user-agent (`whatspro-app/N`); 1 se não casar. */
export function appBuildFromUA(): number {
  const m = navigator.userAgent.match(/whatspro-app\/(\d+)/);
  return m ? Number(m[1]) : 1;
}

export async function wireAppPush(userId: string): Promise<void> {
  const push = getPushPlugin();
  if (!push) return;
  try {
    const perm = await push.requestPermissions();
    if (perm.receive !== 'granted') return;

    // Canal "fila" — o sender manda channel_id:'fila'; sem o canal criado no
    // aparelho, Android 8+ não desenha a notificação.
    try {
      await push.createChannel?.({ id: 'fila', name: 'Fila de atendimento', description: 'Cliente esperando resposta', importance: 5 });
    } catch { /* canal já existe */ }

    push.addListener('registration', (token: { value: string }) => {
      void supabase.from('push_devices').upsert(
        {
          user_id: userId,
          fcm_token: token.value,
          app_build: appBuildFromUA(),
          platform: 'android',
          enabled: true,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'fcm_token' },
      ).then(({ error }) => {
        if (error) console.error('[appPush] registro do token falhou:', error.message);
      });
    });

    // Tap na notificação → abre o Helpdesk (deep-link pra conversa = fase futura)
    push.addListener('pushNotificationActionPerformed', () => {
      window.location.assign('/dashboard/helpdesk');
    });

    await push.register();
  } catch (err) {
    // Sem Firebase no APK (build sem google-services.json) cai aqui — esperado
    console.warn('[appPush] push indisponível neste build:', err);
  }
}

/** Logout desliga o push do dono anterior (aparelho não pode seguir vibrando). */
export async function disableAppPush(userId: string): Promise<void> {
  if (!getPushPlugin()) return;
  try {
    await supabase.from('push_devices').update({ enabled: false }).eq('user_id', userId);
  } catch { /* best-effort */ }
}
