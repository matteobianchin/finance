# OpenBB Dashboard

Dashboard finanziaria personale costruita su Next.js 15 (App Router) con Domain API Python (yfinance, FMP, Tiingo, FRED).

---

## Struttura del progetto

```
OpenBB/
├── frontend/               ← Next.js 15 dashboard (porta 3000)
│   ├── app/                ← Pagine (App Router)
│   │   ├── page.tsx        ← Overview (watchlist + macro)
│   │   ├── equity/[ticker] ← Scheda titolo (grafico, indicatori, AI)
│   │   ├── analisi/        ← Analisi quantitativa (vol, drawdown, correlazione)
│   │   ├── screener/       ← Screener con filtri RSI/return/PE
│   │   ├── earnings/       ← Calendario earnings watchlist
│   │   ├── portfolio/      ← Importa CSV, P&L, storico 1Y
│   │   ├── crypto/         ← Top 10 crypto
│   │   ├── macro/          ← Serie FRED (FED, CPI, PIL, Treasury)
│   │   ├── advanced/       ← Analisi avanzata (Hurst, regime, portfolio optimizer)
│   │   └── api/analyze/    ← Route Handler: AI analysis via Claude
│   ├── components/
│   │   ├── providers/
│   │   │   └── WatchlistProvider.tsx  ← Context globale watchlist
│   │   ├── layout/Sidebar.tsx
│   │   ├── charts/         ← PriceChart, CandlestickChart, ComparisonChart, ...
│   │   ├── equity/         ← SignalsPanel, FundamentalsTable, AIAnalysisPanel, ...
│   │   ├── overview/       ← WatchlistCard, WatchlistManager, MacroWidget
│   │   ├── analisi/        ← QuantStatsCard, ReturnsHistogram, DrawdownChart, RollingChart, ...
│   │   ├── advanced/       ← RegimeChart, LinearChannelChart, EfficientFrontierChart
│   │   ├── portfolio/      ← PortfolioHistoryChart, PortfolioTable, CSVImport
│   │   └── ui/             ← Componenti UI generici (SectionToggle, ...)
│   ├── lib/
│   │   ├── openbb.ts       ← Client unificato per Domain API + cache 60s (unica interfaccia dati)
│   │   ├── screener.ts     ← filterRows, sortRows (pure functions)
│   │   └── portfolio.ts    ← calcPositions, parseCSV
│   ├── types/openbb.ts     ← Tutti i tipi API (unica fonte di verità)
│   ├── hooks/useKeyboardShortcut.ts
│   ├── __tests__/          ← Vitest (21 test: openbb, portfolio, watchlist)
│   └── e2e/                ← Playwright E2E (setup presente, test da implementare)
├── backend/
│   ├── domain_api/         ← Domain API FastAPI (porta 6901) — tutta la logica dati
│   │   ├── main.py         ← Entry point: registra 5 router
│   │   ├── fetcher.py      ← yfinance wrapper async (fetch_history, fetch_quote)
│   │   ├── indicators.py   ← 20+ funzioni TA custom (RSI, MACD, Bollinger, ...)
│   │   ├── quant_advanced.py ← Hurst, Kelly, Markowitz, regime detection, ...
│   │   ├── routers/
│   │   │   ├── data.py     ← quote, history, fundamentals, news, earnings, macro, search
│   │   │   ├── signals.py  ← /signals/{ticker} — tutti gli indicatori tecnici
│   │   │   ├── quant.py    ← /quant/{ticker} — risk metrics (Sharpe, VaR, drawdown, ...)
│   │   │   ├── screener.py ← /screener, /crypto/top
│   │   │   └── advanced.py ← /advanced/{ticker}, /portfolio/optimize
│   │   └── tests/          ← pytest (16 test: quant, screener, signals)
│   └── openbb_platform/    ← OpenBB Platform source (non più usato in runtime)
├── docker-compose.yml
└── CLAUDE.md
```

---

## Architettura

```
Browser → Next.js :3000 → Domain API FastAPI :6901 → yfinance / FMP / Tiingo / FRED
```

