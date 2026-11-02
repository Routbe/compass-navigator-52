import { useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  ArrowUpRight,
  AtSign,
  BarChart3,
  CalendarDays,
  Fingerprint,
  Inbox,
  KeyRound,
  LayoutTemplate,
  Loader2,
  Mail,
  MessageCircleQuestion,
  Megaphone,
  QrCode,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BrandLoader } from "@/components/BrandLoader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Link, useNavigate } from "@/lib/router-compat";
import { useAuth } from "@/hooks/useAuth";
import { getCommandCenter, type ChronosEvent, type ChronosKind, type CommandCenterData } from "@/lib/command-center.functions";
import { useLocalFirst } from "@/lib/local-first/useLocalFirst";
import { useRelayStore } from "@/lib/local-first/useRelayStore";
import { parseOmniInput } from "@/lib/omni-parser";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<ChronosKind, typeof Inbox> = {
  notification: Inbox,
  contact: Mail,
  question: MessageCircleQuestion,
  guestbook: Megaphone,
  login: KeyRound,
  booking: CalendarDays,
  relay: ShieldCheck,
};

const EXAMPLE_EVENTS: ChronosEvent[] = [
  { id: "ex-1", kind: "contact", title: "Inkomend contactbericht via hub", detail: "Berichten via het contactblok op je hub verschijnen hier.", at: "" },
  { id: "ex-2", kind: "question", title: "Anonieme Q&A ontvangen", detail: "Vragen die bezoekers anoniem stellen.", at: "" },
  { id: "ex-3", kind: "login", title: "Login gedetecteerd bij app X", detail: "Elke “Login met ROUT” wordt hier gelogd.", at: "" },
  { id: "ex-4", kind: "guestbook", title: "Prikbord verzoek in de wachtrij", detail: "Nieuwe prikbordberichten wachten op je goedkeuring.", at: "" },
];

