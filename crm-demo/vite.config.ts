import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * Демо-сборка CRM: использует src основной CRM (родитель),
 * подменяя только auth и API на моки (без бэкенда).
 */
export default defineConfig({
  root: __dirname,
  server: {
    port: 5174,
    host: true,
    fs: { strict: false },
  },
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@/hooks/useAuth", replacement: path.resolve(__dirname, "src/demo/useAuth.tsx") },
      { find: "@/lib/api", replacement: path.resolve(__dirname, "src/demo/api.ts") },
      { find: "@/services/auth.service", replacement: path.resolve(__dirname, "src/demo/auth.service.ts") },
      { find: "@", replacement: path.resolve(__dirname, "../src") },
    ],
  },
});
