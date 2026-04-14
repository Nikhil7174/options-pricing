"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ChartSpline,
  LoaderCircle,
  Sigma,
  TrendingUp,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { ApiRequestError, analyzeOption, simulateOption } from "@/lib/api";
import type {
  MonteCarloInput,
  MonteCarloSummary,
  OptionAnalysisResponse,
  OptionType,
  PricingInput,
} from "@/lib/types";

const defaultInputs: PricingInput = {
  spot_price: 100,
  strike_price: 105,
  time_to_expiry: 0.5,
  volatility: 0.24,
  risk_free_rate: 0.05,
  option_type: "call",
};

const simulationDefaults = {
  num_simulations: 5000,
  num_steps: 45,
  random_seed: 42,
};

type InputField = keyof PricingInput;
type FieldErrors = Partial<Record<InputField, string>>;

const inputLabels: Record<InputField, string> = {
  spot_price: "Spot Price",
  strike_price: "Strike Price",
  time_to_expiry: "Time to Expiry",
  volatility: "Volatility",
  risk_free_rate: "Risk-Free Rate",
  option_type: "Option Type",
};

const numericFieldConfig: Array<{
  field: Exclude<InputField, "option_type">;
  label: string;
  step: number;
}> = [
  { field: "spot_price", label: "Spot Price", step: 0.01 },
  { field: "strike_price", label: "Strike Price", step: 0.01 },
  { field: "time_to_expiry", label: "Time to Expiry", step: 0.01 },
  { field: "volatility", label: "Volatility", step: 0.01 },
  { field: "risk_free_rate", label: "Risk-Free Rate", step: 0.01 },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDecimal(value: number, digits = 4): string {
  return value.toFixed(digits);
}

function getFieldLabel(field: string): string {
  return (
    inputLabels[field as InputField] ??
    field
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function normalizeFieldMessage(field: string, message: string): string {
  return message.startsWith(`${getFieldLabel(field)}:`)
    ? message.slice(getFieldLabel(field).length + 1).trim()
    : message;
}

function validateField(
  field: Exclude<InputField, "option_type">,
  value: number,
): string | null {
  if (!Number.isFinite(value)) {
    return "Enter a valid number.";
  }

  if (field === "risk_free_rate") {
    return value < -1 || value > 1 ? "Must be between -1 and 1." : null;
  }

  return value <= 0 ? "Must be greater than 0." : null;
}

function validateInputs(currentInputs: PricingInput): FieldErrors {
  const nextFieldErrors: FieldErrors = {};

  numericFieldConfig.forEach(({ field }) => {
    const message = validateField(field, currentInputs[field]);
    if (message) {
      nextFieldErrors[field] = message;
    }
  });

  return nextFieldErrors;
}

function mapApiFieldErrors(messages: Array<{ field: string; message: string }>): FieldErrors {
  const nextFieldErrors: FieldErrors = {};

  messages.forEach(({ field, message }) => {
    if (field in inputLabels && !nextFieldErrors[field as InputField]) {
      nextFieldErrors[field as InputField] = normalizeFieldMessage(field, message);
    }
  });

  return nextFieldErrors;
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof TrendingUp;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.25)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-300">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
        </div>
        <span className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-200">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-400">{hint}</p>
    </article>
  );
}

function ChartPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-[0_24px_80px_rgba(8,15,34,0.45)]">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-sm text-slate-400">{subtitle}</p>
      </div>
      <div className="h-72 min-w-0">{children}</div>
    </section>
  );
}

