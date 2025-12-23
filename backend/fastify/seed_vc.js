const {PrismaClient}=require('@prisma/client')
const prisma=new PrismaClient()
async function main(){
  await prisma.vendor.upsert({where:{code:'VEND1'},update:{name:'Vendor One'},create:{code:'VEND1',name:'Vendor One'}})
  await prisma.customer.upsert({where:{code:'CUST1'},update:{name:'Customer One'},create:{code:'CUST1',name:'Customer One'}})
  console.log('Seeded vendor VEND1 and customer CUST1')
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})
