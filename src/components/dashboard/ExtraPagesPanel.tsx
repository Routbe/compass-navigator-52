import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, ExternalLink, HeartHandshake, MessageCircleQuestion } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { getMyTipSetup, saveMyTipSettings } from "@/lib/tip-page.functions";
import { getMyQuestions, setMyQuestionsEnabled } from "@/lib/questions.functions";

/** Settings overview of extra page types: only an on/off switch and a view link. Content lives in the page's Inhoud tab. */
export function ExtraPagesPanel({ handle, onTipEnabledChange }: { handle: string; onTipEnabledChange?: (v: boolean) => void }) {
  const loadTip = useServerFn(getMyTipSetup);
  const saveTip = useServerFn(saveMyTipSettings);
  const loadQ = useServerFn(getMyQuestions);
  const setQ = useServerFn(setMyQuestionsEnabled);
  const [tip, setTip] = useState<Awaited<ReturnType<typeof getMyTipSetup>> | null>(null);
  const [qna, setQna] = useState<boolean | null>(null);

  useEffect(() => {
    void loadTip().then(setTip).catch(() => setTip(null));
    void loadQ().then((r) => setQna(r.enabled)).catch(() => setQna(null));
  }, [loadTip, loadQ]);

  const tipEnabled = Boolean(tip?.settings?.enabled);
  const tipLocked = !tip?.eligibility.ok || !tip?.settings;

  async function toggleTip(v: boolean) {
    if (!tip?.settings) return;
    const res = await saveTip({ data: { ...tip.settings, enabled: v } }).catch(() => null);
    if (res?.ok) { setTip({ ...tip, settings: { ...tip.settings, enabled: v } }); onTipEnabledChange?.(v); }
    else toast.error("Opslaan mislukt");
  }
  async function toggleQna(v: boolean) {
    const res = await setQ({ data: { enabled: v } }).catch(() => null);
    if (res?.ok) setQna(v); else toast.error("Opslaan mislukt");
  }

  const rows = [
    { key: "tip", Icon: HeartHandshake, title: "Steunpagina", path: `/${handle}/tip`, checked: tipEnabled, disabled: tipLocked, onChange: toggleTip, hint: tipLocked ? "Vereist verificatie" : null },
    { key: "qna", Icon: MessageCircleQuestion, title: "Anonieme vragen / Gastenboek", path: `/${handle}#qna`, checked: Boolean(qna), disabled: qna === null, onChange: toggleQna, hint: null },
  ];

  return (
    <ul className="divide-y divide-border">
      {rows.map(({ key, Icon, title, path, checked, disabled, onChange, hint }) => (
        <li key={key} className="flex items-center gap-3 py-3">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{title}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">rout.be{path.replace("#qna", "")}{hint ? ` · ${hint}` : ""}</p>
          </div>
          <Button asChild variant="ghost" size="icon" className="h-8 w-8" aria-label={`${title} bekijken`}>
            <a href={path} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /></a>
          </Button>
          <Switch checked={checked} disabled={disabled} onCheckedChange={(v) => void onChange(v)} aria-label={`${title} actief`} />
        </li>
      ))}
      <li className="flex items-center gap-3 py-3">
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Boekingen</p>
          <p className="text-xs text-muted-foreground">Actief zodra je een boekingstype publiceert.</p>
        </div>
        <Button asChild variant="outline" size="sm"><Link to="/studio" search={{ page: "booking" } as never}>Beheren</Link></Button>
      </li>
    </ul>
  );
}
