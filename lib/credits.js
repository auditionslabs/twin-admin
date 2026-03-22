/**
 * Stars / Wallet / Usage Tracking – digital currency (Telegram Stars–style)
 *
 * - Platform stars: our own digital currency for AI/token usage
 * - Logs all AI usage with provider cost
 * - Markup on top of passthrough (VAPI/Patreon model)
 * - Default 1M stars for new tenants
 * - Future: buy stars with Telegram Stars via bot (exchange)
 *
 * 1 star ≈ $0.000001 (1M stars = $1)
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const WALLETS_FILE = path.join(DATA_DIR, 'wallets.json');
const USAGE_LOG_FILE = path.join(DATA_DIR, 'usage.jsonl');

// Star unit: 1 star = STAR_TO_USD dollars. 1M stars = $1.
const STAR_TO_USD = 1e-6; // 1 star = $0.000001
const DEFAULT_STARS = 1_000_000;
const DEFAULT_MARKUP = 1.2; // 20% on top of cost (VAPI-style platform fee)

// Cost per unit (USD) – passthrough rates (approximate)
const COST_RATES = {
  openai: {
    'gpt-4o': { input: 0.0025, output: 0.01 },         // per 1K tokens
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-4': { input: 0.03, output: 0.06 },
    'whisper-1': { per_minute: 0.006 },
  },
  elevenlabs: {
    default: { per_char: 0.00003 }, // ~$0.30/1K chars for multilingual_v2
  },
  replicate: {
    'cjwbw/sadtalker': { per_run: 0.065 },
    'devxpy/cog-wav2lip': { per_run: 0.014 },
    'lucataco/ms-img2vid': { per_run: 0.023 },
    'zsxkib/framepack': { per_run: 0.04 },
    'bxclib2/flux_img2img': { per_run: 0.02 },
    default: { per_run: 0.02 },
  },
  fal: {
    'flux/dev/image-to-image': { per_run: 0.035 },
    'ltx-2/image-to-video': { per_run: 0.25 },
    default: { per_run: 0.03 },
  },
  heygen: {
    'video/generate': { per_second: 0.08 }, // approximate
    default: { per_run: 0.5 },
  },
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadWallets() {
  ensureDataDir();
  if (!fs.existsSync(WALLETS_FILE)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(WALLETS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveWallets(wallets) {
  ensureDataDir();
  fs.writeFileSync(WALLETS_FILE, JSON.stringify(wallets, null, 2));
}

function appendUsage(entry) {
  ensureDataDir();
  fs.appendFileSync(USAGE_LOG_FILE, JSON.stringify(entry) + '\n');
}

/**
 * Get or create wallet for tenant. New tenants get DEFAULT_STARS.
 */
