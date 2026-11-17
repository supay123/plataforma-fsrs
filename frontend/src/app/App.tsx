import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ModalProvider } from "../components/ui/modal";
import { ToastProvider } from "../components/ui/toast";
import { queryClient } from "../lib/query/client";
import { ThemeProvider } from "../lib/theme/ThemeProvider";
import { InstitutionThemeSync } from "../features/theme/InstitutionThemeSync";
import { AuthProvider } from "../features/auth/AuthProvider";
import { AppRouter } from "./router";

export function App() {
  return <QueryClientProvider client={queryClient}><ToastProvider><ModalProvider><BrowserRouter><ThemeProvider><AuthProvider><InstitutionThemeSync /><AppRouter /></AuthProvider></ThemeProvider></BrowserRouter></ModalProvider></ToastProvider></QueryClientProvider>;
}
