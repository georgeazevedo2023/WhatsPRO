import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Recuperação de "deploy no meio da sessão" (auditoria 2026-06-09, vendedores
// Android sem conseguir enviar foto): cada redeploy APAGA os chunks do build
// anterior; uma aba aberta que tenta lazy-load depois (ex.: 1º envio de foto
// HEIC puxa o chunk do heic2any) toma 404 — e o Chromium cacheia a falha do
// módulo até o reload, então TODO retry falha na hora. O Vite emite
// `vite:preloadError` exatamente nesse caso: recarregamos UMA vez (guarda
// anti-loop) pra aba pegar o index/chunks novos sem o atendente saber o que é F5.
window.addEventListener("vite:preloadError", (event) => {
  const KEY = "whatspro:chunk-reload-at";
  let last = 0;
  try { last = Number(sessionStorage.getItem(KEY) || 0); } catch { /* storage indisponível */ }
  if (Date.now() - last < 60_000) return; // recarregou há <1min e não resolveu — não loopar
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* segue sem guarda */ }
  event.preventDefault(); // suprime o erro — o reload resolve
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
