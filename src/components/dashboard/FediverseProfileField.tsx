import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Loader2, RefreshCw, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getMyFediverseProfile, saveMyFediverseProfile } from "@/lib/fediverse-profile.functions";
import { mastodonProfileSchema } from "@/lib/fediverse-profile";

export function FediverseProfileField() {
  const get = useServerFn(getMyFediverseProfile); const save = useServerFn(saveMyFediverseProfile);
  const [value, setValue] = useState(""); const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(true); const [message, setMessage] = useState("");
  useEffect(() => { let active = true; void get().then(identity => { if (active) { setValue(identity?.url ?? ""); setVerified(identity?.verified ?? false); } }).catch(() => { if (active) setMessage("De koppeling is tijdelijk niet bereikbaar."); }).finally(() => { if (active) setBusy(false); }); return () => { active = false; }; }, [get]);
  useEffect(() => {
    if (busy || verified || !message.startsWith("Opgeslagen")) return;
    const timer = setTimeout(() => { void submit(); }, 60_000);
    return () => clearTimeout(timer);
  }, [busy, verified, message, value]);
  async function submit() {
    const parsed = mastodonProfileSchema.safeParse(value);
    if (!parsed.success) { setMessage(parsed.error.issues[0]?.message ?? "Ongeldige Mastodon-handle."); return; }
    setBusy(true); setMessage("");
    try {
      const result = await save({ data: parsed.data });
      if (!result.ok) { setMessage(result.message); return; }
      setValue(result.identity?.url ?? ""); setVerified(result.identity?.verified ?? false);
      setMessage(result.identity ? result.identity.verified ? "Mastodon-eigendom bevestigd." : "Opgeslagen · teruglink nog niet bevestigd." : "Mastodon-koppeling verwijderd.");
    } catch { setMessage("De koppeling is tijdelijk niet bereikbaar."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2">
    <label htmlFor="mastodon-profile" className="text-sm font-medium">Mastodon</label>
    <div className="flex items-center gap-2">
      <Input id="mastodon-profile" value={value} maxLength={200} disabled={busy} placeholder="@gebruiker@instance.be" onChange={event => { setValue(event.target.value); setVerified(false); setMessage(""); }} />
      <Button size="icon" variant="outline" disabled={busy} title="Opslaan en verifiëren" aria-label="Mastodon opslaan en verifiëren" onClick={() => void submit()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : value ? <RefreshCw className="h-4 w-4" /> : <Save className="h-4 w-4" />}</Button>
    </div>
    {verified && <span className="inline-flex items-center gap-1 text-sm text-primary"><BadgeCheck className="h-4 w-4" />Geverifieerd</span>}
    {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
  </div>;
}