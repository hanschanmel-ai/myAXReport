import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dayjs from "dayjs";
import { resolveRegionAndDistrict, calculateFeeHKD } from "./rate.js";
import { loadRates, saveRates } from "./admin.js";
import { regions, aliases, regionForDistrict } from "./hkDistricts.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";

const app = express();
app.set("trust proxy", true);
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
  res.redirect("/apps/vks-shipping-rate");
});
app.use("/proxy", express.static(path.join(__dirname, "../public")));
app.get("/proxy/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin.html"));
});
app.get("/proxy/pickup", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/pickup.html"));
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/config/rates", (req, res) => {
  const cfg = loadRates();
  res.json(cfg);
});

app.get("/config/base", (req, res) => {
  try{
    const cfg = loadRates();
    res.json({
      fallback_enabled: !!cfg.fallback_enabled,
      fallback_fee_hkd: typeof cfg.fallback_fee_hkd === 'number' ? cfg.fallback_fee_hkd : (typeof cfg.default_fee_hkd === 'number' ? cfg.default_fee_hkd : 0),
      default_fee_hkd: cfg.default_fee_hkd || 0,
      default_threshold_hkd: cfg.default_threshold_hkd || 0,
      default_threshold_op: cfg.default_threshold_op || 'lt'
    });
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/config/base/update", (req, res) => {
  try{
    const body = req.body || {};
    const cfg = loadRates();
    if (typeof body.fallback_enabled !== 'undefined') cfg.fallback_enabled = !!body.fallback_enabled;
    if (typeof body.fallback_fee_hkd === 'number' && !Number.isNaN(body.fallback_fee_hkd)) cfg.fallback_fee_hkd = body.fallback_fee_hkd;
    if (typeof body.default_fee_hkd === 'number' && !Number.isNaN(body.default_fee_hkd)) cfg.default_fee_hkd = body.default_fee_hkd;
    if (typeof body.default_threshold_hkd === 'number' && !Number.isNaN(body.default_threshold_hkd)) cfg.default_threshold_hkd = body.default_threshold_hkd;
    if (typeof body.default_threshold_op === 'string') cfg.default_threshold_op = body.default_threshold_op === 'ge' ? 'ge' : 'lt';
    const out = saveRates(cfg);
    res.json({ ok: true, base: { fallback_enabled: !!out.fallback_enabled, fallback_fee_hkd: out.fallback_fee_hkd || 0, default_fee_hkd: out.default_fee_hkd || 0, default_threshold_hkd: out.default_threshold_hkd || 0, default_threshold_op: out.default_threshold_op || 'lt' } });
  }catch(e){
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.put("/config/rates", (req, res) => {
  try {
    const v = saveRates(req.body);
    res.json(v);
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.post("/config/rates/upsert", (req, res) => {
  try{
    const body = req.body || {};
    const country = String(body.country || "HK").trim().toLowerCase();
    const region = String(body.region || "").trim().toLowerCase();
    const districts = Array.isArray(body.districts) ? body.districts : String(body.districts || "").split(",").map(s=>s.trim()).filter(Boolean);
    const threshold = typeof body.threshold_hkd === "number" ? body.threshold_hkd : undefined;
    const fee = typeof body.fee_hkd === "number" ? body.fee_hkd : undefined;
    const op = String(body.threshold_op || "lt").trim().toLowerCase() === "ge" ? "ge" : "lt";
    const active = body.active !== false;
    const cfg = loadRates();
    cfg.area_overrides = cfg.area_overrides || {};
    for (const dRaw of districts){
      const d = String(dRaw || "").trim().toLowerCase();
      if (!d && !region) continue;
      let key = d ? `${country}/${region}/${d}` : `${country}/${region}`;
      key = key.replace(/\/+/, "/").toLowerCase();
      const entry = cfg.area_overrides[key] || {};
      entry.active = active;
      entry.threshold_op = op;
      if (threshold !== undefined) entry.threshold_hkd = threshold;
      if (fee !== undefined) entry.fee_hkd = fee;
      cfg.area_overrides[key] = entry;
    }
    const out = saveRates(cfg);
    res.json(out);
  }catch(e){
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.post("/config/rates/delete", (req, res) => {
  try{
    const body = req.body || {};
    const keys = Array.isArray(body.keys) ? body.keys : [String(body.key || "").trim().toLowerCase()].filter(Boolean);
    const cfg = loadRates();
    cfg.area_overrides = cfg.area_overrides || {};
    for (const k of keys){
      const kk = String(k || "").trim().toLowerCase();
      if (kk) delete cfg.area_overrides[kk];
    }
    const out = saveRates(cfg);
    res.json(out);
  }catch(e){
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.get("/config/free-addresses", (req, res) => {
  try{
    const cfg = loadRates();
    const list = Array.isArray(cfg.free_addresses) ? cfg.free_addresses : [];
    res.json({ list });
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/config/free-address/upsert", (req, res) => {
  try{
    const body = req.body || {};
    const idx = typeof body.index === "number" ? body.index : -1;
    const entry = {
      country: String(body.country || "").trim(),
      region: String(body.region || "").trim(),
      city: String(body.city || body.district || "").trim(),
      district: String(body.district || "").trim(),
      location_name: String(body.location_name || body.shop_name || "").trim(),
      address1: String(body.address1 || "").trim(),
      locked: body.locked === true
    };
    const cfg = loadRates();
    const list = Array.isArray(cfg.free_addresses) ? cfg.free_addresses : [];
    if (idx >= 0 && idx < list.length) {
      const cur = list[idx] || {};
      if (cur.locked === true && body.locked !== true) {
        // preserve lock when editing unless explicitly setting locked true
        entry.locked = true;
      }
      list[idx] = entry;
    } else {
      const key = String(entry.location_name || (entry.city + " " + entry.address1)).toLowerCase();
      const found = list.findIndex(x => String(x.location_name || "").toLowerCase() === key);
      if (found >= 0) {
        const cur = list[found] || {};
        if (cur.locked === true && body.locked !== true) entry.locked = true;
        list[found] = entry;
      } else {
        list.push(entry);
      }
    }
    cfg.free_addresses = list;
    const out = saveRates(cfg);
    res.json({ ok: true, list: out.free_addresses || [] });
  }catch(e){
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.post("/config/free-address/delete", (req, res) => {
  try{
    const body = req.body || {};
    const idx = typeof body.index === "number" ? body.index : -1;
    const name = String(body.location_name || body.shop_name || "").trim().toLowerCase();
    const cfg = loadRates();
    const list = Array.isArray(cfg.free_addresses) ? cfg.free_addresses : [];
    if (idx >= 0 && idx < list.length) {
      if (list[idx] && list[idx].locked === true) return res.status(403).json({ error: "locked entry" });
      list.splice(idx, 1);
    } else if (name) {
      const found = list.findIndex(x => String(x.location_name || "").toLowerCase() === name);
      if (found >= 0) {
        if (list[found] && list[found].locked === true) return res.status(403).json({ error: "locked entry" });
        list.splice(found, 1);
      }
    }
    cfg.free_addresses = list;
    const out = saveRates(cfg);
    res.json({ ok: true, list: out.free_addresses || [] });
  }catch(e){
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.post("/config/free-address/lock", (req, res) => {
  try{
    const body = req.body || {};
    const cfg = loadRates();
    const list = Array.isArray(cfg.free_addresses) ? cfg.free_addresses : [];
    const idx = typeof body.index === "number" ? body.index : -1;
    const name = String(body.location_name || body.shop_name || "").trim().toLowerCase();
    let changed = false;
    if (idx >= 0 && idx < list.length) { list[idx].locked = true; changed = true; }
    if (name) {
      const found = list.findIndex(x => String(x.location_name || "").toLowerCase() === name);
      if (found >= 0) { list[found].locked = true; changed = true; }
    }
    if (!changed && Array.isArray(body.names)) {
      for (const nm of body.names) {
        const f = list.findIndex(x => String(x.location_name || "").toLowerCase() === String(nm||"").toLowerCase());
        if (f >= 0) { list[f].locked = true; changed = true; }
      }
    }
    cfg.free_addresses = list;
    const out = saveRates(cfg);
    res.json({ ok: true, list: out.free_addresses || [] });
  }catch(e){ res.status(400).json({ error: String(e.message || e) }); }
});

app.post("/config/free-address/unlock", (req, res) => {
  try{
    const body = req.body || {};
    const cfg = loadRates();
    const list = Array.isArray(cfg.free_addresses) ? cfg.free_addresses : [];
    const idx = typeof body.index === "number" ? body.index : -1;
    const name = String(body.location_name || body.shop_name || "").trim().toLowerCase();
    let changed = false;
    if (idx >= 0 && idx < list.length) { list[idx].locked = false; changed = true; }
    if (name) {
      const found = list.findIndex(x => String(x.location_name || "").toLowerCase() === name);
      if (found >= 0) { list[found].locked = false; changed = true; }
    }
    cfg.free_addresses = list;
    const out = saveRates(cfg);
    res.json({ ok: true, list: out.free_addresses || [] });
  }catch(e){ res.status(400).json({ error: String(e.message || e) }); }
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
  const etcPath = mkETCLogPath();
  writeETC(etcPath, { ts: Date.now(), event: "request", address, resolved: r, carrier_callback_status: "received", counts: { area_rules: Object.keys((cfg && cfg.area_overrides) || {}).length, free_addresses: (Array.isArray(cfg.free_addresses) ? cfg.free_addresses.length : 0) } });
  const pickupEnabled = !!(cfg && cfg.pickup_match_enabled !== false);
  const matchedFreeIndex = matchFreeAddress(cfg, address, r, "carrier", etcPath);
  const isFree = matchedFreeIndex >= 0;
  if (isFree) {
    const now = dayjs();
    const minDate = now.add(2, "day").toISOString();
    const maxDate = now.add(4, "day").toISOString();
    const response = { rates: [] };
    response.rates.push({ service_name: "ETC Shipping Fee", service_code: `ALTAYA_PICKUP_${matchedFreeIndex}`, total_price: "0", currency: "HKD", min_delivery_date: minDate, max_delivery_date: maxDate });
    res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma','no-cache');
    res.setHeader('Expires','0');
    writeETC(etcPath, { ts: Date.now(), event: "pickup-only", address, regionKey: norm(address.region || (r && r.region) || ""), districtKey: norm(address.city || (r && r.district) || ""), compositeKey: "", matchedKey: "" });
    return res.json(response);
  }
  const countryNorm = String(address.country || "").trim().toLowerCase();
  const isHongKong = countryNorm === "hk" || /hong\s*kong/.test(countryNorm) || /hksar/.test(countryNorm) || /hongkong/.test(countryNorm);
  if (!isHongKong) {
    return res.json({ rates: [] });
  }
  const items = Array.isArray(rateReq.items) ? rateReq.items : [];
  const subtotalCents = items.reduce((acc, it) => acc + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
  const itemCount = items.reduce((acc, it) => acc + Number(it.quantity || 1), 0);
  const totalWeightGrams = items.reduce((acc, it) => acc + (Number(it.grams || 0) * Number(it.quantity || 1)), 0);
  const subtotalHkd = subtotalCents / 100;
  let threshold = cfg.default_threshold_hkd || cfg.free_threshold_hkd || 0;
  let baseFee = cfg.default_fee_hkd || 0;
  const cityKey = norm(address.city);
  const rawRegion = pickRegion(address, r);
  const regionKey = norm(rawRegion);
  const countryKey = norm(address.country);
  const districtKey = norm(cityKey || (r && r.district) || "");
  const { area, matchedKey } = findAreaOverride(cfg, countryKey, regionKey, districtKey);
  const compositeKey = matchedKey;
  let selectedArea = area;
  
  
  if (selectedArea && selectedArea.active === false) selectedArea = undefined;
  if (selectedArea) {
    const nowDay = dayjs();
    if (typeof selectedArea.min_weight_grams === 'number' && totalWeightGrams < selectedArea.min_weight_grams) selectedArea = undefined;
    if (typeof selectedArea.max_weight_grams === 'number' && totalWeightGrams > selectedArea.max_weight_grams) selectedArea = undefined;
    if (typeof selectedArea.min_items === 'number' && itemCount < selectedArea.min_items) selectedArea = undefined;
    if (typeof selectedArea.max_items === 'number' && itemCount > selectedArea.max_items) selectedArea = undefined;
    if (typeof selectedArea.active_from === 'string' && selectedArea.active_from) {
      const from = dayjs(selectedArea.active_from);
      if (nowDay.isBefore(from, 'day')) selectedArea = undefined;
    }
    if (typeof selectedArea.active_to === 'string' && selectedArea.active_to) {
      const to = dayjs(selectedArea.active_to);
      if (nowDay.isAfter(to, 'day')) selectedArea = undefined;
    }
  }
  const now = dayjs();
  const minDate = now.add(2, "day").toISOString();
  const maxDate = now.add(4, "day").toISOString();
  // No area rule match → still return a paid shipping method to avoid empty rates
  if (!selectedArea) {
    const response = { rates: [] };
    res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma','no-cache');
    res.setHeader('Expires','0');
    const fbEnabled = !!(cfg && cfg.fallback_enabled);
    const fbConfigured = (cfg && typeof cfg.fallback_fee_hkd === 'number' && !Number.isNaN(cfg.fallback_fee_hkd)) ? cfg.fallback_fee_hkd : undefined;
    const baseDefault = (cfg && typeof cfg.default_fee_hkd === 'number' && !Number.isNaN(cfg.default_fee_hkd)) ? cfg.default_fee_hkd : 0;
    const fb = fbEnabled ? (typeof fbConfigured === 'number' ? fbConfigured : baseDefault) : baseDefault;
    const cents = Math.round(fb * 100);
    response.rates.push({ service_name: "ETC Shipping Fee", service_code: "ALTAYA_SHIPPING_DEFAULT", total_price: String(cents), currency: "HKD", min_delivery_date: minDate, max_delivery_date: maxDate });
    writeETC(etcPath, { ts: Date.now(), event: fbEnabled ? "fallback-fee" : "default-fee", address, regionKey, districtKey, compositeKey, matchedKey, fee_hkd: fb });
    return res.json(response);
  }
  let op = (selectedArea && typeof selectedArea.threshold_op === "string" && (selectedArea.threshold_op === "lt" || selectedArea.threshold_op === "ge")) ? selectedArea.threshold_op : "lt";
  const feeBase = (typeof selectedArea.fee_hkd === "number" && !Number.isNaN(selectedArea.fee_hkd)) ? selectedArea.fee_hkd : ((typeof cfg.default_fee_hkd === "number" && !Number.isNaN(cfg.default_fee_hkd)) ? cfg.default_fee_hkd : 0);
  let fee = 0;
  if (typeof selectedArea.threshold_hkd === "number" && !Number.isNaN(selectedArea.threshold_hkd)) {
    const applyFee = op === "lt" ? (subtotalHkd < selectedArea.threshold_hkd) : (subtotalHkd >= selectedArea.threshold_hkd);
    fee = applyFee ? feeBase : 0;
  } else {
    fee = feeBase;
  }
  const stdCents = Math.round((isFree ? 0 : fee) * 100);
  const response = { rates: [] };
  response.rates.push({ service_name: "ETC Shipping Fee", service_code: "ALTAYA_SHIPPING", total_price: String(stdCents), currency: "HKD", min_delivery_date: minDate, max_delivery_date: maxDate });
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma','no-cache');
  res.setHeader('Expires','0');
  writeETC(etcPath, { ts: Date.now(), event: "area-fee", address, regionKey, districtKey, compositeKey, matchedKey, fee_hkd: stdCents/100 });
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
  const etcPath = mkETCLogPath();
  writeETC(etcPath, { ts: Date.now(), event: "request-proxy", address, resolved: r, counts: { area_rules: Object.keys((cfg && cfg.area_overrides) || {}).length, free_addresses: (Array.isArray(cfg.free_addresses) ? cfg.free_addresses.length : 0) } });
  const pickupEnabled = !!(cfg && cfg.pickup_match_enabled !== false);
  const matchedFreeIndex = matchFreeAddress(cfg, address, r, "proxy", etcPath);
  const isFree = matchedFreeIndex >= 0;
  if (isFree) {
    const now = dayjs();
    const minDate = now.add(2, "day").toISOString();
    const maxDate = now.add(4, "day").toISOString();
    const response = { rates: [] };
    response.rates.push({ service_name: "ETC Shipping Fee", service_code: `ALTAYA_PICKUP_${matchedFreeIndex}`, total_price: "0", currency: "HKD", min_delivery_date: minDate, max_delivery_date: maxDate });
    res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma','no-cache');
    res.setHeader('Expires','0');
    return res.json(response);
  }
  const countryNorm = String(address.country || "").trim().toLowerCase();
  const isHongKong = countryNorm === "hk" || /hong\s*kong/.test(countryNorm) || /hksar/.test(countryNorm) || /hongkong/.test(countryNorm);
  if (!isHongKong) {
    return res.json({ rates: [] });
  }
  const items = Array.isArray(rateReq.items) ? rateReq.items : [];
  const subtotalCents = items.reduce((acc, it) => acc + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
  const itemCount = items.reduce((acc, it) => acc + Number(it.quantity || 1), 0);
  const totalWeightGrams = items.reduce((acc, it) => acc + (Number(it.grams || 0) * Number(it.quantity || 1)), 0);
  const subtotalHkd = subtotalCents / 100;
  let threshold = cfg.default_threshold_hkd || cfg.free_threshold_hkd || 0;
  let baseFee = cfg.default_fee_hkd || 0;
  const cityKey = norm(address.city);
  const rawRegion = pickRegion(address, r);
  const regionKey = norm(rawRegion);
  const countryKey = norm(address.country);
  const districtKey = norm(cityKey || (r && r.district) || "");
  const { area, matchedKey } = findAreaOverride(cfg, countryKey, regionKey, districtKey);
  const compositeKey = matchedKey;
  let selectedArea = area;
  
  if (selectedArea && selectedArea.active === false) selectedArea = undefined;
  if (selectedArea) {
    const nowDay = dayjs();
    if (typeof selectedArea.min_weight_grams === 'number' && totalWeightGrams < selectedArea.min_weight_grams) selectedArea = undefined;
    if (typeof selectedArea.max_weight_grams === 'number' && totalWeightGrams > selectedArea.max_weight_grams) selectedArea = undefined;
    if (typeof selectedArea.min_items === 'number' && itemCount < selectedArea.min_items) selectedArea = undefined;
    if (typeof selectedArea.max_items === 'number' && itemCount > selectedArea.max_items) selectedArea = undefined;
    if (typeof selectedArea.active_from === 'string' && selectedArea.active_from) {
      const from = dayjs(selectedArea.active_from);
      if (nowDay.isBefore(from, 'day')) selectedArea = undefined;
    }
    if (typeof selectedArea.active_to === 'string' && selectedArea.active_to) {
      const to = dayjs(selectedArea.active_to);
      if (nowDay.isAfter(to, 'day')) selectedArea = undefined;
    }
  }
  const now = dayjs();
  const minDate = now.add(2, "day").toISOString();
  const maxDate = now.add(4, "day").toISOString();
  if (!selectedArea) {
    const response = { rates: [] };
    res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma','no-cache');
    res.setHeader('Expires','0');
    const fbEnabled = !!(cfg && cfg.fallback_enabled);
    const fbConfigured = (cfg && typeof cfg.fallback_fee_hkd === 'number' && !Number.isNaN(cfg.fallback_fee_hkd)) ? cfg.fallback_fee_hkd : undefined;
    const baseDefault = (cfg && typeof cfg.default_fee_hkd === 'number' && !Number.isNaN(cfg.default_fee_hkd)) ? cfg.default_fee_hkd : 0;
    const fb = fbEnabled ? (typeof fbConfigured === 'number' ? fbConfigured : baseDefault) : baseDefault;
    const cents = Math.round(fb * 100);
    response.rates.push({ service_name: "ETC Shipping Fee", service_code: "ALTAYA_SHIPPING_DEFAULT", total_price: String(cents), currency: "HKD", min_delivery_date: minDate, max_delivery_date: maxDate });
    return res.json(response);
  }
  let op2 = (selectedArea && typeof selectedArea.threshold_op === "string" && (selectedArea.threshold_op === "lt" || selectedArea.threshold_op === "ge")) ? selectedArea.threshold_op : "lt";
  const feeBase2 = (typeof selectedArea.fee_hkd === "number" && !Number.isNaN(selectedArea.fee_hkd)) ? selectedArea.fee_hkd : ((typeof cfg.default_fee_hkd === "number" && !Number.isNaN(cfg.default_fee_hkd)) ? cfg.default_fee_hkd : 0);
  let fee2 = 0;
  if (typeof selectedArea.threshold_hkd === "number" && !Number.isNaN(selectedArea.threshold_hkd)) {
    const applyFee2 = op2 === "lt" ? (subtotalHkd < selectedArea.threshold_hkd) : (subtotalHkd >= selectedArea.threshold_hkd);
    fee2 = applyFee2 ? feeBase2 : 0;
  } else {
    fee2 = feeBase2;
  }
  const stdCents = Math.round((isFree ? 0 : fee2) * 100);
  const response = { rates: [] };
  response.rates.push({ service_name: "ETC Shipping Fee", service_code: "ALTAYA_SHIPPING", total_price: String(stdCents), currency: "HKD", min_delivery_date: minDate, max_delivery_date: maxDate });
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma','no-cache');
  res.setHeader('Expires','0');
  writeETC(etcPath, { ts: Date.now(), event: "area-fee-proxy", address, regionKey, districtKey, compositeKey, matchedKey, fee_hkd: stdCents/100 });
  res.json(response);
});

app.get("/config/rates/sanitized-index", (req, res) => {
  try{
    const cfg = loadRates();
    const idx = getAreaIndex(cfg);
    res.json({ index: idx });
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/carrier/diagnose", (req, res) => {
  const rateReq = req.body && req.body.rate ? req.body.rate : req.body;
  const dest = rateReq && rateReq.destination ? rateReq.destination : rateReq;
  const address = {
    country: (dest && dest.country) || "HK",
    province: (dest && dest.province) || "",
    city: (dest && dest.city) || "",
    region: (dest && dest.region) || ""
  };
  const countryNorm = String(address.country || "").trim().toLowerCase();
  if (countryNorm !== "hk") return res.json({ match: null, fee_hkd: 0, reason: "non-hk" });
  const r = resolveRegionAndDistrict(address);
  const cfg = loadRates();
  const items = Array.isArray(rateReq.items) ? rateReq.items : [];
  const subtotalCents = items.reduce((acc, it) => acc + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
  const subtotalHkd = subtotalCents / 100;
  const cityKeyNorm = norm(address.city);
  const regionKeyNorm = norm(pickRegion(address, r));
  const countryKeyNorm = norm(address.country);
  const districtKeyNorm = norm((r && r.district) || cityKeyNorm || "");
  const found = findAreaOverride(cfg, countryKeyNorm, regionKeyNorm, districtKeyNorm);
  let area = found.area;
  let matched = found.matchedKey;
  if (!area || area.active === false) return res.json({ match: null, fee_hkd: 0, reason: "no-active-rule" });
  let op = typeof area.threshold_op === "string" ? area.threshold_op : "lt";
  let fee = 0;
  if (typeof area.threshold_hkd === "number") {
    const applyFee = op === "lt" ? subtotalHkd < area.threshold_hkd : subtotalHkd >= area.threshold_hkd;
    fee = applyFee ? (typeof area.fee_hkd === "number" ? area.fee_hkd : 0) : 0;
  } else {
    fee = typeof area.fee_hkd === "number" ? area.fee_hkd : 0;
  }
  const region_sanitized = `${sanitizeKey(countryKeyNorm)}/${sanitizeKey(regionKeyNorm)}`;
  const district_sanitized = `${sanitizeKey(countryKeyNorm)}/${sanitizeKey(regionKeyNorm)}/${sanitizeKey(districtKeyNorm)}`;
  const idx = getAreaIndex(cfg);
  const matched_sanitized = matched ? (idx.composite[district_sanitized] ? district_sanitized : (idx.region[region_sanitized] ? region_sanitized : "")) : "";
  res.json({ match: matched, matched_sanitized, region: regionKeyNorm, region_sanitized, district: districtKeyNorm, district_sanitized, subtotal_hkd: subtotalHkd, op, threshold_hkd: area.threshold_hkd || null, fee_hkd: fee });
});

app.post("/carrier/pickup-diagnose", (req, res) => {
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
  const etcPath = mkETCLogPath();
  const idx = matchFreeAddress(cfg, address, r, "pickup-diagnose", etcPath);
  const regionKey = norm(address.region || (r && r.region) || "");
  const districtKey = norm(address.city || (r && r.district) || "");
  const fa = Array.isArray(cfg.free_addresses) ? cfg.free_addresses : [];
  const matched = idx >= 0 ? (fa[idx] || null) : null;
  res.json({ matched_index: idx, region: regionKey, district: districtKey, matched_detail: matched ? { location_name: matched.location_name||'', address1: matched.address1||'', city: matched.city||matched.district||'', region: matched.region||'', locked: !!matched.locked } : null });
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

app.get("/logs/list", (req, res) => {
  try{
    const dir = __dirname;
    const names = fs.readdirSync(dir).filter(f => /^ETC_\d{8}_\d{6}\.log$/.test(f)).sort().reverse();
    res.json({ files: names });
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/logs/latest", (req, res) => {
  try{
    const dir = __dirname;
    const names = fs.readdirSync(dir).filter(f => /^ETC_\d{8}_\d{6}\.log$/.test(f)).sort().reverse();
    if (names.length === 0) return res.json({ file: null, entries: [] });
    const latest = names[0];
    const raw = fs.readFileSync(path.join(dir, latest), "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const entries = [];
    for (const l of lines.slice(-200)) {
      try{ entries.push(JSON.parse(l)); }catch(_){ entries.push({ raw: l }); }
    }
    res.json({ file: latest, entries });
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/logs/read", (req, res) => {
  try{
    const name = String(req.query.file || "").trim();
    if (!/^ETC_\d{8}_\d{6}\.log$/.test(name)) return res.status(400).json({ error: "invalid file" });
    const p = path.join(__dirname, name);
    if (!fs.existsSync(p)) return res.status(404).json({ error: "not found" });
    const raw = fs.readFileSync(p, "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const entries = [];
    for (const l of lines) {
      try{ entries.push(JSON.parse(l)); }catch(_){ entries.push({ raw: l }); }
    }
    res.json({ file: name, entries });
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/apps/vks-shipping-rate", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin.html"));
});

app.get("/apps/vks-shipping-rate/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin.html"));
});

app.get("/apps/altaya-shipping-rate", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin.html"));
});

app.get("/apps/altaya-shipping-rate/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin.html"));
});
app.get("/apps/altaya-shipping-rates", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin.html"));
});
app.get("/apps/altaya-shipping-rates/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin.html"));
});
app.get("/apps/altaya-shipping-rate/pickup", (req, res) => {
  res.redirect("/apps/altaya-shipping-rates");
});
app.get("/apps/altaya-shipping-rate/shopify-tools", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/shopify-tools.html"));
});

app.get("/proxy/pickup/list", (req, res) => {
  try{
    const cfg = loadRates();
    const list = Array.isArray(cfg.free_addresses) ? cfg.free_addresses : [];
    res.json({ list });
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});

function mkETCLogPath(){
  const ts = dayjs().format("YYYYMMDD_HHmmss");
  return path.join(__dirname, `ETC_${ts}.log`);
}
function writeETC(etcPath, payload){
  try{ fs.appendFileSync(etcPath, JSON.stringify(payload)+"\n"); }catch(_){}
}

function selectedAddressPath(){
  return path.join(__dirname, "selectedAddress.json");
}
app.get("/proxy/pickup/selected", (req, res) => {
  try{
    if (!fs.existsSync(selectedAddressPath())) return res.json({ destination: null });
    const raw = fs.readFileSync(selectedAddressPath(), "utf8");
    const obj = JSON.parse(raw);
    res.json(obj);
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});
app.post("/proxy/pickup/select", (req, res) => {
  try{
    const dest = req.body && req.body.destination ? req.body.destination : req.body;
    const obj = { destination: {
      country: String((dest && dest.country) || ""),
      province: String((dest && dest.province) || ""),
      region: String((dest && dest.region) || ""),
      city: String((dest && dest.city) || ""),
      address1: String((dest && dest.address1) || ""),
      address2: String((dest && dest.address2) || "")
    } };
    fs.writeFileSync(selectedAddressPath(), JSON.stringify(obj, null, 2));
    res.json({ ok: true });
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/proxy/pickup/script.js", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/pickup-proxy.js"));
});

function tokensPath(){
  return path.join(__dirname, "shopifyTokens.json");
}
function loadTokens(){
  try{
    const raw = fs.readFileSync(tokensPath(), "utf8");
    return JSON.parse(raw);
  }catch(e){
    return {};
  }
}
function saveToken(shop, token){
  const t = loadTokens();
  const key = String(shop||"").toLowerCase();
  const cur = t[key];
  const obj = (cur && typeof cur === "object") ? cur : { token: typeof cur === "string" ? cur : "" };
  obj.token = token;
  t[key] = obj;
  fs.writeFileSync(tokensPath(), JSON.stringify(t, null, 2));
}
function saveShopSettings(shop, fields){
  const t = loadTokens();
  const key = String(shop||"").toLowerCase();
  const cur = t[key];
  const obj = (cur && typeof cur === "object") ? cur : { token: typeof cur === "string" ? cur : "" };
  if (fields && typeof fields.callback_url === "string") obj.callback_url = fields.callback_url;
  if (typeof fields.service_discovery !== "undefined") obj.service_discovery = !!fields.service_discovery;
  t[key] = obj;
  fs.writeFileSync(tokensPath(), JSON.stringify(t, null, 2));
}
function clearTokens(){
  fs.writeFileSync(tokensPath(), JSON.stringify({}, null, 2));
}
function deleteToken(shop){
  const t = loadTokens();
  delete t[String(shop||"").toLowerCase()];
  fs.writeFileSync(tokensPath(), JSON.stringify(t, null, 2));
}

app.get("/shopify/auth", (req, res) => {
  const shop = String(req.query.shop || "").trim().toLowerCase();
  const key = String(process.env.SHOPIFY_API_KEY || "").trim();
  const scopes = String(process.env.SHOPIFY_APP_SCOPES || "write_shipping").trim();
  if (!shop || !/\.myshopify\.com$/.test(shop)) return res.status(400).json({ error: "invalid shop" });
  if (!key) return res.status(500).json({ error: "missing api key" });
  const host = req.get("host");
  const redirectUri = `https://${host}/shopify/callback`;
  const state = crypto.randomBytes(16).toString("hex");
  const url = `https://${shop}/admin/oauth/authorize?client_id=${encodeURIComponent(key)}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
  res.redirect(url);
});

app.get("/shopify/callback", async (req, res) => {
  try{
    const shop = String(req.query.shop || "").trim().toLowerCase();
    const code = String(req.query.code || "");
    const hmac = String(req.query.hmac || "");
    const secret = String(process.env.SHOPIFY_API_SECRET || "").trim();
    if (!shop || !code || !secret) return res.status(400).json({ error: "invalid callback" });
    const params = { ...req.query };
    delete params["hmac"];
    const message = Object.keys(params).sort().map(k=>`${k}=${params[k]}`).join("&");
    const digest = crypto.createHmac("sha256", secret).update(message).digest("hex");
    if (digest !== hmac) return res.status(400).json({ error: "bad hmac" });
    const resp = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: process.env.SHOPIFY_API_KEY, client_secret: secret, code })
    });
    const json = await resp.json();
    const token = json && json.access_token ? json.access_token : "";
    if (!token) return res.status(500).json({ error: "token exchange failed", detail: json });
    saveToken(shop, token);
    res.json({ ok: true, shop, access_token: token });
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/shopify/register-carrier", async (req, res) => {
  try{
    const shop = String((req.body && req.body.shop) || "").trim().toLowerCase();
    const tokens = loadTokens();
    const token = tokens[shop];
    if (!shop || !token) return res.status(400).json({ error: "missing shop or token" });
    const host = req.get("host");
    const callbackUrl = `https://${host}/carrier/rates`;
    const name = String((req.body && req.body.name) || "Altaya Shipping Rate");
    const body = { carrier_service: { name, callback_url: callbackUrl, service_discovery: false } };
    const u = `https://${shop}/admin/api/2025-01/carrier_services.json`;
    const r = await fetch(u, { method: "POST", headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    res.status(r.status).json(j);
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/shopify/carriers", async (req, res) => {
  try{
    const shop = String(req.query.shop || "").trim().toLowerCase();
    const tokens = loadTokens();
    const token = tokens[shop];
    if (!shop || !token) return res.status(400).json({ error: "missing shop or token" });
    const u = `https://${shop}/admin/api/2025-01/carrier_services.json`;
    const r = await fetch(u, { method: "GET", headers: { "X-Shopify-Access-Token": token } });
    const j = await r.json();
    res.status(r.status).json(j);
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/shopify/update-carrier-callback", async (req, res) => {
  try{
    const shop = String((req.body && req.body.shop) || "").trim().toLowerCase();
    const targetId = String((req.body && req.body.id) || "").trim();
    const targetName = String((req.body && req.body.name) || "").trim();
    const tokens = loadTokens();
    const token = tokens[shop];
    if (!shop || !token) return res.status(400).json({ error: "missing shop or token" });
    const host = req.get("host");
    const callbackUrl = `https://${host}/carrier/rates`;
    const listU = `https://${shop}/admin/api/2025-01/carrier_services.json`;
    const listR = await fetch(listU, { method: "GET", headers: { "X-Shopify-Access-Token": token } });
    const listJ = await listR.json();
    const arr = (listJ && Array.isArray(listJ.carrier_services)) ? listJ.carrier_services : [];
    let svc = null;
    if (targetId) svc = arr.find(x => String(x.id) === targetId) || null;
    if (!svc && targetName) svc = arr.find(x => String(x.name || "").toLowerCase() === targetName.toLowerCase()) || null;
    if (!svc) svc = arr.find(x => /altaya/i.test(String(x.name||""))) || arr[0] || null;
    if (!svc) return res.status(404).json({ error: "carrier not found" });
    const updU = `https://${shop}/admin/api/2025-01/carrier_services/${svc.id}.json`;
    const body = { carrier_service: { id: svc.id, callback_url: callbackUrl, service_discovery: false } };
    const updR = await fetch(updU, { method: "PUT", headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const updJ = await updR.json();
    res.status(updR.status).json(updJ);
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/shopify/register-carrier-q", async (req, res) => {
  try{
    const shop = String(req.query.shop || "").trim().toLowerCase();
    const tokens = loadTokens();
    const token = tokens[shop];
    if (!shop || !token) return res.status(400).json({ error: "missing shop or token" });
    const host = req.get("host");
    const callbackUrl = `https://${host}/carrier/rates`;
    const name = String(req.query.name || "Altaya Shipping Rate");
    const body = { carrier_service: { name, callback_url: callbackUrl, service_discovery: false } };
    const u = `https://${shop}/admin/api/2025-01/carrier_services.json`;
    const r = await fetch(u, { method: "POST", headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    res.status(r.status).json(j);
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/shopify/register-webhooks", async (req, res) => {
  try{ return res.status(403).json({ error: "webhooks-disabled" });
    const shop = String((req.body && req.body.shop) || "").trim().toLowerCase();
    const tokens = loadTokens();
    const token = tokens[shop];
    if (!shop || !token) return res.status(400).json({ error: "missing shop or token" });
    const host = req.get("host");
    const address = `https://${host}/shopify/webhook/orders-create`;
    const body = { webhook: { topic: "orders/create", address, format: "json" } };
    const u = `https://${shop}/admin/api/2025-01/webhooks.json`;
    const r = await fetch(u, { method: "POST", headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    res.status(r.status).json(j);
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/shopify/webhook/orders-create", express.raw({ type: "application/json" }), async (req, res) => {
  try{ return res.status(403).send("webhook-disabled");
    const shop = String(req.get("X-Shopify-Shop-Domain") || "").trim().toLowerCase();
    const hmacHeader = String(req.get("X-Shopify-Hmac-SHA256") || "").trim();
    const secret = String(process.env.SHOPIFY_API_SECRET || "").trim();
    const raw = req.body;
    const digest = crypto.createHmac("sha256", secret).update(raw).digest("base64");
    if (!secret || digest !== hmacHeader) return res.status(401).send("unauthorized");
    const order = JSON.parse(raw.toString("utf8"));
    const sl = Array.isArray(order.shipping_lines) ? order.shipping_lines : [];
    const pickup = sl.find(l => String(l.code || "").startsWith("ALTAYA_PICKUP_") || String(l.title || "").startsWith("ETC Pickup - ") || String(l.title || "").startsWith("Altaya Pickup - "));
    if (!pickup) {
      try{ fs.appendFileSync(path.join(__dirname, "shopifyWebhook.log"), JSON.stringify({ shop, order_id: order.id, status: "no-pickup" })+"\n"); }catch(e){}
      return res.json({ ok: true, updated: false });
    }
    let idx = -1;
    const m = String(pickup.code || "").match(/ALTAYA_PICKUP_(\d+)/);
    if (m) idx = parseInt(m[1], 10);
    const cfg = loadRates();
    const fa = Array.isArray(cfg.free_addresses) ? cfg.free_addresses : [];
    let entry = fa[idx] || null;
    if (!entry) {
      const t = String(pickup.title || "").toLowerCase();
      const j = fa.find(x => t.includes(String(x.location_name || x.shop_name || "").toLowerCase()));
      if (j) entry = j;
    }
    if (!entry) {
      try{ fs.appendFileSync(path.join(__dirname, "shopifyWebhook.log"), JSON.stringify({ shop, order_id: order.id, status: "pickup-not-found", pickup })+"\n"); }catch(e){}
      return res.json({ ok: true, updated: false });
    }
    const dest = { order: { shipping_address: { first_name: "Pickup", last_name: "Location", address1: String(entry.address1 || ""), address2: "", city: String(entry.city || entry.district || ""), province: String(entry.region || ""), country: "HK", zip: "" } } };
    const tokens = loadTokens();
    const token = tokens[shop];
    if (!token) return res.status(400).json({ error: "missing token" });
    const u = `https://${shop}/admin/api/2025-01/orders/${order.id}.json`;
    const r = await fetch(u, { method: "PUT", headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" }, body: JSON.stringify(dest) });
    const j = await r.json();
    try{ fs.appendFileSync(path.join(__dirname, "shopifyWebhook.log"), JSON.stringify({ shop, order_id: order.id, status: r.status, ok: r.ok, response: j })+"\n"); }catch(e){}
    res.status(r.status).json({ ok: r.ok, updated: r.ok, detail: j });
  }catch(e){
    try{ fs.appendFileSync(path.join(__dirname, "shopifyWebhook.log"), JSON.stringify({ status: "error", error: String(e.message || e) })+"\n"); }catch(_){}
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/shopify/store-token", (req, res) => {
  try{
    const shop = String((req.body && req.body.shop) || "").trim().toLowerCase();
    const token = String((req.body && req.body.token) || "").trim();
    if (!shop || !/\.myshopify\.com$/.test(shop)) return res.status(400).json({ error: "invalid shop" });
    if (!token) return res.status(400).json({ error: "missing token" });
    saveToken(shop, token);
    const cb = String((req.body && req.body.callback_url) || "").trim();
    const sdRaw = (req.body && req.body.service_discovery);
    const sd = typeof sdRaw !== "undefined" ? !!sdRaw : undefined;
    if (cb || typeof sd !== "undefined") saveShopSettings(shop, { callback_url: cb, service_discovery: sd });
    res.json({ ok: true, shop });
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/shopify/store-token-q", (req, res) => {
  try{
    const shop = String(req.query.shop || "").trim().toLowerCase();
    const token = String(req.query.token || "").trim();
    if (!shop || !/\.myshopify\.com$/.test(shop)) return res.status(400).json({ error: "invalid shop" });
    if (!token) return res.status(400).json({ error: "missing token" });
    saveToken(shop, token);
    res.json({ ok: true, shop });
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});

function maskedTokens(){
  const t = loadTokens();
  const out = [];
  for (const shop of Object.keys(t)) {
    const val = t[shop];
    const tok = typeof val === "object" ? String(val.token || "") : String(val || "");
    const mask = tok ? (tok.slice(0, 6) + "…" + tok.slice(-4)) : "";
    const cb = typeof val === "object" ? String(val.callback_url || "") : "";
    const sd = typeof val === "object" ? !!val.service_discovery : false;
    out.push({ shop, token_masked: mask, callback_url: cb, service_discovery: sd });
  }
  return out;
}
app.get("/shopify/tokens", (req, res) => {
  try{
    res.json({ list: maskedTokens() });
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});
app.post("/shopify/tokens-clear", (req, res) => {
  try{
    clearTokens();
    res.json({ ok: true });
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});
app.post("/shopify/token-delete", (req, res) => {
  try{
    const shop = String((req.body && req.body.shop) || "").trim().toLowerCase();
    if (!shop) return res.status(400).json({ error: "missing shop" });
    deleteToken(shop);
    res.json({ ok: true, shop });
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/shopify/store-settings", (req, res) => {
  try{
    const shop = String((req.body && req.body.shop) || "").trim().toLowerCase();
    const cb = String((req.body && req.body.callback_url) || "").trim();
    const sdRaw = (req.body && req.body.service_discovery);
    const sd = typeof sdRaw !== "undefined" ? !!sdRaw : undefined;
    if (!shop || !/\.myshopify\.com$/.test(shop)) return res.status(400).json({ error: "invalid shop" });
    saveShopSettings(shop, { callback_url: cb, service_discovery: sd });
    res.json({ ok: true, shop });
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/config/rates/sanitized", (req, res) => {
  try{
    const cfg = loadRates();
    const table = (cfg && cfg.area_overrides) || {};
    const list = Object.keys(table).map(k => {
      const area = table[k] || {};
      const parts = String(k).split("/");
      const country = parts[0] || "";
      const region = parts[1] || "";
      const district = parts[2] || "";
      const sanitized = `${sanitizeKey(country)}/${sanitizeKey(region)}/${sanitizeKey(district)}`;
      return {
        key: k,
        sanitized,
        scope: area.scope || "district",
        active: !!area.active,
        threshold_hkd: typeof area.threshold_hkd === 'number' ? area.threshold_hkd : null,
        threshold_op: typeof area.threshold_op === 'string' ? area.threshold_op : 'lt',
        fee_hkd: typeof area.fee_hkd === 'number' ? area.fee_hkd : 0
      };
    });
    res.json({ list });
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/config/rates/reset", (req, res) => {
  try{
    const confirm = !!(req.body && req.body.confirm === true);
    if (!confirm) return res.status(403).json({ error: "confirmation required" });
    const before = loadRates();
    const ts = dayjs().format("YYYYMMDD_HHmmss");
    const backupFile = path.join(__dirname, `ratesConfig.backup_${ts}.json`);
    try{ fs.writeFileSync(backupFile, JSON.stringify(before, null, 2)); }catch(_){ }
    const cfg = { ...before, area_overrides: {} };
    const out = saveRates(cfg);
    res.json({ ok: true, area_rules_count: Object.keys(out.area_overrides || {}).length, backup: path.basename(backupFile) });
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/shopify/carrier-delete", async (req, res) => {
  try{
    const shop = String((req.body && req.body.shop) || "").trim().toLowerCase();
    const targetId = String((req.body && req.body.id) || "").trim();
    const targetName = String((req.body && req.body.name) || "").trim();
    const tokens = loadTokens();
    const token = tokens[shop];
    if (!shop || !token) return res.status(400).json({ error: "missing shop or token" });
    const listU = `https://${shop}/admin/api/2025-01/carrier_services.json`;
    const listR = await fetch(listU, { method: "GET", headers: { "X-Shopify-Access-Token": token } });
    const listJ = await listR.json();
    const arr = (listJ && Array.isArray(listJ.carrier_services)) ? listJ.carrier_services : [];
    let svc = null;
    if (targetId) svc = arr.find(x => String(x.id) === targetId) || null;
    if (!svc && targetName) svc = arr.find(x => String(x.name || "").toLowerCase() === targetName.toLowerCase()) || null;
    if (!svc) svc = arr.find(x => /altaya|etc|shipping/i.test(String(x.name||""))) || arr[0] || null;
    if (!svc) return res.status(404).json({ error: "carrier not found" });
    const delU = `https://${shop}/admin/api/2025-01/carrier_services/${svc.id}.json`;
    const delR = await fetch(delU, { method: "DELETE", headers: { "X-Shopify-Access-Token": token } });
    if (!delR.ok) {
      let errJ = {};
      try{ errJ = await delR.json(); }catch(_){ }
      return res.status(delR.status).json(errJ);
    }
    res.json({ ok: true, deleted_id: String(svc.id) });
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/shopify/carrier-update", async (req, res) => {
  try{
    const shop = String((req.body && req.body.shop) || "").trim().toLowerCase();
    const serviceDiscovery = (typeof (req.body && req.body.service_discovery) !== 'undefined') ? !!req.body.service_discovery : undefined;
    const callbackUrl = String((req.body && req.body.callback_url) || "").trim();
    const targetId = String((req.body && req.body.id) || "").trim();
    const targetName = String((req.body && req.body.name) || "").trim();
    const tokens = loadTokens();
    const token = tokens[shop];
    if (!shop || !token) return res.status(400).json({ error: "missing shop or token" });
    const listU = `https://${shop}/admin/api/2025-01/carrier_services.json`;
    const listR = await fetch(listU, { method: "GET", headers: { "X-Shopify-Access-Token": token } });
    const listJ = await listR.json();
    const arr = (listJ && Array.isArray(listJ.carrier_services)) ? listJ.carrier_services : [];
    let svc = null;
    if (targetId) svc = arr.find(x => String(x.id) === targetId) || null;
    if (!svc && targetName) svc = arr.find(x => String(x.name || "").toLowerCase() === targetName.toLowerCase()) || null;
    if (!svc) svc = arr.find(x => /altaya|etc|shipping/i.test(String(x.name||""))) || arr[0] || null;
    if (!svc) return res.status(404).json({ error: "carrier not found" });
    const updU = `https://${shop}/admin/api/2025-01/carrier_services/${svc.id}.json`;
    const body = { carrier_service: {} };
    body.carrier_service.service_discovery = (typeof serviceDiscovery !== 'undefined') ? serviceDiscovery : false;
    if (callbackUrl) body.carrier_service.callback_url = callbackUrl;
    const updR = await fetch(updU, { method: "PUT", headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const updJ = await updR.json();
    if (!updR.ok) return res.status(updR.status).json(updJ);
    res.json({ ok: true, carrier: updJ.carrier_service });
  }catch(e){
    res.status(500).json({ error: String(e.message || e) });
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
function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function sanitizeKey(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeRegionName(s) {
  const n = norm(s);
  if (!n) return "";
  if (n === "nt" || n === "newterritories") return "new territories";
  if (n === "kln" || n === "kl") return "kowloon";
  if (n === "hongkongisland" || n === "hkisland" || n === "hk island" || n === "hki") return "hong kong island";
  return n;
}

function getAreaIndex(cfg) {
  try{
    const table = (cfg && cfg.area_overrides) || {};
    const comp = {}, reg = {};
    for (const k of Object.keys(table)) {
      const parts = String(k).split("/");
      const cSan = sanitizeKey(norm(parts[0] || "hk"));
      const rSan = sanitizeKey(norm(parts[1] || ""));
      const dSan = sanitizeKey(norm(parts[2] || ""));
      const compKey = `${cSan}/${rSan}/${dSan}`;
      const regKey = `${cSan}/${rSan}`;
      comp[compKey] = k;
      reg[regKey] = `${parts[0] || "hk"}/${parts[1] || ""}`;
    }
    const idx = { composite: comp, region: reg };
    // do not cache inside cfg to avoid stale sanitized index after config edits
    return idx;
  }catch(_){ return { composite: {}, region: {} }; }
}

function inferRegionFromCity(cfg, districtString) {
  try{
    const idx = getAreaIndex(cfg);
    const dSan = sanitizeKey(norm(districtString || ""));
    if (!dSan) return "";
    for (const compKey of Object.keys(idx.composite)) {
      const parts = compKey.split("/");
      const rSan = parts[1] || "";
      const d = parts[2] || "";
      if (d === dSan) {
        const mapped = idx.region[`hk/${rSan}`] || "";
        return norm(mapped.split("/")[1] || "");
      }
    }
    return "";
  }catch(_){ return ""; }
}

function findAreaOverride(cfg, countryKey, regionKey, districtKey) {
  const table = (cfg && cfg.area_overrides) || {};
  const cNorm = norm(countryKey || "hk");
  const rNorm = norm(regionKey || "");
  const dNorm = norm(districtKey || "");
  const compositeNorm = `${cNorm}/${rNorm}/${dNorm}`;
  const regionOnlyNorm = `${cNorm}/${rNorm}`;
  const idx = getAreaIndex(cfg);
  const compSanKey = `${sanitizeKey(cNorm)}/${sanitizeKey(rNorm)}/${sanitizeKey(dNorm)}`;
  const regSanKey = `${sanitizeKey(cNorm)}/${sanitizeKey(rNorm)}`;
  let area = undefined;
  let matchedKey = compSanKey;
  const mappedComp = idx.composite[compSanKey];
  if (mappedComp) { area = table[mappedComp]; matchedKey = mappedComp; }
  if (!area) {
    const mappedReg = idx.region[regSanKey];
    if (mappedReg) { area = table[mappedReg]; matchedKey = mappedReg; }
  }
  if (!area) { area = table[compositeNorm]; matchedKey = compositeNorm; }
  if (!area) { area = table[regionOnlyNorm]; matchedKey = regionOnlyNorm; }
  return { area, matchedKey };
}

function pickRegion(address, r) {
  const aReg = normalizeRegionName(address.region || "");
  const aProv = normalizeRegionName(address.province || "");
  const rReg = normalizeRegionName((r && r.region) || "");
  const generic = new Set(["hk","hong kong","hong kong sar","sar","china","hksar"]);
  if (aReg && !generic.has(aReg)) return aReg;
  if (aProv && !generic.has(aProv)) return aProv;
  if (rReg && !generic.has(rReg)) return rReg;
  const dRaw = String(address.city || (r && r.district) || "");
  const inferredRaw = typeof regionForDistrict === 'function' ? String(regionForDistrict(dRaw) || "") : "";
  let inferred = norm(inferredRaw);
  if (inferred && !generic.has(inferred)) return inferred;
  inferred = inferRegionFromCity(loadRates(), dRaw);
  if (inferred && !generic.has(inferred)) return inferred;
  return rReg || aReg || aProv;
}

function tokenSet(s) {
  const t = norm(s).split(" ").filter(Boolean);
  const set = new Set();
  for (const w of t) set.add(w);
  return set;
}

function overlapRatio(a, b) {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  const denom = Math.max(A.size, B.size);
  return denom > 0 ? inter / denom : 0;
}

function containsTokens(dest, src) {
  const D = tokenSet(dest);
  const S = tokenSet(src);
  if (S.size === 0) return false;
  for (const w of S) { if (!D.has(w)) return false; }
  return true;
}

function isFreeAddress(cfg, address, r) {
  const list = Array.isArray(cfg.free_addresses) ? cfg.free_addresses : [];
  const regionKey = norm(pickRegion(address, r));
  const districtKey = norm(address.city || (r && r.district) || "");
  const destCombined = norm(`${address.address1 || ""} ${address.address2 || ""}`);
  for (const e of list) {
    const er = norm(e.region || "");
    const ed = norm(e.city || e.district || "");
    const loc = norm(e.location_name || "");
    const addr = norm(e.address1 || "");
    if (er === regionKey && ed === districtKey && (destCombined.includes(addr) || destCombined.includes(loc))) return true;
  }
  return false;
}

function matchFreeAddress(cfg, address, r, debugTag, etcPath) {
  const list = Array.isArray(cfg.free_addresses) ? cfg.free_addresses : [];
  const regionKey = norm(pickRegion(address, r));
  const districtKey = norm(address.city || (r && r.district) || "");
  const addrCombined = norm(`${address.address1 || ""} ${address.address2 || ""}`);
  let bestIdx = -1;
  const scores = [];
  for (let i = 0; i < list.length; i++) {
    const e = list[i] || {};
    const er = norm(e.region || "");
    const ed = norm(e.city || e.district || "");
    const loc = norm(e.location_name || "");
    const addr = norm(e.address1 || "");
    const regionOk = er === regionKey;
    const districtOk = ed === districtKey;
    const locOk = containsTokens(addrCombined, loc);
    const addrOk = containsTokens(addrCombined, addr);
    const nameStreetOk = locOk && addrOk;
    const score = (regionOk && districtOk && (addrOk || locOk)) || ((!regionKey || !districtKey) && nameStreetOk) ? 1 : 0;
    scores.push({ index: i, score, regionOk, districtOk, locOk, addrOk, entry: { country: e.country, region: e.region, city: e.city || e.district, location_name: e.location_name, address1: e.address1 } });
    if (score === 1) { bestIdx = i; break; }
  }
  const p = etcPath || path.join(__dirname, "carrier.log");
  writeETC(p, { ts: Date.now(), event: "pickup-eval", tag: debugTag || "", address, regionKey, districtKey, scores });
  return bestIdx;
}
