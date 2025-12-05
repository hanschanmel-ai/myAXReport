const FeeConfig = {
  currency: "HKD",
  variantsByAmount: {
    "25": null,
    "30": null,
    "35": null,
    "40": null,
    "60": null
  },
  feeLinePropertyKey: "HK District Fee"
};

async function loadConfig() {
  try {
    const r = await fetch("/config/rates");
    return await r.json();
  } catch (e) {
    return { currency: "HKD", default_threshold_hkd: 0, default_fee_hkd: 0, default_threshold_op: "lt", area_overrides: {} };
  }
}

async function getCartSummary() {
  const cart = await fetch("/cart.js").then(r => r.json());
  let subtotalHkd = 0;
  let grams = 0;
  let items = 0;
  (cart.items || []).forEach(i => {
    subtotalHkd += (i.final_line_price || i.line_price || 0) / 100;
    grams += (i.grams || 0) * (i.quantity || 0);
    items += (i.quantity || 0);
  });
  return { cart, subtotalHkd, grams, items };
}

function inDateRange(now, from, to) {
  if (from) {
    const f = new Date(from);
    if (now < f) return false;
  }
  if (to) {
    const t = new Date(to);
    if (now > t) return false;
  }
  return true;
}

function pickOverride(cfg, country, region, district) {
  const ov = cfg.area_overrides || {};
  const keys = [
    `${(country||"HK")}/${region||""}/${district||""}`.toLowerCase(),
    `${(country||"HK")}/${region||""}`.toLowerCase(),
    `${(country||"HK")}`.toLowerCase(),
    `${district||""}`.toLowerCase(),
    `${region||""}`.toLowerCase()
  ];
  for (const k of keys) {
    if (ov[k]) return ov[k];
  }
  return null;
}

function shouldApply(op, threshold, subtotal) {
  if (typeof threshold !== "number") return false;
  if ((op || "lt") === "lt") return subtotal < threshold;
  return subtotal >= threshold;
}

function calcStandardFee(cfg, override, ctx) {
  const now = new Date();
  const ov = override || {};
  if (ov.active === false) return 0;
  if (ov.min_weight_grams && ctx.grams < ov.min_weight_grams) return 0;
  if (ov.max_weight_grams && ctx.grams > ov.max_weight_grams) return 0;
  if (ov.min_items && ctx.items < ov.min_items) return 0;
  if (ov.max_items && ctx.items > ov.max_items) return 0;
  if (!inDateRange(now, ov.active_from, ov.active_to)) return 0;
  const op = ov.threshold_op || cfg.default_threshold_op || "lt";
  const threshold = typeof ov.threshold_hkd === "number" ? ov.threshold_hkd : (cfg.default_threshold_hkd || 0);
  const fee = typeof ov.fee_hkd === "number" ? ov.fee_hkd : (cfg.default_fee_hkd || 0);
  if (threshold === 0) return fee;
  return shouldApply(op, threshold, ctx.subtotalHkd) ? fee : 0;
}

function calcExpressFee(cfg, stdFee, override) {
  const exp = (override && override.express) || cfg.express || null;
  if (!exp) return null;
  if (exp.free_when_standard_free && stdFee === 0) return 0;
  if ((exp.type || "multiplier") === "multiplier") return Math.round(stdFee * (exp.value || 1));
  return Math.round(exp.value || 0);
}

async function addOrUpdateFee(region, district) {
  const cfg = await loadConfig();
  const { cart, subtotalHkd, grams, items } = await getCartSummary();
  const override = pickOverride(cfg, "HK", region, district);
  const stdFee = Math.round(calcStandardFee(cfg, override, { subtotalHkd, grams, items }));
  const amt = stdFee;
  const vid = FeeConfig.variantsByAmount[String(amt)];
  if (!vid) return { ok: false, reason: "variant_missing", amount: amt };
  const feeLine = (cart.items || []).find(i => i.properties && i.properties[FeeConfig.feeLinePropertyKey]);
  if (feeLine && feeLine.id === vid) {
    return { ok: true, updated: false, amount: amt };
  }
  if (feeLine && feeLine.id !== vid) {
    await fetch("/cart/change.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: feeLine.key, quantity: 0 })
    });
  }
  const body = {
    items: [
      {
        id: vid,
        quantity: 1,
        properties: { [FeeConfig.feeLinePropertyKey]: `${region} ${district}` }
      }
    ]
  };
  await fetch("/cart/add.js", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { ok: true, updated: true, amount: amt };
}

function getDefaultDistricts() {
  return {
    regions: {
      "Hong Kong Island": ["Central and Western", "Wan Chai", "Eastern", "Southern"],
      "Kowloon": ["Yau Tsim Mong", "Sham Shui Po", "Kowloon City", "Wong Tai Sin", "Kwun Tong"],
      "New Territories": ["Tsuen Wan", "Tuen Mun", "Yuen Long", "North", "Tai Po", "Sha Tin", "Kwai Tsing", "Sai Kung", "Islands"]
    }
  };
}

window.HKFee = { addOrUpdateFee, getDefaultDistricts };