export function OptionsDashboard() {
  const [inputs, setInputs] = useState<PricingInput>(defaultInputs);
  const [analysis, setAnalysis] = useState<OptionAnalysisResponse | null>(null);
  const [simulation, setSimulation] = useState<MonteCarloSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isMounted, setIsMounted] = useState(false);

  const monteCarloPayload = useMemo<MonteCarloInput>(
    () => ({
      ...inputs,
      ...simulationDefaults,
    }),
    [inputs],
  );

  async function loadDashboard(currentInputs: PricingInput) {
    const clientFieldErrors = validateInputs(currentInputs);
    if (Object.keys(clientFieldErrors).length > 0) {
      setFieldErrors(clientFieldErrors);
      setError("Please correct the highlighted inputs and try again.");
      return;
    }

    setLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      const [analysisResponse, simulationResponse] = await Promise.all([
        analyzeOption(currentInputs),
        simulateOption({
          ...currentInputs,
          ...simulationDefaults,
        }),
      ]);

      setAnalysis(analysisResponse);
      setSimulation(simulationResponse);
    } catch (requestError) {
      const message = requestError instanceof Error
        ? requestError.message
        : "Unable to load pricing analysis.";

      if (requestError instanceof ApiRequestError) {
        const serverFieldErrors = mapApiFieldErrors(requestError.fieldErrors);
        if (Object.keys(serverFieldErrors).length > 0) {
          setFieldErrors(serverFieldErrors);
          setError("Please correct the highlighted inputs and try again.");
        } else {
          setError(message);
        }
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setIsMounted(true);
    void loadDashboard(defaultInputs);
  }, []);

  function updateNumberField(field: keyof PricingInput, value: string) {
    const parsedValue = Number(value);
    setInputs((current) => ({
      ...current,
      [field]: parsedValue,
    }));
    setFieldErrors((current) => {
      if (field === "option_type") {
        return current;
      }

      const nextFieldErrors = { ...current };
      const message = validateField(field, parsedValue);

      if (message) {
        nextFieldErrors[field] = message;
      } else {
        delete nextFieldErrors[field];
      }

      return nextFieldErrors;
    });
    setError(null);
  }

  function updateOptionType(value: string) {
    setInputs((current) => ({
      ...current,
      option_type: value as OptionType,
    }));
    setFieldErrors((current) => {
      const nextFieldErrors = { ...current };
      delete nextFieldErrors.option_type;
      return nextFieldErrors;
    });
    setError(null);
  }

  const pathSeries =
    simulation?.sample_paths.slice(0, 6).map((path, index) => ({
      name: `Path ${index + 1}`,
      data: path.map((value, step) => ({ step, value })),
    })) ?? [];

  const monteCarloChartData =
    pathSeries[0]?.data.map((point, index) => {
      const row: Record<string, number> = { step: point.step };
      pathSeries.forEach((series) => {
        row[series.name] = series.data[index]?.value ?? series.data.at(-1)?.value ?? 0;
      });
      return row;
    }) ?? [];

  const sensitivityData =
    analysis?.volatility_sensitivity.map((point, index) => ({
      volatility: point.label,
      volatilityPrice: point.option_price,
      time: analysis.time_sensitivity[index]?.label ?? point.label,
      timePrice: analysis.time_sensitivity[index]?.option_price ?? point.option_price,
    })) ?? [];

  const chartFallback = (
    <div className="flex h-full items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-sm text-slate-400">
      Chart will render in the browser.
    </div>
  );

  const hasFieldErrors = Object.keys(fieldErrors).length > 0;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.22),_transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_45%,#111827_100%)] px-6 py-10 text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/8 p-7 shadow-[0_32px_120px_rgba(8,15,34,0.55)] backdrop-blur-xl">
            <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium tracking-[0.24em] text-cyan-200 uppercase">
              Quant Dashboard
            </span>
            <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Options pricing, Greeks, payoff, and Monte Carlo analysis in one view.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Adjust contract assumptions, rerun the valuation model, and compare
              sensitivity curves without leaving the screen.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <MetricCard
                label="Option Price"
                value={analysis ? formatCurrency(analysis.price.option_price) : "--"}
                hint="Black-Scholes theoretical value for the selected contract."
                icon={TrendingUp}
              />
              <MetricCard
                label="Expected Payoff"
                value={
                  simulation
                    ? formatCurrency(simulation.expected_discounted_payoff)
                    : "--"
                }
                hint="Discounted Monte Carlo payoff from simulated terminal prices."
                icon={Activity}
              />
              <MetricCard
                label="Delta"
                value={analysis ? formatDecimal(analysis.greeks.delta) : "--"}
                hint="Sensitivity of option value to a $1 move in the underlying."
                icon={Sigma}
              />
              <MetricCard
                label="Profit Probability"
                value={
                  simulation
                    ? `${(simulation.probability_of_profit * 100).toFixed(1)}%`
                    : "--"
                }
                hint="Share of simulated paths ending in intrinsic value."
                icon={ChartSpline}
              />
            </div>
          </div>

          <section className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-6 shadow-[0_24px_80px_rgba(8,15,34,0.45)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Contract Inputs</h2>
                <p className="text-sm text-slate-400">
                  Use annualized volatility and time to expiry in years.
                </p>
              </div>
              {loading ? (
                <span className="inline-flex items-center gap-2 text-sm text-cyan-200">
                  <LoaderCircle className="size-4 animate-spin" />
                  Calculating
                </span>
              ) : null}
            </div>

            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void loadDashboard(inputs);
              }}
            >
              {numericFieldConfig.map(({ field, label, step }) => (
                <label key={field} className="flex flex-col gap-2 text-sm text-slate-300">
                  <span>{label}</span>
                  <input
                    className={`h-12 rounded-2xl border px-4 text-base text-white outline-none transition focus:bg-white/8 ${
                      fieldErrors[field]
                        ? "border-rose-400/70 bg-rose-500/10 focus:border-rose-300"
                        : "border-white/10 bg-white/5 focus:border-cyan-300/70"
                    }`}
                    type="number"
                    step={step}
                    value={inputs[field]}
                    onChange={(event) => updateNumberField(field, event.target.value)}
                  />
                  {fieldErrors[field] ? (
                    <span className="text-xs text-rose-200">{fieldErrors[field]}</span>
                  ) : null}
                </label>
              ))}

              <label className="flex flex-col gap-2 text-sm text-slate-300">
                <span>Option Type</span>
                <select
                  className={`h-12 cursor-pointer rounded-2xl border px-4 text-base text-white outline-none transition ${
                    fieldErrors.option_type
                      ? "border-rose-400/70 bg-rose-500/10 focus:border-rose-300"
                      : "border-white/10 bg-white/5 focus:border-cyan-300/70"
                  }`}
                  value={inputs.option_type}
                  onChange={(event) => updateOptionType(event.target.value)}
                >
                  <option className="bg-slate-950" value="call">
                    Call
                  </option>
                  <option className="bg-slate-950" value="put">
                    Put
                  </option>
                </select>
                {fieldErrors.option_type ? (
                  <span className="text-xs text-rose-200">{fieldErrors.option_type}</span>
                ) : null}
              </label>

              <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
                Monte Carlo uses {monteCarloPayload.num_simulations.toLocaleString()} paths,{" "}
                {monteCarloPayload.num_steps} steps, and seed {monteCarloPayload.random_seed}.
              </div>

              <Button
                className="h-12 rounded-2xl border border-cyan-200/20 text-sm font-semibold"
                type="submit"
              >
                Recalculate Analysis
              </Button>
            </form>

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-400/30 bg-gradient-to-r from-rose-500/14 via-rose-500/10 to-orange-500/12 px-4 py-3 text-sm text-rose-100">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-200" />
                  <div>
                    <p className="font-medium text-white">
                      {hasFieldErrors
                        ? "Check the highlighted fields."
                        : "Unable to recalculate analysis."}
                    </p>
                    <p className="mt-1 text-rose-100/90">{error}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <MetricCard
            label="Gamma"
            value={analysis ? formatDecimal(analysis.greeks.gamma) : "--"}
            hint="Curvature of delta with respect to the underlying."
            icon={Sigma}
          />
          <MetricCard
            label="Theta"
            value={analysis ? formatDecimal(analysis.greeks.theta) : "--"}
            hint="Estimated daily time decay of the option premium."
            icon={Activity}
          />
          <MetricCard
            label="Vega"
            value={analysis ? formatDecimal(analysis.greeks.vega) : "--"}
            hint="Sensitivity of price to a 1 percentage-point volatility move."
            icon={ChartSpline}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <ChartPanel
            title="Payoff at Expiry"
            subtitle="Intrinsic value across a range of underlying prices."
          >
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
                <LineChart data={analysis?.payoff ?? []}>
                  <CartesianGrid stroke="rgba(148,163,184,0.14)" vertical={false} />
                  <XAxis
                    dataKey="underlying_price"
                    stroke="#94a3b8"
                    tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      border: "1px solid rgba(148,163,184,0.25)",
                      borderRadius: "16px",
                    }}
                    formatter={(value) => formatCurrency(Number(value))}
                    labelFormatter={(value) =>
                      `Underlying: ${formatCurrency(Number(value))}`
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="payoff"
                    stroke="#67e8f9"
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              chartFallback
            )}
          </ChartPanel>

          <ChartPanel
            title="Sensitivity Curves"
            subtitle="Compare the effect of volatility and time to expiry on option value."
          >
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
                <LineChart data={sensitivityData}>
                  <CartesianGrid stroke="rgba(148,163,184,0.14)" vertical={false} />
                  <XAxis
                    dataKey="volatility"
                    stroke="#94a3b8"
                    tickFormatter={(value) => Number(value).toFixed(2)}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tickFormatter={(value) => `$${Number(value).toFixed(1)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      border: "1px solid rgba(148,163,184,0.25)",
                      borderRadius: "16px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="volatilityPrice"
                    name="Volatility sensitivity"
                    stroke="#22d3ee"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="timePrice"
                    name="Time sensitivity"
                    stroke="#a78bfa"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              chartFallback
            )}
          </ChartPanel>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <ChartPanel
            title="Monte Carlo Paths"
            subtitle="Six representative simulated paths generated from geometric Brownian motion."
          >
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
                <LineChart data={monteCarloChartData}>
                  <CartesianGrid stroke="rgba(148,163,184,0.14)" vertical={false} />
                  <XAxis dataKey="step" stroke="#94a3b8" />
                  <YAxis
                    stroke="#94a3b8"
                    tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      border: "1px solid rgba(148,163,184,0.25)",
                      borderRadius: "16px",
                    }}
                  />
                  {pathSeries.map((series, index) => (
                    <Line
                      key={series.name}
                      type="monotone"
                      dataKey={series.name}
                      stroke={
                        ["#22d3ee", "#38bdf8", "#60a5fa", "#818cf8", "#a78bfa", "#c084fc"][
                          index
                        ]
                      }
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              chartFallback
            )}
          </ChartPanel>

          <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-[0_24px_80px_rgba(8,15,34,0.45)]">
            <h3 className="text-lg font-semibold text-white">Simulation Summary</h3>
            <p className="mt-1 text-sm text-slate-400">
              Percentile bands help frame the range of plausible terminal outcomes.
            </p>

            <div className="mt-6 grid gap-4">
              {simulation ? (
                [
                  ["5th Percentile", formatCurrency(simulation.percentile_5)],
                  ["Median Terminal Price", formatCurrency(simulation.percentile_50)],
                  ["95th Percentile", formatCurrency(simulation.percentile_95)],
                  [
                    "Expected Terminal Price",
                    formatCurrency(simulation.expected_terminal_price),
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <p className="text-sm text-slate-400">{label}</p>
                    <p className="mt-1 text-lg font-semibold text-white">{value}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
                  Run the model to view percentile summaries.
                </div>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
