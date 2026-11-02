import { useRef, useState } from "react";
import { ImagePlus, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { uploadGalleryMedia } from "@/lib/gallery-media.functions";
import {
  GALLERY_ALLOWED_TYPES,
  GALLERY_MAX_BYTES,
  isValidImageUrl,
  newGalleryItemId,
  type GalleryItem,
} from "@/lib/gallery";
import { cn } from "@/lib/utils";

/** Leest een bestand als pure base64 (zonder data-URL prefix). */
function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

/**
 * Twee-tabs dialoog om een foto aan de galerij toe te voegen:
 * eigen upload (10 MB) of een externe afbeeldings-URL.
 */
export function GalleryImageDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: GalleryItem) => void;
}) {
  const [tab, setTab] = useState("upload");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState("");
  const [urlOk, setUrlOk] = useState<boolean | null>(null);
  const [caption, setCaption] = useState("");
  const [alt, setAlt] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  function reset() {
    setUrl("");
    setUrlOk(null);
    setCaption("");
    setAlt("");
    setLinkUrl("");
    setDragging(false);
    setTab("upload");
  }

  function commit(imageUrl: string) {
    onAdd({
      id: newGalleryItemId(),
      url: imageUrl,
      caption: caption.trim() || undefined,
      alt: alt.trim() || undefined,
      linkUrl: linkUrl.trim() || undefined,
    });
    reset();
    onOpenChange(false);
  }

  async function handleFile(file: File | undefined | null) {
    if (!file || busy) return;
    if (!GALLERY_ALLOWED_TYPES.includes(file.type)) {
      toast.error("Gebruik een JPG, PNG, WebP, GIF of SVG.");
      return;
    }
    if (file.size > GALLERY_MAX_BYTES) {
      toast.error("Houd de foto onder 10 MB.");
      return;
    }
    setBusy(true);
    try {
      const base64 = await readBase64(file);
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const res = await uploadGalleryMedia({
        data: { base64, contentType: file.type, ext },
      });
      if (!res.ok || !res.url) {
        toast.error(res.message ?? "Upload mislukt.");
        return;
      }
      commit(res.url);
    } catch {
      toast.error("Upload mislukt. Probeer het opnieuw.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Foto toevoegen</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Bestand uploaden</TabsTrigger>
            <TabsTrigger value="url">Afbeeldings-URL plakken</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="pt-3">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void handleFile(e.dataTransfer.files?.[0]);
              }}
              disabled={busy}
              className={cn(
                "flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border px-4 py-8 text-center transition-colors",
                dragging && "border-foreground bg-muted",
                busy && "opacity-60",
              )}
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <UploadCloud className="h-5 w-5 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">Sleep je foto hierheen</span>
              <span className="text-[11px] text-muted-foreground">
                JPG, PNG, WebP, GIF of SVG — max 10 MB
              </span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept={GALLERY_ALLOWED_TYPES.join(",")}
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
          </TabsContent>

          <TabsContent value="url" className="space-y-2 pt-3">
            <Input
              className="input-field h-9 rounded-xl"
              placeholder="https://…"
              value={url}
              maxLength={2000}
              onChange={(e) => {
                setUrl(e.target.value);
                setUrlOk(null);
              }}
              aria-label="Afbeeldings-URL"
            />
            {url.trim() !== "" && !isValidImageUrl(url) && (
              <p className="text-[11px] font-medium text-destructive" role="alert">
                ⚠️ Geef een volledige http(s)-URL op
              </p>
            )}
            {isValidImageUrl(url) && (
              <div className="overflow-hidden rounded-xl border border-border bg-muted">
                <img
                  src={url.trim()}
                  alt="Voorbeeld"
                  loading="lazy"
                  className="max-h-40 w-full object-contain"
                  onLoad={() => setUrlOk(true)}
                  onError={() => setUrlOk(false)}
                />
              </div>
            )}
            {urlOk === false && (
              <p className="text-[11px] font-medium text-destructive" role="alert">
                ⚠️ Deze URL levert geen geldige afbeelding op
              </p>
            )}
            <button
              type="button"
              disabled={!isValidImageUrl(url) || urlOk !== true}
              onClick={() => commit(url.trim())}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-foreground text-sm font-medium text-background disabled:opacity-50"
            >
              <ImagePlus className="h-4 w-4" /> Toevoegen
            </button>
          </TabsContent>
        </Tabs>

        <div className="space-y-2 border-t border-border pt-3">
          <Input
            className="input-field h-9 rounded-xl"
            placeholder="Caption / titel (optioneel)"
            maxLength={160}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            aria-label="Caption"
          />
          <Input
            className="input-field h-9 rounded-xl"
            placeholder="Alt-tekst voor schermlezers (optioneel)"
            maxLength={160}
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            aria-label="Alt-tekst"
          />
          <Input
            className="input-field h-9 rounded-xl"
            placeholder="Doellink bij klikken (optioneel)"
            maxLength={2000}
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            aria-label="Doellink"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
