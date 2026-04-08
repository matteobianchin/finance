# OpenBB Dashboard — Design Spec

**Data:** 2026-04-08  
**Stato:** Approvato

---

## Obiettivo

Dashboard finanziaria personale (uso singolo, no auth) che usa l'OpenBB Platform come backend REST API e un frontend Next.js custom come interfaccia.

---

## Architettura

```
OpenBB/
├── vecchio/            ← OpenBB Platform (backend, porta 6900) — già esistente
├── frontend/           ← Next.js 14 app (da costruire)
├── docker-compose.yml  ← avvia entrambi i servizi
└── .env                ← API keys (non in git)
```

**Stack:**
- Frontend: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Recharts
- Backend: OpenBB Platform REST API (già installato in `vecchio/`)
- Orchestrazione: Docker Compose
- Nessun database — dati sempre freschi da OpenBB + CSV in memoria per portfolio

---

## Sezioni dell'app

### 1. Overview (homepage)
- Watchlist personalizzabile (ticker salvati in localStorage)
- Prezzi live con variazione % giornaliera
- Mini-grafici sparkline per ogni ticker
- Widget macro: tasso FED, rendimento 10Y, VIX

### 2. Azioni
- Ricerca ticker (autocomplete)
- Grafico storico prezzi (1D / 1W / 1M / 6M / 1Y / 5Y)
- Tab fondamentali: revenue, utile netto, P/E, EPS
- Feed news (ultimi 10 articoli)

### 3. Crypto
- Grafico storico prezzi (stessi timeframe azioni)
- Top 10 crypto per market cap (da CoinGecko via OpenBB)

### 4. Macro
- Serie FRED: tasso FED, inflazione CPI, PIL USA, yield curve (2Y vs 10Y)
- Grafici a linea con date sull'asse X

### 5. Portfolio
- Import CSV con formato: `ticker, quantity, buy_price, buy_date`
- Calcolo P&L per posizione e totale
- Grafico allocazione (pie chart)
- Tabella posizioni con prezzo attuale, costo medio, gain/loss %

---

## Data Flow

```
Frontend (Next.js)
    └── fetch → /api/v1/...
                    └── OpenBB Platform (:6900)
                            └── Provider (yfinance, fmp, fred, ...)
```

- Next.js chiama direttamente `localhost:6900` (in dev) o il container (in Docker)
- Nessun layer intermedio — Next.js è solo UI
- CSV portfolio: parsato client-side con `papaparse`, prezzi attuali da OpenBB

---

## Provider per sezione

| Sezione     | Provider principale | Fallback |
|-------------|--------------------| ---------|
| Prezzi      | yfinance           | tiingo   |
| Fondamentali| fmp                | polygon  |
| News        | tiingo             | fmp      |
| Crypto      | yfinance           | —        |
| Macro       | fred               | —        |

---

## Error Handling

- Timeout API > 10s: mostra stato "dati non disponibili" inline (no crash)
- Provider non risponde: mostra messaggio con provider usato
- CSV malformato: mostra errore per riga con dettaglio campo mancante

---

## Struttura frontend

```
frontend/
├── app/
│   ├── page.tsx              ← Overview
│   ├── equity/[ticker]/      ← Azioni
│   ├── crypto/               ← Crypto
│   ├── macro/                ← Macro
│   └── portfolio/            ← Portfolio
├── components/
│   ├── charts/               ← PriceChart, SparklineChart, PieChart
│   ├── tables/               ← FundamentalsTable, PortfolioTable
│   └── ui/                   ← shadcn components
├── lib/
│   ├── openbb.ts             ← fetch wrapper per OpenBB API
│   └── portfolio.ts          ← parsing CSV + calcolo P&L
└── docker-compose.yml        ← (root del progetto)
```

---

## Docker Compose

```yaml
services:
  backend:
    build: ./vecchio
    ports: ["6900:6900"]
    env_file: .env

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:6900
    depends_on: [backend]
```

---

## Indicatori tecnici (v1 — inclusi)

OpenBB ha `openbb.technical` nativo — zero lavoro extra. Inclusi nel pannello azioni:
- RSI, MACD, Bollinger Bands, SMA/EMA
- Pannello "Segnali": lettura automatica (overbought/oversold, trend direction)

---

## Estensibilità futura

L'architettura e' progettata per aggiungere in seguito senza riscritture:

### Worker service (placeholder in v1)
```
worker/
├── main.py       ← APScheduler entry point (pronto, non attivo)
├── checks/       ← ogni condizione/alert è un file separato
└── notify/       ← canali notifica intercambiabili (Telegram, email, ecc.)
```
Aggiunto al Docker Compose ma non attivo in v1.

### AI Analysis (placeholder UI in v1)
- Sezione "Analisi AI" nel pannello azioni — pulsante visibile ma disabilitato
- `ANTHROPIC_API_KEY` gia' in `.env` (placeholder)
- Quando abilitato: invia prezzi + indicatori + news + fondamentali a Claude, riceve summary + segnale

### Regola di design
Tutta la logica dati passa per `lib/openbb.ts` — riusabile da frontend e worker senza duplicazioni.

---

## Out of scope (v1)

- Autenticazione
- Database persistente
- Alert attivi e notifiche
- AI analysis attiva
- Backtest
- Mobile app
