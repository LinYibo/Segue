import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "@/components/error-boundary";
import { Workbench } from "@/components/workbench";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <Workbench />
  </ErrorBoundary>,
);
