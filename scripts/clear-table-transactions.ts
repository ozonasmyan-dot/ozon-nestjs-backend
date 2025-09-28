import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Замените `user` на вашу модель (с маленькой буквы)
    await prisma.transaction.deleteMany({});
    console.log('✅ Все записи удалены, таблица осталась.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });