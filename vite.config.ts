import { defineConfig } from 'vite';
export default defineConfig({ build: { outDir: 'dist/client', emptyOutDir: true, rollupOptions:{input:{main:'index.html',artLab:'battle-art-lab.html'}} }, server: { host: '127.0.0.1', watch: { ignored: ['**/artifacts/**','**/data/**','**/spec-source/**','**/.tools/**','**/test-results/**','**/playwright-report/**'] } } });
