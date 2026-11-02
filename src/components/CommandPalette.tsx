import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { AtSign, Building2, Code2, Compass, KeyRound, LayoutDashboard, QrCode, Settings, Sparkles } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { parseOmniInput } from "@/lib/omni-parser";

const ITEMS = [
  { group: "Navigatie", label: "Studio", to: "/studio", Icon: Sparkles, keywords: "profiel ontwerp" },
  { group: "Navigatie", label: "Dashboard", to: "/dashboard", Icon: LayoutDashboard, keywords: "cockpit beheer" },
  { group: "Navigatie", label: "Workspaces wisselen", to: "/dashboard", Icon: Building2, keywords: "team workspace" },
  { group: "Navigatie", label: "Profielen verkennen", to: "/explore", Icon: Compass, keywords: "zoeken" },
  { group: "Acties", label: "QR-code genereren", to: "/qr-code-generator", Icon: QrCode, keywords: "qr" },
  { group: "Acties", label: "Tokens & apps beheren", to: "/console/api", Icon: KeyRound, keywords: "api sleutel herroepen token" },
  { group: "Acties", label: "Instellingen", to: "/settings", Icon: Settings, keywords: "account" },
  { group: "Developers", label: "Developer Hub & docs", to: "/developers", Icon: Code2, keywords: "api mcp openapi llms" },
] as const;

/** Global Cmd/Ctrl+K command center, mounted once in the root layout. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const intent = useMemo(() => parseOmniInput(query), [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("rout:command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("rout:command-palette", onOpen);
    };
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    void router.navigate({ href });
  };

  const groups = [...new Set(ITEMS.map((i) => i.group))];
  const routable = intent.kind === "url" || intent.kind === "handle" || intent.kind === "command";

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Zoek, plak een link of typ een @handle…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>Niets gevonden.</CommandEmpty>
        {routable && (
          <CommandGroup heading="Routeren">
            <CommandItem value={`route ${query}`} onSelect={() => go(intent.destination)}>
              {intent.kind === "url" ? <QrCode /> : <AtSign />}
              {intent.kind === "url" ? "QR-code maken voor deze link" : intent.kind === "handle" ? `Profiel @${intent.handle} openen` : `Commando ${intent.command}`}
              <CommandShortcut>↵</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        )}
        {groups.map((g) => (
          <CommandGroup key={g} heading={g}>
            {ITEMS.filter((i) => i.group === g).map(({ label, to, Icon, keywords }) => (
              <CommandItem key={label} value={`${label} ${keywords}`} onSelect={() => go(to)}>
                <Icon /> {label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
