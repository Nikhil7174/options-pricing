# Options Pricing Backend

FastAPI backend for pricing European call and put options with the Black-Scholes model, computing Greeks, and running Monte Carlo simulations.

## Endpoints

- `GET /health` for a quick health check
- `POST /api/analyze` for price, Greeks, payoff points, and sensitivity curves
- `POST /api/simulate` for Monte Carlo summary statistics and sample paths

## Local setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

## Notes

- Inputs assume annualized volatility and time to expiry in years.
- The pricing model targets European options.
- Monte Carlo outputs are meant for scenario analysis, not market prediction.
