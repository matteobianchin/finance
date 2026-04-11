import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker");
  const timeframe = searchParams.get("timeframe") ?? "1M";

  if (!ticker) {
    return NextResponse.json({ error: "ticker mancante" }, { status: 400 });
  }

  const base = process.env.DOMAIN_API_URL ?? "http://localhost:6901";
  const res = await fetch(
    `${base}/signals/${encodeURIComponent(ticker)}?timeframe=${timeframe}`
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: `Domain API error: ${res.status}` },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
