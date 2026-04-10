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
│   │   ├── layout/Sidebar.tsx
│   │   ├── charts/         ← PriceChart, CandlestickChart, ComparisonChart, ...
│   │   ├── equity/         ← SignalsPanel, FundamentalsTable, AIAnalysisPanel, ...
│   │   ├── overview/       ← WatchlistCard, WatchlistManager, MacroWidget
│   │   └── portfolio/      ← PortfolioHistoryChart, PortfolioTable, CSVImport
│   ├── lib/
│   │   ├── openbb.ts       ← Client/server unificato per OpenBB API + cache 60s
│   │   ├── quant.ts        ← Funzioni statistiche pure (vol, Sharpe, drawdown, beta)
│   │   ├── screener.ts     ← filterRows, sortRows (pure functions)
│   │   └── portfolio.ts    ← calcPositions, parseCSV
│   ├── types/openbb.ts     ← Tutti i tipi API (unica fonte di verità)
│   ├── hooks/useKeyboardShortcut.ts
│   └── __tests__/          ← Vitest (57 test: quant, openbb, portfolio, watchlist)
├── backend/                ← OpenBB Platform source (backend REST API, porta 6900)
├── docker-compose.yml
└── CLAUDE.md
```

---

## Architettura

### Backend
OpenBB Platform in `backend/`, espone REST API su `:6900`.
Docs interattive: http://localhost:6900/docs

### Frontend — data layer

`lib/openbb.ts` è la **sola** interfaccia verso il backend. Funziona sia client che server-side:

| Contesto | `getBase()` ritorna | Motivo |
|----------|--------------------|----|
| Browser | `window.location.origin + "/api/openbb"` | Proxy Next.js → niente CORS, URL backend non esposto |
| Server (Route Handlers) | `OPENBB_INTERNAL_URL \|\| NEXT_PUBLIC_API_URL \|\| localhost:6900` | Chiamata diretta, il proxy non si applica server-side |

**Cache in-memory** (TTL 60s, module-level): evita refetch per navigazioni ravvicinate.

### Stato globale

`WatchlistProvider` (Context React) montato nel root layout — unica istanza condivisa da tutte le pagine.

```
app/layout.tsx
  └── WatchlistProvider
        ├── Sidebar
        └── <pagina>   ← useWatchlist() condivide lo stato
```

### AI Analysis

`/api/analyze` (Route Handler Node.js):
1. Fetcha da OpenBB: quote, storico 3M, fondamentali FMP, key metrics, news Tiingo
2. Calcola RSI/MACD/ATR server-side con `technicalindicators`
3. Costruisce prompt strutturato → stream su `claude-haiku-4-5`

---

## Variabili d'ambiente

### `frontend/.env.local` (sviluppo locale)

```env
# URL backend — usata da next.config.mjs per il proxy rewrite
NEXT_PUBLIC_API_URL=http://localhost:6900

# URL backend server-side — usata da Route Handlers (non esposta al browser)
OPENBB_INTERNAL_URL=http://localhost:6900

# Richiesta per AI analysis
ANTHROPIC_API_KEY=sk-ant-...
```

### Docker (`docker-compose.yml` già configurato)

```
NEXT_PUBLIC_API_URL=http://backend:6900
OPENBB_INTERNAL_URL=http://backend:6900
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}   ← letto dal .env host
```

### API Keys OpenBB (backend)

File: `backend/user_settings.json`

| Provider  | Uso                              |
|-----------|----------------------------------|
| yfinance  | Prezzi storici, quote (gratuito) |
| FMP       | Fondamentali, key metrics        |
| FRED      | Serie macro (FED, CPI, PIL, ...) |
| Tiingo    | News                             |

---

## Avvio

### Sviluppo locale

```bash
# Terminale 1 — backend
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e "openbb_platform/platform/core[uvicorn]"
pip install -e "openbb_platform/platform/openbb"
pip install openbb-yfinance openbb-fmp openbb-fred openbb-tiingo
uvicorn openbb_core.api.rest_api:app --host 127.0.0.1 --port 6900 --reload

# Terminale 2 — frontend
cd frontend
cp .env.example .env.local   # imposta le variabili
npm install
npm run dev
```

### Docker

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
| `/equity/[ticker]` | Grafico line/candele, EMA overlay, SignalsPanel completo, fondamentali, news, comparison, AI analysis |
| `/analisi` | Analisi quantitativa: volatilità, Sharpe, drawdown, beta, correlazione heatmap |
| `/screener` | Screener 20 titoli + watchlist, filtri RSI/return/PE, sortable |
| `/earnings` | Calendario earnings watchlist, upcoming + past con beat/miss |
| `/portfolio` | Import CSV, P&L table, pie chart allocazione, storico valore 1Y |
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
cd backend
rm -rf .venv
python -m venv .venv
.venv\Scripts\activate
pip install -e "openbb_platform/platform/core[uvicorn]"
pip install -e "openbb_platform/platform/openbb"
pip install openbb-yfinance openbb-fmp openbb-fred openbb-tiingo
```

**AI analysis non funziona:**
Verifica che `ANTHROPIC_API_KEY` sia impostata in `frontend/.env.local` (dev) o nel `.env` host (Docker).
