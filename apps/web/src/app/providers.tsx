import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import "../i18n";
import { queryClient } from "../lib/query";
import { ThemeProvider } from "./theme";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}
