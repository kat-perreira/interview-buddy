import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  // Vite doesn't put .env into process.env for this file. Load it here so the
  // proxy targets the same PORT the server reads. "" loads all vars, not just VITE_*.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      // Forward API calls to the Hono server so the browser only talks to one origin.
      proxy: {
        "/api": `http://localhost:${env.PORT || 8787}`,
      },
    },
    test: {
      include: ["client/**/*.test.{ts,tsx}", "server/**/*.test.ts", "shared/**/*.test.ts", "dev/**/*.test.ts"],
      environment: "node",
    },
  };
});
