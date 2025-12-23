const path=require('path')
const fs=require('fs')
const {PrismaClient}=require('@prisma/client')
const prisma=new PrismaClient()
async function importFile(fp,kind){try{const raw=fs.readFileSync(fp,'utf8');const json=JSON.parse(raw);const rows=(json.rows||[]);for(const r of rows){if(kind==='vendor'){const code=String(r.code||r.vendor||'').trim();const name=String(r.name||'').trim();if(!code||!name)continue;await prisma.vendor.upsert({where:{code},update:{name},create:{code,name}})}else if(kind==='customer'){const code=String(r.code||r.customer||'').trim();const name=String(r.name||'').trim();if(!code||!name)continue;await prisma.customer.upsert({where:{code},update:{name},create:{code,name}})}}console.log(`Imported ${rows.length} ${kind}s from ${fp}`)}catch(e){console.log(`Skip ${kind} import: ${e.message}`)}}
async function main(){const root=path.resolve(__dirname,'..','..','public','erp-data');await importFile(path.join(root,'vendors.json'),'vendor');await importFile(path.join(root,'customers.json'),'customer');}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})
