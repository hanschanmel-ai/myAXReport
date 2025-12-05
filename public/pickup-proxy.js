(function(){
  async function getList(){ try{ const r = await fetch('/proxy/pickup/list'); const j = await r.json(); return Array.isArray(j.list)?j.list:[] }catch(e){ return [] } }
  async function saveSelected(dest){ try{ await fetch('/proxy/pickup/select',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ destination: dest }) }); }catch(e){} }
  function fillFields(dest){
    const pairs = [
      ['input[name="checkout[shipping_address][address1]"]', dest.address1],
      ['input[name="checkout[shipping_address][address2]"]', dest.address2],
      ['input[name="checkout[shipping_address][city]"]', dest.city],
      ['input[name="checkout[shipping_address][province]"]', dest.region],
      ['input[name="checkout[shipping_address][country]"]', dest.country]
    ];
    pairs.forEach(([sel,val])=>{ const el = document.querySelector(sel); if(el && typeof val==='string') { el.value = val; el.dispatchEvent(new Event('input',{bubbles:true})); } });
  }
  function getDestFromFields(){
    const q = s=>document.querySelector(s);
    const country = (q('input[name="checkout[shipping_address][country]"]')||{}).value || 'HK';
    const province = (q('input[name="checkout[shipping_address][province]"]')||{}).value || '';
    const region = province || '';
    const city = (q('input[name="checkout[shipping_address][city]"]')||{}).value || '';
    const address1 = (q('input[name="checkout[shipping_address][address1]"]')||{}).value || '';
    const address2 = (q('input[name="checkout[shipping_address][address2]"]')||{}).value || '';
    return { country, province, region, city, address1, address2, postal_code: '' };
  }
  async function calcRates(msg, subtotalHKD){
    try{
      const dest = getDestFromFields();
      const items = Array.isArray(subtotalHKD) ? subtotalHKD : [{ price: Math.round((Number(subtotalHKD||0))*100), quantity: 1, grams: 0 }];
      const body = { rate: { destination: dest, items } };
      const r = await fetch('/proxy/carrier/rates', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const j = await r.json();
      const rate = (j && Array.isArray(j.rates) && j.rates[0]) ? j.rates[0] : null;
      if (!rate) { msg.textContent = 'No rates'; return; }
      const hkd = Number(rate.total_price||0)/100;
      msg.textContent = `${rate.service_name} — ${hkd.toFixed(0)} HKD`;
    }catch(e){ msg.textContent = 'Error calculating rates'; }
  }
  function observeChanges(msg, subtotalHKD){
    const sels = [
      'input[name="checkout[shipping_address][address1]"]',
      'input[name="checkout[shipping_address][address2]"]',
      'input[name="checkout[shipping_address][city]"]',
      'input[name="checkout[shipping_address][province]"]',
      'input[name="checkout[shipping_address][country]"]'
    ];
    const handler = ()=>{
      const q = s=>document.querySelector(s);
      const region = (q('input[name="checkout[shipping_address][province]"]')||{}).value || '';
      const city = (q('input[name="checkout[shipping_address][city]"]')||{}).value || '';
      if (region && city) { calcRates(msg, subtotalHKD); }
    };
    sels.forEach(s=>{ const el = document.querySelector(s); if (el) { el.addEventListener('input', handler, { passive: true }); el.addEventListener('change', handler, { passive: true }); } });
  }
  async function mount(selector, opts){
    const root = typeof selector==='string' ? document.querySelector(selector) : selector;
    if(!root) return;
    const list = await getList();
    const options = list.map((e,i)=>`<option value="${i}">${(e.location_name||e.shop_name||'Pickup')} — ${(e.city||e.district||'')} — ${(e.region||'')}</option>`).join('');
    root.innerHTML = `<div style="display:flex;gap:8px;align-items:center"><select id="altaya_pickup_sel"><option value="">Select Pickup Location</option>${options}</select><button id="altaya_pickup_apply">Apply</button></div><div id="altaya_pickup_msg" style="margin-top:8px"></div>`;
    const sel = root.querySelector('#altaya_pickup_sel');
    const btn = root.querySelector('#altaya_pickup_apply');
    const msg = root.querySelector('#altaya_pickup_msg');
    const subtotalHKD = (opts && typeof opts.subtotal_hkd==='number') ? opts.subtotal_hkd : 0;
    observeChanges(msg, subtotalHKD);
    btn.onclick = async()=>{
      const idx = parseInt(sel.value,10);
      if(Number.isNaN(idx)) { msg.textContent = 'Please select a pickup location'; return; }
      const e = list[idx]||{};
      const dest = { country:(e.country||'HK'), region:(e.region||''), province:(e.region||''), city:(e.city||e.district||''), address1:(e.address1||''), address2:(e.location_name||e.shop_name||'') };
      const ok = confirm(`Proceed with Pickup at "${e.location_name||e.shop_name||'Pickup'}"?\n\nThis will overwrite your delivery address with the pickup location.`);
      if(!ok) return;
      await saveSelected(dest);
      try{
        fillFields(dest);
        msg.textContent = 'Pickup address applied. Proceed to checkout.';
      }catch(err){ msg.textContent = 'Pickup saved. Please proceed to checkout.'; }
    };
  }
  window.AltayaPickup = { mount };
})();
