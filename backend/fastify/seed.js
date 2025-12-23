const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()
async function main(){
  const roles=["admin","inventory","accountant"]
  for(const name of roles){
    await prisma.role.upsert({where:{name},update:{},create:{name}})
  }
  const email=process.env.ADMIN_EMAIL||'admin@example.com'
  const name=process.env.ADMIN_NAME||'Admin'
  const password=process.env.ADMIN_PASSWORD||'admin123'
  const passwordHash=await bcrypt.hash(password,10)
  let user=await prisma.user.findUnique({where:{email}})
  if(!user){
    user=await prisma.user.create({data:{email,name,passwordHash}})
  }
  const roleAdmin=await prisma.role.findUnique({where:{name:'admin'}})
  const roleInv=await prisma.role.findUnique({where:{name:'inventory'}})
  const roleAcc=await prisma.role.findUnique({where:{name:'accountant'}})
  for(const r of [roleAdmin,roleInv,roleAcc]){
    await prisma.userRole.upsert({where:{userId_roleId:{userId:user.id,roleId:r.id}},update:{},create:{userId:user.id,roleId:r.id}})
  }
  console.log('Seeded admin user and roles')
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})
