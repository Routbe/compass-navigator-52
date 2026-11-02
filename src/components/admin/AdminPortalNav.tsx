import { createContext, useContext } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Award, BadgeCheck, Gift, Globe, Inbox, KeyRound, LayoutDashboard, Landmark, Plug, Shield, UserSearch, Users, Webhook, Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** True inside the /admin layout so AppLayout renders the portal sidebar. */
export const AdminPortalContext = createContext(false);
export const useInAdminPortal = () => useContext(AdminPortalContext);

const GROUPS = [
  { label: "Overzicht", items: [{ to: "/admin", label: "Mission control", icon: LayoutDashboard }] },
  {
    label: "Leden & identiteit",
    items: [
      { to: "/admin/members", label: "Leden 360°", icon: UserSearch },
      { to: "/admin/verifications", label: "Verificaties & aanvragen", icon: BadgeCheck },
      { to: "/admin/team", label: "Mede-admins & rechten", icon: Users },
    ],
  },
  {
    label: "Heraldiek",
    items: [{ to: "/admin/custom-badges", label: "Wapenschilden & badges", icon: Award }],
  },
  {
    label: "Koppelingen",
    items: [
      { to: "/admin/integrations", label: "Schakelkast", icon: Plug },
      { to: "/admin/oauth-apps", label: "OAuth-apps", icon: KeyRound },
    ],
  },
  {
    label: "Financieel",
    items: [
      { to: "/admin/finance", label: "Financieel & SEPA", icon: Landmark },
      { to: "/admin/sepa", label: "SEPA review", icon: Landmark },
      { to: "/admin/gift-cards", label: "Cadeaubonnen", icon: Gift },
    ],
  },
  {
    label: "Infrastructuur",
    items: [
      { to: "/admin/infra", label: "Infrastructuur & Logs", icon: Webhook },
      { to: "/admin/subdomains", label: "Subdomeinen", icon: Globe },
      { to: "/admin/webhooks", label: "Webhooks", icon: Webhook },
      { to: "/admin/ops", label: "Operations", icon: Wrench },
    ],
  },
  { label: "Communicatie", items: [{ to: "/admin/contact", label: "Contact-inbox", icon: Inbox }] },
] as const;

export function AdminPortalNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav aria-label="Beheerportaal" className="space-y-5 text-sm">
      <div className="flex items-center gap-2 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Shield className="h-3.5 w-3.5" aria-hidden /> ROUT Ops Center
      </div>
      {GROUPS.map((g) => (
        <div key={g.label}>
          <p className="mb-1 px-2 text-[11px] uppercase tracking-wide text-muted-foreground">{g.label}</p>
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active = it.to === "/admin" ? path === "/admin" || path === "/admin/" : path.startsWith(it.to);
              const Icon = it.icon;
              return (
                <li key={it.to}>
                  <Link
                    to={it.to}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
                      active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
