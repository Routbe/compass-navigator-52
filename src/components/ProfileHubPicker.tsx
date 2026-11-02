import { useContext, useEffect, useState } from "react";
import { BadgeCheck, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/lib/router-compat";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { getStudioProfile } from "@/lib/studio-profile.functions";
import { saveQrSettingsFn } from "@/lib/qr-settings.functions";
import { ProfileQrDesignContext } from "@/lib/qr-design-bridge";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { HANDLE_MIN_LENGTH, handleIssue, normalizeHandle, profilePath } from "@/lib/profile";

interface Props {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

/**
 * The QR generator only picks the @handle the QR points to; "Opslaan" stores
 * the on-screen design as the profile QR style (shown in the Share menu).
 */
export function ProfileHubPicker({ values, onChange }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [handle, setHandle] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [manual, setManual] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const loadProfile = useServerFn(getStudioProfile);
  const saveQr = useServerFn(saveQrSettingsFn);
  const design = useContext(ProfileQrDesignContext);
  const queryClient = useQueryClient();

  useEffect(() => { setSaved(false); }, [design]);

  async function saveDesign() {
    if (!design || saving) return;
    setSaving(true);
    try {
      await saveQr({ data: design });
      await queryClient.invalidateQueries({ predicate: query => query.queryKey.some(key => typeof key === "string" && /profile|studio|draft/.test(key)) });
      setSaved(true);
      toast.success("Profiel-QR opgeslagen");
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      toast.error(`Opslaan mislukt: ${err instanceof Error ? err.message : "onbekende fout"}`);
    } finally {
      setSaving(false);
    }
  }

  const origin = "https://rout.be";
  const host = origin.replace(/^https?:\/\//, "");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }
      let data: Awaited<ReturnType<typeof loadProfile>> = null;
      try {
        data = await loadProfile();
      } catch (error) {
        console.error("[hub-picker:load:failed]", error);
      }
      if (cancelled) return;
      if (data?.username) {
        const isVerified = Boolean(data.verified) && data.status === "active";
        setHandle(data.username);
        setVerified(isVerified);
        onChange("hub_url", `${origin}${profilePath(data.username, isVerified)}`);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const setManualHandle = (raw: string) => {
    const h = normalizeHandle(raw);
    setManual(raw);
    setHandle(h || null);
    setVerified(false);
    onChange("hub_url", h ? `${origin}${profilePath(h, false)}` : "");
  };

  if (loading) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl border border-border">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const shown = handle ?? normalizeHandle(manual);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div>
        <p className="text-sm font-medium text-foreground">Social Profile Hub</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Kies welke handle deze QR-code opent. Je profielinhoud beheer je in de Studio.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className="shrink-0 font-mono text-[13px] text-muted-foreground">@</span>
        <Input
          className="input-field h-11 min-w-0 flex-1 rounded-xl"
          placeholder="jouwnaam"
          maxLength={30}
          minLength={HANDLE_MIN_LENGTH}
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={shown ? !!handleIssue(shown) : undefined}
          aria-describedby="hub-handle-help"
          value={manual || handle || ""}
          onChange={(e) => setManualHandle(e.target.value)}
          aria-label="ROUT handle"
        />
        {verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
      </div>

      {shown && handleIssue(shown) && (
        <p id="hub-handle-help" role="status" className="text-[11px] text-muted-foreground">
          {handleIssue(shown)}
        </p>
      )}

      {/* Doelprofiel: ruime padding zodat de tekst nergens afgesneden wordt. */}
      <div className="rounded-lg bg-muted/50 px-3 py-3 sm:px-4">
        <p className="break-all font-mono text-[13px] font-medium leading-relaxed text-foreground">
          {host}
          {profilePath(shown || "jouwnaam", verified)}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Gratis profiel op rout.be. Custom domeinen beschikbaar op Pro. Gratis profielen gebruiken
          de <strong>/u/</strong> namespace. Verifieer je account om je eigen unieke handle te
          claimen.
        </p>
      </div>

      <Button
        type="button"
        onClick={() => void saveDesign()}
        disabled={saving || !user || !design}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
        {!user ? "Log in om op te slaan" : saved ? "Opgeslagen" : "Opslaan"}
      </Button>
      <Link to="/studio" className="block text-center text-[12px] text-muted-foreground underline-offset-4 hover:underline">
        Beheer profielhub →
      </Link>

      {values.hub_url && (
        <p className="break-all text-[11px] text-muted-foreground">Doel: {values.hub_url}</p>
      )}
    </div>
  );
}
