import { LocaleDropdown } from "./LocaleDropdown";
import { Github, Instagram, Linkedin } from "lucide-react";
import { Link, useLocation } from "@/lib/router-compat";
import { RoutLogo } from "./RoutLogo";
import { StatusWidget } from "./StatusWidget";
import { BlueskyIcon, EyouIcon, MastodonIcon } from "./SocialIcons";
import { useI18n } from "@/lib/i18n";
import { SOCIAL_LINKS, GITHUB_ACCOUNT } from "@/lib/social-links";

export const GITHUB_REPO = GITHUB_ACCOUNT;

const linkClass = "text-sm text-muted-foreground hover:text-foreground transition-colors text-left";

const headingClass =
  "text-[11px] font-mono tracking-wider uppercase text-muted-foreground font-semibold";

const SOCIALS = [
  { href: SOCIAL_LINKS.github, label: "GitHub", Icon: Github },
  { href: SOCIAL_LINKS.bluesky, label: "Bluesky", Icon: BlueskyIcon },
  { href: SOCIAL_LINKS.eyou, label: "Eyou", Icon: EyouIcon },
  { href: SOCIAL_LINKS.mastodon, label: "Mastodon", Icon: MastodonIcon },
  { href: SOCIAL_LINKS.linkedin, label: "LinkedIn", Icon: Linkedin },
  { href: SOCIAL_LINKS.instagram, label: "Instagram", Icon: Instagram },
];

const PLATFORM = [
  { to: "/", label: "QR generator" },
  { to: "/studio", label: "Profile Studio" },
  { to: "/batch", label: "Batch engine" },
  { to: "/dashboard", label: "Dynamic routing" },
];

const INFRASTRUCTURE = [
  { to: "/domains", label: "Custom domains" },
  { to: "/console", label: "Developer Console" },
  { to: "/developers", label: "Developer docs" },
  { to: "/self-hosting", label: "Self-hosting guide" },
];

const ECOSYSTEM = [
  { to: "/explore", label: "Explore profiles" },
  { to: "/manifesto", label: "Manifesto" },
  { to: "/press", label: "Press & brand kit" },
  { href: GITHUB_REPO, label: "GitHub repository" },
];

const SUPPORT = [
  { to: "/contact", label: "Contact form" },
  { to: "/sovereignty", label: "Sovereignty" },
  { to: "/privacy", label: "Privacy policy" },
  { to: "/terms", label: "Terms" },
];

const AUTH_ROUTES = new Set(["/auth", "/login"]);

/** Static footer: brand + social matrix on top, three-column grid below. */
export function Footer() {
  const { t } = useI18n();
  const location = useLocation();
  const pathname = location?.pathname ?? "";
  const isAuthRoute = AUTH_ROUTES.has(pathname) || pathname.startsWith("/auth/");
  // The admin portal is a dense working surface: the marketing footer is
  // replaced by a single compact line, and hidden entirely on small screens.
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  if (isAuthRoute || isAdminRoute) {
    return (
      <footer
        className={`mt-auto border-t border-border bg-background ${
          isAdminRoute ? "hidden md:block" : ""
        }`}
      >
        <div className="flex items-center justify-center gap-4 pb-4 pt-6 text-xs text-muted-foreground">
          <span>© ROUT</span>
          <span aria-hidden>•</span>
          <Link to="/privacy" className="hover:text-foreground">
            {t("auth.footer.privacy")}
          </Link>
          <span aria-hidden>•</span>
          <Link to="/terms" className="hover:text-foreground">
            {t("auth.footer.terms")}
          </Link>
          <span aria-hidden>•</span>
          <Link to="/data-deletion" className="hover:text-foreground">
            {t("auth.footer.deletion")}
          </Link>
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-auto border-t border-border bg-background">
      <div className="container mx-auto px-4 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] md:py-12">
        <div className="min-w-0 space-y-3">
          {/* Altijd naar de root van de huidige omgeving — nooit een preview-host. */}
          <Link to="/" aria-label="ROUT home" className="inline-flex">
            <RoutLogo size={24} />
            <LocaleDropdown />
          </Link>
          <p className="max-w-xs text-sm text-muted-foreground">{t("footer.tagline")}</p>
          <div
            data-testid="footer-socials"
            className="flex flex-wrap items-center gap-3 pt-1 sm:gap-4"
          >
            {SOCIALS.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex size-5 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icon className="size-5 shrink-0" aria-hidden />
              </a>
            ))}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-8 sm:gap-12 md:grid-cols-4">
          <nav className="space-y-3">
            <p className={headingClass}>Platform</p>
            <ul className="space-y-1.5">
              {PLATFORM.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="space-y-3">
            <p className={headingClass}>Infrastructure</p>
            <ul className="space-y-1.5">
              {INFRASTRUCTURE.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="space-y-3">
            <p className={headingClass}>Ecosystem</p>
            <ul className="space-y-1.5">
              {ECOSYSTEM.map((l) =>
                "href" in l ? (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={linkClass}
                    >
                      {l.label}
                    </a>
                  </li>
                ) : (
                  <li key={l.to}>
                    <Link to={l.to} className={linkClass}>
                      {l.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </nav>

          <nav data-testid="footer-support-nav" className="space-y-3">
            <p className={headingClass}>Support &amp; Legal</p>
            <ul className="space-y-1.5">
              {SUPPORT.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-center gap-2 border-t border-border/40 pt-5 text-center text-xs text-muted-foreground">
          <p>
            <span>© 2026 ROUT</span>{" "}
            · Open Source (AGPLv3) · Designed &amp; engineered by{" "}
            <a
              href="https://delplanche.cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4"
            >
              delplanche.cloud
            </a>
          </p>
          <StatusWidget className="font-mono text-xs" />

        </div>
      </div>
    </footer>
  );
}
