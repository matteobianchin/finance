# OpenBB Dashboard

Dashboard finanziaria custom (Next.js) con backend OpenBB Platform (REST API).

## Architettura

```
OpenBB/
├── vecchio/        ← OpenBB Platform source (backend REST API, porta 6900)
├── frontend/       ← Next.js dashboard (in sviluppo)
├── docker-compose.yml
└── CLAUDE.md
```

- **Backend**: OpenBB Platform in `vecchio/`, espone REST API su `:6900`
- **Frontend**: Next.js in `frontend/`, chiama il backend su `:6900`
- **Avvio**: `docker-compose up`

---

## Avvio

### Con Docker
```bash
docker-compose up
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:6900

### Senza Docker (sviluppo)
```bash
# Backend
cd vecchio
.venv\Scripts\activate
uvicorn openbb_core.api.rest_api:app --host 127.0.0.1 --port 6900 --reload

# Frontend (altro terminale)
cd frontend
npm run dev
```

---

## API Keys

File: `.env` (root del progetto) — non committare in git

| Provider       | Uso                          |
|----------------|------------------------------|
| yfinance       | Prezzi storici, fondamentali (gratuito, no key) |
| FMP            | Fondamentali avanzati        |
| Polygon        | Dati intraday                |
| FRED           | Macro (tassi, inflazione, PIL)|
| Alpha Vantage  | Dati alternativi             |
| Tiingo         | News, prezzi EOD             |

Per aggiungere/modificare le chiavi:
```bash
cd vecchio
.venv\Scripts\activate
openbb  # poi: /account login
```

---

## Backend — Endpoint principali

```
GET /api/v1/equity/price/historical?symbol=AAPL&provider=yfinance
GET /api/v1/equity/fundamental/balance?symbol=AAPL&provider=fmp
GET /api/v1/crypto/price/historical?symbol=BTCUSD&provider=yfinance
GET /api/v1/economy/fred_series?symbol=DGS10&provider=fred
GET /api/v1/equity/news?symbols=AAPL&provider=tiingo
```

Docs interattive: http://localhost:6900/docs

---

## Troubleshooting

**Porta 6900 occupata:**
```batch
netstat -ano | findstr :6900
taskkill /PID <PID> /F
```

**Reinstallare backend da zero:**
```bash
cd vecchio
rm -rf .venv
python -m venv .venv
.venv\Scripts\activate
pip install -e "openbb_platform/platform/core[uvicorn]"
pip install -e "openbb_platform/platform/openbb"
pip install openbb-yfinance openbb-fmp openbb-fred openbb-polygon openbb-tiingo openbb-alpha-vantage
```
