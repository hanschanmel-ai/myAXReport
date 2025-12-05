import { loadRates } from "./admin.js";
import { regionForDistrict } from "./hkDistricts.js";

function resolveRegionAndDistrict(address) {
  let region = String(address.province || address.region || "").trim().toLowerCase();
  const district = String(address.city || "").trim().toLowerCase();
  // Normalize region text by removing SAR/China suffixes
  region = region
    .replace(/special administrative region|s\.a\.r\.|\bsar\b|china/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // Infer region from district if not one of the expected keys
  const expected = new Set(["hong kong island","kowloon","new territories"]);
  if (!expected.has(region)) {
    const inferred = regionForDistrict(district);
    if (inferred) region = inferred;
  }
  return { region, district };
}

function calculateFeeHKD(region, district) {
  const cfg = loadRates();
  const regionKey = String(region || "").toLowerCase();
  const districtKey = String(district || "").toLowerCase();
  const countryKey = "hk";
  let threshold = cfg.default_threshold_hkd || cfg.free_threshold_hkd || 0;
  let baseFee = cfg.default_fee_hkd || 0;
  let op = cfg.default_threshold_op || "lt";
  const compositeKey = `${countryKey}/${regionKey}/${districtKey}`;
  let area = (cfg.area_overrides || {})[compositeKey];
  if (!area) area = (cfg.area_overrides || {})[districtKey];
  if (!area) area = (cfg.area_overrides || {})[regionKey];
  if (area && area.active === false) area = undefined;
  if (area) {
    if (typeof area.threshold_hkd === "number") threshold = area.threshold_hkd;
    if (typeof area.fee_hkd === "number") baseFee = area.fee_hkd;
    if (typeof area.threshold_op === "string") op = area.threshold_op;
  }
  const subtotal = 0;
  const applyFee = op === "lt" ? subtotal < threshold : subtotal >= threshold;
  return applyFee ? baseFee : 0;
}

export { resolveRegionAndDistrict, calculateFeeHKD };
