import { useI18n } from "@/lib/i18n";
import { StudioSectionIcon } from "./StudioSectionIcon";
import { useSnapchatCallback } from "./SnapchatPanel";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { StatusContentSettings } from "@/components/dashboard/editor/StatusSettings";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { LiveIntegrations, useLiveIntegrationCount } from "@/components/studio/LiveIntegrations";
import type { ProfileDisplayPrefs } from "@/lib/profile-display";
import { Switch } from "@/components/ui/switch";

type SetPref = <K extends keyof ProfileDisplayPrefs>(key: K, value: ProfileDisplayPrefs[K]) => void;

/** 💬 Live Status & Gedachten: status indicator + status bericht. */
export function LiveStatusAccordion({ prefs, setPref }: { prefs: ProfileDisplayPrefs; setPref: SetPref }) {
  const { t, locale } = useI18n();
  useSnapchatCallback();
  return (
    <AccordionItem value="live_status" className="rounded-2xl border border-border bg-card px-4 sm:px-5">
      <AccordionTrigger className="hover:no-underline">
        <span className="flex flex-1 items-center justify-between gap-3 pr-2">
          <span className="flex min-w-0 items-center gap-2 text-base font-medium"><StudioSectionIcon kind="live" />{t("studio.live.title").replace(/^\p{Extended_Pictographic}\s*/u, "")}</span>
          {prefs.statusLine && (
            <span className="max-w-[45%] truncate rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
              {prefs.statusLine}
            </span>
          )}
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-5">
        <StatusContentSettings prefs={prefs} setPref={setPref} bare />
        <div className="mt-5 space-y-4 border-t border-border pt-4">
          {([['steamPresence', 'studio.effects.steam', 'studio.effects.steamHelp'], ['lastfmPresence', 'studio.effects.lastfm', 'studio.effects.lastfmHelp']] as const).map(([key, title, help]) => (
            <div key={key} className="flex items-start justify-between gap-4">
              <div className="min-w-0"><p className="text-sm font-medium">{t(title)}</p><p className="text-sm text-muted-foreground">{t(help)}</p></div>
              <Switch aria-label={t(title)} checked={prefs[key]} onCheckedChange={(value) => setPref(key, value)} />
            </div>
          ))}
        </div>
        <LiveIntegrationsPanel />
      </AccordionContent>
    </AccordionItem>
  );
}

/** ⚡ Live Integraties als eigen inklapbaar sub-paneel. */
function LiveIntegrationsPanel() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const count = useLiveIntegrationCount();
  return (
    <section className="mt-5 border-t border-border pt-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5 text-left text-sm font-medium hover:bg-muted"
      >
        <span>{t("studio.live.count", { count })}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && <div className="mt-3"><LiveIntegrations /></div>}
    </section>
  );
}