Il **Domain API** (`:6901`) è il layer centrale: orchestrazione dati, calcolo indicatori tecnici e metriche quantitative in Python. Chiama i provider direttamente (yfinance per prezzi/storia, FMP per fondamentali, Tiingo per news, FRED per macro). Next.js è un thin UI layer — non calcola nulla lato client tranne il portfolio CSV.

### Domain API — router e endpoint

| Router | Endpoint principali |
|--------|---------------------|
| `data` | `GET /quote/{ticker}`, `/history/{ticker}`, `/fundamentals/{ticker}`, `/news/{ticker}`, `/earnings`, `/macro/{id}`, `/search` |
| `signals` | `GET /signals/{ticker}?timeframe=` — RSI, MACD, CCI, MFI, Stoch, ADX, ATR, Bollinger, Donchian, Keltner, OBV, SMA/EMA/VWAP |
| `quant` | `GET /quant/{ticker}?timeframe=&benchmark=` — vol, Sharpe, Sortino, Calmar, VaR, CVaR, drawdown, rolling metrics, beta vs benchmark |
| `screener` | `GET /screener?symbols=`, `GET /crypto/top` |
| `advanced` | `GET /advanced/{ticker}?timeframe=` — Hurst, O-U half-life, ADF, GK-vol, Kelly, regime, canale regressione lineare, pivot points |
| `advanced` | `GET /portfolio/optimize?symbols=&timeframe=` — Max Sharpe, Min Variance, Risk Parity + frontiera efficiente |

### Frontend — data layer

`lib/openbb.ts` è la **sola** interfaccia verso i dati. Usa `domainFetch()` per tutte le chiamate:

| Contesto | URL usato | Motivo |
|----------|-----------|--------|
| Browser | `window.location.origin + "/api/domain"` | Proxy Next.js → niente CORS, URL interno non esposto |
| Server (Route Handlers) | `DOMAIN_API_URL \|\| http://localhost:6901` | Chiamata diretta al Domain API |

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

`/api/analyze` (Route Handler Node.js) — usa `lib/openbb.ts` (Domain API) come tutti gli altri:
1. Fetcha quote, storico 3M, fondamentali, news dal Domain API via `DOMAIN_API_URL`
2. Calcola RSI/MACD/ATR con `technicalindicators` (npm) lato server
3. Costruisce prompt strutturato → stream su `claude-haiku-4-5`

> Nota: `technicalindicators` rimane come dipendenza solo per questo Route Handler. I segnali nella UI provengono da `/signals/{ticker}` del Domain API.

---

## Variabili d'ambiente

### `frontend/.env.local` (sviluppo locale)

```env
# URL Domain API — usata dal proxy rewrite next.config.mjs e da lib/openbb.ts server-side
DOMAIN_API_URL=http://localhost:6901

# Richiesta per AI analysis
ANTHROPIC_API_KEY=sk-ant-...
```

### Docker (`docker-compose.yml` già configurato)

```
DOMAIN_API_URL=http://domain-api:6901
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}   ← letto dal .env host
# API keys per domain-api:
FMP_API_KEY=${FMP_API_KEY}
TIINGO_API_KEY=${TIINGO_API_KEY}
FRED_API_KEY=${FRED_API_KEY}
```

### Domain API (backend/domain_api/.env)

```env
FMP_API_KEY=...       # fondamentali e key metrics
TIINGO_API_KEY=...    # news
FRED_API_KEY=...      # serie macro
```

File `.env` caricato automaticamente da `python-dotenv` all'avvio.

### API Keys — provider

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
# Terminale 1 — Domain API
cd backend/domain_api
# Crea backend/domain_api/.env con FMP_API_KEY, TIINGO_API_KEY, FRED_API_KEY
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 6901 --reload

