/** Anonymous Q&A storage (db/94). Server-only. No IP or author is ever stored with a question. */
import { sql } from "@/lib/neon";
import { ANSWER_MAX, QUESTION_MAX, normalizeText } from "./questions-rules";

type Row = Record<string, unknown>;
export type Question = { id: string; body: string; answer: string | null; published: boolean; createdAt: string; answeredAt: string | null };

const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
function toQ(r: Row): Question {
  return {
    id: String(r["id"]),
    body: String(r["body"]),
    answer: (r["answer"] as string) ?? null,
    published: r["published"] === true,
    createdAt: iso(r["created_at"]) ?? "",
    answeredAt: iso(r["answered_at"]),
  };
}

async function publicOwnerId(handle: string): Promise<string | null> {
  const rows = (await sql`select id from public.profiles
     where lower(username) = lower(${handle})
       and coalesce((display_prefs ->> 'publicProfile')::boolean, true)
       and coalesce((display_prefs ->> 'questionsEnabled')::boolean, true)
       and coalesce(is_banned, false) = false
       and coalesce(is_suspended, false) = false
       and coalesce(status, 'active') not in ('frozen', 'banned', 'suspended') limit 1`) as Row[];
  return rows[0] ? String(rows[0]["id"]) : null;
}

export async function publishedQuestions(handle: string): Promise<Question[]> {
  const owner = await publicOwnerId(handle);
  if (!owner) return [];
  const rows = (await sql`select id, body, answer, published, created_at, answered_at from public.profile_questions
     where owner_id = ${owner} and published and answer is not null order by answered_at desc limit 30`) as Row[];
  return rows.map(toQ);
}

export async function askQuestion(handle: string, raw: string): Promise<"ok" | "invalid" | "not_found"> {
  const body = normalizeText(raw, QUESTION_MAX);
  if (!body) return "invalid";
  const owner = await publicOwnerId(handle);
  if (!owner) return "not_found";
  await sql`insert into public.profile_questions (owner_id, body) values (${owner}, ${body})`;
  return "ok";
}

export async function myQuestions(ownerId: string): Promise<Question[]> {
  const rows = (await sql`select id, body, answer, published, created_at, answered_at from public.profile_questions
     where owner_id = ${ownerId} order by created_at desc limit 200`) as Row[];
  return rows.map(toQ);
}

export async function answerQuestion(ownerId: string, id: string, raw: string, publish: boolean): Promise<"ok" | "invalid"> {
  const answer = normalizeText(raw, ANSWER_MAX);
  if (!answer) return "invalid";
  await sql`update public.profile_questions set answer = ${answer}, published = ${publish}, answered_at = now()
     where id = ${id} and owner_id = ${ownerId}`;
  return "ok";
}

export async function unpublishQuestion(ownerId: string, id: string): Promise<void> {
  await sql`update public.profile_questions set published = false where id = ${id} and owner_id = ${ownerId}`;
}

export async function deleteQuestion(ownerId: string, id: string): Promise<void> {
  await sql`delete from public.profile_questions where id = ${id} and owner_id = ${ownerId}`;
}

export async function questionsEnabled(ownerId: string): Promise<boolean> {
  const rows = (await sql`select coalesce((display_prefs ->> 'questionsEnabled')::boolean, true) as on from public.profiles where id = ${ownerId}`) as Row[];
  return rows[0]?.["on"] !== false;
}

/** Owner toggle: off hides the block and the server refuses new questions. */
export async function setQuestionsEnabled(ownerId: string, on: boolean): Promise<void> {
  await sql`update public.profiles set display_prefs = coalesce(display_prefs, '{}'::jsonb) || jsonb_build_object('questionsEnabled', ${on}::boolean)
     where id = ${ownerId}`;
}