function getOrCreateWallet(tenantId = 'default') {
  const wallets = loadWallets();
  if (!wallets[tenantId]) {
    wallets[tenantId] = {
      tenant_id: tenantId,
      balance: DEFAULT_STARS,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveWallets(wallets);
  }
  return wallets[tenantId];
}

/**
 * Compute cost (USD) for a usage event.
 */
function computeCost(provider, model, units = {}) {
  const providerRates = COST_RATES[provider];
  if (!providerRates) return 0;

  const rates = providerRates[model] || providerRates.default || { per_run: 0.01 };

  if (rates.input !== undefined && rates.output !== undefined) {
    const inK = (units.input_tokens || 0) / 1000;
    const outK = (units.output_tokens || 0) / 1000;
    return inK * rates.input + outK * rates.output;
  }
  if (rates.per_minute !== undefined) {
    return (units.duration_seconds || 0) / 60 * rates.per_minute;
  }
  if (rates.per_char !== undefined) {
    return (units.chars || 0) * rates.per_char;
  }
  if (rates.per_second !== undefined) {
    return (units.seconds || 0) * rates.per_second;
  }
  return rates.per_run || 0;
}

/**
 * USD to stars (with markup). chargeStars = costUsd * markup / STAR_TO_USD
 */
function usdToStars(usd, markup = DEFAULT_MARKUP) {
  return Math.ceil((usd * markup) / STAR_TO_USD);
}

/**
 * Deduct stars, log usage. Returns { ok, balance, error }.
 */
function chargeAndLog(tenantId, opts) {
  const {
    provider,
    model = 'default',
    route,
    cost_usd,
    stars_charged,
    tokens_in,
    tokens_out,
    metadata = {},
  } = opts;

  const wallets = loadWallets();
  let wallet = wallets[tenantId];
  if (!wallet) {
    wallet = { tenant_id: tenantId, balance: DEFAULT_STARS, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    wallets[tenantId] = wallet;
  }

  const toCharge = stars_charged ?? usdToStars(cost_usd || 0);
  if (wallet.balance < toCharge) {
    return { ok: false, balance: wallet.balance, error: 'Insufficient stars' };
  }

  wallet.balance -= toCharge;
  wallet.updated_at = new Date().toISOString();
  saveWallets(wallets);

  const entry = {
    ts: new Date().toISOString(),
    tenant_id: tenantId,
    provider,
    model,
    route,
    cost_usd: cost_usd ?? 0,
    stars_charged: toCharge,
    tokens_in: tokens_in ?? null,
    tokens_out: tokens_out ?? null,
    balance_after: wallet.balance,
    ...metadata,
  };
  appendUsage(entry);

  return { ok: true, balance: wallet.balance, stars_charged: toCharge };
}

/**
 * Get balance for tenant.
 */
function getBalance(tenantId = 'default') {
  const w = getOrCreateWallet(tenantId);
  return w.balance;
}

/**
 * Add stars (e.g. purchase, Telegram Stars exchange, admin grant).
 */
function addStars(tenantId, amount, reason = '') {
  const wallets = loadWallets();
  let wallet = wallets[tenantId];
  if (!wallet) {
    wallet = { tenant_id: tenantId, balance: DEFAULT_STARS, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    wallets[tenantId] = wallet;
  }
  wallet.balance += amount;
  wallet.updated_at = new Date().toISOString();
  saveWallets(wallets);
  appendUsage({
    ts: new Date().toISOString(),
    tenant_id: tenantId,
    provider: 'system',
    route: 'stars_add',
    stars_added: amount,
    balance_after: wallet.balance,
    reason,
  });
  return wallet.balance;
}

/**
 * Read usage log (last N lines).
 */
function readUsageLog(tenantId, limit = 100) {
  if (!fs.existsSync(USAGE_LOG_FILE)) return [];
  const lines = fs.readFileSync(USAGE_LOG_FILE, 'utf8').trim().split('\n').filter(Boolean);
  let entries = lines.map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  }).filter(Boolean);
  if (tenantId) {
    entries = entries.filter((e) => e.tenant_id === tenantId);
  }
  return entries.slice(-limit).reverse();
}

/**
 * Get usage summary (total cost, total credits) for tenant.
 */
function getUsageSummary(tenantId, since) {
  const entries = readUsageLog(tenantId, 10000);
  let totalCost = 0;
  let totalStars = 0;
  const byProvider = {};
  for (const e of entries) {
    if (e.provider === 'system' && e.stars_added) continue;
    if (since && new Date(e.ts) < new Date(since)) continue;
    totalCost += e.cost_usd || 0;
    totalStars += e.stars_charged || 0;
    if (e.provider) {
      byProvider[e.provider] = (byProvider[e.provider] || 0) + (e.stars_charged || 0);
    }
  }
  return { total_cost_usd: totalCost, total_stars_charged: totalStars, by_provider: byProvider };
}

module.exports = {
  STAR_TO_USD,
  DEFAULT_STARS,
  DEFAULT_MARKUP,
  COST_RATES,
  getOrCreateWallet,
  getBalance,
  addStars,
  addCredits: addStars,  // alias for backwards compat
  computeCost,
  usdToStars,
  chargeAndLog,
  readUsageLog,
  getUsageSummary,
};
