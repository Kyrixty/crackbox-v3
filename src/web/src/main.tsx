import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { AppRouter } from "./router";
import { Notifications } from "@mantine/notifications";
import "./index.css";
import "@mantine/core/styles.css";
import '@mantine/carousel/styles.css';

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider forceColorScheme="dark">
      <Notifications />
      <AppRouter />
    </MantineProvider>
  </React.StrictMode>
);
