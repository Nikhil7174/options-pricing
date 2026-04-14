from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import MonteCarloInput, MonteCarloSummary, OptionAnalysisResponse, PricingInput
from app.services.pricing import (
    black_scholes_price,
    compute_greeks,
    generate_payoff_curve,
    generate_sensitivity_curve,
    run_monte_carlo,
)

app = FastAPI(
    title="Options Pricing Backend",
    description="API for Black-Scholes pricing, Greeks, Monte Carlo simulation, and payoff analysis.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://options-pricing-rosy.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/analyze", response_model=OptionAnalysisResponse)
def analyze_option(inputs: PricingInput) -> OptionAnalysisResponse:
    return OptionAnalysisResponse(
        inputs=inputs,
        price=black_scholes_price(inputs),
        greeks=compute_greeks(inputs),
        payoff=generate_payoff_curve(inputs),
        volatility_sensitivity=generate_sensitivity_curve(
            inputs,
            parameter="volatility",
            min_value=max(inputs.volatility * 0.5, 0.05),
            max_value=min(inputs.volatility * 1.5, 1.2),
        ),
        time_sensitivity=generate_sensitivity_curve(
            inputs,
            parameter="time_to_expiry",
            min_value=max(inputs.time_to_expiry * 0.25, 1 / 365),
            max_value=max(inputs.time_to_expiry * 1.5, inputs.time_to_expiry + 0.25),
        ),
    )


@app.post("/api/simulate", response_model=MonteCarloSummary)
def simulate_option(inputs: MonteCarloInput) -> MonteCarloSummary:
    return MonteCarloSummary(**run_monte_carlo(inputs))
