import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { z } from "zod";

const RegionEnum = z.enum(["hong kong island", "kowloon", "new territories"]);
const ExpressSchema = z.object({
  type: z.enum(["multiplier", "fixed"]).default("multiplier"),
  value: z.number().nonnegative().default(1.5),
  free_when_standard_free: z.boolean().default(true)
});

const AreaOverrideSchema = z.object({
  scope: z.enum(["district", "region"]).default("district"),
  active: z.boolean().default(true),
  threshold_hkd: z.number().nonnegative().optional(),
  threshold_op: z.enum(["lt", "ge"]).default("lt"),
  fee_hkd: z.number().nonnegative().optional(),
  min_weight_grams: z.number().nonnegative().optional(),
  max_weight_grams: z.number().nonnegative().optional(),
  active_from: z.string().optional(),
  active_to: z.string().optional(),
  min_items: z.number().nonnegative().optional(),
  max_items: z.number().nonnegative().optional(),
  express: ExpressSchema.optional()
});

const FreeAddressSchema = z.object({
  country: z.string().optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  location_name: z.string().optional(),
  shop_name: z.string().optional(),
  address1: z.string().optional()
});

const RatesSchema = z.object({
  base: z.record(RegionEnum, z.number().nonnegative()).default({}),
  district: z.record(z.string(), z.number().nonnegative()).default({}),
  free_threshold_hkd: z.number().nonnegative().default(0),
  default_threshold_hkd: z.number().nonnegative().default(0),
  default_fee_hkd: z.number().nonnegative().default(0),
  default_threshold_op: z.enum(["lt", "ge"]).default("lt"),
  fallback_enabled: z.boolean().default(false),
  fallback_fee_hkd: z.number().nonnegative().default(0),
  service_standard_name: z.string().default("VKS Standard"),
  service_express_name: z.string().default("VKS Express"),
  currency: z.string().default("HKD"),
  express: ExpressSchema.default({ type: "multiplier", value: 1.5, free_when_standard_free: true }),
  area_overrides: z.record(z.string(), AreaOverrideSchema).default({}),
  free_addresses: z.array(FreeAddressSchema).default([])
});

function configPath() {
  return resolve("src", "ratesConfig.json");
}

function loadRates() {
  const raw = readFileSync(configPath(), "utf-8");
  const parsed = JSON.parse(raw);
  const v = RatesSchema.parse(parsed);
  return v;
}

function saveRates(data) {
  const v = RatesSchema.parse(data);
  writeFileSync(configPath(), JSON.stringify(v, null, 2));
  return v;
}

export { RatesSchema, loadRates, saveRates };
