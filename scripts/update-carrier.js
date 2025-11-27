import https from "https";

const shop = process.env.SHOPIFY_SHOP;
const token = process.env.SHOPIFY_ACCESS_TOKEN;
const apiVersion = process.env.SHOPIFY_API_VERSION || "2025-10";
const newUrl = process.env.NEW_CALLBACK_URL;
const newName = process.env.NEW_NAME;

if (!shop || !token || !newUrl) {
  console.error("Missing env: SHOPIFY_SHOP, SHOPIFY_ACCESS_TOKEN, NEW_CALLBACK_URL");
  process.exit(1);
}

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: `${shop}.myshopify.com`, path, method: "GET", headers },
      res => {
        let data = "";
        res.on("data", c => (data += c));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data));
          else reject(new Error(`GET ${path} ${res.statusCode} ${data}`));
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function put(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: `${shop}.myshopify.com`, path, method: "PUT", headers },
      res => {
        let data = "";
        res.on("data", c => (data += c));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data));
          else reject(new Error(`PUT ${path} ${res.statusCode} ${data}`));
        });
      }
    );
    req.on("error", reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const headers = { "Content-Type": "application/json", "X-Shopify-Access-Token": token };
  const list = await get(`/admin/api/${apiVersion}/carrier_services.json`, headers);
  const match = process.env.NEW_MATCH_NAME || "VKS Shipping Rates";
  const svc = (list.carrier_services || []).find(s => s.name === match || s.name === "VKS Shipping Rate");
  if (!svc) throw new Error("VKS Shipping Rate not found");
  const id = svc.id;
  const payload = { carrier_service: { id, name: newName || svc.name, callback_url: newUrl || svc.callback_url, service_discovery: false } };
  const updated = await put(`/admin/api/${apiVersion}/carrier_services/${id}.json`, payload, headers);
  console.log(JSON.stringify(updated));
}

main().catch(e => { console.error(e.stack || e.message || e); process.exit(1); });
