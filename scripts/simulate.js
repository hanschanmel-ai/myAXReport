import http from "http";

const payload = {
  rate: {
    origin: {
      country: "HK",
      province: "Hong Kong Island",
      city: "Central",
      name: "Shop",
      address1: "",
      postal_code: ""
    },
    destination: {
      country: "HK",
      province: "New Territories",
      city: "Yuen Long",
      name: "Customer",
      address1: "",
      postal_code: ""
    },
    items: [
      {
        name: "Tee",
        quantity: 2,
        grams: 300,
        price: 1500
      },
      {
        name: "Hoodie",
        quantity: 1,
        grams: 700,
        price: 3500
      }
    ],
    currency: "HKD"
  }
};

function send() {
  const req = http.request(
    {
      hostname: "localhost",
      port: process.env.PORT || 3000,
      path: "/carrier/rates",
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
