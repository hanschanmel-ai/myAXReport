const regions = {
  "hong kong island": [
    "central and western",
    "eastern",
    "southern",
    "wan chai"
  ],
  "kowloon": [
    "kowloon city",
    "kwun tong",
    "sham shui po",
    "wong tai sin",
    "yau tsim mong"
  ],
  "new territories": [
    "islands",
    "kwai tsing",
    "north",
    "sai kung",
    "sha tin",
    "tai po",
    "tsuen wan",
    "tuen mun",
    "yuen long"
  ]
};

const aliases = {
  "central & western": "central and western",
  "wan chai": "wan chai",
  "wanchai": "wan chai",
  "yau tsim mong": "yau tsim mong",
  "ytm": "yau tsim mong",
  "kwun tong": "kwun tong",
  "kt": "kwun tong",
  "sham shui po": "sham shui po",
  "ssp": "sham shui po",
  "wong tai sin": "wong tai sin",
  "wts": "wong tai sin",
  "sha tin": "sha tin",
  "shatin": "sha tin",
  "tai po": "tai po",
  "saikung": "sai kung",
  "tsuenwan": "tsuen wan",
  "tuenmun": "tuen mun",
  "yuenlong": "yuen long",
  "kwai tsing": "kwai tsing"
};

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

function canonicalDistrict(name) {
  const n = normalizeName(name);
  if (aliases[n]) return aliases[n];
  return n;
}

function detectRegionFromProvince(province) {
  const p = normalizeName(province);
  if (p.includes("hong kong island")) return "hong kong island";
  if (p.includes("kowloon")) return "kowloon";
  if (p.includes("new territories")) return "new territories";
  return "";
}

function detectRegionFromText(text) {
  const t = normalizeName(text);
  if (!t) return "";
  if (t.includes("hong kong island") || t.includes("hk island")) return "hong kong island";
  if (t.includes("kowloon")) return "kowloon";
  if (t.includes("new territories") || t.includes("nt")) return "new territories";
  return "";
}

function detectDistrictFromCity(city) {
  const c = canonicalDistrict(city);
  for (const [region, list] of Object.entries(regions)) {
    if (list.includes(c)) return c;
  }
  return "";
}

function regionForDistrict(district) {
  const d = canonicalDistrict(district);
  for (const [region, list] of Object.entries(regions)) {
    if (list.includes(d)) return region;
  }
  return "";
}

export { regions, canonicalDistrict, detectRegionFromProvince, detectRegionFromText, detectDistrictFromCity, regionForDistrict };
