import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dayjs from "dayjs";
import { resolveRegionAndDistrict, calculateFeeHKD } from "./rate.js";
import { loadRates, saveRates } from "./admin.js";
import { regions } from "./hkDistricts.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors https://*.myshopify.com https://admin.shopify.com"
  );
  next();
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "../public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin.html"));
});
app.use("/proxy", express.static(path.join(__dirname, "../public")));
app.get("/proxy/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin.html"));
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/config/rates", (req, res) => {
  const cfg = loadRates();
  res.json(cfg);
});

app.put("/config/rates", (req, res) => {
  try {
    const v = saveRates(req.body);
    res.json(v);
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.post("/config/rates/import-csv", bodyParser.text({ type: "*/*" }), (req, res) => {
  try {
    const text = String(req.body || "");
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return res.status(400).json({ error: "empty csv" });
    const header = lines[0].split(",").map(h => h.trim().toLowerCase());
    const idx = {
      country: header.indexOf("country"),
      district: header.indexOf("district"),
      region: header.indexOf("region"),
      threshold: header.indexOf("threshold_hkd"),
      fee: header.indexOf("fee_hkd"),
      active: header.indexOf("active"),
      threshold_op: header.indexOf("threshold_op"),
      express_type: header.indexOf("express_type"),
      express_value: header.indexOf("express_value"),
      express_free: header.indexOf("express_free")
    };
    const cfg = loadRates();
    cfg.area_overrides = cfg.area_overrides || {};
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const countryCell = (idx.country >= 0 ? cols[idx.country] : "").trim().toLowerCase();
      const districtCell = (idx.district >= 0 ? cols[idx.district] : "").trim().toLowerCase();
      const regionCell = (idx.region >= 0 ? cols[idx.region] : "").trim().toLowerCase();
      let key = "";
      if (countryCell && (districtCell || regionCell)) {
        const d = districtCell;
        const r = regionCell;
        key = `${countryCell}/${r}/${d}`.replace(/\/\/+/, "/").toLowerCase();
      } else {
        key = districtCell || regionCell;
      }
      key = String(key || "").trim().toLowerCase();
      if (!key) continue;
      const threshold = idx.threshold >= 0 ? Number(cols[idx.threshold] || 0) : undefined;
      const fee = idx.fee >= 0 ? Number(cols[idx.fee] || 0) : undefined;
      const active = idx.active >= 0 ? String(cols[idx.active] || "true").trim().toLowerCase() : "true";
      const op = idx.threshold_op >= 0 ? String(cols[idx.threshold_op] || "lt").trim().toLowerCase() : "lt";
      const et = idx.express_type >= 0 ? String(cols[idx.express_type] || "").trim().toLowerCase() : "";
      const ev = idx.express_value >= 0 ? Number(cols[idx.express_value] || 0) : 0;
      const ef = idx.express_free >= 0 ? String(cols[idx.express_free] || "").trim().toLowerCase() : "";
      const entry = {};
      entry.scope = (idx.district >= 0 && cols[idx.district] && String(cols[idx.district]).trim()) ? "district" : "region";
      entry.active = active !== "false";
      entry.threshold_op = op === "ge" ? "ge" : "lt";
      if (typeof threshold === "number" && !Number.isNaN(threshold)) entry.threshold_hkd = threshold;
      if (typeof fee === "number" && !Number.isNaN(fee)) entry.fee_hkd = fee;
      if (et === "multiplier" || et === "fixed") {
        entry.express = { type: et, value: ev || 0, free_when_standard_free: ef === "true" };
      }
      cfg.area_overrides[key] = entry;
    }
    const v = saveRates(cfg);
    res.json(v);
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.post("/carrier/rates", (req, res) => {
  const rateReq = req.body && req.body.rate ? req.body.rate : req.body;
  const dest = rateReq && rateReq.destination ? rateReq.destination : rateReq;
  const address = {
    country: (dest && dest.country) || "HK",
    province: (dest && dest.province) || "",
    city: (dest && dest.city) || "",
    postal_code: (dest && dest.postal_code) || "",
    address1: (dest && dest.address1) || "",
    address2: (dest && dest.address2) || "",
    region: (dest && dest.region) || ""
  };
  const r = resolveRegionAndDistrict(address);
  const cfg = loadRates();
  const items = Array.isArray(rateReq.items) ? rateReq.items : [];
  const subtotalCents = items.reduce((acc, it) => acc + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
  const itemCount = items.reduce((acc, it) => acc + Number(it.quantity || 1), 0);
  const totalWeightGrams = items.reduce((acc, it) => acc + (Number(it.grams || 0) * Number(it.quantity || 1)), 0);
  const subtotalHkd = subtotalCents / 100;
  let threshold = cfg.default_threshold_hkd || cfg.free_threshold_hkd || 0;
  let baseFee = cfg.default_fee_hkd || 0;
  const cityKey = String(address.city || "").trim().toLowerCase();
  const regionKey = String(r.region || "").trim().toLowerCase();
  const countryKey = String(address.country || "").trim().toLowerCase();
  const districtKey = String((r && r.district) || cityKey || "").trim().toLowerCase();
  const compositeKey = `${countryKey}/${regionKey}/${districtKey}`;
  let area = (cfg.area_overrides || {})[compositeKey];
  if (!area) area = (cfg.area_overrides || {})[cityKey];
  if (!area) area = (cfg.area_overrides || {})[regionKey];
  if (area && area.active === false) area = undefined;
  if (area) {
    const nowDay = dayjs();
    if (typeof area.min_weight_grams === 'number' && totalWeightGrams < area.min_weight_grams) area = undefined;
    if (typeof area.max_weight_grams === 'number' && totalWeightGrams > area.max_weight_grams) area = undefined;
    if (typeof area.min_items === 'number' && itemCount < area.min_items) area = undefined;
    if (typeof area.max_items === 'number' && itemCount > area.max_items) area = undefined;
    if (typeof area.active_from === 'string' && area.active_from) {
      const from = dayjs(area.active_from);
      if (nowDay.isBefore(from, 'day')) area = undefined;
    }
    if (typeof area.active_to === 'string' && area.active_to) {
      const to = dayjs(area.active_to);
      if (nowDay.isAfter(to, 'day')) area = undefined;
    }
  }
  let op = cfg.default_threshold_op || "lt";
  if (area) {
    if (typeof area.threshold_hkd === "number") threshold = area.threshold_hkd;
    if (typeof area.fee_hkd === "number") baseFee = area.fee_hkd;
    if (typeof area.threshold_op === "string") op = area.threshold_op;
  }
  let applyFee = false;
  if (op === "lt") applyFee = subtotalHkd < threshold;
  else applyFee = subtotalHkd >= threshold;
  let fee = applyFee ? baseFee : 0;
  const now = dayjs();
  const minDate = now.add(2, "day").toISOString();
  const maxDate = now.add(4, "day").toISOString();
  const stdCents = Math.round(fee * 100);
  const expressCfg = (area ? area.express : null) || cfg.express || { type: "multiplier", value: 1.5, free_when_standard_free: true };
  let expFee = 0;
  if (expressCfg.free_when_standard_free && fee === 0) {
    expFee = 0;
  } else if (expressCfg.type === "multiplier") {
    expFee = fee * expressCfg.value;
  } else {
    expFee = expressCfg.value;
  }
  const expCents = Math.round(expFee * 100);
  const response = {
    rates: [
      {
        service_name: cfg.service_standard_name || "VKS Standard",
        service_code: "VKS_STANDARD",
        total_price: String(stdCents),
        currency: cfg.currency || "HKD",
        min_delivery_date: minDate,
        max_delivery_date: maxDate
      },
      {
        service_name: cfg.service_express_name || "VKS Express",
        service_code: "VKS_EXPRESS",
        total_price: String(expCents),
        currency: cfg.currency || "HKD",
        min_delivery_date: now.add(1, "day").toISOString(),
        max_delivery_date: now.add(2, "day").toISOString()
      }
    ]
  };
  res.json(response);
});

app.post("/proxy/carrier/rates", (req, res) => {
  const rateReq = req.body && req.body.rate ? req.body.rate : req.body;
  const dest = rateReq && rateReq.destination ? rateReq.destination : rateReq;
  const address = {
    country: (dest && dest.country) || "HK",
    province: (dest && dest.province) || "",
    city: (dest && dest.city) || "",
    postal_code: (dest && dest.postal_code) || "",
    address1: (dest && dest.address1) || "",
    address2: (dest && dest.address2) || "",
    region: (dest && dest.region) || ""
  };
  const r = resolveRegionAndDistrict(address);
  const cfg = loadRates();
  const items = Array.isArray(rateReq.items) ? rateReq.items : [];
  const subtotalCents = items.reduce((acc, it) => acc + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
  const itemCount = items.reduce((acc, it) => acc + Number(it.quantity || 1), 0);
  const totalWeightGrams = items.reduce((acc, it) => acc + (Number(it.grams || 0) * Number(it.quantity || 1)), 0);
  const subtotalHkd = subtotalCents / 100;
  let threshold = cfg.default_threshold_hkd || cfg.free_threshold_hkd || 0;
  let baseFee = cfg.default_fee_hkd || 0;
  const cityKey = String(address.city || "").trim().toLowerCase();
  const regionKey = String(r.region || "").trim().toLowerCase();
  const countryKey = String(address.country || "").trim().toLowerCase();
  const districtKey = String((r && r.district) || cityKey || "").trim().toLowerCase();
  const compositeKey = `${countryKey}/${regionKey}/${districtKey}`;
  let area = (cfg.area_overrides || {})[compositeKey];
  if (!area) area = (cfg.area_overrides || {})[cityKey];
  if (!area) area = (cfg.area_overrides || {})[regionKey];
  if (area && area.active === false) area = undefined;
  if (area) {
    const nowDay = dayjs();
    if (typeof area.min_weight_grams === 'number' && totalWeightGrams < area.min_weight_grams) area = undefined;
    if (typeof area.max_weight_grams === 'number' && totalWeightGrams > area.max_weight_grams) area = undefined;
    if (typeof area.min_items === 'number' && itemCount < area.min_items) area = undefined;
    if (typeof area.max_items === 'number' && itemCount > area.max_items) area = undefined;
    if (typeof area.active_from === 'string' && area.active_from) {
      const from = dayjs(area.active_from);
      if (nowDay.isBefore(from, 'day')) area = undefined;
    }
    if (typeof area.active_to === 'string' && area.active_to) {
      const to = dayjs(area.active_to);
      if (nowDay.isAfter(to, 'day')) area = undefined;
    }
  }
  let op = cfg.default_threshold_op || "lt";
  if (area) {
    if (typeof area.threshold_hkd === "number") threshold = area.threshold_hkd;
    if (typeof area.fee_hkd === "number") baseFee = area.fee_hkd;
    if (typeof area.threshold_op === "string") op = area.threshold_op;
  }
  let applyFee = false;
  if (op === "lt") applyFee = subtotalHkd < threshold;
  else applyFee = subtotalHkd >= threshold;
  let fee = applyFee ? baseFee : 0;
  const now = dayjs();
  const minDate = now.add(2, "day").toISOString();
  const maxDate = now.add(4, "day").toISOString();
  const stdCents = Math.round(fee * 100);
  const expressCfg = (area ? area.express : null) || cfg.express || { type: "multiplier", value: 1.5, free_when_standard_free: true };
  let expFee = 0;
  if (expressCfg.free_when_standard_free && fee === 0) {
    expFee = 0;
  } else if (expressCfg.type === "multiplier") {
    expFee = fee * expressCfg.value;
  } else {
    expFee = expressCfg.value;
  }
  const expCents = Math.round(expFee * 100);
  const response = {
    rates: [
      {
        service_name: cfg.service_standard_name || "VKS Standard",
        service_code: "VKS_STANDARD",
        total_price: String(stdCents),
        currency: cfg.currency || "HKD",
        min_delivery_date: minDate,
        max_delivery_date: maxDate
      },
      {
        service_name: cfg.service_express_name || "VKS Express",
        service_code: "VKS_EXPRESS",
        total_price: String(expCents),
        currency: cfg.currency || "HKD",
        min_delivery_date: now.add(1, "day").toISOString(),
        max_delivery_date: now.add(2, "day").toISOString()
      }
    ]
  };
  res.json(response);
});

app.post("/storefront/fee", (req, res) => {
  const region = String(req.body.region || "").toLowerCase();
  const district = String(req.body.district || "").toLowerCase();
  const currency = String(req.body.currency || "HKD").toUpperCase();
  const fee = calculateFeeHKD(region, district);
  const cents = Math.round(fee * 100);
  res.json({ fee_hkd: fee, fee_cents: cents, currency });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`HK shipping rate service listening on port ${port}`);
});
app.get("/hk/districts", (req, res) => {
  res.json({ regions });
});

app.get("/sitemap.xml", (req, res) => {
  try{
    const pub = path.join(__dirname, "../public");
    const files = fs.readdirSync(pub).filter(f => /(\.html)$/.test(f));
    const origin = `${req.protocol}://${req.get("host")}`;
    const urls = files.map(f => `${origin}/${f === "index.html" ? "" : f}`);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u=>`<url><loc>${u}</loc></url>`).join("\n")}\n</urlset>`;
    res.setHeader("Content-Type","application/xml");
    res.send(xml);
  }catch(e){
    res.status(500).send("error");
  }
});

app.get("/spec", (req, res) => {
  try{
    const file = path.join(__dirname, "../public", "VKS Shipping Rate apps User Requirement.xml");
    if (!fs.existsSync(file)) return res.status(404).json({ error: "spec not found" });
    const xml = fs.readFileSync(file, "utf8");
    const matches = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]);
    const text = matches.join("\n");
    res.json({ text });
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});
