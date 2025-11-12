import { useState } from "react";

type QA = { q: string; a: string };

export default function Home() {
  const [stage, setStage] = useState<"idle" | "asking" | "answering" | "drafting" | "done" | "error">("idle");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function getQuestions() {
    try {
      setLoading(true);
      setErr("");
      setDraft("");
      const res = await fetch("/api/essay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "start" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || data?.error || "Failed to get questions");
      setQuestions(data.questions || []);
      setAnswers(["", "", ""]);
      setStage("answering");
    } catch (e: any) {
      setErr(e.message || "Error");
      setStage("error");
    } finally {
      setLoading(false);
    }
  }

  async function getEssay() {
    try {
      setLoading(true);
      setErr("");
      setDraft("");
      const payload = {
        stage: "essay",
        answers: answers.map((a, i) => ({ q: questions[i] || `Q${i + 1}`, a })),
        tone: "natural, specific, reflective",
        maxWords: 650,
      };
      const res = await fetch("/api/essay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || data?.error || "Failed to generate essay");
      setDraft(data.essay || "");
      setStage("done");
    } catch (e: any) {
      setErr(e.message || "Error");
      setStage("error");
    } finally {
      setLoading(false);
    }
  }

  function resetAll() {
    setStage("idle");
    setQuestions([]);
    setAnswers(["", "", ""]);
    setDraft("");
    setErr("");
  }

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: 24, lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Storyloom</h1>
      <p style={{ marginBottom: 16 }}>
        Answer a few focused questions. Get a human sounding Common App style draft.
      </p>

      {err ? (
        <div style={{ background: "#fee2e2", border: "1px solid #ef4444", padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <b>Error:</b> {err}
        </div>
      ) : null}

      {stage === "idle" || stage === "asking" ? (
        <section style={{ marginTop: 12 }}>
          <button
            onClick={getQuestions}
            disabled={loading}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #111",
              background: loading ? "#f3f4f6" : "#111",
              color: loading ? "#111" : "#fff",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Getting questions..." : "Start"}
          </button>
        </section>
      ) : null}

      {stage === "answering" && (
        <section style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Your questions</h2>
          {questions.map((q, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{q}</div>
              <textarea
                value={answers[i] || ""}
                onChange={(e) => {
                  const copy = [...answers];
                  copy[i] = e.target.value;
                  setAnswers(copy);
                }}
                rows={4}
                placeholder="Type your answer here. Be concrete. Add small details like sounds, colors, names."
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
              />
            </div>
          ))}
          <button
            onClick={getEssay}
            disabled={loading || answers.filter(Boolean).length === 0}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #111",
              background: loading ? "#f3f4f6" : "#111",
              color: loading ? "#111" : "#fff",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Drafting..." : "Generate essay"}
          </button>
          <button
            onClick={resetAll}
            style={{
              marginLeft: 8,
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        </section>
      )}

      {stage === "done" && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Your draft</h2>
          <textarea
            rows={18}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #d1d5db" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={() => navigator.clipboard.writeText(draft)}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #111",
                background: "#111",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Copy
            </button>
            <button
              onClick={resetAll}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              New session
            </button>
          </div>
        </section>
      )}

      <footer style={{ marginTop: 36, fontSize: 13, color: "#6b7280" }}>
        <div>Health: <a href="/api/essay">/api/essay</a></div>
      </footer>
    </main>
  );
}
