import type {
  MonteCarloInput,
  MonteCarloSummary,
  OptionAnalysisResponse,
  PricingInput,
} from "@/lib/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type ApiFieldError = {
  field: string;
  message: string;
};

type FastApiErrorDetail = {
  loc?: Array<string | number>;
  msg?: string;
};

function formatFieldName(field: string): string {
  return field
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractApiFieldErrors(payload: unknown): ApiFieldError[] {
  if (!payload || typeof payload !== "object" || !("detail" in payload)) {
    return [];
  }

  const detail = (payload as { detail?: unknown }).detail;
  if (!Array.isArray(detail)) {
    return [];
  }

  return detail.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const { loc, msg } = entry as FastApiErrorDetail;
    const field = loc?.findLast((part): part is string => typeof part === "string");
    if (!field || !msg) {
      return [];
    }

    return [
      {
        field,
        message: `${formatFieldName(field)}: ${msg}`,
      },
    ];
  });
}

function extractApiMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if ("message" in payload && typeof payload.message === "string") {
    return payload.message;
  }

  if ("detail" in payload) {
    const detail = payload.detail;
    if (typeof detail === "string") {
      return detail;
    }
  }

  return null;
}

export class ApiRequestError extends Error {
  status: number;
  fieldErrors: ApiFieldError[];

  constructor(message: string, status: number, fieldErrors: ApiFieldError[] = []) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function apiRequest<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const errorPayload = (await response.json()) as unknown;
      const fieldErrors = extractApiFieldErrors(errorPayload);
      const message =
        fieldErrors[0]?.message ??
        extractApiMessage(errorPayload) ??
        "Unable to complete the request.";

      throw new ApiRequestError(message, response.status, fieldErrors);
    }

    const errorText = await response.text();
    throw new ApiRequestError(errorText || "Request failed.", response.status);
  }

  return response.json() as Promise<T>;
}

export function analyzeOption(
  payload: PricingInput,
): Promise<OptionAnalysisResponse> {
  return apiRequest<OptionAnalysisResponse>("/api/analyze", payload);
}

export function simulateOption(
  payload: MonteCarloInput,
): Promise<MonteCarloSummary> {
  return apiRequest<MonteCarloSummary>("/api/simulate", payload);
}
