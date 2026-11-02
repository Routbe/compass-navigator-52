import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProfileEditor } from "@/components/dashboard/ProfileEditor";
import { activateScopeFromUrl } from "@/lib/workspaces.functions";

export const Route = createFileRoute("/_authenticated/studio_/w/$workspaceSlug/studio")({
  head: () => ({
    meta: [
      { title: "Workspace Studio | ROUT" },
      { name: "description", content: "De volledige ROUT Studio voor deze workspace: inhoud, vormgeving, componenten en audio." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Workspace Studio | ROUT" },
      { property: "og:description", content: "De volledige ROUT Studio voor deze workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkspaceStudioPage,
});

/**
 * Full Studio parity for workspaces: the same StudioCanvas (ProfileEditor)
 * as the personal Studio — same tabs, design options, blocks and the
 * universal audio block — bound to the workspace instead of the member.
 */
function WorkspaceStudioPage() {
  const { workspaceSlug } = Route.useParams();
  const activate = useServerFn(activateScopeFromUrl);
  const qc = useQueryClient();
  const [scope, setScope] = useState<"loading" | "ready" | "denied">("loading");

  useEffect(() => {
    let alive = true;
    void activate({ data: { workspaceSlug } })
      .then(() => {
        if (!alive) return;
        qc.removeQueries({ queryKey: ["workspace-context"] });
        setScope("ready");
      })
      .catch(() => alive && setScope("denied"));
    return () => {
      alive = false;
    };
  }, [activate, qc, workspaceSlug]);

  const crumbs = [{ label: "Studio", to: "/studio" }, { label: workspaceSlug }];
  if (scope === "denied") {
    return (
      <AppLayout title="Workspace Studio" crumbs={crumbs}>
        <p className="text-sm text-muted-foreground">Geen toegang tot deze workspace.</p>
      </AppLayout>
    );
  }
  if (scope === "loading") {
    return (
      <AppLayout title="Workspace Studio" crumbs={crumbs}>
        <p className="text-sm text-muted-foreground">Studio laden…</p>
      </AppLayout>
    );
  }
  return <ProfileEditor key={`workspace:${workspaceSlug}`} variant="workspace" workspaceSlug={workspaceSlug} />;
}
