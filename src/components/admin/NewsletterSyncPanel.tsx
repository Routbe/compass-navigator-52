/**
 * Admin-paneel: nieuwsbriefleads met per inschrijver de laatste Brevo-status
 * en een knop om een gefaalde sync handmatig opnieuw te proberen.
 */
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Mail, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminListNewsletterSubscribers,
  adminRetryNewsletterSync,
} from "@/lib/admin-newsletter.functions";

type Overview = Awaited<ReturnType<typeof adminListNewsletterSubscribers>>;
type Row = Overview["rows"][number];

const STATUS_STYLES: Record<Row["status"], string> = {
  synced: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  failed: "border-destructive/50 text-destructive",
  pending: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  skipped: "border-border text-muted-foreground",
};

const STATUS_LABEL: Record<Row["status"], string> = {
  synced: "Gesynchroniseerd",
  failed: "Mislukt",
  pending: "In wachtrij",
  skipped: "Geen lijst",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("nl-BE", { dateStyle: "short", timeStyle: "short" });
}

export function NewsletterSyncPanel() {
  const [data, setData] = useState<Overview | null>(null);
  const [search, setSearch] = useState("");
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminListNewsletterSubscribers({
        data: { search, onlyFailed, limit: 100 },
      });
      setData(res);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Laden mislukt.");
    }
  }, [search, onlyFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  async function retry(id?: string) {
    setBusy(id ?? "all");
    try {
      const res = await adminRetryNewsletterSync({
        data: id ? { id, allFailed: false } : { allFailed: true },
      });
      toast.success(res.message);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Opnieuw proberen mislukt.");
    } finally {
      setBusy(null);
    }
  }

  const counts = data?.counts;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Totaal", counts?.total ?? 0],
          ["Gesynchroniseerd", counts?.synced ?? 0],
          ["Mislukt", counts?.failed ?? 0],
          ["In wachtrij", counts?.pending ?? 0],
          ["Geen lijst", counts?.skipped ?? 0],
        ].map(([label, value]) => (
          <div key={label as string} className="space-y-0.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {data && !data.brevoConfigured ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400">
          BREVO_API_KEY ontbreekt — leads worden bewaard in de database, maar niet doorgestuurd.
        </p>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap">
        <div className="relative min-w-0">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zoek op e-mail of handle"
            className="h-9 pl-8"
          />
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant={onlyFailed ? "default" : "outline"}
            className="h-9"
            onClick={() => setOnlyFailed((v) => !v)}
          >
            Alleen mislukt
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-9"
            disabled={busy !== null || !counts?.failed}
            onClick={() => void retry()}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Alles opnieuw
          </Button>
        </div>
      </div>

      <ul className="space-y-2">
        {(data?.rows ?? []).map((row) => (
          <li
            key={row.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-xl border border-border p-3"
          >
            <div className="min-w-0 space-y-1">
              <p className="flex min-w-0 items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate font-medium">{row.email}</span>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${STATUS_STYLES[row.status]}`}
                >
                  {STATUS_LABEL[row.status]}
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                @{row.handle} · lijst {row.listId ?? "—"} · ingeschreven {formatDate(row.createdAt)}{" "}
                · laatste sync {formatDate(row.syncedAt)}
              </p>
              {row.error ? (
                <p className="break-words text-[11px] text-destructive">{row.error}</p>
              ) : null}
            </div>
            {row.status === "failed" || row.status === "pending" ? (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 shrink-0"
                disabled={busy !== null}
                onClick={() => void retry(row.id)}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Opnieuw
              </Button>
            ) : null}
          </li>
        ))}
        {data && data.rows.length === 0 ? (
          <li className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Geen inschrijvingen gevonden.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
