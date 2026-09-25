import { createRoot } from "react-dom/client";

import App from "./App";
import { registerApplicationShell } from "@/features/offline/service-worker";
import { configureApiClient } from "@/lib/api-config";
import { initializeTheme } from "@/providers/ThemeProvider";

import "./index.css";

configureApiClient();
initializeTheme();

if (import.meta.env.PROD) {
  registerApplicationShell(`${import.meta.env.BASE_URL}sw.js`);
}

createRoot(document.getElementById("root")!).render(<App />);
