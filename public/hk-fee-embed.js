async function fetchDistricts(){
  try{const r=await fetch('/hk/districts');return r.json();}catch(e){if(window.HKFee&&typeof window.HKFee.getDefaultDistricts==='function')return window.HKFee.getDefaultDistricts();return {regions:{}}}
}

function createOption(text,value){
  const o=document.createElement('option');
  o.textContent=text;o.value=value;return o;
}

function mount(containerId){
  const el=document.getElementById(containerId)||document.querySelector('[data-hk-fee]')||document.body;
  const box=document.createElement('div');
  box.id='hk-fee-widget';
  const row=document.createElement('div');row.className='row';
  const regionSel=document.createElement('select');
  const districtSel=document.createElement('select');
  const status=document.createElement('div');status.className='status';
  row.appendChild(regionSel);row.appendChild(districtSel);
  box.appendChild(row);box.appendChild(status);
  el.appendChild(box);
  fetchDistricts().then(data=>{
    const regions=data.regions||{};
    regionSel.appendChild(createOption('Select region',''));
    Object.keys(regions).forEach(r=>regionSel.appendChild(createOption(r,r)));
    regionSel.addEventListener('change',()=>{
      const r=regionSel.value;
      districtSel.innerHTML='';
      districtSel.appendChild(createOption('Select district',''));
      (regions[r]||[]).forEach(d=>districtSel.appendChild(createOption(d,d)));
    });
    districtSel.addEventListener('change',async()=>{
      const r=regionSel.value;const d=districtSel.value;
      if(!r||!d){status.textContent='';return;}
      const res=await window.HKFee.addOrUpdateFee(r,d);
      if(res.ok){
        status.textContent='Delivery fee applied: HK$'+res.amount;
      }else{
        status.textContent='Unable to apply fee: '+res.reason;
      }
    });
  });
}

window.HKFeeEmbed={mount};
