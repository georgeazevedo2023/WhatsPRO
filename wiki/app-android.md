---
title: APP Android do Vendedor (APK Capacitor)
tags: [mobile, android, capacitor, helpdesk, fila]
sources: [mobile/, .github/workflows/apk.yml, C:\projetos\Claude\casa_do_agricultor\helpdesk\APP.md]
updated: 2026-08-11
audited_at: 2026-08-11
---

# 📱 APP Android do Vendedor — Inbox + Fila no bolso

> **Por que existe** (v7.113.0, 2026-08-11): vendedor/atendente vive no celular. O app leva o Helpdesk (Inbox) e a Fila até ele com o que o navegador não entrega bem: câmera, galeria e microfone nativos integrados — tirar foto de produto e mandar na conversa, gravar nota de voz — e, na fase 3, push com o app fechado.

## Arquitetura (decisão 2026-08-11, dono aprovou Opção A)

**Capacitor 7 em modo `server.url` remoto**: o APK é uma casca nativa (~6 MB) cujo WebView abre direto `https://crm.wsmart.com.br` — o MESMO painel de produção. Receita herdada do **Casa do Agricultor** (`C:\projetos\Claude\casa_do_agricultor\mobile\` + `helpdesk/APP.md`), provada em campo lá em 2026-08-02/03.

Por que assim: front deploya via CI **sem novo APK**; origem = `crm.wsmart.com.br` → zero mudança de CORS; o áudio OGG/Opus do WebView é o formato já provado com a UAZAPI. Alternativas descartadas: bundle local (cada release do site = reinstalar APK), PWA/TWA (push fraco), nativo (reescrita).

**O que o app herda de graça por ser o mesmo site:** câmera/galeria via `<input type="file">` do `ChatInput.tsx` (chooser nativo Câmera | Galeria | Arquivos), downscale ≤2048px da v7.111, nota de voz via `useAudioRecorder.ts` (MediaRecorder OGG/Opus), HEIC, telemetria `media_send_telemetry`, sessão Supabase persistida no WebView.

## As peças

| Peça | Onde | O quê |
|---|---|---|
| Casca | `mobile/` (Capacitor 7) | `capacitor.config.json`: appId `br.com.wsmart.whatspro`, `server.url` remoto, UA `whatspro-app/1` |
| Permissões | `mobile/android/app/src/main/AndroidManifest.xml` | CAMERA, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, POST_NOTIFICATIONS (fase 3) |
| ⚠️ `<queries>` IMAGE_CAPTURE | idem | **lição de campo agro 2026-08-03**: sem isso, com targetSdk 35 o `resolveActivity` não enxerga o app de câmera e a câmera NÃO ABRE em parte dos aparelhos (ROM dependente — mesmo APK funcionava num celular e noutro não) |
| Assinatura | `mobile/android/app/build.gradle` | PKCS12 `keystore-whatspro.p12` alias `whatspro`, senha via env `ANDROID_KEYSTORE_PASS`; sem keystore → assina debug |
| Ícones/splash | `mobile/assets/` (`make-icons.mjs` → PNGs → `npm run icons`) | balão branco + "W" sobre gradiente verde do painel (`--gradient-primary`) |
| Build | `.github/workflows/apk.yml` | CI builda e assina (esta máquina NÃO tem Java/Android SDK — e não precisa); artifact `whatspro-apk`, retenção 30d |

## Segredos (NUNCA no git — `mobile/.gitignore` cobre)

| Item | Onde |
|---|---|
| `keystore-whatspro.p12` + `.base64` + `SEGREDO.txt` (senha) | `mobile/` local. **Guardar cópia em gerenciador de senhas: perder = não atualizar mais o app** sem desinstalar em todos os celulares |
| Secrets do Actions | `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASS` (setados 2026-08-11 via `gh secret set`); `GOOGLE_SERVICES_JSON` só na fase 3 |
| Regerar keystore (aceita reinstalar tudo) | `openssl req -x509 -newkey rsa:2048 ... -subj "/CN=WhatsPRO"` + `openssl pkcs12 -export -name whatspro ...` — alias TEM que ser `whatspro`; no Git Bash usar `MSYS_NO_PATHCONV=1` (senão `/CN=` vira caminho Windows) |

## Como gerar/instalar o APK (recorrente)

1. GitHub → **Actions → apk-whatspro → Run workflow** (ou push em `mobile/**`).
2. Baixar artifact **whatspro-apk** (~2 min): `gh run download <id> -n whatspro-apk`.
3. Mandar `app-release.apk` pro celular (WhatsApp pra si mesmo funciona), instalar aceitando "fonte desconhecida".
4. Abrir, logar com o usuário do atendente, aceitar **câmera** e **microfone** quando pedir.
5. Guardar cópia do APK fora do CI (artifact expira em 30 dias) — ex.: `C:\projetos\claude\apks\`.

**Versionar:** subir `versionCode`/`versionName` no `mobile/android/app/build.gradle` **JUNTO** com `appendUserAgent whatspro-app/N` no `capacitor.config.json`.

## Fase 3 — push "cliente esperando" (v7.117.0: ✅ ATIVO em 2026-08-12)

**Firebase:** projeto **`whatspro-crm-8faae`** (conta `george.azevedo2023@gmail.com`), app Android `br.com.wsmart.whatspro`, service account `firebase-adminsdk-fbsvc@whatspro-crm-8faae.iam.gserviceaccount.com`. JSONs em `mobile/google-services.json` + `mobile/firebase-conta-servico.json` (**gitignored — fazer backup em gerenciador de senhas**). Secrets: `GOOGLE_SERVICES_JSON` (GitHub) + `FIREBASE_SERVICE_ACCOUNT` (Supabase, base64). OAuth+FCM validados ponta a ponta (API FCM v1 ativa). APK com push = **v1.2-build3** (UA `whatspro-app/3`). ⚠️ NÃO recriar o projeto Firebase: invalida todos os tokens em silêncio.

Infra completa shipada em 2026-08-11: `push_devices` (RLS own-rows, upsert por token) + `push_alert_log` + edge fn `push-queue-alert` (cron 2min via vault; anti-ruído: 1 aviso/msg, cooldown 10min, tag por conversa, janela 15min, atribuído→dono / dept não-pausado / fallback todos, token morto auto-desativado; OAuth WebCrypto zero-dep) + `src/lib/appPush.ts` no `AuthContext` (canal "fila", registro no login, **logout desliga o push do dono anterior**) + plugin no `mobile/` (APK v1.1-build2, UA `whatspro-app/2`).

**Pra LIGAR (10 min de console, só o dono):** (1) console.firebase.google.com → Adicionar projeto (ex. `whatspro-crm`; Analytics off); (2) Adicionar app → Android, pacote **`br.com.wsmart.whatspro`** exato → baixar `google-services.json`; (3) Configurações → Contas de serviço → Gerar nova chave privada (JSON do servidor); (4) entregar os 2 JSONs ao assistente → ele seta `GOOGLE_SERVICES_JSON` (GitHub secret, base64) + `FIREBASE_SERVICE_ACCOUNT` (Supabase secret), rebuilda o APK e reinstala. ⚠️ NÃO recriar o projeto Firebase depois: `google-services.json` novo invalida TODOS os tokens registrados em silêncio (lição agro). Sem Firebase o app funciona inteiro — só não vibra no bolso. Armadilhas de campo (battery saver Xiaomi/Realme, lead atribuído a quem não tem app) no `helpdesk/APP.md` do agro.

## Limitações conhecidas

- Exige internet (CRM é online por natureza; sem rede → tela de erro do WebView).
- Mensagem enviada pelo app grava igual à do painel (sem coluna distinguindo app×painel; se precisar medir, gravar o `whatspro-app/N` do user-agent — mesma pendência que o agro resolveu com migration própria).
- `server.url` pra `localhost` (dev) não funciona sem `usesCleartextTraffic` no manifest — usar HTTPS.
