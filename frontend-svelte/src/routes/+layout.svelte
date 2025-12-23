<script>
  import { onMount } from 'svelte'
  let user=null
  async function refresh(){try{const token=localStorage.getItem('token');if(!token)return;const res=await fetch('http://localhost:8788/auth/me',{headers:{Authorization:'Bearer '+token}});if(res.ok){user=await res.json()}}catch(e){}}
  onMount(refresh)
</script>
<div class="topbar">
  <div class="brand">EP-001 ERP</div>
  <nav class="menu">
    <a href="/">Home</a>
    <a href="/inventory">Inventory</a>
    <a href="/transactions/po">PO</a>
    <a href="/transactions/so">SO</a>
    <a href="/gl">GL</a>
    <a href="/login" style="margin-left:auto">{user?user.name:'Login'}</a>
  </nav>
</div>
<slot />
<style>
  .topbar{display:flex;align-items:center;gap:12px;background:#1558b0;color:#fff;padding:8px}
  .brand{font-weight:600}
  .menu{display:flex;gap:12px;align-items:center}
  .menu a{color:#eaf1ff;text-decoration:none;padding:6px 8px;border-radius:4px}
  .menu a:hover{background:rgba(255,255,255,0.15)}
</style>
