import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "@/components/error-boundary";
import { createWebHost } from "./web-host";
import { Workbench } from "./workbench";
import "@/styles.css";

// Everything runs in the browser: the host API (localStorage settings, chat
// fetched straight from the provider) is installed before the UI mounts.
window.segueHost = createWebHost();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <Workbench />
  </ErrorBoundary>,
);
