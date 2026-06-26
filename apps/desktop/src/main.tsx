import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ForjaProvider } from "./store";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ForjaProvider>
      <App />
    </ForjaProvider>
  </React.StrictMode>
);
