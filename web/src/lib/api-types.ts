/**
 * Request-body helpers. Response types come straight from the generated contracts (every field present,
 * because the backend serialises defaults); request bodies may omit fields that have server defaults.
 */
import type {
  AnalysisId,
  DecisionType,
  FactInput,
  ItemizationItem,
  TermAction,
  Uncertainty,
} from "./contracts";

export type * from "./contracts";

export interface SessionCreateBody {
  decision_type?: DecisionType;
  selected_analyses?: AnalysisId[];
}

export interface FactInputBody {
  key: string;
  value?: string | null;
  status?: FactInput["status"];
  uncertainty?: Uncertainty | null;
  original_representation?: string | null;
}

export interface FactsRequestBody {
  facts: FactInputBody[];
  acknowledge_rules?: string[];
}

export interface QuestionResponseBody {
  question_id: string;
  fact_key?: string | null;
  raw_answer?: string | null;
  typed_value?: unknown;
  skipped?: boolean;
  declined?: boolean;
  marked_estimate?: boolean;
}

export type ItemizationItemBody = Pick<ItemizationItem, "item" | "amount"> &
  Partial<Pick<ItemizationItem, "name" | "optional" | "financed">>;

/** Values are decimal strings; rates are FRACTIONS ("0.0475"); term_months is an integer. */
export interface ManualOfferBody {
  label?: string;
  terms: Record<string, string | number | boolean | null>;
  itemization?: ItemizationItemBody[];
  confirmed?: boolean;
}

export interface VerifyRequestBody {
  offer_choice?: number | null;
  actions: Pick<TermAction, "term_key" | "action" | "value">[];
}

export interface AnalysisRequestBody {
  offer_id?: string | null;
}

/** GET /config/assumptions — shape owned by the engine (assumptions_payload); read defensively. */
export type AssumptionsPayload = Record<string, unknown>;
