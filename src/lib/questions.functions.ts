import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/middleware";
import { ANSWER_MAX, QUESTION_MAX, QUESTION_RATE } from "./questions-rules";

const handle = z.string().trim().regex(/^@?[A-Za-z0-9._-]{1,64}$/).transform((h) => h.replace(/^@/, ""));

/** Public: answered + published questions of public profiles only. */
export const getPublishedQuestions = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ handle }).parse(input))
  .handler(async ({ data }) => {
    const s = await import("./questions.server");
    try {
      return { questions: await s.publishedQuestions(data.handle) };
    } catch (e) {
      console.error("[questions] published failed", e instanceof Error ? e.message : e);
      return { questions: [] };
    }
  });

/** Public, no account needed: rate-limited per visitor IP (5/hour). */
export const askAnonymousQuestion = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ handle, body: z.string().max(QUESTION_MAX * 2) }).parse(input))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { clientIp, hitRateLimit } = await import("@/lib/rate-limit-db.server");
    const rl = await hitRateLimit("question-ask", clientIp(getRequest()), QUESTION_RATE);
    if (!rl.ok) return { result: "too_many" as const };
    const s = await import("./questions.server");
    return { result: await s.askQuestion(data.handle, data.body) };
  });

export const getMyQuestions = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const s = await import("./questions.server");
    try {
      const [questions, enabled] = await Promise.all([s.myQuestions(context.userId), s.questionsEnabled(context.userId)]);
      return { ready: true, enabled, questions };
    } catch (e) {
      console.error("[questions] inbox failed", e instanceof Error ? e.message : e);
      return { ready: false, enabled: true, questions: [] };
    }
  });

const idSchema = z.object({ id: z.string().uuid() });

export const answerMyQuestion = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => idSchema.extend({ answer: z.string().max(ANSWER_MAX * 2), publish: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const s = await import("./questions.server");
    return { result: await s.answerQuestion(context.userId, data.id, data.answer, data.publish) };
  });

export const unpublishMyQuestion = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const s = await import("./questions.server");
    await s.unpublishQuestion(context.userId, data.id);
    return { ok: true };
  });

export const deleteMyQuestion = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const s = await import("./questions.server");
    await s.deleteQuestion(context.userId, data.id);
    return { ok: true };
  });

export const setMyQuestionsEnabled = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const s = await import("./questions.server");
    await s.setQuestionsEnabled(context.userId, data.enabled);
    return { ok: true };
  });
