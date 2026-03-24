import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Debug: check Tauri IPC availability
console.log("[main] window.__TAURI_INTERNALS__:", typeof (window as any).__TAURI_INTERNALS__);
console.log("[main] isTauri env:", !!(window as any).__TAURI_INTERNALS__);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
