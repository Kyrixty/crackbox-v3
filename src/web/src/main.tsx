import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { AppRouter } from "./router";
import "./index.css";
import "@mantine/core/styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider forceColorScheme="dark">
      <AppRouter />
    </MantineProvider>
  </React.StrictMode>
);
