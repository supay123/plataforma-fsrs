import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ModalProvider } from "../components/ui/modal";
import { ToastProvider } from "../components/ui/toast";
import { queryClient } from "../lib/query/client";
import { AuthProvider } from "../features/auth/AuthProvider";
import { AppRouter } from "./router";

export function App() {
  return <QueryClientProvider client={queryClient}><ToastProvider><ModalProvider><BrowserRouter><AuthProvider><AppRouter /></AuthProvider></BrowserRouter></ModalProvider></ToastProvider></QueryClientProvider>;
}
