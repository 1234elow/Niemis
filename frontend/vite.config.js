import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isProd = mode === "production";
  const isDev = mode === "development";

  return {
    plugins: [react()],
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./src/setupTests.js",
    },
    esbuild: {
      loader: "jsx",
      include: /src\/.*\.[jt]sx?$/,
      exclude: [],
      jsxInject: `import React from 'react'`,
      // Remove console.log in production
      drop: isProd ? ["console", "debugger"] : [],
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          ".js": "jsx",
        },
        target: "es2020",
      },
      include: ["react", "react-dom", "@mui/material", "@mui/icons-material"],
      force: true,
    },
    server: {
      port: 3000,
      host: true,
      proxy: {
        "/api": {
          target: env.VITE_API_URL || "http://localhost:5000",
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: "build",
      assetsDir: "static",
      sourcemap: isDev,
      target: ["es2020", "edge88", "firefox78", "chrome87", "safari13.1"],
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: isProd,
          drop_debugger: isProd,
          pure_funcs: isProd ? ["console.log", "console.info"] : [],
        },
        mangle: {
          safari10: true,
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor libraries (core dependencies)
            vendor: ["react", "react-dom"],
            router: ["react-router-dom"],

            // UI framework (Material-UI ecosystem)
            mui: ["@mui/material", "@mui/icons-material", "@emotion/react", "@emotion/styled"],
            muiX: ["@mui/x-data-grid", "@mui/x-date-pickers"],

            // Charts and visualization
            charts: ["chart.js", "react-chartjs-2"],

            // Forms and validation
            forms: ["formik", "yup"],

            // Utilities and API
            utils: ["axios", "date-fns", "react-query", "react-hot-toast"],
          },
          // Optimize chunk names for Vercel edge caching
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop().replace(/\.[^/.]+$/, '') : 'chunk';
            return `static/js/${facadeModuleId}-[hash].js`;
          },
          entryFileNames: "static/js/[name]-[hash].js",
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.');
            const ext = info[info.length - 1];
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
              return `static/images/[name]-[hash].[ext]`;
            }
            if (/woff2?|eot|ttf|otf/i.test(ext)) {
              return `static/fonts/[name]-[hash].[ext]`;
            }
            return `static/[ext]/[name]-[hash].[ext]`;
          },
        },
        // External dependencies for Vercel optimization
        external: [],
      },
      // Vercel-optimized settings
      chunkSizeWarningLimit: 1000,
      cssCodeSplit: true,
      reportCompressedSize: false,
      assetsInlineLimit: 4096,
      // Enable module preloading for faster initial loads
      modulePreload: {
        polyfill: true,
      },
    },
    define: {
      global: "globalThis",
      __DEV__: isDev,
      // Vercel environment detection
      __VERCEL__: JSON.stringify(env.VERCEL === "1"),
      __VERCEL_ENV__: JSON.stringify(env.VERCEL_ENV || mode),
    },
    // Performance optimizations for Vercel
    experimental: {
      renderBuiltUrl(filename, { hostType }) {
        if (hostType === 'js') {
          return `/${filename}`;
        }
        return `/${filename}`;
      },
    },
    // Preview server configuration for Vercel builds
    preview: {
      port: 3000,
      host: true,
      strictPort: false,
    },
  };
});
