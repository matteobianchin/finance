import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY non configurata" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await req.json();
  const { ticker, price, change, rsi, macd, atrVal } = body;

  const client = new Anthropic({ apiKey });

  const prompt = `Sei un analista finanziario quantitativo. Analizza il seguente titolo e fornisci un'analisi concisa in italiano (max 200 parole).

Titolo: ${ticker}
Prezzo attuale: $${price}
Variazione giornaliera: ${change}%
RSI (14): ${rsi ?? "N/A"}
MACD histogram: ${macd ?? "N/A"}
ATR (14): ${atrVal ?? "N/A"}

Fornisci:
1. Sentiment tecnico attuale (1-2 frasi)
2. Livelli chiave da monitorare
3. Rischi principali
4. Conclusione breve

Sii diretto e professionale.`;

  const stream = await client.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(new TextEncoder().encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
