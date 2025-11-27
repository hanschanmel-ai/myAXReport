import { loadRates } from "./admin.js";
import { canonicalDistrict, detectRegionFromProvince, detectDistrictFromCity, regionForDistrict } from "./hkDistricts.js";
import { detectRegionFromText } from "./hkDistricts.js";

function resolveRegionAndDistrict(address) {
  const regionGuess =
    detectRegionFromProvince(address.province) ||
    detectRegionFromText(address.region) ||
    detectRegionFromText(address.city) ||
    detectRegionFromText(address.address1) ||
    detectRegionFromText(address.address2);
  const districtFromCity = detectDistrictFromCity(address.city);
  let region = regionGuess;
  let district = districtFromCity;
  if (!district && region) district = canonicalDistrict(address.city);
  if (!region && district) region = regionForDistrict(district);
  return { region, district };
}

function calculateFeeHKD(region, district) {
  const cfg = loadRates();
  const regionKey = String(region || "").toLowerCase();
  const districtKey = canonicalDistrict(district);
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
