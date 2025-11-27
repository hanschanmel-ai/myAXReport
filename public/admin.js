async function fetchJSON(url){const r=await fetch(url);return r.json();}
async function putJSON(url,body){const r=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return r.json();}

let cfg={};

function renderDefaults(){
  document.getElementById('threshold').value=cfg.default_threshold_hkd||cfg.free_threshold_hkd||0;
  document.getElementById('fee').value=cfg.default_fee_hkd||0;
  document.getElementById('default-threshold-op').value=cfg.default_threshold_op||'lt';
  const exp=cfg.express||{type:'multiplier',value:1.5,free_when_standard_free:true};
  document.getElementById('express-type').value=exp.type;
  document.getElementById('express-value').value=exp.value;
  document.getElementById('express-free').checked=!!exp.free_when_standard_free;
  if(document.getElementById('service-standard')) document.getElementById('service-standard').value=cfg.service_standard_name||'VKS Standard';
  if(document.getElementById('service-express')) document.getElementById('service-express').value=cfg.service_express_name||'VKS Express';
  if(document.getElementById('currency')) document.getElementById('currency').value=cfg.currency||'HKD';
}

function renderRegions(reg){
  const rsel=document.getElementById('ov-region');
  const dsel=document.getElementById('ov-district');
  rsel.innerHTML='';dsel.innerHTML='';
  Object.keys(reg).forEach(r=>{const o=document.createElement('option');o.value=r;o.textContent=r;rsel.appendChild(o);});
  rsel.addEventListener('change',()=>{
    const rr=rsel.value;dsel.innerHTML='';(reg[rr]||[]).forEach(d=>{const o=document.createElement('option');o.value=d;o.textContent=d;dsel.appendChild(o);});
  });
  rsel.dispatchEvent(new Event('change'));
}

function renderOverrides(){
  const tbody=document.querySelector('#ov-table tbody');
  tbody.innerHTML='';
  const overrides=cfg.area_overrides||{};
  Object.keys(overrides).forEach(k=>{
    const v=overrides[k];
    const tr=document.createElement('tr');
    const exp=v.express?`${v.express.type}:${v.express.value} ${v.express.free_when_standard_free?'(free when std free)':''}`:'(inherit)';
    tr.innerHTML=`<td>${k}</td><td>${v.scope||'district'}</td><td>${v.active!==false?'true':'false'}</td><td>${v.threshold_op||'lt'}</td><td>${v.threshold_hkd??''}</td><td>${v.fee_hkd??''}</td><td>${exp}</td><td><button data-k="${k}" class="del">Delete</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('button.del').forEach(b=>b.addEventListener('click',()=>{
    const k=b.getAttribute('data-k');
    delete cfg.area_overrides[k];
    saveCfg();
  }));
}

async function saveCfg(){
  const res=await putJSON('/config/rates',cfg);cfg=res;renderOverrides();}

async function init(){
  cfg=await fetchJSON('/config/rates');
  renderDefaults();
  const reg = (await fetchJSON('/hk/districts')).regions||{};
  renderRegions(reg);
  renderOverrides();
  document.getElementById('save-defaults').addEventListener('click',async()=>{
    cfg.default_threshold_hkd=Number(document.getElementById('threshold').value||0);
    cfg.default_fee_hkd=Number(document.getElementById('fee').value||0);
    cfg.default_threshold_op=document.getElementById('default-threshold-op').value||'lt';
    cfg.express={
      type: document.getElementById('express-type').value,
      value: Number(document.getElementById('express-value').value||0),
      free_when_standard_free: document.getElementById('express-free').checked
    };
    cfg.service_standard_name=(document.getElementById('service-standard').value||'VKS Standard');
    cfg.service_express_name=(document.getElementById('service-express').value||'VKS Express');
    cfg.currency=(document.getElementById('currency').value||'HKD');
    await saveCfg();
  });
  document.getElementById('add-override').addEventListener('click',async()=>{
    const scope=(document.getElementById('ov-scope').value||'district');
    let area=(document.getElementById('ov-district').value||'').toLowerCase();
    if (scope==='region') area=(document.getElementById('ov-region').value||'').toLowerCase();
    const threshold=Number(document.getElementById('ov-threshold').value||0);
    const fee=Number(document.getElementById('ov-fee').value||0);
    const op=(document.getElementById('ov-threshold-op').value||'lt');
    const active=document.getElementById('ov-active').checked;
    const minw=Number(document.getElementById('ov-minw').value||NaN);
    const maxw=Number(document.getElementById('ov-maxw').value||NaN);
    const activeFrom=(document.getElementById('ov-active-from').value||'');
    const activeTo=(document.getElementById('ov-active-to').value||'');
    const minItems=Number(document.getElementById('ov-min-items').value||NaN);
    const maxItems=Number(document.getElementById('ov-max-items').value||NaN);
    const et=document.getElementById('ov-express-type').value;
    const ev=Number(document.getElementById('ov-express-value').value||0);
    const ef=document.getElementById('ov-express-free').checked;
    cfg.area_overrides=cfg.area_overrides||{};
    cfg.area_overrides[area]={ scope, active, threshold_hkd: threshold, threshold_op: op, fee_hkd: fee };
    if(!Number.isNaN(minw)) cfg.area_overrides[area].min_weight_grams=minw;
    if(!Number.isNaN(maxw)) cfg.area_overrides[area].max_weight_grams=maxw;
    if(activeFrom) cfg.area_overrides[area].active_from=activeFrom;
    if(activeTo) cfg.area_overrides[area].active_to=activeTo;
    if(!Number.isNaN(minItems)) cfg.area_overrides[area].min_items=minItems;
    if(!Number.isNaN(maxItems)) cfg.area_overrides[area].max_items=maxItems;
    if(et){ cfg.area_overrides[area].express={ type: et, value: ev, free_when_standard_free: ef }; }
    await saveCfg();
  });
  document.getElementById('upload-csv').addEventListener('click', async () => {
    const f = document.getElementById('csv-file').files[0];
    if (!f) return;
    const text = await f.text();
    const r = await fetch('/config/rates/import-csv', { method:'POST', headers:{'Content-Type':'text/csv'}, body:text });
    cfg = await r.json();
    renderOverrides();
    renderDefaults();
  });
}

init();
