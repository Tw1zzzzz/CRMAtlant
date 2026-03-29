import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

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
