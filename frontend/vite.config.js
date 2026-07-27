import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Railway serves the built app through `vite preview` on a *.up.railway.app
  // subdomain. Vite rejects unknown Host headers, so the deploy domain has to be
  // allowed explicitly; the leading dot covers any subdomain, which keeps this
  // working if the service is renamed.
  preview: {
    host: true,
    allowedHosts: [".up.railway.app"],
  },
});
