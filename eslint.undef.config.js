// Gate cirúrgico de referências indefinidas (2026-08-13, lição v7.120.1):
// `useRef` usado sem import PASSA no tsc (resolve pela declaração global/UMD
// dos types do React) e explode só em runtime — derrubou o Helpdesk em prod
// por ~8min. O eslint `no-undef` pega essa classe; o config principal tem 207
// errors legados e não pode ser gate ainda, então este config roda SÓ esta
// regra no CI (step "undef-gate" do quality-gate). Zero errors hoje = zero
// falsos positivos; se um novo global legítimo aparecer, declare em `globals`.
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Testes ficam FORA: usam globals do vitest (it/expect) e símbolo indefinido
  // em teste já explode no próprio vitest do quality-gate.
  { ignores: ["dist", "supabase/functions", "mobile", "node_modules", "**/__tests__/**", "**/*.test.*", "src/test/**"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.es2021,
        // Posição-de-TIPO que o no-undef core não entende (React.MouseEvent,
        // NodeJS.Timeout, RequestInit…). Uso como VALOR sem import continua
        // quebrando em runtime — mas é raro e o tsc pega quando há tipo errado.
        React: "readonly",
        NodeJS: "readonly",
        RequestInit: "readonly",
        RequestInfo: "readonly",
        // Define do Vite (vite.config define:) — injetado no build.
        __APP_BUILD__: "readonly",
      },
    },
    // Plugins registrados SÓ pra comentários eslint-disable de regras deles
    // não virarem "Definition for rule not found" (nenhuma regra ligada aqui).
    plugins: {
      "react-hooks": reactHooks,
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "no-undef": "error",
    },
  },
);
