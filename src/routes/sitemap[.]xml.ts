import { createFileRoute } from "@tanstack/react-router";
import { docs } from "@/lib/docs-catalog";
import { SITE_ORIGIN } from "@/lib/site";
import { STATIC_SITEMAP_ENTRIES, buildSitemapXml, docSitemapEntry } from "@/lib/sitemap";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const xml = buildSitemapXml(SITE_ORIGIN, [...STATIC_SITEMAP_ENTRIES, ...docs.map(docSitemapEntry)]);
        return new Response(xml, {
          headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
