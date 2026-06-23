import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The frontend (Vite, default port 5173) talks to the Express API (port 3001) through a dev
// proxy, so the browser only ever sees same-origin `/api/*` calls. One `npm run dev` starts both.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
