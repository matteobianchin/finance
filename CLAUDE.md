# OpenBB Dashboard

Dashboard finanziaria personale costruita su Next.js 14 (App Router) con backend OpenBB Platform.

---

## Struttura del progetto

```
OpenBB/
├── frontend/               ← Next.js 14 dashboard (porta 3000)
│   ├── app/                ← Pagine (App Router)
│   │   ├── page.tsx        ← Overview (watchlist + macro)
│   │   ├── equity/[ticker] ← Scheda titolo (grafico, indicatori, AI)
│   │   ├── analisi/        ← Analisi quantitativa (vol, drawdown, correlazione)
│   │   ├── screener/       ← Screener con filtri RSI/return/PE
│   │   ├── earnings/       ← Calendario earnings watchlist
│   │   ├── portfolio/      ← Importa CSV, P&L, storico 1Y
│   │   ├── crypto/         ← Top 10 crypto
│   │   ├── macro/          ← Serie FRED (FED, CPI, PIL, Treasury)
│   │   └── api/analyze/    ← Route Handler: AI analysis via Claude
│   ├── components/
│   │   ├── providers/
│   │   │   └── WatchlistProvider.tsx  ← Context globale watchlist
│   │   ├── layout/
│   │   │   └── Sidebar.tsx
│   │   ├── charts/         ← PriceChart, CandlestickChart, ComparisonChart, ...
│   │   ├── equity/         ← SignalsPanel, FundamentalsTable, AIAnalysisPanel, ...
│   │   ├── overview/       ← WatchlistCard, WatchlistManager, MacroWidget
│   │   └── portfolio/      ← PortfolioHistoryChart, PortfolioTable, CSVImport
│   ├── lib/
│   │   ├── openbb.ts       ← Client/server unificato per OpenBB API + cache 60s
│   │   ├── quant.ts        ← Funzioni statistiche pure (vol, Sharpe, drawdown, beta)
│   │   ├── screener.ts     ← filterRows, sortRows (pure functions)
│   │   └── portfolio.ts    ← calcPositions, parseCSV
│   ├── types/
│   │   └── openbb.ts       ← Tutti i tipi API (unica fonte di verità)
│   ├── hooks/
│   │   └── useKeyboardShortcut.ts
│   └── __tests__/          ← Vitest (57 test: quant, openbb, portfolio, watchlist)
├── vecchio/                ← OpenBB Platform source (backend REST API)
├── docker-compose.yml
└── CLAUDE.md
```

---

## Architettura

### Backend
OpenBB Platform in `vecchio/`, espone REST API su `:6900`.
Docs interattive: http://localhost:6900/docs

### Frontend — data layer

`lib/openbb.ts` è la **sola** interfaccia verso il backend. Funziona sia client che server-side:

| Contesto | `getBase()` ritorna | Motivo |
|----------|--------------------|----|
| Browser | `window.location.origin + "/api/openbb"` | Proxy Next.js → niente CORS, URL backend non esposto |
| Server (Route Handlers) | `OPENBB_INTERNAL_URL \|\| NEXT_PUBLIC_API_URL \|\| localhost:6900` | Chiamata diretta, il proxy non si applica server-side |

**Cache in-memory** (module-level, TTL 60s): evita refetch per navigazioni ravvicinate.

### Stato globale

`WatchlistProvider` (Context React) è montato nel root layout. Tutti i componenti usano `useWatchlist()` dallo stesso contesto — nessuno stato isolato per pagina.

```
app/layout.tsx
  └── WatchlistProvider        ← un'unica istanza
        ├── Sidebar
        └── <page>             ← useWatchlist() condivide lo stato
```

### AI Analysis

`/api/analyze` (Route Handler Node.js):
1. Fetcha da OpenBB: quote, storico 3M, fondamentali FMP, key metrics, news Tiingo
2. Calcola RSI/MACD/ATR server-side con `technicalindicators`
3. Costruisce prompt strutturato → stream su claude-haiku

---

## Variabili d'ambiente

### Frontend (`frontend/.env.local` per dev locale)

```env
# Usata da next.config.mjs (rewrite proxy) e da getBase() server-side come fallback
NEXT_PUBLIC_API_URL=http://localhost:6900

# Usata da Route Handlers (server-only, non esposta al browser)
# In Docker: stesso valore di NEXT_PUBLIC_API_URL ma con hostname interno
OPENBB_INTERNAL_URL=http://localhost:6900

# Richiesta per /api/analyze (AI analysis)
ANTHROPIC_API_KEY=sk-ant-...
```

### In Docker (impostato in `docker-compose.yml`)
```yaml
NEXT_PUBLIC_API_URL=http://backend:6900   # per il rewrite (server startup)
OPENBB_INTERNAL_URL=http://backend:6900   # per Route Handlers
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}    # passa dal .env host
```

### API Keys OpenBB (backend)
File: `vecchio/user_settings.json` o via `openbb` CLI.

| Provider  | Uso                              |
|-----------|----------------------------------|
| yfinance  | Prezzi storici, quote (gratuito) |
| FMP       | Fondamentali, key metrics        |
| FRED      | Serie macro (FED, CPI, PIL, ...) |
| Tiingo    | News                             |

---

## Avvio

### Sviluppo locale (senza Docker)

```bash
# Terminale 1 — backend OpenBB
cd vecchio
.venv\Scripts\activate
uvicorn openbb_core.api.rest_api:app --host 127.0.0.1 --port 6900 --reload

# Terminale 2 — frontend
cd frontend
cp .env.example .env.local   # aggiusta i valori
npm install
npm run dev
```

### Docker (tutto in uno)

```bash
docker-compose up
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:6900/docs

---

## Test

```bash
cd frontend
npm test           # watch mode
npm test -- --run  # singola esecuzione
```

4 suite, 57 test:
- `__tests__/lib/quant.test.ts` — funzioni statistiche (28 test)
- `__tests__/lib/openbb.test.ts` — API wrapper + cache (13 test)
- `__tests__/lib/portfolio.test.ts` — calcolo P&L (8 test)
- `__tests__/components/WatchlistManager.test.tsx` — hook + context (8 test)

---

## Pagine

| URL | Descrizione |
|-----|-------------|
| `/` | Overview: watchlist con sparkline, macro FED/Treasury |
| `/equity/[ticker]` | Grafico line/candele, EMA overlay, SignalsPanel, fondamentali, news, comparison, AI analysis |
| `/analisi` | Analisi quantitativa: volatilità, Sharpe, drawdown, beta, correlazione heatmap |
| `/screener` | Screener 20 titoli + watchlist, filtri RSI/return/PE, click-through |
| `/earnings` | Calendario earnings watchlist, upcoming + past con beat/miss |
| `/portfolio` | Import CSV, P&L table, pie chart, storico valore 1Y |
| `/crypto` | Top 10 crypto per prezzo e variazione |
| `/macro` | 5 serie FRED: FED Funds, CPI, PIL, Treasury 2Y/10Y |

---

## Troubleshooting

**Porta 6900 occupata:**
```bat
netstat -ano | findstr :6900
taskkill /PID <PID> /F
```

**Reset backend:**
```bash
cd vecchio
rm -rf .venv
python -m venv .venv
.venv\Scripts\activate
pip install -e "openbb_platform/platform/core[uvicorn]"
pip install -e "openbb_platform/platform/openbb"
pip install openbb-yfinance openbb-fmp openbb-fred openbb-tiingo
```

**AI analysis non funziona:**
Verifica che `ANTHROPIC_API_KEY` sia impostata nel `.env.local` (dev) o in `docker-compose.yml` (Docker).
