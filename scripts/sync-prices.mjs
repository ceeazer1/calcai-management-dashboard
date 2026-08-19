#!/usr/bin/env node
// Refreshes the PRICES table in src/lib/ai-pricing.ts from LiteLLM's
// community-maintained price file. Run with `npm run prices:sync`.
//
// Rewrites only the block between the PRICES markers, so the surrounding
// comments, the interface and priceFor()/costOf() are left alone. Every model
// listed below must resolve to a real entry or the script fails rather than
// quietly leaving a stale price in place.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SOURCE = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

// Keep in sync with ALLOWED_MODELS in edge-worker/wrangler.toml, plus retired
// ids that still appear in historical spend records.
const MODELS = {
  OpenAI: ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano'],
  Anthropic: ['claude-opus-5', 'claude-sonnet-5', 'claude-fable-5', 'claude-haiku-4-5', 'claude-opus-4-8', 'claude-sonnet-4-6'],
  'Google Gemini': ['gemini-3.1-pro-preview', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
};
// The worker tags spend with these provider keys (see recordAiSpend).
const PROVIDER_KEY = { OpenAI: 'openai', Anthropic: 'anthropic', 'Google Gemini': 'gemini' };

const perMillion = (v) => Number((v * 1_000_000).toFixed(6));

const res = await fetch(SOURCE);
if (!res.ok) {
  console.error(`Could not fetch price file: HTTP ${res.status}`);
  process.exit(1);
}
const data = await res.json();

const lines = [];
const missing = [];
for (const [label, models] of Object.entries(MODELS)) {
  lines.push(`  // ${label}`);
  for (const m of models) {
    const e = data[m];
    if (!e || e.input_cost_per_token == null || e.output_cost_per_token == null) {
      missing.push(m);
      continue;
    }
    lines.push(`  "${PROVIDER_KEY[label]}:${m}": { input: ${perMillion(e.input_cost_per_token)}, output: ${perMillion(e.output_cost_per_token)} },`);
  }
}

if (missing.length) {
  console.error(`No published price for: ${missing.join(', ')}`);
  console.error('Either the id changed upstream or the model was retired — fix MODELS above.');
  process.exit(1);
}

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'ai-pricing.ts');
const src = readFileSync(file, 'utf8');
const block = /(const PRICES: Record<string, ModelPrice> = \{\n)[\s\S]*?(\n\};)/;
if (!block.test(src)) {
  console.error('Could not find the PRICES block in ai-pricing.ts');
  process.exit(1);
}
writeFileSync(file, src.replace(block, `$1${lines.join('\n')}$2`), 'utf8');
console.log(`Updated ${lines.filter((l) => !l.trim().startsWith('//')).length} model prices.`);
