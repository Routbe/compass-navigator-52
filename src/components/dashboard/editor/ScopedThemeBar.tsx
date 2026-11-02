import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { ProfileDisplayPrefs } from "@/lib/profile-display";
import {
  applyScopedPatch,
  glassSurfaceStyle,
  hasUniqueStyle,
  resetScope,
  resolveScopedTokens,
  type GlassBorder,
  type GlassStyle,
  type GlassTargets,
  type ScopeOverride,
  type ThemeScope,
  BUTTON_SHAPE_PRESETS,
  OVERRIDE_BUTTON_VARIANTS,
  OVERRIDE_BUTTON_RADII,
} from "@/lib/theme-engine";
import { BUTTON_RADII, BUTTON_VARIANTS } from "@/lib/profile-design";
import {
  resolveComponentDesign,
} from "@/lib/theme-engine";

type SetPref = <K extends keyof ProfileDisplayPrefs>(key: K, value: ProfileDisplayPrefs[K]) => void;

const SCOPES: { id: ThemeScope; label: string }[] = [
  { id: "all", label: "🌐 Alle elementen" },
  { id: "links", label: "🔗 Links" },
  { id: "booking", label: "📅 Boekingen" },
  { id: "board", label: "💬 Prikbord" },
  { id: "presence", label: "🎵 Live-status" },
  { id: "socials", label: "📱 Socials" },
];

const STYLES: { id: GlassStyle; label: string; hint: string }[] = [
  { id: "solid", label: "Solide", hint: "Volle kleur" },
  { id: "frosted-light", label: "Frosted licht", hint: "Helder glas" },
  { id: "frosted-dark", label: "Frosted donker", hint: "Rookglas" },
  { id: "obsidian", label: "Liquid Obsidian", hint: "Diep donker" },
  { id: "prism", label: "Prism Edge", hint: "Iriserende rand" },
];

const BORDERS: { id: GlassBorder; label: string }[] = [
  { id: "subtle", label: "Subtiel" },
  { id: "bright", label: "Helder" },
  { id: "off", label: "Uit" },
];

const TARGETS: { id: keyof GlassTargets; label: string }[] = [
  { id: "links", label: "Links & knoppen" },
  { id: "presence", label: "Live-status widget" },
  { id: "board", label: "Prikbord & vragenkaart" },
  { id: "booking", label: "Boekingswidget" },
];

