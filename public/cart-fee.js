const FeeConfig = {
  endpoint: "/storefront/fee",
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

async function requestFee(region, district) {
  const r = await fetch(FeeConfig.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ region, district, currency: FeeConfig.currency })
  });
  return r.json();
}

async function addOrUpdateFee(region, district) {
  const res = await requestFee(region, district);
  const amt = Math.round(res.fee_hkd);
  const vid = FeeConfig.variantsByAmount[String(amt)];
  if (!vid) return { ok: false, reason: "variant_missing", amount: amt };
  const cart = await fetch("/cart.js").then(r => r.json());
  const feeLine = cart.items.find(i => i.properties && i.properties[FeeConfig.feeLinePropertyKey]);
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

window.HKFee = { addOrUpdateFee };

