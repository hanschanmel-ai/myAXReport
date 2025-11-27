import http from "http";

const payload = {
  region: "New Territories",
  district: "Yuen Long",
  currency: "HKD"
};

function send() {
  const req = http.request(
    {
      hostname: "localhost",
      port: process.env.PORT || 3000,
      path: "/storefront/fee",
      method: "POST",
      headers: { "Content-Type": "application/json" }
    },
    res => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => {
        console.log(data);
      });
    }
  );
  req.write(JSON.stringify(payload));
  req.end();
}

send();

