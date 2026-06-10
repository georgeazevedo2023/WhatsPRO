/// <reference types="vite/client" />

/**
 * Identificador do build (injetado pelo vite.config.ts via `define`).
 * Usado pelo version-check do tab-resume: compara com /version.json (gerado no
 * mesmo build) pra detectar aba rodando bundle velho após um redeploy.
 */
declare const __APP_BUILD__: string;
