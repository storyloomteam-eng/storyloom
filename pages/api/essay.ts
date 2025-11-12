import type { NextApiRequest, NextApiResponse } from "next";

// Only import OpenAI when we actually need it (avoids errors on GET)
async function getOpenAI() {
  const { default: OpenAI } = await import("openai");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  return new OpenAI({ apiKey });
}

type QA = { q: string; a: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Simple health response for GET in browser
    if (req.method === "GET") {
      return res.status(200).json({ ok: true, route: "essay", hint: "POST with {stage:'start' | 'essay'}" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { stage, answers } = (req.body || {}) as { stage?: "start" | "essay"; answers?: QA[] };

    // Start: ask three warm follow-ups
    if (stage === "start") {
      const openai = await getOpenAI();
      const prompt =
        "Ask three warm, specific follow-up questions that help personalize a creative college essay. " +
        "Sound human and conversational. No em dashes. Keep each question on one line.";
      const r = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      });
      const text = r.choices[0]?.message?.content?.trim() || "Tell me about one moment that changed you.";
      return res.status(200).json({ ok: true, stage: "questions", questions: text.split("\n").filter(Boolean) });
    }

    // Essay: generate a draft from answers
    if (stage === "essay") {
      const openai = await getOpenAI();
      const mat = (answers || []).map(x => `Q: ${x.q}\nA: ${x.a}`).join("\n\n");
      const sys =
        "You are a personal writing coach. Write a 650-word max essay that sounds like a real student. " +
        "Short, varied sentences. Natural rhythm. No em dashes. Avoid cliches and big moral slogans. " +
        "Use concrete details from the answers. End quietly.";
      const r = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Student material:\n\n${mat}\n\nWrite the final essay now.` },
        ],
        temperature: 0.85,
      });
      const essay = r.choices[0]?.message?.content?.trim() || "";
      return res.status(200).json({ ok: true, stage: "done", essay });
    }

    return res.status(400).json({ error: "Missing or invalid 'stage'." });
  } catch (err: any) {
    console.error("essay API error:", err?.message || err);
    return res.status(500).json({ error: "Server error", detail: String(err?.message || err) });
  }
}
