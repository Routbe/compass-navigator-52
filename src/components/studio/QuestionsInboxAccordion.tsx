import { useI18n } from "@/lib/i18n";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { EyeOff, Send, Trash2 } from "lucide-react";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { answerMyQuestion, deleteMyQuestion, getMyQuestions, setMyQuestionsEnabled, unpublishMyQuestion } from "@/lib/questions.functions";
import { ANSWER_MAX } from "@/lib/questions-rules";
import { StudioSectionIcon } from "./StudioSectionIcon";

/** Studio inbox: anonymous questions; answering + t("studio.questions.publish") puts them on the public profile. */
export function QuestionsInboxAccordion({ enabled, onEnabledChange }: { enabled: boolean; onEnabledChange: (enabled: boolean) => void }) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const fetchMine = useServerFn(getMyQuestions);
  const answer = useServerFn(answerMyQuestion);
  const unpublish = useServerFn(unpublishMyQuestion);
  const del = useServerFn(deleteMyQuestion);
  const setEnabled = useServerFn(setMyQuestionsEnabled);
  const q = useQuery({ queryKey: ["my-questions"], queryFn: () => fetchMine(), retry: false });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const items = q.data?.questions ?? [];
  const open = items.filter((i) => !i.published).length;
  const refresh = () => qc.invalidateQueries({ queryKey: ["my-questions"] });

  const publish = async (id: string) => {
    const text = drafts[id] ?? items.find((i) => i.id === id)?.answer ?? "";
    const { result } = await answer({ data: { id, answer: text, publish: true } });
    if (result === "ok") {
      toast.success(t("studio.questions.published"));
      void refresh();
    } else toast.error(t("studio.questions.required"));
  };

  return (
    <details className="border-t border-border pt-4">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2">
        <StudioSectionIcon kind="questions" />
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-medium">{t("studio.questions.title")}</span>
          <span className="block text-xs text-muted-foreground">{t("studio.questions.counts", { total: items.length, open })}</span>
        </span>
      </summary>
      <div className="space-y-3 py-3">
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm">
          <span>
            <span className="block font-medium">{t("studio.questions.onProfile")}</span>
            <span className="block text-xs text-muted-foreground">{t("studio.questions.help")}</span>
          </span>
          <Switch
            checked={enabled}
            onCheckedChange={onEnabledChange}
            aria-label={t("studio.questions.onProfile")}
          />
        </label>
        {items.length === 0 && <p className="text-xs text-muted-foreground">{t("studio.questions.empty")}</p>}
        {items.map((it) => (
          <div key={it.id} className={`space-y-2 rounded-xl border p-3 ${it.published ? "border-primary/50 bg-primary/5" : "border-border"}`}>
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 break-words text-sm font-medium">{it.body}</p>
              <button type="button" aria-label={t("studio.questions.delete")} className="text-muted-foreground hover:text-destructive" onClick={async () => { await del({ data: { id: it.id } }); void refresh(); }}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">{new Date(it.createdAt).toLocaleString(locale)}</p>
            <textarea
              value={drafts[it.id] ?? it.answer ?? ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [it.id]: e.target.value.slice(0, ANSWER_MAX) }))}
              rows={2}
              placeholder={t("studio.questions.placeholder")}
              aria-label={t("studio.questions.answer")}
              className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => publish(it.id)}><Send className="mr-1 h-3.5 w-3.5" />{it.published ? t("studio.questions.update") : t("studio.questions.publish")}</Button>
              {it.published && (
                <Button size="sm" variant="outline" onClick={async () => { await unpublish({ data: { id: it.id } }); void refresh(); }}>
                  <EyeOff className="mr-1 h-3.5 w-3.5" />{t("studio.questions.hide")}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
