import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          // Heavy / route-specific libs — split so they don't bloat the main bundle
          if (id.includes('mapbox-gl')) return 'mapbox';
          if (id.includes('@stripe') || id.includes('stripe')) return 'stripe';
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('framer-motion')) return 'motion';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('@radix-ui')) return 'radix';
          if (id.includes('@tanstack')) return 'tanstack';
          if (id.includes('react-dom') || id.includes('react-router') || id.includes('scheduler')) return 'react-vendor';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('date-fns')) return 'date';
          if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n';
        },
      },
    },
  },
}));
