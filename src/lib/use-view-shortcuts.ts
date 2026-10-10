import { useEffect } from "react";
import { useSegue } from "@/lib/store";

/** ⌘F search / ⌘E library / ⌘L ask — shared by both shells. */
export function useViewShortcuts() {
  const setSidebarView = useSegue((s) => s.setSidebarView);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSidebarView("search");
        window.setTimeout(
          () => document.querySelector<HTMLInputElement>("[data-search-input]")?.focus(),
          0,
        );
      }
      if (meta && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setSidebarView("library");
      }
      if (meta && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setSidebarView("chat");
        document.querySelector<HTMLTextAreaElement>("textarea")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSidebarView]);
}
