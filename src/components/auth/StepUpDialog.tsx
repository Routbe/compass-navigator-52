import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Fingerprint, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { completeStepUp, getStepUpOptions, sendStepUpEmail } from "@/lib/auth/step-up.functions";
import { isStepUpRequiredError, type StepUpMethod } from "@/lib/auth/step-up-rules";
import { authClient } from "@/lib/auth-client";

type Waiter = { resolve: (ok: boolean) => void };
let opener: ((w: Waiter) => void) | null = null;

/** Opens the step-up dialog; resolves true once verified. */
export function requestStepUp(): Promise<boolean> {
  return new Promise((resolve) => (opener ? opener({ resolve }) : resolve(false)));
}

/** Runs fn; on a 401 Step-Up Required asks for verification once and retries. */
export async function withStepUp<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!isStepUpRequiredError(e)) throw e;
    if (!(await requestStepUp())) throw new Error("Bevestiging geannuleerd.");
    return fn();
  }
}

export function StepUpDialog() {
  const [waiter, setWaiter] = useState<Waiter | null>(null);
  const [methods, setMethods] = useState<StepUpMethod[]>([]);
  const [method, setMethod] = useState<StepUpMethod | null>(null);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = useServerFn(getStepUpOptions);
  const complete = useServerFn(completeStepUp);
  const sendEmail = useServerFn(sendStepUpEmail);

  useEffect(() => {
    opener = (w) => {
      setWaiter(w);
      setCode("");
      setSent(false);
      setError(null);
      void options().then((r) => {
        setMethods(r.methods);
        setMethod(r.methods[0] ?? null);
      });
    };
    return () => {
      opener = null;
    };
  }, [options]);

  const close = (ok: boolean) => {
    waiter?.resolve(ok);
    setWaiter(null);
  };

  async function verify() {
    if (!method) return;
    setBusy(true);
    setError(null);
    try {
      if (method === "passkey") {
        const r = await authClient.signIn.passkey();
        if (r?.error) throw new Error("Passkey niet bevestigd.");
        await complete({ data: { method } });
      } else {
        await complete({ data: { method, code } });
      }
      close(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dat lukte niet.");
    } finally {
      setBusy(false);
    }
  }

  const label: Record<StepUpMethod, string> = { passkey: "Passkey", totp: "Authenticator-app", email: "E-mailcode" };
  const icon = { passkey: Fingerprint, totp: KeyRound, email: Mail };

  return (
    <Dialog open={!!waiter} onOpenChange={(o) => !o && close(false)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Bevestig dat jij het bent
          </DialogTitle>
          <DialogDescription>Deze actie is gevoelig. Bevestig opnieuw (geldig 2 minuten).</DialogDescription>
        </DialogHeader>
        {methods.length > 1 && (
          <div className="flex gap-2">
            {methods.map((m) => {
              const I = icon[m];
              return (
                <Button key={m} size="sm" variant={m === method ? "default" : "outline"} onClick={() => setMethod(m)} className="gap-1.5">
                  <I className="h-4 w-4" /> {label[m]}
                </Button>
              );
            })}
          </div>
        )}
        {method === "email" && (
          <p className="rounded-md border border-border bg-muted p-2 text-xs text-muted-foreground">
            Voeg een passkey of authenticator-app toe in Accountinstellingen. E-mailcodes zijn alleen een tijdelijke terugvaloptie.
          </p>
        )}
        {method === "email" && !sent && (
          <Button variant="outline" disabled={busy} onClick={() => void sendEmail().then(() => setSent(true)).catch((e: Error) => setError(e.message))}>
            Stuur code naar mijn e-mail
          </Button>
        )}
        {(method === "totp" || (method === "email" && sent)) && (
          <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => close(false)}>Annuleer</Button>
          <Button disabled={busy || !method || (method !== "passkey" && code.length !== 6)} onClick={() => void verify()}>
            {method === "passkey" ? "Gebruik passkey" : "Bevestig"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
