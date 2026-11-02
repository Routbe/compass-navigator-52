import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, MessageCircleQuestion } from "lucide-react";
import { askAnonymousQuestion, getPublishedQuestions } from "@/lib/questions.functions";
import { QUESTION_MAX } from "@/lib/questions-rules";

type Theme = { card: string; border: string; text: string; muted: string };

const MESSAGES: Record<string, string> = {
  invalid: "Schrijf een vraag van max 300 tekens.",
  not_found: "Dit profiel neemt geen vragen aan.",
  too_many: "Je hebt het maximum bereikt — probeer het over een uur opnieuw.",
};

/** Anonymous inbox: anyone can ask; answered questions show as Q&A. */
export function ProfileQuestions({ handle, theme }: { handle: string; theme: Theme }) {
  const { t } = useTranslation();
  const ask = useServerFn(askAnonymousQuestion);
  const q = useQuery({ queryKey: ["questions", handle], queryFn: () => getPublishedQuestions({ data: { handle } }), staleTime: 60_000 });
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const items = q.data?.questions ?? [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      const { result } = await ask({ data: { handle, body } });
      if (result === "ok") {
        setBody("");
        toast.success(t("profile.sentAnonymously"), { description: t("profile.answerAppears") });
      } else toast.error(MESSAGES[result] ?? t("profile.sendFailed"));
    } catch {
      toast.error(t("profile.sendFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-4 w-full max-w-sm rounded-2xl p-3 text-left" style={{ background: theme.card, border: `1px solid ${theme.border}`, color: theme.text }} aria-label={t("profile.anonymousQuestions")}>
      <h2 className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider" style={{ color: theme.muted }}>
        <MessageCircleQuestion className="h-3 w-3" aria-hidden />  {t("profile.askMe")} </h2>
      <form onSubmit={submit} className="mt-2 flex flex-col gap-1.5">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, QUESTION_MAX))}
          maxLength={QUESTION_MAX}
          rows={2}
          placeholder={t("profile.anonymousPlaceholder")}
          aria-label={t("profile.anonymousQuestion")}
          className="w-full resize-none rounded-lg bg-transparent px-2.5 py-1.5 text-sm outline-none"
          style={{ border: `1px solid ${theme.border}` }}
        />
        <span className="flex items-center justify-between text-[11px]" style={{ color: theme.muted }}>
           {t("profile.fullyAnonymous")} {body.length}/{QUESTION_MAX}
          <button type="submit" disabled={busy || !body.trim()} className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50" style={{ background: theme.text, color: theme.card }}>
            {busy && <Loader2 className="h-3 w-3 animate-spin" />}  {t("profile.sendQuestion")} </button>
        </span>
      </form>
      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((it) => (
            <li key={it.id} className="rounded-xl p-2.5 text-sm" style={{ border: `1px solid ${theme.border}` }}>
              <p className="break-words font-medium">{it.body}</p>
              <p className="mt-1.5 break-words" style={{ color: theme.muted }}>↳ {it.answer}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
