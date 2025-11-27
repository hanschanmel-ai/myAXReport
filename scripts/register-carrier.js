import https from "https";

const shop = process.env.SHOPIFY_SHOP;
const token = process.env.SHOPIFY_ACCESS_TOKEN;
const callbackUrl = process.env.CALLBACK_URL || "https://example.com/carrier/rates";
const apiVersion = process.env.SHOPIFY_API_VERSION || "2025-10";

if (!shop || !token) {
  console.error("Missing SHOPIFY_SHOP or SHOPIFY_ACCESS_TOKEN env");
  process.exit(1);
}

const body = JSON.stringify({
  carrier_service: {
    name: "VKS Shipping Rates",
    callback_url: callbackUrl,
    service_discovery: false
  }
});

const req = https.request(
  {
    hostname: `${shop}.myshopify.com`,
    path: `/admin/api/${apiVersion}/carrier_services.json`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token
    }
  },
  res => {
    let data = "";
    res.on("data", c => (data += c));
    res.on("end", () => {
      console.log(res.statusCode, data);
    });
  }
);

req.on("error", err => {
  console.error(err);
  process.exit(1);
});

req.write(body);
req.end();
