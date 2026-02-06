import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "@/hooks/useTheme";
import "katex/dist/katex.min.css";
import "./index.css";

(window as { process?: { env: Record<string, string> } }).process ??= {
  env: {},
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="dark">
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