const rtf = new Intl.RelativeTimeFormat("nl-BE", { numeric: "auto" });
function relative(at: string): string {
  const diff = (new Date(at).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

const fmt = (n: number | null | undefined) => (n == null ? "—" : String(n));

function Widget({
  to,
  icon: Icon,
  eyebrow,
  title,
  hint,
  className,
  children,
}: {
  to?: string;
  icon: typeof Inbox;
  eyebrow: string;
  title: ReactNode;
  hint?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const head = (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden /> {eyebrow}
      </span>
      {to ? (
        <ArrowUpRight
          className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          aria-hidden
        />
      ) : null}
    </div>
  );
  const text = (
    <>
      <div className="mt-4 font-display text-2xl leading-tight text-foreground sm:text-[28px]">{title}</div>
      {hint ? <p className="mt-1.5 text-sm text-muted-foreground">{hint}</p> : null}
    </>
  );
  const cls = cn(
    "group flex min-w-0 flex-col rounded-2xl border border-border bg-card p-5 transition-colors",
    to && "hover:border-border-ink",
    className,
  );
  // Interactive children (switches, inputs) must never sit inside a link.
  if (to && !children) {
    return (
      <Link to={to} className={cls}>
        {head}
        {text}
      </Link>
    );
  }
  return (
    <section className={cls}>
      {to ? (
        <Link to={to} className="block">
          {head}
          {text}
        </Link>
      ) : (
        <>
          {head}
          {text}
        </>
      )}
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

function QuickQr() {
  const nav = useNavigate();
  const [value, setValue] = useState("");
  const intent = parseOmniInput(value);
  return (
    <form
      className="flex items-center gap-2 rounded-xl border border-border bg-background p-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (intent.kind === "url") nav(intent.destination);
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="https://…"
        inputMode="url"
        aria-label="URL voor een snelle QR-code"
        className="h-9 min-w-0 flex-1 bg-transparent px-2 font-mono text-sm outline-none placeholder:text-muted-foreground"
      />
      <Button type="submit" size="sm" className="h-9 shrink-0 rounded-lg" disabled={intent.kind !== "url"}>
        <ArrowRight className="h-4 w-4" />
        <span className="sr-only">QR maken</span>
      </Button>
    </form>
  );
}

function RelayWidget({ userId, connectedApps }: { userId: string; connectedApps: number | null }) {
  const store = useRelayStore(userId);
  const relays = store.relays ?? [];
  const active = relays.filter((r) => r.status === "active").length;
  return (
    <Widget
      to="/dashboard/identity"
      icon={Fingerprint}
      eyebrow="Identity Relays"
      title={`${active} actieve relay${active === 1 ? "" : "s"}`}
      hint={`${fmt(connectedApps)} gekoppelde apps · apps zien alleen je ROUT-alias`}
      className="sm:col-span-2"
    >
      {store.relays === null ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Relays laden" />
      ) : !relays.length ? (
        <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
          Nog geen relays. Schakel per gekoppelde app een privé-relay in via Identity.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {relays.slice(0, 4).map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{r.appName}</span>
                <span className="block truncate font-mono text-[11px] text-muted-foreground">{r.proxyEmail}</span>
              </span>
              <Switch
                checked={r.status === "active"}
                onCheckedChange={() => void store.toggle(r)}
                aria-label={`Relay voor ${r.appName} ${r.status === "active" ? "pauzeren" : "hervatten"}`}
              />
            </li>
          ))}
        </ul>
      )}
      {store.pending > 0 ? (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> {store.pending} wijziging(en) synchroniseren…
        </p>
      ) : null}
    </Widget>
  );
}

function ChronosStream({ events, syncing }: { events: ChronosEvent[]; syncing: boolean }) {
  const shown = events.length ? events : EXAMPLE_EVENTS;
  return (
    <aside className="min-w-0 rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto" aria-label="Chronos Stream">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Chronos Stream</h2>
        {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Synchroniseren" /> : null}
      </div>
      {!events.length ? (
        <p className="mt-2 text-xs text-muted-foreground">Nog geen gebeurtenissen — zo ziet je tijdlijn eruit.</p>
      ) : null}
      <ol className="relative mt-5 space-y-5 border-l border-border pl-5">
        {shown.map((ev) => {
          const Icon = KIND_ICON[ev.kind];
          return (
            <li key={ev.id} className="relative">
              <span className="absolute -left-[31px] top-0 grid h-5 w-5 place-items-center rounded-full border border-border bg-background">
                <Icon className="h-3 w-3 text-foreground" aria-hidden />
              </span>
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 text-sm font-medium text-foreground">{ev.title}</p>
                {ev.at ? (
                  <time dateTime={ev.at} className="shrink-0 text-[11px] text-muted-foreground">
                    {relative(ev.at)}
                  </time>
                ) : (
                  <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                    Voorbeeld
                  </Badge>
                )}
              </div>
              {ev.detail ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{ev.detail}</p> : null}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

/**
 * /dashboard — the Command Center cockpit. Left: bento control grid; right:
 * the Chronos event stream. State is local-first: the last snapshot paints
 * instantly from IndexedDB, mutations apply at 0 ms and sync in the background.
 * QR statistics live in /dashboard/assets.
 */
export function CommandCenter() {
  const { user } = useAuth();
  const loadCenter = useServerFn(getCommandCenter);
  const state = useLocalFirst<CommandCenterData>(user ? `cockpit:${user.id}` : null, () => loadCenter());

  if (!user || (!state.data && state.syncing)) {
    return (
      <AppLayout title="Command Center" width="wide">
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="relative h-24 w-24">
            <BrandLoader label="Cockpit laden…" />
          </div>
        </div>
      </AppLayout>
    );
  }

  const c = state.data;
  const inboxCount = c ? (c.unreadNotifications ?? 0) + (c.openQuestions ?? 0) : null;

  return (
    <AppLayout
      title="Command Center"
      description="Je soevereine cockpit voor identiteit, communicatie en routing."
      width="wide"
      crumbs={[{ label: "Command Center" }]}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => void state.refresh()} disabled={state.syncing}>
            <RefreshCw className={cn("h-4 w-4", state.syncing && "animate-spin")} /> Sync
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/dashboard/assets">
              <BarChart3 className="h-4 w-4" /> Assets &amp; statistieken
            </Link>
          </Button>
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/studio">
              <LayoutTemplate className="h-4 w-4" /> Studio
            </Link>
          </Button>
        </div>
      }
    >
      {state.error && !c ? (
        <p className="mb-4 rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          De cockpit kon niet synchroniseren. Probeer opnieuw met Sync.
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid auto-rows-min gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <RelayWidget userId={user.id} connectedApps={c?.connectedApps ?? null} />

          <Widget to="/studio" icon={LayoutTemplate} eyebrow="Profiel Hub" title="Hub beheren" hint="Blokken, thema en zichtbaarheid in de Studio." />

          <Widget icon={QrCode} eyebrow="Snelle QR" title="Plak een link" hint="Direct naar de generator in de Studio.">
            <QuickQr />
          </Widget>

          <Widget
            to="/dashboard/assets"
            icon={Inbox}
            eyebrow="Unified Inbox"
            title={`${fmt(inboxCount)} nieuwe berichten & Q&A's`}
            hint={`${fmt(c?.unreadNotifications)} meldingen · ${fmt(c?.openQuestions)} open vragen`}
          />

          <Widget
            to="/studio/booking"
            icon={CalendarDays}
            eyebrow="Agenda & Boekingen"
            title={c?.upcomingBookings ? `${c.upcomingBookings} aankomend` : "Geen aankomende afspraken"}
            hint={c?.nextBookingAt ? `Volgende: ${new Date(c.nextBookingAt).toLocaleString("nl-BE")}` : "Deel je boekingspagina vanuit de Studio."}
          />

          <Widget
            to="/dashboard/bluesky"
            icon={AtSign}
            eyebrow="Social & Prikbord"
            title={`${fmt(c?.guestbook30d)} prikbord-berichten`}
            hint="Beheer je Mastodon/Bluesky feed op je hub (laatste 30 dagen)."
          />
        </div>

        <ChronosStream events={c?.events ?? []} syncing={state.syncing} />
      </div>
      {state.savedAt ? (
        <p className="mt-4 text-right text-[11px] text-muted-foreground">
          Lokaal gesynchroniseerd {relative(new Date(state.savedAt).toISOString())}
        </p>
      ) : null}
    </AppLayout>
  );
}
