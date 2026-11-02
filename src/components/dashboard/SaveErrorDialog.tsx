import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sendSaveErrorReport } from "@/lib/error-report.functions";
import type { SaveErrorCode, SaveErrorInfo } from "@/lib/save-errors";

const EXPLAIN: Record<SaveErrorCode, string> = {
  session_expired: "Geweigerd door verstreken sessie. Log opnieuw in en probeer het daarna nog eens.",
  validation_failed: "Een van je instellingen kon niet worden gecontroleerd. Pas het laatst gewijzigde onderdeel aan en probeer opnieuw.",
  db_unavailable: "Er is een tijdelijk verbindingsprobleem met de database.",
  db_timeout: "De database reageerde te traag. Je wijzigingen staan nog klaar.",
  conflict: "Je profiel werd ondertussen elders aangepast. We nemen de nieuwste versie over en slaan opnieuw op.",
  network: "Je toestel heeft geen verbinding met ROUT. Controleer je internet.",
  unknown: "Er ging onverwacht iets mis bij het opslaan.",
};

export function SaveErrorDialog({
  error,
  open,
  onOpenChange,
  onRetry,
  endpoint,
}: {
  error: SaveErrorInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  endpoint: string;
}) {
  const report = useServerFn(sendSaveErrorReport);
  const [showTech, setShowTech] = useState(false);
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const res = await report({ data: { ...error, endpoint } });
      if (res.sent) toast.success("Foutrapport verstuurd naar het ROUT-team.");
      else if (res.reason === "rate_limited") toast.info("Je hebt recent al rapporten gestuurd. We bekijken het.");
      else toast.error("Rapport kon niet worden verstuurd.");
    } catch {
      toast.error("Rapport kon niet worden verstuurd.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Concept kon niet worden opgeslagen</DialogTitle>
          <DialogDescription>{EXPLAIN[error.code]}</DialogDescription>
        </DialogHeader>
        <button
          type="button"
          onClick={() => setShowTech((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground"
          aria-expanded={showTech}
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${showTech ? "rotate-180" : ""}`} aria-hidden />
          Technische details
        </button>
        {showTech && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px]">
            <dt className="text-muted-foreground">Code</dt><dd>{error.code}</dd>
            <dt className="text-muted-foreground">HTTP</dt><dd>{error.status || "geen verbinding"}</dd>
            <dt className="text-muted-foreground">Tijd</dt><dd>{new Date(error.at).toLocaleString()}</dd>
            <dt className="text-muted-foreground">Detail</dt><dd className="break-all">{error.detail}</dd>
          </dl>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={() => { onOpenChange(false); onRetry(); }}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Nu opnieuw opslaan
          </Button>
          <Button variant="outline" className="flex-1" disabled={sending} onClick={() => void send()}>
            <Mail className="h-4 w-4" aria-hidden /> Foutrapport sturen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
