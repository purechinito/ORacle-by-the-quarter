import { defineConfig } from 'vite';
export default defineConfig({
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: '../apps/quarter_erp/quarter_erp/public/workspace',
    emptyOutDir: true,
    lib: { entry: 'src/main.tsx', formats: ['es'], fileName: () => 'orbit.js', cssFileName: 'orbit' },
  },
});
