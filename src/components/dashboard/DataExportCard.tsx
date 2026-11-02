import { withStepUp } from "@/components/auth/StepUpDialog";
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { exportMyDataFn } from "@/lib/my-data.functions";

/**
 * Data-portabiliteit: één klik levert een volledig .json-bestand met profiel,
 * links, socials, aliassen en domeinen. Geen wachtrij, geen e-mail — direct.
 */
export function DataExportCard() {
  const exportData = useServerFn(exportMyDataFn);
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const payload = await withStepUp(() => exportData({}));
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rout-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Je export is gedownload.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">Download mijn data</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Alles wat we van je bijhouden in één leesbaar JSON-bestand: profiel, links, geverifieerde
          socials, e-mailaliassen en domeinen.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={download}
          disabled={busy}
          className="gap-2"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          JSON
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={async () => {
            const go = async () => {
              const res = await fetch("/api/user/vault/export", { credentials: "same-origin" });
              if (res.status === 401 && (await res.clone().text()).includes("Step-Up")) throw new Error("STEP_UP_REQUIRED");
              if (!res.ok) throw new Error(await res.text());
              return res.blob();
            };
            try {
              const blob = await withStepUp(go);
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `rout-vault-${new Date().toISOString().slice(0, 10)}.zip`;
              a.click();
              URL.revokeObjectURL(url);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Export mislukt.");
            }
          }}
        >
          <Download className="h-4 w-4" />
          Volledige kluis (ZIP)
        </Button>
      </div>
    </div>
  );
}

export default DataExportCard;
