const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const reqs = await prisma.rescueRequest.findMany({
    where: {
      status: { in: ['CREATED', 'MATCHING', 'SEARCHING', 'MATCHED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'ARRIVED', 'WORKING', 'PAYMENT_PENDING'] }
    },
    include: {
      assignedProvider: true
    }
  });
  console.log(JSON.stringify(reqs, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
