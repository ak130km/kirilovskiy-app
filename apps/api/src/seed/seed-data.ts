// Демонстрационные данные кондитерской. Цены — в рублях (в БД переводятся в копейки).

export const ALLERGENS = [
  { code: 'gluten', name: 'Глютен' },
  { code: 'milk', name: 'Молоко и лактоза' },
  { code: 'eggs', name: 'Яйца' },
  { code: 'nuts', name: 'Орехи' },
  { code: 'peanuts', name: 'Арахис' },
  { code: 'soy', name: 'Соя' },
  { code: 'sesame', name: 'Кунжут' },
  { code: 'honey', name: 'Мёд' },
];

export const CATEGORIES = [
  { slug: 'torty', name: 'Торты', description: 'Целые торты на праздник и к чаю', sortOrder: 1 },
  { slug: 'pirozhnye', name: 'Пирожные', description: 'Эклеры, тарталетки и классика', sortOrder: 2 },
  { slug: 'makarons', name: 'Макарон', description: 'Наборы миндального печенья', sortOrder: 3 },
  { slug: 'chizkeyki', name: 'Чизкейки', description: 'Нью-Йорк и баскский', sortOrder: 4 },
  { slug: 'vypechka', name: 'Выпечка', description: 'Свежая выпечка каждое утро', sortOrder: 5 },
];

export interface SeedProduct {
  slug: string;
  category: string;
  name: string;
  description: string;
  composition: string;
  price: number;
  oldPrice?: number;
  weightGrams: number;
  allergens: string[];
  kcal: number;
  p: number;
  f: number;
  c: number;
  storage: string;
  leadTimeHours?: number;
  featured?: boolean;
  stopList?: string;
}

