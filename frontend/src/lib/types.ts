export type OptionType = "call" | "put";

export type PricingInput = {
  spot_price: number;
  strike_price: number;
  time_to_expiry: number;
  volatility: number;
  risk_free_rate: number;
  option_type: OptionType;
};

export type MonteCarloInput = PricingInput & {
  num_simulations: number;
  num_steps: number;
  random_seed: number;
};

export type PriceResponse = {
  option_price: number;
  d1: number;
  d2: number;
};

export type GreeksResponse = {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
};

export type PayoffPoint = {
  underlying_price: number;
  payoff: number;
};

export type SensitivityPoint = {
  label: number;
  option_price: number;
};

export type OptionAnalysisResponse = {
  inputs: PricingInput;
  price: PriceResponse;
  greeks: GreeksResponse;
  payoff: PayoffPoint[];
  volatility_sensitivity: SensitivityPoint[];
  time_sensitivity: SensitivityPoint[];
};

export type MonteCarloSummary = {
  expected_terminal_price: number;
  expected_discounted_payoff: number;
  percentile_5: number;
  percentile_50: number;
  percentile_95: number;
  probability_of_profit: number;
  sample_paths: number[][];
};
