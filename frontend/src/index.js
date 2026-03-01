import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "react-query";
import CssBaseline from "@mui/material/CssBaseline";
import { Toaster } from "react-hot-toast";

import App from "./App";
import { ThemeContextProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { initializeSecurity } from "./utils/security";
import { initializeServiceWorker } from "./utils/serviceWorker";

// Initialize security measures
initializeSecurity();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeContextProvider>
        <CssBaseline />
        <BrowserRouter>
          <AuthProvider>
            <App />
            <Toaster position="top-right" />
          </AuthProvider>
        </BrowserRouter>
      </ThemeContextProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
