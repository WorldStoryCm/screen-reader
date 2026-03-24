import { HashRouter, Routes, Route } from "react-router-dom";
import { isTauri } from "@tauri-apps/api/core";
import MainView from "./features/MainView";
import CaptureOverlay from "./features/capture/CaptureOverlay";
import "./App.css";

function App() {
  return (
    <HashRouter>
      {!isTauri() && (
        <div style={{ background: "#dc2626", color: "white", padding: "8px 16px", textAlign: "center", fontSize: 13 }}>
          Not running in Tauri webview. Run <code>bun tauri dev</code> instead of <code>bun run dev</code>
        </div>
      )}
      <Routes>
        <Route path="/" element={<MainView />} />
        <Route path="/capture" element={<CaptureOverlay />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
