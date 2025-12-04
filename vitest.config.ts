import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      '@lexical-playground': path.resolve(__dirname, 'src/Lexical/lexical-playground/src'),
      'shared': path.resolve(__dirname, 'src/Lexical/shared/src'),
      'lexical': path.resolve(__dirname, 'node_modules/lexical'),
      '@lexical/react': path.resolve(__dirname, 'node_modules/@lexical/react'),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    exclude: ["**/node_modules/**", "**/tests/e2e/**"],
  },
});


