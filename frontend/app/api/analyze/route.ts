import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { RSI, MACD, ATR } from "technicalindicators";

export const runtime = "nodejs";

// Direct OpenBB calls — rewrites don't apply server-side
function obbBase() {
  return `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6900"}/api/v1`;
}

async function obbGet<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const url = new URL(`${obbBase()}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`OpenBB ${path}: ${res.status}`);
  const data = await res.json();
  return data.results ?? [];
}

interface Bar { date: string; open: number; high: number; low: number; close: number; volume: number }
interface Quote { price: number; day_change_percent: number; volume?: number; market_cap?: number; pe_ratio?: number }
interface Income { date: string; revenue: number | null; net_income: number | null; eps: number | null }
interface Metrics { pe_ratio: number | null; price_to_book: number | null; price_to_sales: number | null; debt_to_equity: number | null; return_on_equity: number | null }
interface NewsItem { date: string; title: string; source?: string }

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function fmt(v: number | null | undefined, decimals = 2): string {
  return v != null ? v.toFixed(decimals) : "N/A";
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY non configurata" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const { ticker } = await req.json();
  if (!ticker) {
    return new Response(JSON.stringify({ error: "ticker mancante" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch everything in parallel — failures are tolerated
  const [quoteRes, histRes, incomeRes, metricsRes, newsRes] = await Promise.allSettled([
    obbGet<Quote>("equity/price/quote", { symbol: ticker, provider: "yfinance" }),
    obbGet<Bar>("equity/price/historical", { symbol: ticker, provider: "yfinance", start_date: daysAgo(90) }),
    obbGet<Income>("equity/fundamental/income", { symbol: ticker, provider: "fmp", period: "annual", limit: "1" }),
    obbGet<Metrics>("equity/fundamental/metrics", { symbol: ticker, provider: "fmp", limit: "1" }),
    obbGet<NewsItem>("equity/news", { symbols: ticker, provider: "tiingo", limit: "5" }),
  ]);

  const quote = quoteRes.status === "fulfilled" ? quoteRes.value[0] : null;
  const bars: Bar[] = histRes.status === "fulfilled" ? histRes.value : [];
  const income = incomeRes.status === "fulfilled" ? incomeRes.value[0] : null;
  const metrics = metricsRes.status === "fulfilled" ? metricsRes.value[0] : null;
  const news: NewsItem[] = newsRes.status === "fulfilled" ? newsRes.value : [];

  // Technical indicators from historical bars
  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);

  const rsiVals = closes.length >= 14
    ? RSI.calculate({ values: closes, period: 14 })
    : [];
  const rsi = rsiVals.at(-1);

  const macdVals = closes.length >= 26
    ? MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false })
    : [];
  const macdHist = macdVals.at(-1)?.histogram;

  const atrVals = bars.length >= 14
    ? ATR.calculate({ high: highs, low: lows, close: closes, period: 14 })
    : [];
  const atr = atrVals.at(-1);

  // 3-month return
  const ret3m = closes.length >= 2
    ? ((closes.at(-1)! - closes[0]) / closes[0]) * 100
    : null;

  // Build prompt
  const technicalSection = `
DATI TECNICI (3 mesi):
- Prezzo attuale: $${fmt(quote?.price)} | Var. 1G: ${fmt(quote?.day_change_percent)}% | Rendimento 3M: ${fmt(ret3m)}%
- Volume: ${quote?.volume ? (quote.volume / 1_000_000).toFixed(1) + "M" : "N/A"}
- RSI(14): ${fmt(rsi, 1)}${rsi != null ? (rsi >= 70 ? " ⚠️ ipercomprato" : rsi <= 30 ? " ⚠️ ipervenduto" : "") : ""}
- MACD histogram: ${fmt(macdHist)}${macdHist != null ? (macdHist > 0 ? " (bullish)" : " (bearish)") : ""}
- ATR(14): $${fmt(atr)} (volatilità giornaliera media)`;

  const fundamentalSection = income || metrics ? `

FONDAMENTALI:
- P/E: ${fmt(metrics?.pe_ratio ?? quote?.pe_ratio)} | P/B: ${fmt(metrics?.price_to_book)} | P/S: ${fmt(metrics?.price_to_sales)}
- ROE: ${metrics?.return_on_equity != null ? (metrics.return_on_equity * 100).toFixed(1) + "%" : "N/A"} | Debt/Equity: ${fmt(metrics?.debt_to_equity)}
- Market Cap: ${quote?.market_cap ? "$" + (quote.market_cap / 1e9).toFixed(1) + "B" : "N/A"}
${income ? `- Revenue (ultimo FY): ${income.revenue ? "$" + (income.revenue / 1e9).toFixed(2) + "B" : "N/A"} | Net Income: ${income.net_income ? "$" + (income.net_income / 1e9).toFixed(2) + "B" : "N/A"} | EPS: $${fmt(income.eps)}` : ""}` : "";

  const newsSection = news.length > 0 ? `

NEWS RECENTI:
${news.slice(0, 5).map((n) => `- [${n.date?.slice(0, 10) ?? ""}] ${n.title}`).join("\n")}` : "";

  const prompt = `Sei un analista finanziario quantitativo senior. Analizza ${ticker} con i dati reali seguenti e fornisci un'analisi completa in italiano (max 350 parole).
${technicalSection}${fundamentalSection}${newsSection}

Struttura la risposta così:
**1. Sentiment tecnico** — trend corrente, forza del movimento, livelli chiave
**2. Valutazione fondamentale** — il titolo è caro/equo/economico? Perché?
**3. Catalyst & rischi** — cosa potrebbe muovere il titolo nei prossimi mesi
**4. Outlook** — conclusione sintetica su orizzonte 1-3 mesi

Usa i dati forniti per argomentare. Sii diretto e concreto, non generico.`;

  const client = new Anthropic({ apiKey });

  const stream = await client.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
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
