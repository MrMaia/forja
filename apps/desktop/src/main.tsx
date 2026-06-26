import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ForjaProvider } from "./store";
// self-hosted fonts (bundled) — work offline on a freshly-formatted PC
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ForjaProvider>
      <App />
    </ForjaProvider>
  </React.StrictMode>
);
