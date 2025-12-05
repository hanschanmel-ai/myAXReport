const regions = {
  "hong kong island": [
    "central","central and western","sheung wan","mid-levels","sai ying pun","kennedy town","pok fu lam",
    "wan chai","causeway bay","tin hau","north point","quarry bay","tai koo","shau kei wan","sai wan ho","chai wan","heng fa chuen",
    "ap lei chau","aberdeen","wong chuk hang","happy valley"
  ],
  "kowloon": [
    "tsim sha tsui","yau ma tei","jordan","mong kok","tai kok tsui","sham shui po","cheung sha wan","lai chi kok",
    "kowloon city","hung hom","ho man tin","kowloon tong","wong tai sin","diamond hill","ngau tau kok","kwun tong","lam tin","sau mau ping"
  ],
  "new territories": [
    "tsuen wan","ting kau","sham tseng","tsing lung tau","ma wan","sunny bay","tsing yi","kwai chung",
    "sha tin","tai wai","fo tan","ma on shan","wu kai sha","tai po","tai po market","tai po kau","tai mei tuk",
    "tseung kwan o","hang hau","tiu keng leng","clear water bay","sai kung","yuen long","tin shui wai","tuen mun",
    "fanling","sheung shui","lok ma chau","kam tin","pat heung","discovery bay","lantau island","cheung chau","peng chau","lamma island",
    "airport","chek lap kok","hong kong international airport"
  ]
};

const aliases = {
  "central": "central and western",
  "central & western": "central and western",
  "wan chai": "wan chai",
  "wanchai": "wan chai",
  "tin hau": "wan chai",
  "hki": "hong kong island",
  "yau tsim mong": "yau tsim mong",
  "ytm": "yau tsim mong",
  "kwun tong": "kwun tong",
  "kt": "kwun tong",
  "sham shui po": "sham shui po",
  "ssp": "sham shui po",
  "wong tai sin": "wong tai sin",
  "wts": "wong tai sin",
  "wong chuk hang road": "wong chuk hang",
  "sha tin": "sha tin",
  "shatin": "sha tin",
  "tai po": "tai po",
  "saikung": "sai kung",
  "tsuenwan": "tsuen wan",
  "tuenmun": "tuen mun",
  "yuenlong": "yuen long",
  "kwai tsing": "kwai tsing",
  "hkg": "airport",
  "chek lap kok": "airport",
  "hong kong international airport": "airport"
};

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

function canonicalDistrict(name) {
  const n = normalizeName(name);
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
  return normalizeName(city);
}

function regionForDistrict(district) {
  const d = normalizeName(district);
  for (const [region, list] of Object.entries(regions)) {
    if (list.includes(d)) return region;
  }
  const a = aliases[d];
  if (a) {
    return regionForDistrict(a);
  }
  return "";
}

export { regions, aliases, canonicalDistrict, detectRegionFromProvince, detectRegionFromText, detectDistrictFromCity, regionForDistrict };
