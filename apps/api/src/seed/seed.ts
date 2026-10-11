/**
 * Наполнение БД: справочники, демо-каталог, интервалы, зоны, промокоды, первый администратор.
 * Скрипт идемпотентный — существующие записи не перезаписываются (можно запускать при каждом старте).
 *
 *   pnpm db:seed
 *
 * Переменные: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_DEMO_DATA (true/false).
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { ALLERGENS, CATEGORIES, PRODUCTS, PROMO_CODES, TIME_SLOTS, ZONES } from './seed-data';

const prisma = new PrismaClient();
const rub = (v: number) => Math.round(v * 100);

async function seedStaff() {
  const count = await prisma.staffUser.count();
  if (count > 0) return;
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@kirilovskiy.local').toLowerCase();
  const generated = !process.env.SEED_ADMIN_PASSWORD;
  const password = process.env.SEED_ADMIN_PASSWORD ?? randomBytes(9).toString('base64url');
  await prisma.staffUser.create({
    data: { email, name: 'Администратор', role: 'ADMIN', passwordHash: await bcrypt.hash(password, 10) },
  });
  console.log(`👤 Администратор: ${email}${generated ? ` / пароль: ${password} (сохраните и смените)` : ''}`);

  if (process.env.SEED_DEMO_DATA !== 'false') {
    const demoPassword = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? password, 10);
    await prisma.staffUser.createMany({
      data: [
        { email: 'manager@kirilovskiy.local', name: 'Мария (менеджер)', role: 'MANAGER', passwordHash: demoPassword },
        { email: 'operator@kirilovskiy.local', name: 'Олег (оператор)', role: 'OPERATOR', passwordHash: demoPassword },
      ],
    });
    console.log('👥 Демо-сотрудники: manager@kirilovskiy.local, operator@kirilovskiy.local (пароль как у администратора)');
  }
}

async function seedCatalog() {
  for (const a of ALLERGENS) {
    await prisma.allergen.upsert({ where: { code: a.code }, create: a, update: {} });
  }
  if (process.env.SEED_DEMO_DATA === 'false') return;

  const categories = new Map<string, string>();
  for (const c of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      create: { ...c, imageUrl: `/static/seed/cat-${c.slug}.svg` },
      update: {},
    });
    categories.set(c.slug, row.id);
  }

  const allergens = new Map((await prisma.allergen.findMany()).map((a) => [a.code, a.id]));
  let created = 0;
  for (const [index, p] of PRODUCTS.entries()) {
    const exists = await prisma.product.findUnique({ where: { slug: p.slug } });
    if (exists) continue;
    await prisma.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        categoryId: categories.get(p.category)!,
        description: p.description,
        composition: p.composition,
        price: rub(p.price),
        oldPrice: p.oldPrice ? rub(p.oldPrice) : null,
        weightGrams: p.weightGrams,
        caloriesKcal: p.kcal,
        proteins: p.p,
        fats: p.f,
        carbohydrates: p.c,
        storageConditions: p.storage,
        leadTimeHours: p.leadTimeHours ?? 0,
        isFeatured: p.featured ?? false,
        inStopList: !!p.stopList,
        stopListReason: p.stopList ?? null,
        sortOrder: index,
        allergens: { connect: p.allergens.map((code) => ({ id: allergens.get(code)! })) },
        images: {
          create: [
            { url: `/static/seed/${p.slug}.svg`, sortOrder: 0 },
            { url: `/static/seed/${p.slug}-2.svg`, sortOrder: 1 },
          ],
        },
      },
    });
    created++;
  }
  if (created) console.log(`🍰 Товаров добавлено: ${created}`);
}

async function seedDelivery() {
  if (process.env.SEED_DEMO_DATA === 'false') return;
  if ((await prisma.deliveryZone.count()) === 0) {
    await prisma.deliveryZone.createMany({
      data: ZONES.map((z) => ({
        name: z.name,
        description: z.description,
        price: rub(z.price),
        freeFromAmount: z.freeFrom ? rub(z.freeFrom) : null,
        minOrderAmount: rub(z.minOrder),
        estimatedMinutes: z.minutes,
        sortOrder: z.sortOrder,
      })),
    });
    console.log(`🚚 Зон доставки: ${ZONES.length}`);
  }
  if ((await prisma.timeSlot.count()) === 0) {
    await prisma.timeSlot.createMany({ data: TIME_SLOTS });
    console.log(`🕒 Интервалов: ${TIME_SLOTS.length}`);
  }
  for (const p of PROMO_CODES) {
    await prisma.promoCode.upsert({
      where: { code: p.code },
      create: {
        code: p.code,
        description: p.description,
        type: p.type,
        value: p.type === 'FIXED' ? rub(p.value) : p.value,
        maxDiscountAmount: p.maxDiscount ? rub(p.maxDiscount) : null,
        minOrderAmount: rub(p.minOrder),
        usageLimitPerCustomer: p.perCustomer,
      },
      update: {},
    });
  }
}

async function main() {
  await seedStaff();
  await seedCatalog();
  await seedDelivery();
  console.log('✅ Сиды применены');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
