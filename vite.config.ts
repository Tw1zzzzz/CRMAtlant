import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

const muiEsmIndexPathPattern = /[\\/]@mui[\\/]icons-material[\\/]esm[\\/]index\.js$/;

const remapDialerSipToDialpad = (id: string) =>
  id.replace("DialerSip", "Dialpad");

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
      {
        name: "mui-dialersip-fix",
        enforce: "pre",
        async resolveId(source, importer) {
          if (
            importer &&
            muiEsmIndexPathPattern.test(importer) &&
            source.startsWith("./DialerSip")
          ) {
            return this.resolve(remapDialerSipToDialpad(source), importer, {
              skipSelf: true,
            });
          }
          return null;
        },
      },
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "logo.svg", "apple-touch-icon-180x180.png"],
        manifest: {
          name: "eSports Mood Tracker",
          short_name: "eSports CRM",
          description: "Отслеживание настроения и прогресса тестов для киберспортсменов",
          theme_color: "#0f172a",
          background_color: "#0f172a",
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/",
          lang: "ru",
          icons: [
            {
              src: "pwa-64x64.png",
              sizes: "64x64",
              type: "image/png",
            },
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "maskable-icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
          runtimeCaching: [
            {
              urlPattern: /^\/api\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60, // 1 час
                },
                networkTimeoutSeconds: 10,
              },
            },
            {
              urlPattern: /^\/uploads\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "uploads-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 дней
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        plugins: [
          {
            name: "mui-dialersip-fix",
            setup(build) {
              build.onResolve(
                {
                  filter:
                    /^\.\/DialerSip(?:Outlined|Rounded|Sharp|TwoTone)?\.js$/,
                },
                (args) => {
                  if (!muiEsmIndexPathPattern.test(args.importer)) {
                    return null;
                  }

                  return {
                    path: path.resolve(
                      path.dirname(args.importer),
                      remapDialerSipToDialpad(args.path)
                    ),
                  };
                }
              );
            },
          },
        ],
      },
    },
  };
});
