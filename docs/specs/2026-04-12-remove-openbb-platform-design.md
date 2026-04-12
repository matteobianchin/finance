# Design: Rimozione OpenBB Platform — Domain API chiama i provider direttamente

**Data:** 2026-04-12  
**Stato:** Approvato  
**Approccio scelto:** B — Chiamate dirette in `data.py`

---

## Obiettivo

Eliminare OpenBB Platform (`:6900`) dall'architettura. Il Domain API (`:6901`) chiamerà
yfinance, FMP, FRED e Tiingo direttamente, senza hop intermedio.

```
PRIMA:  Browser → Next.js :3000 → Domain API :6901 → OpenBB Platform :6900 → provider
DOPO:   Browser → Next.js :3000 → Domain API :6901 → provider
```

---

## File coinvolti

### Eliminati
- `backend/domain_api/client.py`

### Modificati
- `backend/domain_api/routers/data.py` — chiamate dirette ai provider, normalizzazione campi
- `backend/domain_api/requirements.txt` — aggiunti `yfinance>=0.2.40`, `fredapi>=0.5.0`
- `docker-compose.yml` — rimosso servizio `backend` (OpenBB Platform), rimossa dipendenza `domain-api → backend`, aggiunte env FMP/Tiingo/FRED key
- `backend/Dockerfile.api` — rimossi riferimenti a OpenBB Platform
- `CLAUDE.md` — aggiornata sezione "Avvio" (2 terminali invece di 3)

### Non toccati
- `indicators.py`, `quant_advanced.py`
- `routers/signals.py`, `quant.py`, `screener.py`, `advanced.py`
- `frontend/` (tutto)
- `backend/domain_api/tests/` (tutto)

---

## Mapping provider per endpoint

| Endpoint | Libreria | Note |
|----------|----------|------|
| `GET /quote/{ticker}` | `yfinance` | `yf.Ticker(ticker).fast_info` |
| `GET /history/{ticker}` | `yfinance` | `yf.download(ticker, start=..., interval=...)` |
| `GET /fundamentals/{ticker}` | `httpx` → FMP REST | `/v3/income-statement/` + `/v3/key-metrics/` |
| `GET /news/{ticker}` | `httpx` → Tiingo REST | `api.tiingo.com/tiingo/news` |
| `GET /earnings` | `yfinance` | `yf.Ticker(ticker).calendar` |
| `GET /macro/{series_id}` | `fredapi` | `Fred().get_series(series_id)` |
| `GET /search` | `yfinance` | `yf.Search(query).quotes` |

---

## Normalizzazione response shape

Tutti i response shape restano identici — il frontend non cambia nulla.
`data.py` normalizza i campi nativi dei provider verso la struttura attuale.

| Endpoint | Normalizzazione necessaria |
|----------|---------------------------|
| `/quote` | `currentPrice` → `last_price`, `regularMarketChangePercent` → `change_percent` |
| `/history` | column rename lowercase (`Open` → `open`, etc.) |
| `/fundamentals` | camelCase → snake_case (`netIncome` → `net_income`, `peRatio` → `pe_ratio`) |
| `/news` | `publishedDate` → `published_utc` |
| `/earnings` | estrazione da dict calendar, rename campi |
| `/macro` | `pd.Series` (index=date) → `[{"date": ..., "value": ...}]` |
| `/search` | `longname` → `name` |

---

## Variabili d'ambiente

Il Domain API legge le API key direttamente:

```env
FMP_API_KEY=...
TIINGO_API_KEY=...
FRED_API_KEY=...
```

In sviluppo: `backend/domain_api/.env` (o shell).  
In Docker: `docker-compose.yml` nel servizio `domain-api`.

Le key esistono già in `backend/user_settings.json` — vengono semplicemente esposte come env var invece di essere lette da OpenBB Platform.

---

## Docker

```yaml
# Rimosso:
services:
  backend:   # OpenBB Platform — non più necessario
    ...

# domain-api: rimossa dipendenza su backend, aggiunto:
    environment:
      - FMP_API_KEY=${FMP_API_KEY}
      - TIINGO_API_KEY=${TIINGO_API_KEY}
      - FRED_API_KEY=${FRED_API_KEY}
```

---

## Testing

I test esistenti (`test_quant.py`, `test_screener.py`, `test_signals.py`) testano funzioni
pure e restano invariati.

Verifica manuale post-migrazione su `/docs` del Domain API:

- [ ] `GET /quote/AAPL`
- [ ] `GET /history/AAPL?timeframe=1M`
- [ ] `GET /fundamentals/AAPL`
- [ ] `GET /news/AAPL`
- [ ] `GET /earnings?symbols=AAPL,MSFT`
- [ ] `GET /macro/DFF`
- [ ] `GET /search?query=apple`

---

## Avvio post-migrazione

```bash
# Terminale 1 — Domain API
cd backend/domain_api
uvicorn main:app --host 127.0.0.1 --port 6901 --reload

# Terminale 2 — Frontend
cd frontend
npm run dev
```
