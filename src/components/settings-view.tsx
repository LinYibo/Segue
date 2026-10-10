import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useSegue } from "@/lib/store";
import type { AiSettingsPatch } from "@/lib/types";

const inputCls =
  "h-9 w-full rounded-md border border-border bg-bg px-2.5 text-sm text-fg outline-none placeholder:text-faint";

/**
 * Sidebar "add provider" form, reached from the chat pane's model menu: pick
 * a preset, point it at a base URL and model, save the key. The key goes into
 * the host's settings store (settings.json on desktop, localStorage on the
 * web) and never round-trips back into the renderer. Adding a provider
 * activates it and returns to the view the form replaced; Cancel does the
 * same without saving.
 */
export function SettingsView() {
  const aiSettings = useSegue((s) => s.aiSettings);
  const addAiProvider = useSegue((s) => s.addAiProvider);
  const closeSettings = useSegue((s) => s.closeSettings);
  const [provider, setProvider] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const first = aiSettings?.presets[0];
    if (!provider && first) {
      setProvider(first.id);
      setBaseUrl(first.baseUrl);
      setModel(first.model);
    }
  }, [aiSettings, provider]);

  if (!aiSettings) return null;
  const preset = aiSettings.presets.find((p) => p.id === provider);
  const needsKey = Boolean(preset?.envKey) && !preset?.envKeySet;

  const pickProvider = (id: string) => {
    setProvider(id);
    const p = aiSettings.presets.find((x) => x.id === id);
    if (p) {
      setBaseUrl(p.baseUrl);
      setModel(p.model);
    }
  };

  const add = async (patch: AiSettingsPatch) => {
    setSaving(true);
    try {
      await addAiProvider(patch);
      closeSettings();
    } finally {
      setSaving(false);
    }
  };

  const keyPlaceholder = preset?.envKey
    ? preset.envKeySet
      ? `Using ${preset.envKey} — leave blank`
      : preset.envKey
    : "Not required";

  return (
    <div className="space-y-4 px-3 pb-6">
      <Field label="Provider">
        <select
          className={inputCls}
          value={provider}
          onChange={(e) => pickProvider(e.target.value)}
        >
          {aiSettings.presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Base URL">
        <input
          className={inputCls}
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://…"
          spellCheck={false}
        />
      </Field>
      <Field label="API key">
        <input
          type="password"
          className={inputCls}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={keyPlaceholder}
          autoComplete="off"
        />
      </Field>
      <Field label="Model">
        <input
          className={inputCls}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={preset?.model || "model id"}
          spellCheck={false}
        />
      </Field>
      <div className="space-y-2">
        <Button
          variant="default"
          size="sm"
          className="w-full bg-fg"
          disabled={saving || !baseUrl.trim() || !model.trim() || (needsKey && !apiKey.trim())}
          onClick={() => {
            const patch: AiSettingsPatch = {
              provider,
              baseUrl: baseUrl.trim(),
              model: model.trim(),
            };
            if (apiKey.trim()) patch.apiKey = apiKey.trim();
            void add(patch);
          }}
        >
          Add
        </Button>
        <Button variant="outline" size="sm" className="w-full" onClick={closeSettings}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium tracking-wide text-faint uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