/** Scoped theme bar + glass controls under "Knoppen & Typografie". */
export function ScopedThemeBar({ prefs, setPref }: { prefs: ProfileDisplayPrefs; setPref: SetPref }) {
  const [scope, setScope] = useState<ThemeScope>("all");
  const tokens = resolveScopedTokens(prefs, prefs.themeOverrides, scope);
  const unique = hasUniqueStyle(prefs, prefs.themeOverrides, scope);

  const design = resolveComponentDesign(prefs, prefs.themeOverrides, scope);
  const patch = (p: ScopeOverride) => {
    const next = applyScopedPatch(prefs, prefs.themeOverrides, scope, p);
    if (scope === "all") {
      (Object.keys(p) as (keyof ScopeOverride)[]).forEach((k) => setPref(k, (next.global as Record<string, unknown>)[k] as never));
      if (Object.keys(p).some((k) => k.startsWith("button") || k === "fontPairing")) setPref("buttonsCustom", true);
    } else {
      setPref("themeOverrides", next.overrides);
    }
  };

  const sampleScope = scope === "all" ? "links" : scope;
  const sample = glassSurfaceStyle(tokens, sampleScope, { links: true, presence: true, board: true, booking: true });

  return (
    <section className="space-y-4 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="input-label">Stijl toepassen op</p>
        {unique && scope !== "all" ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-primary">● Unieke stijl</span>
            <Button type="button" size="sm" variant="outline" onClick={() => setPref("themeOverrides", resetScope(prefs.themeOverrides, scope))}>
              Herstel naar standaard
            </Button>
          </div>
        ) : scope !== "all" ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Volgt standaard</span>
        ) : null}
      </div>
      <div role="tablist" aria-label="Doelonderdeel" className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={scope === s.id}
            onClick={() => setScope(s.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              scope === s.id ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <ButtonControls design={design} patch={patch} />

      <p className="input-label">Glaseffect</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={tokens.glassStyle === s.id}
            onClick={() => patch({ glassStyle: s.id })}
            className={cn(
              "rounded-xl border p-2.5 text-left text-xs",
              tokens.glassStyle === s.id ? "border-primary ring-1 ring-primary" : "border-border",
            )}
          >
            <span className="block font-medium">{s.label}</span>
            <span className="block text-muted-foreground">{s.hint}</span>
          </button>
        ))}
      </div>

      {tokens.glassStyle !== "solid" && (
        <>
          <div className="rounded-xl bg-[linear-gradient(135deg,var(--primary),var(--accent))] p-4">
            <div className="rounded-xl px-4 py-3 text-center text-sm font-medium text-primary-foreground" style={sample ?? undefined}>
              Voorbeeld
            </div>
          </div>
          <div className="space-y-2">
            <p className="input-label">Glastransparantie ({tokens.glassOpacity}%)</p>
            <Slider min={5} max={50} step={1} value={[tokens.glassOpacity]} onValueChange={([v]) => patch({ glassOpacity: v ?? tokens.glassOpacity })} />
          </div>
          <div className="space-y-2">
            <p className="input-label">Vervaging ({tokens.glassBlur}px)</p>
            <Slider min={4} max={32} step={1} value={[tokens.glassBlur]} onValueChange={([v]) => patch({ glassBlur: v ?? tokens.glassBlur })} />
          </div>
          <div className="space-y-2">
            <p className="input-label">Randafwerking</p>
            <div className="flex gap-1.5">
              {BORDERS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={tokens.glassBorder === b.id}
                  onClick={() => patch({ glassBorder: b.id })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    tokens.glassBorder === b.id ? "border-primary ring-1 ring-primary" : "border-border",
                  )}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {scope === "all" && (
        <div className="space-y-2">
          <p className="input-label">Glaseffect toepassen op</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {TARGETS.map((tg) => (
              <label key={tg.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={prefs.glassTargets[tg.id]}
                  onCheckedChange={(v) => setPref("glassTargets", { ...prefs.glassTargets, [tg.id]: v === true })}
                />
                {tg.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

const FONTS: { id: "modern" | "serif" | "mono"; label: string }[] = [
  { id: "modern", label: "Modern Sans" },
  { id: "serif", label: "Klassiek Serif" },
  { id: "mono", label: "Technisch Mono" },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn("rounded-full border px-3 py-1 text-xs", active ? "border-primary ring-1 ring-primary" : "border-border")}
    >
      {children}
    </button>
  );
}

/** Shape, style, typography, radius and colours for the selected scope. */
function ButtonControls({
  design,
  patch,
}: {
  design: { buttonVariant: string; buttonRadius: string; fontPairing: string; buttonColor: string | null; buttonTextColor: string | null };
  patch: (p: ScopeOverride) => void;
}) {
  const variants = BUTTON_VARIANTS.filter((v) => (OVERRIDE_BUTTON_VARIANTS as readonly string[]).includes(v.id));
  const radii = BUTTON_RADII.filter((r) => (OVERRIDE_BUTTON_RADII as readonly string[]).includes(r.id));
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="input-label">Knopvorm</p>
        <div className="flex flex-wrap gap-1.5">
          {BUTTON_SHAPE_PRESETS.map((sp) => (
            <Chip
              key={sp.id}
              active={design.buttonVariant === sp.buttonVariant && design.buttonRadius === sp.buttonRadius}
              onClick={() => patch({ buttonVariant: sp.buttonVariant, buttonRadius: sp.buttonRadius })}
            >
              {sp.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="input-label">Knopstijl</p>
        <div className="flex flex-wrap gap-1.5">
          {variants.map((v) => (
            <Chip key={v.id} active={design.buttonVariant === v.id} onClick={() => patch({ buttonVariant: v.id as ScopeOverride["buttonVariant"] })}>
              {v.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="input-label">Typografie</p>
        <div className="flex flex-wrap gap-1.5">
          {FONTS.map((f) => (
            <Chip key={f.id} active={design.fontPairing === f.id} onClick={() => patch({ fontPairing: f.id })}>
              {f.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="input-label">Hoekafronding</p>
        <div className="flex flex-wrap gap-1.5">
          {radii.map((r) => (
            <Chip key={r.id} active={design.buttonRadius === r.id} onClick={() => patch({ buttonRadius: r.id as ScopeOverride["buttonRadius"] })}>
              {r.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-xs">
          <span className="input-label block">Knopkleur</span>
          <input type="color" className="h-9 w-full rounded-md border border-border bg-background" value={design.buttonColor ?? "#000000"} onChange={(e) => patch({ buttonColor: e.target.value })} />
        </label>
        <label className="space-y-1 text-xs">
          <span className="input-label block">Knoptekstkleur</span>
          <input type="color" className="h-9 w-full rounded-md border border-border bg-background" value={design.buttonTextColor ?? "#ffffff"} onChange={(e) => patch({ buttonTextColor: e.target.value })} />
        </label>
      </div>
    </div>
  );
}
