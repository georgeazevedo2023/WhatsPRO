import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Identificador único por build (avaliado em build-time, no Node). Vai pro
// bundle via define(__APP_BUILD__) E pro dist/version.json — o version-check do
// tab-resume compara os dois pra detectar aba rodando bundle velho pós-deploy.
const BUILD_ID = new Date().toISOString().replace(/[:.]/g, "-");

// Emite /version.json no build com o MESMO id injetado no bundle.
function emitVersionJson(): Plugin {
  return {
    name: "emit-version-json",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ build: BUILD_ID }),
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_BUILD__: JSON.stringify(BUILD_ID),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), emitVersionJson()].filter(Boolean),
  optimizeDeps: {
    include: ["@tanstack/react-query"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react-router-dom", "@tanstack/react-query"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-popover', '@radix-ui/react-tabs', '@radix-ui/react-accordion', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tooltip', '@radix-ui/react-alert-dialog', '@radix-ui/react-collapsible', '@radix-ui/react-checkbox', '@radix-ui/react-switch', '@radix-ui/react-label', '@radix-ui/react-separator', '@radix-ui/react-scroll-area', '@radix-ui/react-slot'],
          'vendor-charts': ['recharts'],
          'vendor-pdf': ['jspdf', 'html2canvas'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          'vendor-date': ['date-fns'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 650,
  },
}));
