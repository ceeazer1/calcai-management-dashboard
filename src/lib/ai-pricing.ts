// Price table: USD per 1M tokens { input, output }.
// The edge-worker meters exact token counts; cost = tokens x these rates.
//
// Rates come from LiteLLM's community-maintained model price file, which tracks
// every provider's published pricing:
//   https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json
// Refresh with `npm run prices:sync` (scripts/sync-prices.mjs) rather than
// editing by hand — the previous hand-written table had no entry for any current
// model, so every charge fell through to a provider default and under-reported
// the flagship models by 20x.
export interface ModelPrice {
  input: number;
  output: number;
}

const PRICES: Record<string, ModelPrice> = {
  // OpenAI
  "openai:gpt-5.6-sol": { input: 5, output: 30 },
  "openai:gpt-5.6-terra": { input: 2, output: 12 },
  "openai:gpt-5.6-luna": { input: 0.2, output: 1.2 },
  "openai:gpt-5": { input: 1.25, output: 10 },
  "openai:gpt-5-mini": { input: 0.25, output: 2 },
  "openai:gpt-5-nano": { input: 0.05, output: 0.4 },
  // Anthropic
  "anthropic:claude-opus-5": { input: 5, output: 25 },
  "anthropic:claude-sonnet-5": { input: 2, output: 10 },
  "anthropic:claude-fable-5": { input: 10, output: 50 },
  "anthropic:claude-haiku-4-5": { input: 1, output: 5 },
  "anthropic:claude-opus-4-8": { input: 5, output: 25 },
  "anthropic:claude-sonnet-4-6": { input: 3, output: 15 },
  // Google Gemini
  "gemini:gemini-3.1-pro-preview": { input: 2, output: 12 },
  "gemini:gemini-3.6-flash": { input: 1.5, output: 7.5 },
  "gemini:gemini-3.5-flash": { input: 1.5, output: 9 },
  "gemini:gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "gemini:gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
};

// Fallbacks by provider when an exact model id isn't in the table above. Set to
// the priciest model each provider currently offers: an unknown model is more
// likely to be a new flagship than a new budget tier, and under-reporting spend
// is the more expensive mistake.
const PROVIDER_DEFAULT: Record<string, ModelPrice> = {
  openai: { input: 5, output: 30 },
  anthropic: { input: 10, output: 50 },
  gemini: { input: 2, output: 12 },
};

export function priceFor(providerModel: string): { price: ModelPrice; exact: boolean } {
  const exact = PRICES[providerModel];
  if (exact) return { price: exact, exact: true };
  const provider = providerModel.split(":")[0];
  return { price: PROVIDER_DEFAULT[provider] ?? { input: 1, output: 5 }, exact: false };
}

/** USD cost for a token count under a given provider:model id. */
export function costOf(providerModel: string, inputTokens: number, outputTokens: number): number {
  const { price } = priceFor(providerModel);
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
}
