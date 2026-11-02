import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_RULES, type PresenceRules } from "@/lib/custom-presence";
import { getCustomPresence, revokePresenceApiKey, rotatePresenceApiKey, savePresenceRules, setMyCustomStatus } from "@/lib/custom-presence.functions";

const QK = ["custom-presence"];
const DAYS = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];
const DURATIONS = [{ m: 30, l: "30 min" }, { m: 60, l: "1 uur" }, { m: 240, l: "4 uur" }, { m: 0, l: "Geen einde" }];

/** Custom status, presence API key and stealth rules. */
export function CustomPresencePanel() {
  const qc = useQueryClient();
  const get = useServerFn(getCustomPresence);
  const setStatus = useServerFn(setMyCustomStatus);
  const rotate = useServerFn(rotatePresenceApiKey);
  const revoke = useServerFn(revokePresenceApiKey);
  const save = useServerFn(savePresenceRules);
  const q = useQuery({ queryKey: QK, queryFn: () => get(), retry: false });
  const [text, setText] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [rules, setRules] = useState<PresenceRules>(DEFAULT_RULES);
  useEffect(() => { if (q.data) { setRules(q.data.rules); setText(q.data.statusText ?? ""); } }, [q.data]);

  const refresh = () => qc.invalidateQueries({ queryKey: QK });
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); refresh(); } catch { toast.error("Dat lukte niet. Probeer opnieuw."); }
  };
  const updateRules = (next: PresenceRules) => { setRules(next); void run(() => save({ data: next }), "Privacyregels bewaard"); };

  if (q.isError) return <p className="text-xs text-muted-foreground">Eigen status is nu niet beschikbaar.</p>;

  return (
    <section className="space-y-4 rounded-xl border border-border p-3">
      <div className="space-y-2">
        <p className="text-sm font-medium">Eigen status</p>
        <Input value={text} maxLength={140} onChange={(e) => setText(e.target.value)} placeholder="Bijv. In een meeting" aria-label="Eigen status" />
        <div className="flex flex-wrap gap-1.5">
          {DURATIONS.map((d) => (
            <Button key={d.m} type="button" size="sm" variant={minutes === d.m ? "default" : "outline"} onClick={() => setMinutes(d.m)}>{d.l}</Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={!text.trim()} onClick={() => run(() => setStatus({ data: { status_text: text.trim(), category: "custom", ...(minutes ? { expires_in_minutes: minutes } : {}) } }), "Status ingesteld")}>Instellen</Button>
          {q.data?.statusText && <Button type="button" size="sm" variant="ghost" onClick={() => run(() => setStatus({ data: null }), "Status gewist")}>Wissen</Button>}
        </div>
        {q.data?.expiresAt && <p className="text-xs text-muted-foreground">Vervalt om {new Date(q.data.expiresAt).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}.</p>}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <p className="flex items-center gap-1.5 text-sm font-medium"><KeyRound className="h-4 w-4" aria-hidden /> API-sleutel voor automatisering</p>
        <p className="text-xs text-muted-foreground">Werk je status bij vanuit Raycast, Apple Shortcuts of Home Assistant met <code>POST /api/v1/presence</code>.</p>
        {newKey && (
          <div className="flex items-center gap-2 rounded-lg bg-muted p-2">
            <code className="min-w-0 flex-1 break-all text-[11px]">{newKey}</code>
            <Button type="button" size="icon" variant="ghost" aria-label="Kopiëren" onClick={() => { void navigator.clipboard.writeText(newKey); toast.success("Gekopieerd"); }}><Copy className="h-4 w-4" /></Button>
          </div>
        )}
        {newKey && <p className="text-xs text-muted-foreground">Bewaar deze sleutel nu: je ziet hem maar één keer.</p>}
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={async () => { try { const r = await rotate(); setNewKey(r.key); refresh(); } catch { toast.error("Dat lukte niet."); } }}>{q.data?.hasKey ? "Nieuwe sleutel" : "Sleutel aanmaken"}</Button>
          {q.data?.hasKey && <Button type="button" size="sm" variant="ghost" onClick={() => { setNewKey(null); void run(() => revoke(), "Sleutel ingetrokken"); }}>Intrekken</Button>}
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-3">
        <p className="text-sm font-medium">Privacyregels</p>
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Verbergen op deze dagen</p>
          <div className="flex flex-wrap gap-1">
            {DAYS.map((d, i) => {
              const on = rules.stealthDays.includes(i);
              return <Button key={d} type="button" size="sm" variant={on ? "default" : "outline"} className="h-8 w-10 px-0" aria-pressed={on}
                onClick={() => updateRules({ ...rules, stealthDays: on ? rules.stealthDays.filter((x) => x !== i) : [...rules.stealthDays, i] })}>{d}</Button>;
            })}
          </div>
        </div>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Alleen tonen tijdens werkuren (9–18u)</span>
          <Switch checked={rules.workStart !== null} onCheckedChange={(v) => updateRules({ ...rules, workStart: v ? 9 : null, workEnd: v ? 18 : null })} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Expliciete nummers verbergen</span>
          <Switch checked={rules.hideExplicit} onCheckedChange={(v) => updateRules({ ...rules, hideExplicit: v })} />
        </label>
      </div>
    </section>
  );
}
