import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { queryClient } from "../lib/query/client";
import { AuthProvider } from "../features/auth/AuthProvider";
import { AppRouter } from "./router";

export function App() {
  return <QueryClientProvider client={queryClient}><BrowserRouter><AuthProvider><AppRouter /></AuthProvider></BrowserRouter></QueryClientProvider>;
}
