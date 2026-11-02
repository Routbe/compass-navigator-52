import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TeamTab } from "@/components/settings/TeamTab";
import { DocHelpLink } from "@/components/seo/DocHelpLink";
import { ScopeActivationState, isForbidden } from "@/components/workspace/ScopeActivationState";
import { WorkspaceIconPicker } from "@/components/workspace/WorkspaceIconPicker";
import { RolesOverview } from "@/components/workspace/RolesOverview";
import { isWorkspaceIconKey } from "@/lib/workspace-icons";
import {
  activateScopeFromUrl, setWorkspaceIcon, checkRootWorkspaceSlug, claimCleanWorkspaceSlug, claimRootWorkspaceSlug, deleteWorkspace,
  getWorkspaceContext, getWorkspaceSettings, renameWorkspace, setWorkspaceDomain, verifyWorkspaceDomain,
  type WorkspaceSettings as WsSettings,
} from "@/lib/workspaces.functions";
import { getActiveScopeStorage } from "@/lib/assets.functions";
import { listWorkspaceAgentAudit } from "@/lib/agent/chronos.functions";
import { canRevert } from "@/lib/agent/chronos";
import { canManageTeam } from "@/lib/workspace-rules";

export const Route = createFileRoute("/_authenticated/studio_/w/$workspaceSlug/settings")({
  head: () => ({
    meta: [
      { title: "Workspace Instellingen | ROUT Studio" },
      { name: "description", content: "Naam, adres, team, domeinen en opslag van je ROUT-workspace." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Workspace Instellingen | ROUT Studio" },
      { property: "og:description", content: "Naam, adres, team, domeinen en opslag van je ROUT-workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkspaceSettingsPage,
});

const mb = (b: number) => `${Math.round(b / 1024 / 1024)} MB`;
const errText = (e: unknown) => (e instanceof Error ? e.message : "Er ging iets mis.");
const card = "space-y-3 rounded-2xl border border-border bg-card p-5";

/** Workspace-only settings: general, address, team, domains, storage and the danger zone. */
function WorkspaceSettingsPage() {
  const { workspaceSlug } = Route.useParams();
  const activate = useServerFn(activateScopeFromUrl);
  const ctxFn = useServerFn(getWorkspaceContext);
  const settingsFn = useServerFn(getWorkspaceSettings);
  const storageFn = useServerFn(getActiveScopeStorage);
  const qc = useQueryClient();
  const [state, setState] = useState<"loading" | "ready" | "denied" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    void activate({ data: { workspaceSlug } })
      .then(() => { if (alive) { qc.clear(); setState("ready"); } })
      .catch((e) => alive && setState(isForbidden(e) ? "denied" : "error"));
    return () => { alive = false; };
  }, [activate, qc, workspaceSlug, attempt]);

  const ctx = useQuery({ queryKey: ["workspace-context"], queryFn: () => ctxFn(), enabled: state === "ready" });
  const summary = ctx.data?.workspaces.find((w) => w.slug === workspaceSlug) ?? null;
  const wsId = summary?.id ?? null;
  const settings = useQuery({
    queryKey: ["workspace-settings", wsId],
    queryFn: () => { if (!wsId) throw new Error("Workspace unavailable"); return settingsFn({ data: { workspaceId: wsId } }); },
    enabled: Boolean(wsId),
  });
  const storage = useQuery({ queryKey: ["scope-storage", workspaceSlug], queryFn: () => storageFn(), enabled: state === "ready" });
  const refresh = () => void qc.invalidateQueries();

  if (state === "denied" || state === "error") return <main className="px-4 py-8"><ScopeActivationState kind={state} onRetry={() => { setState("loading"); setAttempt((a) => a + 1); }} /></main>;
  if (ctx.isError || ctx.data?.available === false) return <p role="status" className="p-8 text-center text-sm text-muted-foreground">Workspaces tijdelijk niet beschikbaar.</p>;
  if (state === "loading" || ctx.isLoading || settings.isLoading) return <p className="p-8 text-center text-sm text-muted-foreground">Workspace laden…</p>;
  const ws = settings.data;
  if (!ws) return <p className="p-8 text-center text-sm text-muted-foreground">Workspace niet gevonden.</p>;
  const manage = canManageTeam(ws.role);
  const s = storage.data;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">{ws.name}</h1>
        <p className="text-sm text-muted-foreground">rout.be/w/{ws.slug}{ws.rootAlias ? ` · rout.be/${ws.rootAlias}` : ""}</p>
        <Button asChild variant="outline" size="sm" className="mt-3"><Link to="/studio/w/$workspaceSlug/studio" params={{ workspaceSlug: ws.slug }}>Open Studio van {ws.name}</Link></Button>
      </header>

      {manage && <GeneralCard ws={ws} onDone={refresh} />}
      {summary && ["owner", "admin", "editor"].includes(ws.role) && (
        <IconCard workspaceId={ws.id} category={summary.category} initial={{ icon: isWorkspaceIconKey(summary.icon) ? summary.icon : null, avatarUrl: summary.avatarUrl }} onDone={refresh} />
      )}
      {manage && <AddressCard ws={ws} onDone={refresh} />}

      <section className={card}>
        <h2 className="font-medium">Opslag van deze workspace</h2>
        {s ? (
          <>
            <p className="text-sm text-muted-foreground">{mb(s.usedBytes)} / {mb(s.quotaBytes)} gebruikt</p>
            {s.message && <p className="text-sm text-destructive">{s.message}</p>}
          </>
        ) : <p className="text-sm text-muted-foreground">Opslag laden…</p>}
      </section>

      {manage ? <TeamTab workspaceId={ws.id} workspaceName={ws.name} /> : (
        <p className="text-sm text-muted-foreground">
          Alleen eigenaars en admins beheren het team.{" "}
          <DocHelpLink to="/support/workspace/team-roles">Bekijk het overzicht van alle teamrollen en rechten</DocHelpLink>
        </p>
      )}

      <RolesOverview myRole={ws.role} />

      <section className={card}>
        <h2 className="font-medium">Developer Console &amp; API</h2>
        <p className="text-sm text-muted-foreground">API-sleutels, webhooks en OAuth-apps die je in deze workspace maakt, horen bij {ws.name}, niet bij één persoon.</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" size="sm"><Link to="/studio/w/$workspaceSlug/$feature" params={{ workspaceSlug: ws.slug, feature: "dev-console" }}>Open Developer Console</Link></Button>
          <DocHelpLink to="/support/workspace/developer-console">Lees hoe je veilig API-sleutels rouleert</DocHelpLink>
        </div>
      </section>

      {manage && <ChronosCard ws={ws} />}
      {manage && <DomainCard ws={ws} onDone={refresh} />}
      {ws.role === "owner" && <DangerZone ws={ws} />}
    </main>
  );
}

function IconCard({ workspaceId, category, initial, onDone }: { workspaceId: string; category: string | null; initial: Parameters<typeof WorkspaceIconPicker>[0]["value"]; onDone: () => void }) {
  const save = useServerFn(setWorkspaceIcon);
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const dirty = value.icon !== initial.icon || value.avatarUrl !== initial.avatarUrl;
  async function submit() {
    setBusy(true);
    try { await save({ data: { workspaceId, ...value } }); toast.success("Icoon bijgewerkt"); onDone(); }
    catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  }
  return (
    <section className={card}>
      <h2 className="font-medium">Icoon of logo</h2>
      <p className="text-sm text-muted-foreground">Zonder keuze volgt het icoon je categorie.</p>
      <WorkspaceIconPicker value={value} category={category} onChange={setValue} />
      <Button onClick={submit} disabled={busy || !dirty}>Opslaan</Button>
    </section>
  );
}

function GeneralCard({ ws, onDone }: { ws: WsSettings; onDone: () => void }) {
  const rename = useServerFn(renameWorkspace);
  const [name, setName] = useState(ws.name);
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();
  const invalid = !trimmed || trimmed.length > 80;
  async function save() {
    setBusy(true);
    try { await rename({ data: { workspaceId: ws.id, name } }); toast.success("Naam bijgewerkt"); onDone(); }
    catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  }
  return (
    <section className={card}>
      <h2 className="font-medium">Algemeen</h2>
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Naam van de workspace" maxLength={80} />
        <Button onClick={save} disabled={busy || invalid || trimmed === ws.name}>Opslaan</Button>
      </div>
      {invalid && <p className="text-sm text-destructive">Gebruik een naam van 1 tot 80 tekens.</p>}
    </section>
  );
}

function AddressCard({ ws, onDone }: { ws: WsSettings; onDone: () => void }) {
  const claimClean = useServerFn(claimCleanWorkspaceSlug);
  const claimRoot = useServerFn(claimRootWorkspaceSlug);
  const checkRoot = useServerFn(checkRootWorkspaceSlug);
  const navigate = useNavigate();
  const clean = ws.slug.replace(/-[a-z0-9]{4}$/, "");
  const [slug, setSlug] = useState(clean);
  const [root, setRoot] = useState(ws.rootAlias ?? clean);
  const [rootCheck, setRootCheck] = useState<{ value: string; error: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  // Live availability for the root address.
  useEffect(() => {
    if (!ws.canDropSuffix || !root || root === ws.rootAlias) return;
    const t = setTimeout(() => {
      void checkRoot({ data: { workspaceId: ws.id, slug: root } })
        .then((r) => setRootCheck({ value: root, error: r.error }))
        .catch(() => setRootCheck(null));
    }, 350);
    return () => clearTimeout(t);
  }, [checkRoot, root, ws.canDropSuffix, ws.id, ws.rootAlias]);

  async function saveClean() {
    setBusy(true);
    try {
      const res = await claimClean({ data: { workspaceId: ws.id, slug } });
      toast.success("Workspace-adres bijgewerkt");
      void navigate({ to: "/studio/w/$workspaceSlug/settings", params: { workspaceSlug: res.slug }, replace: true });
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  }
  async function saveRoot() {
    setBusy(true);
    try { await claimRoot({ data: { workspaceId: ws.id, slug: root } }); toast.success("Root-adres geclaimd"); onDone(); }
    catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  }

  const live = rootCheck && rootCheck.value === root ? rootCheck : null;
  return (
    <section className={card}>
      <h2 className="font-medium">Adres</h2>
      <p className="text-sm text-muted-foreground">Huidig adres: rout.be/w/{ws.slug}</p>
      {!ws.canDropSuffix ? (
        <p className="text-sm text-muted-foreground">
          Gratis workspaces houden een achtervoegsel van 4 tekens. Met Plus, Pro of Early Verified kies je een schoon adres en een root-adres.
        </p>
      ) : (
        <>
          <label className="block space-y-1 text-sm">
            <span>Schone slug (rout.be/w/…)</span>
            <div className="flex gap-2">
              <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} aria-label="Schone slug" />
              <Button onClick={saveClean} disabled={busy || slug === ws.slug}>Schone slug claimen</Button>
            </div>
          </label>
          <label className="block space-y-1 text-sm">
            <span>Root-adres (rout.be/…)</span>
            <div className="flex gap-2">
              <Input value={root} onChange={(e) => setRoot(e.target.value.toLowerCase())} aria-label="Root-adres" />
              <Button onClick={saveRoot} disabled={busy || root === ws.rootAlias || Boolean(live?.error)}>Root-adres claimen</Button>
            </div>
          </label>
          {root !== ws.rootAlias && live && (
            <p className={live.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
              {live.error ?? `rout.be/${root} is beschikbaar.`}
            </p>
          )}
        </>
      )}
    </section>
  );
}


const ACTION_LABELS: Record<string, string> = {
  "link.create": "Link/QR aangemaakt",
  "profile_draft.update": "Profieldraft bijgewerkt",
  "workspace.provision": "Workspace ingericht",
};

/** Chronos: the transparent timeline of everything AI agents did in this workspace, with one-click undo. */
function ChronosCard({ ws }: { ws: WsSettings }) {
  const q = useQuery({ queryKey: ["chronos", ws.id], queryFn: () => listWorkspaceAgentAudit({ data: { workspaceId: ws.id } }) });
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function revert(logId: string) {
    setBusyId(logId);
    try {
      const res = await fetch(`/api/audit/revert/${logId}`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Terugdraaien lukte niet.");
      }
      toast.success("AI-actie teruggedraaid");
      void qc.invalidateQueries({ queryKey: ["chronos", ws.id] });
    } catch (e) { toast.error(errText(e)); } finally { setBusyId(null); }
  }

  return (
    <section className={card}>
      <h2 className="font-medium">Chronos — AI-actielog</h2>
      <p className="text-sm text-muted-foreground">
        Elke mutatie die een gekoppelde AI-agent uitvoert verschijnt hier met een momentopname van de vorige staat.
        Eén klik draait een ongewenste actie terug.
      </p>
      {q.data?.length === 0 && <p className="text-sm text-muted-foreground">Nog geen AI-acties in deze workspace.</p>}
      {q.data && q.data.length > 0 && (
        <ul className="divide-y divide-border">
          {q.data.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{ACTION_LABELS[entry.action] ?? entry.action}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {entry.actorClientId} · {new Date(entry.createdAt).toLocaleString("nl-BE")}
                  {entry.revertedAt && " · teruggedraaid"}
                </p>
              </div>
              {canRevert(entry) && (
                <Button variant="outline" size="sm" disabled={busyId === entry.id} onClick={() => void revert(entry.id)}>
                  {busyId === entry.id ? "Bezig…" : "Draai terug"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DomainCard({ ws, onDone }: { ws: WsSettings; onDone: () => void }) {
  const setDomain = useServerFn(setWorkspaceDomain);
  const verify = useServerFn(verifyWorkspaceDomain);
  const [value, setValue] = useState(ws.domain?.name ?? "");
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); onDone(); } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  }
  return (
    <section className={card}>
      <h2 className="font-medium">Eigen domein</h2>
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="acme.be" aria-label="Domeinnaam" />
        <Button onClick={() => run(async () => { await setDomain({ data: { workspaceId: ws.id, domain: value || null } }); toast.success("Domein opgeslagen"); })} disabled={busy}>
          Koppelen
        </Button>
      </div>
      {ws.domain && (
        <div className="space-y-2 text-sm">
          <p>Status: {ws.domain.verified ? "Geverifieerd" : "Wacht op DNS-controle"}</p>
          {!ws.domain.verified && (
            <>
              <p className="text-muted-foreground">Voeg dit TXT-record toe bij je domeinbeheerder:</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-muted p-3 font-mono text-xs">
                <dt>Naam</dt><dd className="break-all">{ws.domain.recordName}</dd>
                <dt>Waarde</dt><dd className="break-all">{ws.domain.recordValue ?? "Domeinverificatie is nog niet ingesteld."}</dd>
              </dl>
              <Button variant="outline" disabled={busy} onClick={() => run(async () => {
                const r = await verify({ data: { workspaceId: ws.id } });
                if (r.verified) toast.success("Domein geverifieerd");
                else toast.error("Het TXT-record is nog niet gevonden. DNS-wijzigingen kunnen even duren.");
              })}>DNS controleren</Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function DangerZone({ ws }: { ws: WsSettings }) {
  const del = useServerFn(deleteWorkspace);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true);
    try {
      await del({ data: { workspaceId: ws.id, confirmation: confirm } });
      qc.clear();
      toast.success("Workspace verwijderd");
      void navigate({ to: "/studio/account", replace: true });
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  }
  return (
    <section className="space-y-3 rounded-2xl border border-destructive/50 bg-card p-5">
      <h2 className="font-medium text-destructive">Gevarenzone</h2>
      <p className="text-sm text-muted-foreground">
        Verwijderen is definitief: alle teamleden worden ontkoppeld en de bestanden van deze workspace verdwijnen.
        Typ <strong className="text-foreground">{ws.name}</strong> om te bevestigen.
      </p>
      <div className="flex gap-2">
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Naam van de workspace ter bevestiging" />
        <Button variant="destructive" onClick={remove} disabled={busy || confirm.trim() !== ws.name.trim()}>Workspace verwijderen</Button>
      </div>
    </section>
  );
}
