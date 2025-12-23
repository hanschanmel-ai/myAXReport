async function loadForm() {
  const res = await fetch('/forms/sales_order_form.json');
  const data = await res.json();
  return data.form;
}

function setStatus() {
  const el = document.getElementById('status');
  el.textContent = navigator.onLine ? 'Online' : 'Offline (changes will be queued)';
}

function fieldInput(field) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const label = document.createElement('label');
  label.textContent = field.key;
  wrap.appendChild(label);
  let input;
  if (field.data_type === 'date') {
    input = document.createElement('input');
    input.type = 'date';
  } else if (field.data_type === 'string') {
    if (field.validation && field.validation.in) {
      input = document.createElement('select');
      field.validation.in.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = v; input.appendChild(opt);
      });
    } else {
      input = document.createElement('input');
      input.type = 'text';
    }
  } else {
    input = document.createElement('input');
    input.type = 'text';
  }
  input.dataset.key = field.key;
  wrap.appendChild(input);
  return wrap;
}

function renderHeader(form) {
  const container = document.getElementById('header');
  const h2 = document.createElement('h2'); h2.style.fontSize = '16px'; h2.textContent = 'Header';
  container.appendChild(h2);
  const row1 = document.createElement('div'); row1.className = 'row';
  const row2 = document.createElement('div'); row2.className = 'row';
  const map = new Map(form.fields.map(f => [f.key, f]));
  ['order_date','customer','currency'].forEach(k => { row1.appendChild(fieldInput(map.get(k))); });
  ['payment_terms','bill_to'].forEach(k => { row2.appendChild(fieldInput(map.get(k))); });
  container.appendChild(row1);
  container.appendChild(row2);
}

function addLineRow() {
  const tbody = document.querySelector('#linesTable tbody');
  const tr = document.createElement('tr');
  const tdItem = document.createElement('td'); const tdUom = document.createElement('td');
  const tdQty = document.createElement('td'); const tdPrice = document.createElement('td');
  const tdDel = document.createElement('td');
  const inItem = document.createElement('input'); inItem.type='text'; inItem.placeholder='SKU or ID';
  const inUom = document.createElement('input'); inUom.type='text'; inUom.placeholder='UOM';
  const inQty = document.createElement('input'); inQty.type='number'; inQty.min='1'; inQty.step='1'; inQty.value='1';
  const inPrice = document.createElement('input'); inPrice.type='number'; inPrice.min='0'; inPrice.step='0.01'; inPrice.value='0';
  const del = document.createElement('button'); del.className='btn secondary'; del.textContent='Delete';
  del.onclick = () => tr.remove();
  tdItem.appendChild(inItem); tdUom.appendChild(inUom);
  tdQty.appendChild(inQty); tdPrice.appendChild(inPrice);
  tdDel.appendChild(del);
  tr.appendChild(tdItem); tr.appendChild(tdUom); tr.appendChild(tdQty); tr.appendChild(tdPrice); tr.appendChild(tdDel);
  tbody.appendChild(tr);
}

function collectPayload() {
  const headerEl = document.getElementById('header');
  const inputs = headerEl.querySelectorAll('input, select');
  const header = {};
  inputs.forEach(i => { header[i.dataset.key] = i.value; });
  const lines = [];
  document.querySelectorAll('#linesTable tbody tr').forEach(tr => {
    const tds = tr.querySelectorAll('td');
    const line = {
      item_id: tds[0].querySelector('input').value,
      uom: tds[1].querySelector('input').value,
      qty: Number(tds[2].querySelector('input').value || 0),
      price: Number(tds[3].querySelector('input').value || 0)
    };
    lines.push(line);
  });
  return { header, lines };
}

function validate(form, payload) {
  const errors = [];
  const req = k => { if (!payload.header[k]) errors.push(`${k} is required`); };
  req('order_date'); req('customer'); req('currency');
  payload.lines.forEach((l, idx) => {
    if (!l.item_id) errors.push(`Line ${idx+1}: item is required`);
    if (!l.uom) errors.push(`Line ${idx+1}: uom is required`);
    if (l.qty <= 0) errors.push(`Line ${idx+1}: qty must be >= 1`);
    if (l.price < 0) errors.push(`Line ${idx+1}: price must be >= 0`);
  });
  return errors;
}

function queueMutation(payload) {
  const q = JSON.parse(localStorage.getItem('erp_mutations') || '[]');
  q.push({ id: Date.now().toString(), entity_type: 'sales_order', action: 'submit', payload, created_at: Date.now() });
  localStorage.setItem('erp_mutations', JSON.stringify(q));
}

async function main() {
  setStatus();
  window.addEventListener('online', setStatus);
  window.addEventListener('offline', setStatus);
  const form = await loadForm();
  renderHeader(form);
  document.getElementById('addLine').onclick = addLineRow;
  addLineRow();
  const errorsEl = document.getElementById('errors');
  const payloadEl = document.getElementById('payload');
  document.getElementById('preview').onclick = () => {
    const payload = collectPayload();
    payloadEl.textContent = JSON.stringify(payload, null, 2);
  };
  document.getElementById('submit').onclick = async () => {
    const payload = collectPayload();
    const errors = validate(form, payload);
    if (errors.length) { errorsEl.textContent = errors.join('\n'); return; }
    errorsEl.textContent = '';
    payloadEl.textContent = JSON.stringify(payload, null, 2);
    if (!navigator.onLine) {
      queueMutation(payload);
      alert('Offline: queued mutation for sync');
      return;
    }
    alert('Prototype: payload prepared (no server endpoint yet).');
  };
}

main();