export const PRODUCTS: SeedProduct[] = [
  {
    slug: 'medovik', category: 'torty', name: 'Медовик классический', featured: true,
    description: 'Тонкие медовые коржи, пропитанные нежным сметанным кремом. Рецепт, по которому пекли наши бабушки.',
    composition: 'Мука пшеничная, сметана 20%, сахар, мёд натуральный, масло сливочное 82,5%, яйца куриные, сода.',
    price: 2900, weightGrams: 1200, allergens: ['gluten', 'milk', 'eggs', 'honey'],
    kcal: 386, p: 5.2, f: 19.4, c: 47.1, storage: 'При +2…+6 °C — 72 часа', leadTimeHours: 24,
  },
  {
    slug: 'napoleon', category: 'torty', name: 'Наполеон',
    description: 'Хрустящие слоёные коржи и заварной крем на сливочном масле.',
    composition: 'Мука пшеничная, масло сливочное 82,5%, молоко, сахар, яйца куриные, сливки 33%, ваниль.',
    price: 2600, weightGrams: 1000, allergens: ['gluten', 'milk', 'eggs'],
    kcal: 412, p: 5.8, f: 24.1, c: 43.5, storage: 'При +2…+6 °C — 48 часов', leadTimeHours: 24,
  },
  {
    slug: 'red-velvet', category: 'torty', name: 'Красный бархат', featured: true,
    description: 'Бархатные бисквиты с какао и сливочно-сырный крем. Украшаем свежими ягодами.',
    composition: 'Мука пшеничная, сахар, сыр сливочный, сливки 33%, кефир, масло растительное, яйца, какао, свежие ягоды.',
    price: 3900, oldPrice: 4300, weightGrams: 1500, allergens: ['gluten', 'milk', 'eggs'],
    kcal: 354, p: 4.6, f: 21.3, c: 36.0, storage: 'При +2…+6 °C — 72 часа', leadTimeHours: 48,
  },
  {
    slug: 'chocolate-truffle', category: 'torty', name: 'Шоколадный трюфель',
    description: 'Влажный шоколадный бисквит, трюфельный ганаш на бельгийском шоколаде 70%.',
    composition: 'Шоколад тёмный 70%, сливки 33%, мука пшеничная, сахар, яйца, масло сливочное, какао, соевый лецитин.',
    price: 3600, weightGrams: 1300, allergens: ['gluten', 'milk', 'eggs', 'soy'],
    kcal: 421, p: 6.1, f: 27.8, c: 37.2, storage: 'При +2…+6 °C — 72 часа', leadTimeHours: 24,
  },
  {
    slug: 'carrot-cake', category: 'torty', name: 'Морковный с грецким орехом',
    description: 'Пряный морковный бисквит с грецким орехом и кремом на сливочном сыре.',
    composition: 'Морковь, мука пшеничная, сахар, грецкий орех, сыр сливочный, масло растительное, яйца, корица, мускатный орех.',
    price: 3200, weightGrams: 1200, allergens: ['gluten', 'milk', 'eggs', 'nuts'],
    kcal: 372, p: 5.4, f: 22.0, c: 38.1, storage: 'При +2…+6 °C — 72 часа', leadTimeHours: 24,
    stopList: 'Закончился грецкий орех',
  },
  {
    slug: 'eclair-vanilla', category: 'pirozhnye', name: 'Эклер ванильный', featured: true,
    description: 'Заварное тесто, крем патисьер с мадагаскарской ванилью и белая глазурь.',
    composition: 'Молоко, яйца, мука пшеничная, масло сливочное, сахар, сливки 33%, стручок ванили, шоколад белый.',
    price: 290, weightGrams: 80, allergens: ['gluten', 'milk', 'eggs'],
    kcal: 318, p: 6.0, f: 18.2, c: 32.4, storage: 'При +2…+6 °C — 24 часа',
  },
  {
    slug: 'eclair-pistachio', category: 'pirozhnye', name: 'Эклер фисташковый',
    description: 'Заварное тесто, крем на сицилийской фисташковой пасте.',
    composition: 'Молоко, яйца, мука пшеничная, масло сливочное, сахар, паста фисташковая, сливки 33%, шоколад белый.',
    price: 320, weightGrams: 80, allergens: ['gluten', 'milk', 'eggs', 'nuts'],
    kcal: 335, p: 6.8, f: 20.1, c: 31.0, storage: 'При +2…+6 °C — 24 часа',
  },
  {
    slug: 'kartoshka', category: 'pirozhnye', name: 'Пирожное «Картошка»',
    description: 'Шоколадно-бисквитная классика с ромовой ноткой (без алкоголя).',
    composition: 'Бисквитная крошка, масло сливочное, сгущённое молоко, какао, ароматизатор «Ром».',
    price: 190, weightGrams: 70, allergens: ['gluten', 'milk', 'eggs'],
    kcal: 402, p: 6.2, f: 19.0, c: 51.5, storage: 'При +2…+6 °C — 72 часа',
  },
  {
    slug: 'berry-tart', category: 'pirozhnye', name: 'Тарталетка с ягодами',
    description: 'Песочная корзинка, ванильный крем и свежие сезонные ягоды.',
    composition: 'Мука пшеничная, масло сливочное, сахар, яйца, сливки 33%, молоко, малина, черника, клубника.',
    price: 380, weightGrams: 90, allergens: ['gluten', 'milk', 'eggs'],
    kcal: 289, p: 4.1, f: 16.0, c: 32.8, storage: 'При +2…+6 °C — 24 часа',
  },
  {
    slug: 'pavlova', category: 'pirozhnye', name: 'Павлова с маракуйей',
    description: 'Хрустящая снаружи и тягучая внутри меренга, сливочный крем и курд из маракуйи.',
    composition: 'Белки яичные, сахар, сливки 33%, сыр маскарпоне, пюре маракуйи, свежие фрукты, крахмал кукурузный.',
    price: 450, weightGrams: 110, allergens: ['milk', 'eggs'],
    kcal: 264, p: 3.3, f: 13.5, c: 33.0, storage: 'При +2…+6 °C — 12 часов',
  },
  {
    slug: 'macarons-6', category: 'makarons', name: 'Макарон, 6 штук', featured: true,
    description: 'Ассорти: малина, фисташка, солёная карамель, лаванда, шоколад, манго.',
    composition: 'Мука миндальная, сахарная пудра, белки яичные, сахар, сливки 33%, шоколад белый, пюре фруктовое, красители натуральные.',
    price: 890, weightGrams: 120, allergens: ['nuts', 'milk', 'eggs'],
    kcal: 427, p: 7.5, f: 20.6, c: 52.9, storage: 'При +2…+6 °C — 5 суток',
  },
  {
    slug: 'macarons-12', category: 'makarons', name: 'Макарон, 12 штук',
    description: 'Подарочная коробка из 12 вкусов. Можно добавить открытку с пожеланием в комментарии.',
    composition: 'Мука миндальная, сахарная пудра, белки яичные, сахар, сливки 33%, шоколад белый, пюре фруктовое, красители натуральные.',
    price: 1690, weightGrams: 240, allergens: ['nuts', 'milk', 'eggs'],
    kcal: 427, p: 7.5, f: 20.6, c: 52.9, storage: 'При +2…+6 °C — 5 суток',
  },
  {
    slug: 'cheesecake-ny', category: 'chizkeyki', name: 'Чизкейк «Нью-Йорк», кусочек',
    description: 'Плотный сливочный чизкейк на песочной основе с ягодным соусом.',
    composition: 'Сыр сливочный, сливки 33%, сахар, яйца, печенье песочное, масло сливочное, малиновый соус.',
    price: 420, weightGrams: 150, allergens: ['gluten', 'milk', 'eggs'],
    kcal: 341, p: 6.4, f: 24.0, c: 25.1, storage: 'При +2…+6 °C — 72 часа',
  },
  {
    slug: 'san-sebastian', category: 'chizkeyki', name: 'Баскский чизкейк «Сан-Себастьян»', featured: true,
    description: 'Карамелизированная корочка и кремовая середина. Целый чизкейк на 8–10 кусочков.',
    composition: 'Сыр сливочный, сливки 33%, сахар, яйца, мука пшеничная, соль.',
    price: 2900, weightGrams: 1100, allergens: ['gluten', 'milk', 'eggs'],
    kcal: 318, p: 6.1, f: 25.4, c: 16.8, storage: 'При +2…+6 °C — 72 часа', leadTimeHours: 24,
  },
  {
    slug: 'croissant', category: 'vypechka', name: 'Круассан классический',
    description: 'Слоёное дрожжевое тесто на французском масле 82%, 27 слоёв.',
    composition: 'Мука пшеничная, масло сливочное 82%, молоко, сахар, дрожжи, соль, яйцо для смазки.',
    price: 220, weightGrams: 70, allergens: ['gluten', 'milk', 'eggs'],
    kcal: 406, p: 8.2, f: 21.0, c: 45.6, storage: 'При комнатной температуре — 24 часа',
  },
  {
    slug: 'croissant-almond', category: 'vypechka', name: 'Круассан миндальный',
    description: 'Круассан с франжипаном и миндальными лепестками.',
    composition: 'Мука пшеничная, масло сливочное 82%, мука миндальная, сахар, яйца, молоко, миндальные лепестки, дрожжи.',
    price: 320, weightGrams: 110, allergens: ['gluten', 'milk', 'eggs', 'nuts'],
    kcal: 448, p: 9.6, f: 26.2, c: 42.0, storage: 'При комнатной температуре — 24 часа',
  },
  {
    slug: 'cinnabon', category: 'vypechka', name: 'Булочка с корицей',
    description: 'Мягкая сдобная булочка с корицей и сливочным крем-чизом.',
    composition: 'Мука пшеничная, молоко, масло сливочное, сахар коричневый, корица, сыр сливочный, яйца, дрожжи.',
    price: 290, weightGrams: 140, allergens: ['gluten', 'milk', 'eggs'],
    kcal: 365, p: 6.9, f: 15.2, c: 49.8, storage: 'При комнатной температуре — 24 часа',
  },
];

