# Options Pricing & Analysis Tool

A small full-stack quant project with a `Next.js` frontend and `FastAPI` backend for pricing European options, computing Greeks, and running Monte Carlo simulations.

## Features

- Black-Scholes pricing for calls and puts
- Greeks: Delta, Gamma, Theta, Vega
- Payoff curve across a range of underlying prices
- Sensitivity analysis for volatility and time to expiry
- Monte Carlo simulation with sample paths and percentile summaries
- Interactive dashboard with editable contract inputs

## Stack

- Frontend: `Next.js`, `React`, `TypeScript`, `Tailwind CSS`, `shadcn/ui`, `Recharts`
- Backend: `FastAPI`, `NumPy`, `SciPy`, `Pydantic`, `Pandas`
- Validation: `pytest`

## Project Structure

```text
backend/    Python pricing engine, API, and tests
frontend/   Next.js dashboard
notebooks/  Short explanatory notebook for interview walkthroughs
```

## Run the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

The backend runs on `http://localhost:8000`.

## Run the frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
```

The frontend runs on `http://localhost:3000`.

## Tests

Backend tests:

```bash
cd backend
source .venv/bin/activate
pytest
```

Frontend checks:

```bash
cd frontend
npm run lint
npm run build
```

## Notes

- The pricing engine assumes European options.
- Volatility is annualized and entered as a decimal, for example `0.24` for `24%`.
- Time to expiry is measured in years.
- This project is an analysis tool, not a market prediction engine.
