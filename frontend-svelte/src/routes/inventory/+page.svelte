<script>
  import { onMount } from 'svelte'
  let balances=[]
  async function load(){const token=localStorage.getItem('token');if(!token){location.href='/login';return}const res=await fetch('http://localhost:8788/inventory/balances',{headers:{Authorization:'Bearer '+token}});if(res.ok){balances=await res.json()}else{const out=await res.json();alert(out.error||'Error')}}
  onMount(load)
</script>
<h2>Inventory Balances</h2>
<table>
  <thead><tr><th>Company</th><th>Location</th><th>SKU</th><th>On Hand</th></tr></thead>
  <tbody>
    {#each balances as b}
      <tr><td>{b.companyCode}</td><td>{b.location}</td><td>{b.itemSku}</td><td>{(b.qtyOnHand||0).toFixed(2)}</td></tr>
    {/each}
  </tbody>
</table>
<style>
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #e5e7eb;padding:8px;text-align:left}
  th{background:#f3f4f6}
</style>
