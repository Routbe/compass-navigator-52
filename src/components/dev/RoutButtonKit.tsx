import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/CodeBlock";
import { ROUT_BUTTON_LOGO, routButtonSnippet } from "@/lib/oauth/button-kit";

export function RoutButtonKit() {
  const [mode, setMode] = useState<"login" | "connect">("login");
  return <section className="space-y-4" aria-labelledby="rout-button-kit">
    <h2 id="rout-button-kit" className="font-display text-2xl">Officiële ROUT-knoppen</h2>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Knopvariant">
      <Button variant={mode === "login" ? "secondary" : "ghost"} aria-pressed={mode === "login"} onClick={() => setMode("login")}>Login met ROUT</Button>
      <Button variant={mode === "connect" ? "secondary" : "ghost"} aria-pressed={mode === "connect"} onClick={() => setMode("connect")}>Connect ROUT</Button>
    </div>
    <div className="flex items-center gap-3 border-y border-border py-6">
      <Button variant="soft" disabled className="min-h-11 gap-3" aria-label="Voorbeeld van de officiële ROUT-knop">
        <span className="inline-flex" dangerouslySetInnerHTML={{ __html: ROUT_BUTTON_LOGO }} />
        {mode === "login" ? "Doorgaan met ROUT" : "Connect ROUT"}
      </Button>
    </div>
    <p className="text-sm text-muted-foreground">{mode === "login" ? "Login maakt een sessie in jouw app na de bevestigde ROUT-terugkeer." : "Connect koppelt ROUT aan een al ingelogd account in jouw app; het vervangt geen account of sessie."}</p>
    <p className="text-sm text-muted-foreground">De code is de knop, niet de volledige login. Maak eerst de aangegeven handler en een exact geregistreerd terugkeeradres. Start nooit automatisch bij het openen van een pagina. Google en andere aanmeldmethodes hebben hun eigen implementatie nodig.</p>
    <CodeBlock
      code={routButtonSnippet(mode)}
      language="html"
      collapsible
      title="Toon code — HTML-snippet"
      copyLabel="Kopieer code"
      copiedLabel="Gekopieerd!"
    />
  </section>;
}