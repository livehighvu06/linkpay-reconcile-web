import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages 專案站需設 base 為 repo 名稱，否則資源 404
export default defineConfig({
  base: "/linkpay-reconcile-web/",
  plugins: [react(), tailwindcss()],
});
