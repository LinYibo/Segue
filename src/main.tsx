import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "@/components/error-boundary";
import { markPlatform } from "@/lib/platform";
import { Workbench } from "./workbench";
import "@/styles.css";

markPlatform("desktop");

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <Workbench />
  </ErrorBoundary>,
);
