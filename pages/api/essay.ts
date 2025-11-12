import type { NextApiRequest, NextApiResponse } from "next";

// Lazy import OpenAI so GET works without a key in local dev
async function getOpenAI() {
  const { default: OpenAI } = await import("openai");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  return new OpenAI({ apiKey });
}

type QA = { q?: string; a: string };
type Body = {
  stage?: "start" | "essay";
  answers?: Array<string | QA>;
  tone?: string;
  maxWords?: number;
};

function normalizeAnswers(answers: Array<string | QA> = []): string[] {
  return answers.map((x) => (typeof x === "string" ? x : x.a || ""));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Health check in browser
    if (req.method === "GET") {
      return res
        .status(200)
        .json({ ok: true, route: "essay", hint: "POST with { stage: 'start' | 'essay' }" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { stage, answers, tone, maxWords }: Body = req.body || {};
    const MODEL = "gpt-4o-mini";

    // Stage: start. Return three focused follow-up questions
    if (stage === "start") {
      const openai = await getOpenAI();
      const prompt =
        "Ask three warm, specific follow-up questions that help personalize a college essay. " +
        "No em dashes. No multi-part questions. Put each question on its own line. " +
        "Aim at concrete detail like place, time, tiny actions, people, sounds, or objects.";
      const r = await openai.chat.completions.create({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });
      const text = r.choices?.[0]?.message?.content?.trim() || "";
      const questions = text.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 3);
      return res.status(200).json({ ok: true, stage: "questions", questions });
    }

    // Stage: essay. Generate a single cohesive draft
    if (stage === "essay") {
      const openai = await getOpenAI();
      const items = normalizeAnswers(answers);
      if (items.length === 0) {
        return res.status(400).json({ error: "Provide answers for stage 'essay'." });
      }

      const finalTone = tone || "natural, specific, reflective";
      const limit = Math.min(Math.max(Number(maxWords || 650), 300), 650);

      const system =
        [
          "You are a college essay coach.",
          "Write one cohesive essay only.",
          "Use concrete details directly from the student's answers.",
          "Avoid clichés, stock morals, and template phrasing.",
          "No em dashes. First person. Mix short and medium sentences.",
          "End with a quiet, earned beat. No slogans.",
        ].join(" ");

      const userPrompt = `
Answers:
${items.map((a, i) => `${i + 1}. ${a}`).join("\n")}

Task:
1) Extract 10 to 20 specific facts in your head (places, people, actions, sounds, textures, small numbers).
2) Write a ${limit}-word max essay that weaves those facts into a single scene or arc.
3) Tone: ${finalTone}.
4) Do not use these phrases: tapestry, looking back, taught me, in the end, ever since, I learned that.
5) Use first person, natural rhythm, short and medium sentences.
6) No list format, no headings, no bullets.
7) Return only the essay text.
      `.trim();

      const r = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.7,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      });

      const essay = r.choices?.[0]?.message?.content?.trim() || "";
      return res.status(200).json({ ok: true, stage: "done", essay });
    }

    return res.status(400).json({ error: "Missing or invalid 'stage'." });
  } catch (err: any) {
    console.error("essay API error:", err?.message || err);
    return res.status(500).json({ error: "Server error", detail: String(err?.message || err) });
  }
}
