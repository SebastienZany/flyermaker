import { defineConfig } from 'vite';

const buildTag = process.env.BUILD_TAG ?? process.env.npm_package_version ?? 'dev';

export default defineConfig({
  define: {
    __BUILD_TAG__: JSON.stringify(buildTag)
  },
  server: {
    port: 5173,
    host: '0.0.0.0'
  }
});
