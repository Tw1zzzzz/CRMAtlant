import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = env.PORT || '5001';
  const apiHost = env.HOST || '127.0.0.1';
  const proxyTarget = env.VITE_API_PROXY_TARGET || `http://${apiHost}:${apiPort}`;

  return {
    server: {
      host: "::",
      port: 8080,
      fs: {
        strict: false,
      },
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/health': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/health-check': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    plugins: [
      react(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