# Terminale 2 — Frontend
cd frontend
cp .env.example .env.local   # imposta DOMAIN_API_URL e ANTHROPIC_API_KEY
npm install
npm run dev
```

### Docker

```bash
# Crea .env nella root con FMP_API_KEY, TIINGO_API_KEY, FRED_API_KEY, ANTHROPIC_API_KEY
docker-compose up
```

- Frontend: http://localhost:3000
- Domain API: http://localhost:6901/docs

### VPS (Hetzner CX32 / Ubuntu 24.04)

Deploy su VPS con accesso via Tailscale, OpenBB come systemd service sempre attivo.

**Script di provisioning** (in `scripts/`, da eseguire in ordine):

| Script | Chi lo esegue | Cosa fa |
|--------|--------------|---------|
| `first-login.sh` | root | Crea utente sudo, copia SSH keys da root, blocca password root |
| `setup-vps.sh` | utente sudo | Node 24, Python 3.12, Claude Code CLI, ufw, fail2ban, swap 4GB, tmux |
| `harden-ssh.sh` | utente sudo | Chiude SSH pubblico, abilita solo accesso via tailnet, key-only auth |
| `install-openclaw.sh` | utente sudo | Workspace Claude Code persistente via tmux + systemd user service + linger |
| `deploy-openbb.sh` | utente sudo | Installa Docker CE, costruisce immagini, registra `openbb.service` (autostart al boot) |

**Ordine di esecuzione:**

```bash
# 0. Hetzner console: crea CX32 Ubuntu 24.04, aggiungi la tua chiave SSH pubblica
#    poi connettiti come root:
ssh root@<public-ip>
bash <(curl -fsSL https://raw.githubusercontent.com/matteobianchin/finance/main/scripts/first-login.sh)
# → crea utente, copia chiavi, poi esci da root

# 1. Login come utente appena creato
ssh <username>@<public-ip>
bash <(curl -fsSL https://raw.githubusercontent.com/matteobianchin/finance/main/scripts/setup-vps.sh)

# 2. Installa Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up   # autenticati nel browser

# 3. Hardening SSH (con Tailscale già attivo — non invertire l'ordine)
bash scripts/harden-ssh.sh
# ⚠ Apri una seconda sessione SSH via tailnet PRIMA di riavviare sshd

# 4. Workspace Claude Code sempre vivo
bash scripts/install-openclaw.sh
# → ssh user@<tailscale-ip> poi `claw` per entrare nel workspace

# 5. Clone repo + .env
git clone git@github.com:matteobianchin/finance.git ~/OpenBB
cp ~/OpenBB/.env.example ~/OpenBB/.env
# Imposta FMP_API_KEY, TIINGO_API_KEY, FRED_API_KEY, ANTHROPIC_API_KEY

# 6. Deploy applicazione
cd ~/OpenBB
bash scripts/deploy-openbb.sh
# → Dashboard su http://<tailscale-ip>:3000
```

**Accesso remoto:**
- Dashboard: `http://<tailscale-ip>:3000` (solo dalla tailnet, non esposto su internet)
- SSH + Claude Code: `ssh user@<tailscale-ip>` poi `claw`
- Gestione servizio: `sudo systemctl [status|stop|start|restart] openbb`
- Log live: `journalctl -u openbb -f`

---

## Test

### Frontend (Vitest)

```bash
cd frontend
npm test           # watch mode
npm test -- --run  # singola esecuzione
```

3 suite, 21 test:
- `__tests__/lib/openbb.test.ts` — API wrapper + cache (6 test)
- `__tests__/lib/portfolio.test.ts` — calcolo P&L, parseCSV (5 test)
- `__tests__/components/WatchlistManager.test.tsx` — hook + context + localStorage (10 test)

### Backend Python (pytest)

```bash
cd backend/domain_api
pytest tests/ -v
```

3 suite, 16 test:
- `tests/test_quant.py` — funzioni risk/stats pure (11 test)
- `tests/test_screener.py` — build screener row (2 test)
- `tests/test_signals.py` — compute_signals output (3 test)

---

## Pagine

| URL | Descrizione |
|-----|-------------|
| `/` | Overview: watchlist con sparkline, macro FED/Treasury |
| `/equity/[ticker]` | Grafico line/candele, EMA overlay, SignalsPanel completo, fondamentali, news, comparison, AI analysis |
| `/analisi` | Analisi quantitativa: volatilità, Sharpe, Sortino, VaR, CVaR, drawdown, distribuzione ritorni, rolling charts, correlazione heatmap |
| `/advanced` | Analisi avanzata: Hurst, O-U half-life, ADF, GK-vol, Kelly, regime detection, canale regressione lineare, pivot points + ottimizzazione portafoglio (Max Sharpe, Min Variance, Risk Parity, Frontiera Efficiente) |
| `/screener` | Screener 20 titoli + watchlist, filtri RSI/return/PE, sortable |
| `/earnings` | Calendario earnings watchlist, upcoming + past con beat/miss |
| `/portfolio` | Import CSV, P&L table, pie chart allocazione, storico valore 1Y |
| `/crypto` | Top 10 crypto per prezzo e variazione |
| `/macro` | 5 serie FRED: FED Funds, CPI, PIL, Treasury 2Y/10Y |

---

## Tool disponibili

### MCP Server attivi

Configurati in `~/.claude/.mcp.json`, abilitati in `settings.json`:

| Server | Cosa fa | Costo |
|--------|---------|-------|
| `playwright` | Browser automation via `@playwright/mcp` (npx) | Gratuito |
| `web-search` | Google search senza API key, installato in `~/.claude/mcp-servers/web-search/` | Gratuito |

---

### wshobson/agents (Claude Code plugin marketplace)

[wshobson/agents](https://github.com/wshobson/agents) è una marketplace di plugin per Claude Code con 77 plugin, 182 agenti specializzati, 149 skill e 96 comandi su 24 categorie (dev, infra, security, AI/ML, ops, docs).

**Installato** in `~/.claude/plugins/marketplaces/wshobson-agents` e registrato in `known_marketplaces.json`.

**Installare plugin singoli** (nel terminale Claude Code):
```
/plugin install python-development
/plugin install backend-development
/plugin install debugging-toolkit
/plugin install code-refactoring
/plugin install database-migrations
```

Plugin rilevanti per questo progetto: `python-development`, `backend-development`, `frontend-mobile-development`, `debugging-toolkit`, `code-refactoring`, `database-migrations`, `security-scanning`.

---

### anthropics/skills (skill-creator e altri)

[anthropics/skills](https://github.com/anthropics/skills) è la marketplace ufficiale Anthropic. Installata in `~/.claude/plugins/marketplaces/anthropics-skills`.

Plugin abilitati: `example-skills` (include **skill-creator**, frontend-design, mcp-builder, webapp-testing, web-artifacts-builder, canvas-design, ecc.), `document-skills` (xlsx, docx, pptx, pdf), `claude-api`.

**skill-creator** in particolare permette di creare, testare con eval/benchmark e ottimizzare nuove skill.

---

### opensrc

[opensrc](https://github.com/vercel-labs/opensrc) è un CLI installato globalmente (`npm install -g opensrc`) che scarica e casha il sorgente dei pacchetti da npm, PyPI e crates.io. Utile per dare all'agente AI accesso al codice interno delle dipendenze.

```bash
# Recupera il sorgente di un pacchetto npm
opensrc path <pacchetto>

# Esempi utili per questo progetto
opensrc path technicalindicators
opensrc path recharts
opensrc path next
```

---

## Troubleshooting

**Porta 6901 occupata:**
```bat
netstat -ano | findstr :6901
taskkill /PID <PID> /F
```

**Reset Domain API:**
```bash
cd backend/domain_api
pip install -r requirements.txt
```

**AI analysis non funziona:**
Verifica che `ANTHROPIC_API_KEY` sia impostata in `frontend/.env.local` (dev) o nel `.env` host (Docker).

**Fondamentali / news / macro non tornano dati:**
Verifica che `FMP_API_KEY`, `TIINGO_API_KEY`, `FRED_API_KEY` siano impostati in `backend/domain_api/.env` (dev) o `.env` root (Docker).
