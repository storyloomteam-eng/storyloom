import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

type QA = { q: string; a: string };
type Req = {
  sessionId?: string;
  stage?: "start" | "followup" | "draft";
  answers?: QA[];
  target?: "common_app";
  tone?: "warm" | "humble" | "confident" | "playful";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  const body = req.body as Req;
  const { stage = "start", answers = [], tone = "warm" } = body;

  const baseRules = [
    "Write like a real student. Short, varied sentences. Occasional fragments.",
    "No em dashes. Use commas or periods instead.",
    "Avoid lists, headings, and obvious structure phrases like firstly or in conclusion.",
    "No cliches. Keep concrete details from the student.",
    "Keep max 650 words for the essay draft."
  ].join(" ");

  if (stage === "start") {
    // First probing question set
    const opening = [
      "Tell me about one moment that changed how you see yourself. What happened, where were you, who was there?",
      "What is one hard thing you kept doing even when no one asked you to?",
      "When did you surprise yourself? Describe the scene and the tiny details, like sounds, smells, and what you touched."
    ];
    return res.json({ ok: true, question: opening[Math.floor(Math.random() * opening.length)] });
  }

  if (stage === "followup") {
    // Ask one sharp follow up based on prior answers
    const qaText = answers.map(x => `Q: ${x.q}\nA: ${x.a}`).join("\n\n");
    const prompt = [
      "You are an admissions essay interviewer.",
      baseRules,
      "Read the student's Q and A. Ask exactly one specific follow up that would unlock vivid detail.",
      "Focus on sensory detail, stakes, and personal change. No multi part questions. No fluff."
    ].join(" ");

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: qaText }
      ],
      temperature: 0.7
    });
    const question = resp.choices?.[0]?.message?.content?.trim() || "What tiny detail would place me in that scene?";
    return res.json({ ok: true, question });
  }

  // stage === "draft": produce the essay
  const qaText = answers.map(x => `Q: ${x.q}\nA: ${x.a}`).join("\n\n");
  const sys = [
    "You are a personal writing coach.",
    baseRules,
    `Tone: ${tone}.`,
    "Write a Common App style essay that sounds like the same person who answered.",
    "Keep paragraphing natural. Vary rhythm. Include one or two crisp images from the answers.",
    "End with a quiet beat, not a slogan."
  ].join(" ");

  const user = `Student material:\n${qaText}\n\nWrite the final essay now.`;

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user }
    ],
    temperature: 0.85
  });

  const draft = out.choices?.[0]?.message?.content || "";
  return res.json({ ok: true, draft });
}
