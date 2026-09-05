const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 30;
const buckets = globalThis.__atattaraBuckets || (globalThis.__atattaraBuckets = new Map());

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "topic", "quick_replies", "updates", "should_record_decision", "decision"],
  properties: {
    reply: { type: "string" },
    topic: { type: "string", enum: ["work", "family", "home", "travel", "car", "project", "money", "rest", "other"] },
    quick_replies: { type: "array", maxItems: 4, items: { type: "string" } },
    updates: {
      type: "object",
      additionalProperties: false,
      required: [
        "work_label", "work_days_per_week", "free_weekdays_per_week",
        "home_label", "home_cost_yen", "family_label",
        "travel_label", "travel_budget_yen", "car_label", "car_cost_yen", "project_label"
      ],
      properties: {
        work_label: { type: ["string", "null"] },
        work_days_per_week: { type: ["number", "null"], minimum: 0, maximum: 7 },
        free_weekdays_per_week: { type: ["number", "null"], minimum: 0, maximum: 5 },
        home_label: { type: ["string", "null"] },
        home_cost_yen: { type: ["integer", "null"], minimum: 0 },
        family_label: { type: ["string", "null"] },
        travel_label: { type: ["string", "null"] },
        travel_budget_yen: { type: ["integer", "null"], minimum: 0 },
        car_label: { type: ["string", "null"] },
        car_cost_yen: { type: ["integer", "null"], minimum: 0 },
        project_label: { type: ["string", "null"] }
      }
    },
    should_record_decision: { type: "boolean" },
    decision: {
      type: "object",
      additionalProperties: false,
      required: ["title", "detail"],
      properties: {
        title: { type: ["string", "null"] },
        detail: { type: ["string", "null"] }
      }
    }
  }
};

const instructions = `あなたは「当たったら」という日本語アプリの会話AIです。
目的は、大きなお金が入った仮定を使って、ユーザーが「今の自分の生活の続き」として未来を楽しく想像することです。

最重要:
- 普通のChatGPTのように自然に会話する。決められたシナリオへ誘導しない。
- ユーザーが言ったことをまず受け止め、必要なときだけ1つの自然な質問を返す。
- 毎回「家・仕事・旅行」へ無理に誘導しない。今の話題を深掘りしてよい。
- 勝手に意思決定しない。本人が決めた、またはかなり具体的に希望したときだけMY LIFEを更新する。
- 現在のMY LIFEと直近の会話を前提に返し、既に話した内容を不自然に聞き直さない。
- 金額や日数は断定的なファイナンシャルアドバイスにしない。概算なら「ざっくり」「仮に」と明示する。
- 宝くじ購入を勧めたり、当選確率を誤認させたり、賭け金を増やすよう促したりしない。
- 会話の主役は「お金」だけでなく、時間・家族・仕事・やりたいこと・暮らしの変化。
- 返答は通常2〜5文程度。長文講義にしない。
- ユーザー固有の言葉が現在地にあれば自然に使う。ただし連呼しない。
- quick_replies は会話の続きを自然に選べる短い候補を0〜4個。

MY LIFE更新ルール:
- updatesは、このターンで新しく確定・具体化した項目だけ値を入れる。変更なしはnull。
- 検討や雑談だけなら更新しない。
- work_days_per_week が明確なら入れる。週3なら3。
- free_weekdays_per_week は週5勤務を基準に増えた自由な平日の概算。週3なら2、週4なら1、退職・長期休業なら5。曖昧ならnull。
- 金額が明確な購入・予算なら円単位で入れる。勝手な価格を作らない。
- should_record_decision は「〜にする」「買う」「週3にする」など意思が明確な時だけtrue。
- decisionはshould_record_decision=trueの時だけ短く記録し、それ以外はtitle/detailともnull。

返却は指定JSON Schemaに厳密に従う。`;

function textFromResponse(data) {
  if (typeof data.output_text === "string" && data.output_text) return data.output_text;
  for (const item of data.output || []) {
    if (item.type !== "message") continue;
    for (const part of item.content || []) {
      if (part.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  return null;
}

function trimString(value, max = 1200) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-12).map(x => ({
    role: x?.role === "assistant" ? "assistant" : "user",
    content: trimString(x?.content, 1000)
  })).filter(x => x.content);
}

function cleanState(s) {
  const state = (s && typeof s === "object") ? s : {};
  const p = (state.profile && typeof state.profile === "object") ? state.profile : {};
  return {
    jackpot: Number.isFinite(Number(state.jackpot)) ? Math.max(0, Number(state.jackpot)) : 300000000,
    remaining: Number.isFinite(Number(state.remaining)) ? Math.max(0, Number(state.remaining)) : undefined,
    profile: {
      work: trimString(p.work, 160),
      family: trimString(p.family, 160),
      project: trimString(p.project, 160),
      wish: trimString(p.wish, 200)
    },
    work: state.work ?? null,
    home: state.home ?? null,
    family: state.family ?? null,
    travel: state.travel ?? null,
    car: state.car ?? null,
    project: state.project ?? null,
    costs: state.costs ?? {}
  };
}

function rateLimit(req) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const now = Date.now();
  const prev = buckets.get(ip);
  if (!prev || now - prev.start > WINDOW_MS) {
    buckets.set(ip, { start: now, count: 1 });
    return false;
  }
  prev.count += 1;
  buckets.set(ip, prev);
  return prev.count > LIMIT;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POSTのみ利用できます。" });
  }

  if (rateLimit(req)) {
    return res.status(429).json({ error: "少し会話が続きすぎたようです。数分後にもう一度お試しください。" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "OPENAI_API_KEY がまだ設定されていません。" });
  }

  const message = trimString(req.body?.message, 800).trim();
  if (!message) return res.status(400).json({ error: "メッセージを入力してください。" });

  const history = cleanHistory(req.body?.history);
  const state = cleanState(req.body?.state);
  const context = [
    "現在のMY LIFE:", JSON.stringify(state), "",
    "直近の会話:",
    history.length ? history.map(x => `${x.role === "assistant" ? "AI" : "ユーザー"}: ${x.content}`).join("\n") : "まだなし",
    "", `ユーザーの最新発言: ${message}`
  ].join("\n");

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
        store: false,
        reasoning: { effort: "low" },
        instructions,
        input: context,
        max_output_tokens: 1200,
        text: {
          format: {
            type: "json_schema",
            name: "atattara_turn",
            strict: true,
            schema
          }
        }
      })
    });

    const data = await openaiRes.json();
    if (!openaiRes.ok) {
      console.error("OpenAI API error", data);
      return res.status(502).json({ error: "AIとの接続でエラーが発生しました。少し時間をおいて再度お試しください。" });
    }

    const raw = textFromResponse(data);
    if (!raw) {
      console.error("No output text", data);
      return res.status(502).json({ error: "AIから返答を受け取れませんでした。" });
    }

    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (e) {
      console.error("JSON parse error", raw);
      return res.status(502).json({ error: "AIの返答形式を読み取れませんでした。" });
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "サーバー側でエラーが発生しました。" });
  }
};
