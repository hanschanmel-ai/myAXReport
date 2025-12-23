<script>
  import { api } from '../../lib/api.js'
  let email=''
  let password=''
  async function login(){try{const out=await api('/auth/login','POST',{email,password});localStorage.setItem('token',out.token);location.href='/'}catch(e){alert(e.message)}}
</script>
<h2>Login</h2>
<div class="row"><input placeholder="email" bind:value={email}><input type="password" placeholder="password" bind:value={password}></div>
<button on:click={login}>Login</button>
<style>
  .row{display:flex;gap:8px;margin:8px 0}
  input{padding:8px;border:1px solid #e5e7eb;border-radius:6px}
  button{padding:8px 12px;border:none;border-radius:6px;background:#1558b0;color:#fff}
</style>