export const ZONES = [
  {
    name: 'Центр (в пределах ТТК)', description: 'Доставка 60–90 минут в выбранный интервал',
    price: 400, freeFrom: 5000, minOrder: 0, minutes: 90, sortOrder: 1,
  },
  {
    name: 'До МКАД', description: 'Доставка в выбранный интервал',
    price: 600, freeFrom: 7000, minOrder: 0, minutes: 120, sortOrder: 2,
  },
  {
    name: 'За МКАД до 10 км', description: 'Минимальный заказ — 3 000 ₽',
    price: 900, freeFrom: null, minOrder: 3000, minutes: 150, sortOrder: 3,
  },
];

const h = (hours: number) => hours * 60;

export const TIME_SLOTS = [
  ...[10, 12, 14, 16, 18, 20].map((start, i) => ({
    fulfillmentType: 'DELIVERY' as const, startMinutes: h(start), endMinutes: h(start + 2), capacity: 6, sortOrder: i,
  })),
  ...[9, 12, 15, 18].map((start, i) => ({
    fulfillmentType: 'PICKUP' as const, startMinutes: h(start), endMinutes: h(start + 3), capacity: 15, sortOrder: i,
  })),
];

export const PROMO_CODES = [
  {
    code: 'WELCOME10', description: 'Скидка 10% на первый заказ (не больше 1 000 ₽)',
    type: 'PERCENT' as const, value: 10, maxDiscount: 1000, minOrder: 0, perCustomer: 1,
  },
  {
    code: 'SWEET500', description: '500 ₽ при заказе от 3 000 ₽',
    type: 'FIXED' as const, value: 500, maxDiscount: null, minOrder: 3000, perCustomer: null,
  },
];
