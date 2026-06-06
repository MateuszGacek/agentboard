import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";

import { AppProviders } from "./app/providers";
import { router } from "./app/router";
import "./styles/global.css";

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
