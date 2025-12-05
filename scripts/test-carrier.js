(async () => {
  const payload = {
    rate: {
      destination: {
        country: 'HK',
        region: 'New Territories',
        city: 'So Kwun Wat',
        address1: 'No. 3 Wah Hing Building',
        address2: 'Peak Road',
        postal_code: ''
      },
      items: [{ price: 36500, quantity: 1, grams: 0 }]
    }
  };
  try{
    const resp = await fetch('http://localhost:3000/carrier/rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await resp.text();
    console.log(text);
  }catch(e){
    console.error('error', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
