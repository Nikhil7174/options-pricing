from __future__ import annotations

import math

import numpy as np
from scipy.stats import norm

from app.schemas import GreeksResponse, MonteCarloInput, OptionType, PayoffPoint, PriceResponse, PricingInput, SensitivityPoint


def _d1_d2(inputs: PricingInput) -> tuple[float, float]:
    numerator = math.log(inputs.spot_price / inputs.strike_price) + (
        inputs.risk_free_rate + 0.5 * inputs.volatility**2
    ) * inputs.time_to_expiry
    denominator = inputs.volatility * math.sqrt(inputs.time_to_expiry)
    d1 = numerator / denominator
    d2 = d1 - inputs.volatility * math.sqrt(inputs.time_to_expiry)
    return d1, d2


def black_scholes_price(inputs: PricingInput) -> PriceResponse:
    d1, d2 = _d1_d2(inputs)
    discount = math.exp(-inputs.risk_free_rate * inputs.time_to_expiry)

    if inputs.option_type == OptionType.CALL:
        option_price = inputs.spot_price * norm.cdf(d1) - inputs.strike_price * discount * norm.cdf(d2)
    else:
        option_price = inputs.strike_price * discount * norm.cdf(-d2) - inputs.spot_price * norm.cdf(-d1)

    return PriceResponse(option_price=option_price, d1=d1, d2=d2)


def compute_greeks(inputs: PricingInput) -> GreeksResponse:
    d1, d2 = _d1_d2(inputs)
    sqrt_t = math.sqrt(inputs.time_to_expiry)
    discount = math.exp(-inputs.risk_free_rate * inputs.time_to_expiry)
    pdf_d1 = norm.pdf(d1)

    if inputs.option_type == OptionType.CALL:
        delta = norm.cdf(d1)
        theta = (
            -(inputs.spot_price * pdf_d1 * inputs.volatility) / (2 * sqrt_t)
            - inputs.risk_free_rate * inputs.strike_price * discount * norm.cdf(d2)
        ) / 365
    else:
        delta = norm.cdf(d1) - 1
        theta = (
            -(inputs.spot_price * pdf_d1 * inputs.volatility) / (2 * sqrt_t)
            + inputs.risk_free_rate * inputs.strike_price * discount * norm.cdf(-d2)
        ) / 365

    gamma = pdf_d1 / (inputs.spot_price * inputs.volatility * sqrt_t)
    vega = (inputs.spot_price * pdf_d1 * sqrt_t) / 100

    return GreeksResponse(delta=delta, gamma=gamma, theta=theta, vega=vega)


def generate_payoff_curve(inputs: PricingInput, points: int = 25) -> list[PayoffPoint]:
    low = inputs.spot_price * 0.5
    high = inputs.spot_price * 1.5
    price_range = np.linspace(low, high, points)

    if inputs.option_type == OptionType.CALL:
        payoff = np.maximum(price_range - inputs.strike_price, 0)
    else:
        payoff = np.maximum(inputs.strike_price - price_range, 0)

    return [
        PayoffPoint(underlying_price=float(price), payoff=float(value))
        for price, value in zip(price_range, payoff)
    ]


def generate_sensitivity_curve(
    inputs: PricingInput,
    parameter: str,
    min_value: float,
    max_value: float,
    points: int = 15,
) -> list[SensitivityPoint]:
    curve = []
    for value in np.linspace(min_value, max_value, points):
        updated_inputs = inputs.model_copy(update={parameter: float(value)})
        price = black_scholes_price(updated_inputs).option_price
        curve.append(SensitivityPoint(label=float(value), option_price=float(price)))
    return curve


def run_monte_carlo(inputs: MonteCarloInput) -> dict[str, float | list[list[float]]]:
    rng = np.random.default_rng(inputs.random_seed)
    dt = inputs.time_to_expiry / inputs.num_steps
    drift = (inputs.risk_free_rate - 0.5 * inputs.volatility**2) * dt
    diffusion = inputs.volatility * np.sqrt(dt)

    shocks = rng.normal(0, 1, size=(inputs.num_simulations, inputs.num_steps))
    log_returns = drift + diffusion * shocks
    cumulative_returns = np.cumsum(log_returns, axis=1)
    paths = inputs.spot_price * np.exp(cumulative_returns)
    paths = np.concatenate(
        [np.full((inputs.num_simulations, 1), inputs.spot_price), paths],
        axis=1,
    )

    terminal_prices = paths[:, -1]

    if inputs.option_type == OptionType.CALL:
        payoff = np.maximum(terminal_prices - inputs.strike_price, 0)
    else:
        payoff = np.maximum(inputs.strike_price - terminal_prices, 0)

    discounted_payoff = np.exp(-inputs.risk_free_rate * inputs.time_to_expiry) * payoff
    probability_of_profit = float(np.mean(payoff > 0))

    sample_count = min(30, inputs.num_simulations)
    sample_paths = paths[:sample_count].tolist()

    return {
        "expected_terminal_price": float(np.mean(terminal_prices)),
        "expected_discounted_payoff": float(np.mean(discounted_payoff)),
        "percentile_5": float(np.percentile(terminal_prices, 5)),
        "percentile_50": float(np.percentile(terminal_prices, 50)),
        "percentile_95": float(np.percentile(terminal_prices, 95)),
        "probability_of_profit": probability_of_profit,
        "sample_paths": sample_paths,
    }
