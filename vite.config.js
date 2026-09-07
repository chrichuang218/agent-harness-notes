import { defineConfig } from 'vite';
export default defineConfig({root:'site',base:'./',build:{outDir:'../dist',emptyOutDir:true,chunkSizeWarningLimit:1500}});
