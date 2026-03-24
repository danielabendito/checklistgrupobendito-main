import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { StoreProvider } from "./contexts/StoreContext";
import { ErrorBoundary } from "./components/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <StoreProvider>
      <App />
    </StoreProvider>
  </ErrorBoundary>
);
