import math

from app.schemas import MonteCarloInput, OptionType, PricingInput
from app.services.pricing import (
    black_scholes_price,
    compute_greeks,
    generate_payoff_curve,
    generate_sensitivity_curve,
    run_monte_carlo,
)


def test_black_scholes_call_price_matches_reference_value() -> None:
    inputs = PricingInput(
        spot_price=100,
        strike_price=100,
        time_to_expiry=1,
        volatility=0.2,
        risk_free_rate=0.05,
        option_type=OptionType.CALL,
    )

    result = black_scholes_price(inputs)

    assert math.isclose(result.option_price, 10.4506, rel_tol=1e-3)


def test_put_delta_is_negative() -> None:
    inputs = PricingInput(
        spot_price=100,
        strike_price=95,
        time_to_expiry=0.5,
        volatility=0.25,
        risk_free_rate=0.03,
        option_type=OptionType.PUT,
    )

    greeks = compute_greeks(inputs)

    assert greeks.delta < 0
    assert greeks.gamma > 0
    assert greeks.vega > 0


def test_payoff_curve_contains_intrinsic_value_shape() -> None:
    inputs = PricingInput(
        spot_price=100,
        strike_price=100,
        time_to_expiry=0.5,
        volatility=0.2,
        risk_free_rate=0.01,
        option_type=OptionType.CALL,
    )

    payoff = generate_payoff_curve(inputs, points=5)

    assert payoff[0].payoff == 0
    assert payoff[-1].payoff > 0


def test_sensitivity_curve_has_requested_number_of_points() -> None:
    inputs = PricingInput(
        spot_price=100,
        strike_price=110,
        time_to_expiry=1,
        volatility=0.3,
        risk_free_rate=0.02,
        option_type=OptionType.CALL,
    )

    sensitivity = generate_sensitivity_curve(inputs, "volatility", 0.1, 0.5, points=9)

    assert len(sensitivity) == 9
    assert sensitivity[0].option_price < sensitivity[-1].option_price


def test_monte_carlo_returns_summary_and_paths() -> None:
    inputs = MonteCarloInput(
        spot_price=100,
        strike_price=100,
        time_to_expiry=1,
        volatility=0.2,
        risk_free_rate=0.05,
        option_type=OptionType.CALL,
        num_simulations=1000,
        num_steps=20,
        random_seed=7,
    )

    result = run_monte_carlo(inputs)

    assert result["expected_terminal_price"] > 0
    assert result["percentile_95"] > result["percentile_5"]
    assert len(result["sample_paths"]) <= 30
    assert len(result["sample_paths"][0]) == 21
