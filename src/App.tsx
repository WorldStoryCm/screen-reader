import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import MainView from "./features/MainView";
import "./App.css";

function App() {
  useEffect(() => {
    invoke<string | null>("get_setting", { key: "theme" })
      .then(theme => {
        if (theme === "light") document.documentElement.classList.add("light");
      })
      .catch(() => {});

    const unlisten = listen<string>("theme-changed", (e) => {
      if (e.payload === "light") {
        document.documentElement.classList.add("light");
      } else {
        document.documentElement.classList.remove("light");
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  return <MainView />;
}

export default App;
