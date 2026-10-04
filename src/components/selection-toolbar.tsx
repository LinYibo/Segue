import { useEffect, useRef } from "react";
import { Highlighter, MessageSquare, ScanSearch, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSegue } from "@/lib/store";

export function SelectionToolbar() {
  const selection = useSegue((s) => s.selection);
  const addHighlight = useSegue((s) => s.addHighlight);
  const sendChat = useSegue((s) => s.sendChat);
  const activeDocId = useSegue((s) => s.activeDocId);
  const setSelection = useSegue((s) => s.setSelection);
  const pillRef = useRef<HTMLDivElement>(null);

  // SumatraPDF drops the selection on mousedown (DeleteOldSelectionInfo): a
  // press anywhere outside the toolbar clears it, so the buttons never
  // outlive the click that already collapsed the text.
  useEffect(() => {
    if (!selection) return;
    const onDown = (e: PointerEvent) => {
      if (pillRef.current && e.target instanceof Node && pillRef.current.contains(e.target)) return;
      setSelection(null);
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [selection, setSelection]);

  if (!selection || !activeDocId) return null;

  const ask = (prompt: string) => {
    // sendChat itself makes the pane visible; the message stays on the
    // active thread instead of landing on an untouched tab.
    void sendChat(prompt);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-3">
      <div
        ref={pillRef}
        className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-border bg-bg p-1"
      >
        <Button
          size="sm"
          onClick={() =>
            addHighlight({
              docId: activeDocId,
              locator: selection.locator,
              text: selection.text,
              note: "",
              cfi: selection.cfi,
            })
          }
        >
          <Highlighter className="size-3.5" />
          Highlight
        </Button>
        <Button size="sm" onClick={() => ask(`Explain this passage:\n\n"${selection.text}"`)}>
          <ScanSearch className="size-3.5" />
          Explain
        </Button>
        <Button
          size="sm"
          onClick={() => ask(`Define or unpack the key terms in:\n\n"${selection.text}"`)}
        >
          <Type className="size-3.5" />
          Define
        </Button>
        <Button
          size="sm"
          onClick={() => ask(`What should I notice in this selection?\n\n"${selection.text}"`)}
        >
          <MessageSquare className="size-3.5" />
          Ask
        </Button>
      </div>
    </div>
  );
}
