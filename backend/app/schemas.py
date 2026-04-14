from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class OptionType(str, Enum):
    CALL = "call"
    PUT = "put"


class PricingInput(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    spot_price: float = Field(..., gt=0, description="Current underlying asset price")
    strike_price: float = Field(..., gt=0, description="Option strike price")
    time_to_expiry: float = Field(
        ...,
        gt=0,
        description="Time to expiry in years",
    )
    volatility: float = Field(
        ...,
        gt=0,
        description="Annualized volatility as a decimal",
    )
    risk_free_rate: float = Field(
        0.0,
        ge=-1,
        le=1,
        description="Continuously compounded risk-free rate as a decimal",
    )
    option_type: OptionType = Field(..., description="Call or put")

    @field_validator("spot_price", "strike_price", "time_to_expiry", "volatility")
    @classmethod
    def validate_finite(cls, value: float) -> float:
        if value != value or value in (float("inf"), float("-inf")):
            raise ValueError("Input values must be finite numbers.")
        return value


class MonteCarloInput(PricingInput):
    num_simulations: int = Field(
        5000,
        ge=100,
        le=100000,
        description="Number of Monte Carlo paths",
    )
    num_steps: int = Field(
        100,
        ge=1,
        le=365,
        description="Steps per Monte Carlo path",
    )
    random_seed: int | None = Field(
        42,
        description="Optional seed for reproducible simulations",
    )


class PriceResponse(BaseModel):
    option_price: float
    d1: float
    d2: float


class GreeksResponse(BaseModel):
    delta: float
    gamma: float
    theta: float
    vega: float


class SensitivityPoint(BaseModel):
    label: float
    option_price: float


class PayoffPoint(BaseModel):
    underlying_price: float
    payoff: float


class MonteCarloSummary(BaseModel):
    expected_terminal_price: float
    expected_discounted_payoff: float
    percentile_5: float
    percentile_50: float
    percentile_95: float
    probability_of_profit: float
    sample_paths: list[list[float]]


class OptionAnalysisResponse(BaseModel):
    inputs: PricingInput
    price: PriceResponse
    greeks: GreeksResponse
    payoff: list[PayoffPoint]
    volatility_sensitivity: list[SensitivityPoint]
    time_sensitivity: list[SensitivityPoint]
