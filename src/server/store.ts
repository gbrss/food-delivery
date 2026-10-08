import {
  Role,
  RestaurantStatus,
  OrderStatus,
  PaymentStatus,
  DriverStatus,
  User,
  Address,
  RestaurantCategory,
  Restaurant,
  ProductCategory,
  Product,
  Order,
  Driver,
  DriverLocation,
  Coupon,
  NotificationItem,
  PlatformSettings,
  PaymentTransaction,
  Review,
} from '../types/domain.ts';

// High-resolution generated food photography assets
export const GENERATED_IMAGES = {
  hero: '/src/assets/images/hero_food_delivery_1791416748217.jpg',
  burger: '/src/assets/images/rest_burger_artisan_1791416756892.jpg',
  sushi: '/src/assets/images/rest_sushi_nikkei_1791416766182.jpg',
  pizza: '/src/assets/images/rest_pizza_napoli_1791416774600.jpg',
  tacos: '/src/assets/images/rest_tacos_mexican_1791416784194.jpg',
};

const safeWebpayCode =
  typeof process !== 'undefined' && process.env && process.env.WEBPAY_COMMERCE_CODE
    ? process.env.WEBPAY_COMMERCE_CODE
    : '597055555532';

export interface UserWithCredentials extends User {
  passwordHash: string;
}

export class InMemoryDatabase {
  users: UserWithCredentials[] = [];
  addresses: Address[] = [];
  restaurantCategories: RestaurantCategory[] = [];
  restaurants: Restaurant[] = [];
  productCategories: ProductCategory[] = [];
  products: Product[] = [];
  orders: Order[] = [];
  drivers: Driver[] = [];
  driverLocations: DriverLocation[] = [];
  coupons: Coupon[] = [];
  notifications: NotificationItem[] = [];
  transactions: PaymentTransaction[] = [];
  reviews: Review[] = [];
  settings: PlatformSettings = {
    defaultCommissionPercent: 15,
    serviceFeeClp: 500,
    baseDeliveryFeeClp: 2500,
    driverSharePercent: 85,
    webpayEnvironment: 'INTEGRATION',
    webpayCommerceCode: safeWebpayCode,
    maxLocationHistoryPerOrder: 25,
  };
  nextOrderNumber = 1049;

  constructor() {
    this.seed();
  }

  seed() {
    // 1. Seed Demo Users for all 5 roles
    this.users = [
      {
        id: 'usr-client-1',
        email: 'cliente@demo.cl',
        passwordHash: 'demo123',
        name: 'Camila Valdés',
        phone: '+56 9 8412 3901',
        role: Role.CLIENT,
      },
      {
        id: 'usr-rest-1',
        email: 'restaurante@demo.cl',
        passwordHash: 'demo123',
        name: 'Martín Echeverría (La Brasa)',
        phone: '+56 9 7211 4500',
        role: Role.RESTAURANT,
        restaurantId: 'rest-1',
      },
      {
        id: 'usr-kitchen-1',
        email: 'cocina@demo.cl',
        passwordHash: 'demo123',
        name: 'Chef Ejecutivo – KDS Cocina',
        phone: '+56 9 7211 4501',
        role: Role.KITCHEN,
        restaurantId: 'rest-1',
      },
      {
        id: 'usr-driver-1',
        email: 'repartidor@demo.cl',
        passwordHash: 'demo123',
        name: 'Diego Morales',
        phone: '+56 9 6590 1122',
        role: Role.DRIVER,
        driverId: 'drv-1',
      },
      {
        id: 'usr-admin-1',
        email: 'admin@demo.cl',
        passwordHash: 'demo123',
        name: 'Javiera Osses (Directora Operaciones)',
        phone: '+56 9 9001 8800',
        role: Role.ADMIN,
      },
    ];

    // 2. Seed Client Addresses in Santiago (Providencia, Las Condes, Ñuñoa)
    this.addresses = [
      {
        id: 'addr-1',
        userId: 'usr-client-1',
        label: 'Casa Providencia',
        street: 'Av. Eliodoro Yáñez',
        number: '1890',
        apartment: 'Depto 704',
        commune: 'Providencia',
        city: 'Santiago',
        instructions: 'Dejar en conserjería o llamar al citófono 704',
        lat: -33.4318,
        lng: -70.6045,
        isDefault: true,
      },
      {
        id: 'addr-2',
        userId: 'usr-client-1',
        label: 'Oficina El Golf',
        street: 'Av. Apoquindo',
        number: '3600',
        apartment: 'Piso 12',
        commune: 'Las Condes',
        city: 'Santiago',
        instructions: 'Recepción torre principal',
        lat: -33.4152,
        lng: -70.5881,
        isDefault: false,
      },
    ];

    // 3. Seed 8 Restaurant Categories
    this.restaurantCategories = [
      { id: 'cat-pizza', name: 'Pizza', slug: 'pizza', icon: '🍕' },
      { id: 'cat-burgers', name: 'Hamburguesas', slug: 'hamburguesas', icon: '🍔' },
      { id: 'cat-chicken', name: 'Pollo', slug: 'pollo', icon: '🍗' },
      { id: 'cat-sushi', name: 'Sushi', slug: 'sushi', icon: '🍣' },
      { id: 'cat-mexican', name: 'Mexicana', slug: 'mexicana', icon: '🌮' },
      { id: 'cat-healthy', name: 'Saludable', slug: 'saludable', icon: '🥗' },
      { id: 'cat-desserts', name: 'Postres', slug: 'postres', icon: '🍰' },
      { id: 'cat-coffee', name: 'Cafetería', slug: 'cafeteria', icon: '☕' },
    ];

    const defaultHours = (restId: string) => [
      { id: `${restId}-h1`, restaurantId: restId, dayOfWeek: 1, dayName: 'Lunes a Jueves', openTime: '12:00', closeTime: '23:00', isClosed: false },
      { id: `${restId}-h2`, restaurantId: restId, dayOfWeek: 5, dayName: 'Viernes y Sábado', openTime: '12:00', closeTime: '00:30', isClosed: false },
      { id: `${restId}-h3`, restaurantId: restId, dayOfWeek: 0, dayName: 'Domingo', openTime: '12:30', closeTime: '22:00', isClosed: false },
    ];

    // 4. Seed Restaurants
    this.restaurants = [
      {
        id: 'rest-1',
        ownerId: 'usr-rest-1',
        categoryId: 'cat-burgers',
        categoryName: 'Hamburguesas',
        name: 'La Brasa Artesanal & Smash',
        slug: 'la-brasa-artesanal',
        description: 'Smash burgers de ganado Angus certificado madurado 30 días, pan brioche horneado cada mañana y papas rústicas al romero.',
        logoUrl: GENERATED_IMAGES.burger,
        coverUrl: GENERATED_IMAGES.burger,
        address: 'Av. Providencia 2140',
        commune: 'Providencia',
        lat: -33.4248,
        lng: -70.6118,
        phone: '+56 2 2419 8200',
        status: RestaurantStatus.OPEN,
        acceptingOrders: true,
        rating: 4.9,
        reviewCount: 342,
        prepTimeMinutes: 22,
        deliveryFee: 1990,
        minOrderAmount: 8500,
        commissionPercent: 15,
        featured: true,
        promoLabel: '20% DCTO en Combos Smash',
        distanceKm: 1.4,
        hours: defaultHours('rest-1'),
        deliveryZones: [
          { id: 'dz-1', restaurantId: 'rest-1', name: 'Providencia / Ñuñoa Norte', radiusKm: 5.5, baseFee: 1990, perKmFee: 300 },
          { id: 'dz-2', restaurantId: 'rest-1', name: 'Las Condes / Vitacura', radiusKm: 8.5, baseFee: 2900, perKmFee: 350 },
        ],
        promotions: [
          {
            id: 'promo-1',
            restaurantId: 'rest-1',
            title: '20% DCTO en Combos Smash Dobles',
            description: 'Descuento automático en combos seleccionados durante toda la semana.',
            badgeText: '20% DCTO',
            discountPercent: 20,
            active: true,
          },
        ],
      },
      {
        id: 'rest-2',
        ownerId: 'usr-rest-1',
        categoryId: 'cat-sushi',
        categoryName: 'Sushi',
        name: 'Nikkei Kyoto & Omakase',
        slug: 'nikkei-kyoto-sushi',
        description: 'Fusión peruano-japonesa de autor. Cortes frescos de salmón austral, atún aleta amarilla, acevichados y rolls flambeados.',
        logoUrl: GENERATED_IMAGES.sushi,
        coverUrl: GENERATED_IMAGES.sushi,
        address: 'Nueva de Lyon 105',
        commune: 'Providencia',
        lat: -33.4215,
        lng: -70.6085,
        phone: '+56 2 2335 1900',
        status: RestaurantStatus.OPEN,
        acceptingOrders: true,
        rating: 4.8,
        reviewCount: 289,
        prepTimeMinutes: 30,
        deliveryFee: 2500,
        minOrderAmount: 12000,
        commissionPercent: 15,
        featured: true,
        promoLabel: 'Gyozas de regalo sobre $25.000',
        distanceKm: 1.8,
        hours: defaultHours('rest-2'),
        deliveryZones: [
          { id: 'dz-3', restaurantId: 'rest-2', name: 'Zona Oriente', radiusKm: 7.0, baseFee: 2500, perKmFee: 350 },
        ],
        promotions: [],
      },
      {
        id: 'rest-3',
        ownerId: 'usr-rest-1',
        categoryId: 'cat-pizza',
        categoryName: 'Pizza',
        name: 'Forno di Napoli Vera Pizza',
        slug: 'forno-di-napoli',
        description: 'Masa madre de 72 horas de fermentación lenta horneada a leña a 485°C con Pomodoro San Marzano DOP y Fior di Latte.',
        logoUrl: GENERATED_IMAGES.pizza,
        coverUrl: GENERATED_IMAGES.pizza,
        address: 'Av. Italia 1420',
        commune: 'Ñuñoa',
        lat: -33.4438,
        lng: -70.6251,
        phone: '+56 2 2501 7740',
        status: RestaurantStatus.OPEN,
        acceptingOrders: true,
        rating: 4.9,
        reviewCount: 415,
        prepTimeMinutes: 25,
        deliveryFee: 1800,
        minOrderAmount: 9000,
        commissionPercent: 14,
        featured: true,
        promoLabel: 'Despacho $990 con código BIENVENIDO',
        distanceKm: 2.1,
        hours: defaultHours('rest-3'),
        deliveryZones: [
          { id: 'dz-4', restaurantId: 'rest-3', name: 'Barrio Italia / Providencia', radiusKm: 6.0, baseFee: 1800, perKmFee: 300 },
        ],
        promotions: [],
      },
      {
        id: 'rest-4',
        ownerId: 'usr-rest-1',
        categoryId: 'cat-mexican',
        categoryName: 'Mexicana',
        name: 'Taquería El Santo & Birriería',
        slug: 'taqueria-el-santo',
        description: 'Auténticos tacos callejeros en tortillas de maíz nixtamalizado hechas a mano, birria de res cocinada 12 horas y guacamole fresco.',
        logoUrl: GENERATED_IMAGES.tacos,
        coverUrl: GENERATED_IMAGES.tacos,
        address: 'General Holley 2320',
        commune: 'Providencia',
        lat: -33.4198,
        lng: -70.6062,
        phone: '+56 2 2884 1230',
        status: RestaurantStatus.OPEN,
        acceptingOrders: true,
        rating: 4.7,
        reviewCount: 198,
        prepTimeMinutes: 18,
        deliveryFee: 1990,
        minOrderAmount: 7500,
        commissionPercent: 15,
        featured: false,
        promoLabel: '3x2 en Tacos Al Pastor',
        distanceKm: 1.6,
        hours: defaultHours('rest-4'),
        deliveryZones: [
          { id: 'dz-5', restaurantId: 'rest-4', name: 'Providencia Centro', radiusKm: 5.0, baseFee: 1990, perKmFee: 300 },
        ],
        promotions: [],
      },
    ];

    // 5. Seed Product Categories
    this.productCategories = [
      { id: 'pcat-1', restaurantId: 'rest-1', name: 'Smash Burgers de Autor', sortOrder: 1 },
      { id: 'pcat-2', restaurantId: 'rest-1', name: 'Acompañamientos & Papas', sortOrder: 2 },
      { id: 'pcat-3', restaurantId: 'rest-1', name: 'Bebidas & Postres', sortOrder: 3 },
      { id: 'pcat-4', restaurantId: 'rest-2', name: 'Rolls Especiales Nikkei', sortOrder: 1 },
      { id: 'pcat-5', restaurantId: 'rest-2', name: 'Sashimi & Nigiris', sortOrder: 2 },
      { id: 'pcat-6', restaurantId: 'rest-3', name: 'Pizzas Napolitanas a la Leña', sortOrder: 1 },
      { id: 'pcat-7', restaurantId: 'rest-4', name: 'Tacos & Birria', sortOrder: 1 },
    ];

    // 6. Seed Products with Rich Modifiers, Options & Extras
    this.products = [
      {
        id: 'prod-1',
        restaurantId: 'rest-1',
        productCategoryId: 'pcat-1',
        categoryName: 'Smash Burgers de Autor',
        name: 'Double Truffle & Aged Cheddar Smash',
        description: 'Doble medallón Angus smash (220g) con costra caramelizada, doble cheddar inglés madurado, cebolla crispy, tocino ahumado en madera de manzano y mayonesa de trufa negra en brioche.',
        price: 11900,
        discountPrice: 9900,
        imageUrl: GENERATED_IMAGES.burger,
        ingredients: ['Carne Angus 220g', 'Queso Cheddar Madurado', 'Tocino Ahumado', 'Mayonesa Trufa Negra', 'Pan Brioche Artesanal'],
        available: true,
        popular: true,
        prepMinutes: 15,
        options: [
          {
            id: 'opt-1',
            productId: 'prod-1',
            name: 'Guarnición Incluida',
            required: true,
            choices: [
              { label: 'Papas Rústicas al Romero', priceDelta: 0 },
              { label: 'Papas Fritas con Parmesano y Trufa', priceDelta: 1500 },
              { label: 'Aros de Cebolla en Tempura Cerveza', priceDelta: 1200 },
            ],
          },
          {
            id: 'opt-2',
            productId: 'prod-1',
            name: 'Bebida del Combo',
            required: true,
            choices: [
              { label: 'Coca-Cola Sin Azúcar 350ml', priceDelta: 0 },
              { label: 'Coca-Cola Original 350ml', priceDelta: 0 },
              { label: 'Limonada Menta Jengibre 450ml', priceDelta: 1200 },
            ],
          },
        ],
        extras: [
          { id: 'ext-1', productId: 'prod-1', name: 'Medallón Extra Smash 110g', price: 2800, available: true },
          { id: 'ext-2', productId: 'prod-1', name: 'Palta Hass Laminada', price: 1600, available: true },
          { id: 'ext-3', productId: 'prod-1', name: 'Doble Tocino Ahumado', price: 1800, available: true },
        ],
      },
      {
        id: 'prod-2',
        restaurantId: 'rest-1',
        productCategoryId: 'pcat-1',
        categoryName: 'Smash Burgers de Autor',
        name: 'Oklahoma Onion Bacon Burger',
        description: 'Clásica técnica Oklahoma con cebolla blanca finamente laminada planchada directamente en la carne Angus, triple queso americano fundido, pepinillos eneldo hechos en casa y salsa secreta Brasa.',
        price: 9800,
        imageUrl: GENERATED_IMAGES.burger,
        ingredients: ['Doble Carne Angus', 'Cebolla Planchada Oklahoma', 'Triple Queso Americano', 'Pepinillos Eneldo', 'Salsa Secreta'],
        available: true,
        popular: true,
        prepMinutes: 14,
        options: [
          {
            id: 'opt-3',
            productId: 'prod-2',
            name: 'Guarnición Incluida',
            required: true,
            choices: [
              { label: 'Papas Rústicas al Romero', priceDelta: 0 },
              { label: 'Papas Cheddar & Bacon Bits', priceDelta: 1800 },
            ],
          },
        ],
        extras: [
          { id: 'ext-4', productId: 'prod-2', name: 'Jalapeños Encurtidos', price: 900, available: true },
          { id: 'ext-5', productId: 'prod-2', name: 'Huevo de Campo a la Plancha', price: 1200, available: true },
        ],
      },
      {
        id: 'prod-3',
        restaurantId: 'rest-1',
        productCategoryId: 'pcat-2',
        categoryName: 'Acompañamientos & Papas',
        name: 'Papas Rústicas Trufadas & Parmesano Reggiano',
        description: 'Porción para compartir (400g) de papas nativas triple cocción, aceite de trufa blanca, lluvia de queso Parmesano Reggiano 24 meses y ciboulette fresco.',
        price: 5900,
        imageUrl: GENERATED_IMAGES.burger,
        ingredients: ['Papas Nativas 400g', 'Aceite de Trufa', 'Parmesano Reggiano', 'Ciboulette'],
        available: true,
        popular: false,
        prepMinutes: 10,
        options: [],
        extras: [
          { id: 'ext-6', productId: 'prod-3', name: 'Salsa Queso Cheddar Caliente (Dip)', price: 1400, available: true },
        ],
      },
      {
        id: 'prod-4',
        restaurantId: 'rest-2',
        productCategoryId: 'pcat-4',
        categoryName: 'Rolls Especiales Nikkei',
        name: 'Acevichado Imperial Roll (10 piezas)',
        description: 'Relleno de camarón ecuatoriano furai y palta cremosa, envuelto en láminas de salmón fresco flambeado con salsa acevichada cítrica, togarashi e hilos de camote crocante.',
        price: 11500,
        imageUrl: GENERATED_IMAGES.sushi,
        ingredients: ['Camarón Ecuatoriano Furai', 'Palta Hass', 'Salmón Austral', 'Salsa Acevichada', 'Hilos de Camote'],
        available: true,
        popular: true,
        prepMinutes: 20,
        options: [
          {
            id: 'opt-4',
            productId: 'prod-4',
            name: 'Salsa Base',
            required: true,
            choices: [
              { label: 'Soya Tradicional Kikkoman', priceDelta: 0 },
              { label: 'Salsa Unagi (Anguila Dulce)', priceDelta: 500 },
              { label: 'Salsa Ponzu Cítrica', priceDelta: 500 },
            ],
          },
        ],
        extras: [
          { id: 'ext-7', productId: 'prod-4', name: 'Porción Jengibre & Wasabi Extra', price: 800, available: true },
          { id: 'ext-8', productId: 'prod-4', name: 'Salsa Acevichada Extra (60ml)', price: 1200, available: true },
        ],
      },
      {
        id: 'prod-5',
        restaurantId: 'rest-2',
        productCategoryId: 'pcat-5',
        categoryName: 'Sashimi & Nigiris',
        name: 'Omakase Sashimi & Nigiri Box (16 piezas)',
        description: 'Selección del Itamae: 6 cortes de sashimi de salmón austral, 4 nigiris de atún con trufa, 4 nigiris de vieira flambeada con mantequilla batayaki y 2 gunkan de ikura.',
        price: 18900,
        discountPrice: 16500,
        imageUrl: GENERATED_IMAGES.sushi,
        ingredients: ['Salmón Austral', 'Atún Aleta Amarilla', 'Vieiras', 'Ikura'],
        available: true,
        popular: true,
        prepMinutes: 22,
        options: [],
        extras: [],
      },
      {
        id: 'prod-6',
        restaurantId: 'rest-3',
        productCategoryId: 'pcat-6',
        categoryName: 'Pizzas Napolitanas a la Leña',
        name: 'Pizza Margherita Verace DOP (32 cm)',
        description: 'Salsa de tomates San Marzano DOP dell’Agro Sarnese-Nocerino, mozzarella Fior di Latte fresca, hojas de albahaca orgánica, Parmigiano Reggiano y aceite de oliva virgen extra.',
        price: 11200,
        imageUrl: GENERATED_IMAGES.pizza,
        ingredients: ['Masa Madre 72h', 'Pomodoro San Marzano DOP', 'Fior di Latte', 'Albahaca Fresca', 'Aceite de Oliva EVO'],
        available: true,
        popular: true,
        prepMinutes: 15,
        options: [
          {
            id: 'opt-5',
            productId: 'prod-6',
            name: 'Tipo de Mozzarella',
            required: true,
            choices: [
              { label: 'Fior di Latte Tradicional', priceDelta: 0 },
              { label: 'Mozzarella di Bufala Campana DOP', priceDelta: 2500 },
            ],
          },
        ],
        extras: [
          { id: 'ext-9', productId: 'prod-6', name: 'Prosciutto di Parma 24 Meses', price: 2900, available: true },
          { id: 'ext-10', productId: 'prod-6', name: 'Burrata Entera Fresca (125g)', price: 3500, available: true },
        ],
      },
      {
        id: 'prod-7',
        restaurantId: 'rest-4',
        productCategoryId: 'pcat-7',
        categoryName: 'Tacos & Birria',
        name: 'Orden de Quesabirrias con Consomé (4 unidades)',
        description: 'Cuatro tortillas de maíz artesanal doradas en la grasa del estofado con queso Oaxaca fundido, birria de res deshebrada, cilantro, cebolla morada y consomé caliente para chopear.',
        price: 10500,
        imageUrl: GENERATED_IMAGES.tacos,
        ingredients: ['Tortilla Maíz Nixtamalizado', 'Birria de Res 12h', 'Queso Oaxaca', 'Consomé Caliente', 'Cilantro y Cebolla'],
        available: true,
        popular: true,
        prepMinutes: 14,
        options: [
          {
            id: 'opt-6',
            productId: 'prod-7',
            name: 'Nivel de Picante Salsa',
            required: true,
            choices: [
              { label: 'Suave (Salsa Verde Tomatillo)', priceDelta: 0 },
              { label: 'Medio (Salsa Taquera Roja)', priceDelta: 0 },
              { label: 'Picante Bravo (Habanero Tatemado)', priceDelta: 500 },
            ],
          },
        ],
        extras: [
          { id: 'ext-11', productId: 'prod-7', name: 'Guacamole Rústico con Totopos', price: 2800, available: true },
        ],
      },
    ];

    // 7. Seed Active Driver with Initial GPS Position near Providencia
    this.drivers = [
      {
        id: 'drv-1',
        userId: 'usr-driver-1',
        name: 'Diego Morales',
        phone: '+56 9 6590 1122',
        vehicleType: 'MOTO',
        vehiclePlate: 'KXZ-84',
        status: DriverStatus.AVAILABLE,
        currentLat: -33.4268,
        currentLng: -70.6092,
        rating: 4.95,
        completedTrips: 214,
        totalEarnings: 684500,
      },
    ];

    // 8. Seed Active Coupons
    this.coupons = [
      {
        id: 'coup-1',
        code: 'BIENVENIDO',
        description: '$3.000 de descuento en tu pedido sobre $10.000',
        discountType: 'FIXED',
        discountValue: 3000,
        minOrderAmount: 10000,
        active: true,
        expiresAt: '2027-12-31T23:59:59.000Z',
      },
      {
        id: 'coup-2',
        code: 'DELIVERY15',
        description: '15% de descuento en el subtotal de tu orden (tope $5.000)',
        discountType: 'PERCENT',
        discountValue: 15,
        minOrderAmount: 12000,
        maxDiscount: 5000,
        active: true,
        expiresAt: '2027-12-31T23:59:59.000Z',
      },
    ];

    // 9. Seed Active Order #1048 so Client, Restaurant, Kitchen, Driver and Admin can test immediately
    const nowIso = new Date().toISOString();
    const tenMinAgoIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const eightMinAgoIso = new Date(Date.now() - 8 * 60 * 1000).toISOString();
    const fiveMinAgoIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const demoOrder1048: Order = {
      id: 'ord-1048',
      orderNumber: 1048,
      clientId: 'usr-client-1',
      clientName: 'Camila Valdés',
      clientPhone: '+56 9 8412 3901',
      restaurantId: 'rest-1',
      restaurantName: 'La Brasa Artesanal & Smash',
      restaurantAddress: 'Av. Providencia 2140, Providencia',
      restaurantLat: -33.4248,
      restaurantLng: -70.6118,
      addressId: 'addr-1',
      deliveryAddress: 'Av. Eliodoro Yáñez 1890, Depto 704, Providencia',
      deliveryInstructions: 'Dejar en conserjería o llamar al citófono 704',
      deliveryLat: -33.4318,
      deliveryLng: -70.6045,
      driverId: 'drv-1',
      driverName: 'Diego Morales',
      driverPhone: '+56 9 6590 1122',
      driverVehicle: 'Moto Honda CB190R · Patente KXZ-84',
      status: OrderStatus.PREPARING,
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: 'WEBPAY_PLUS',
      deliveryMethod: 'DELIVERY',
      subtotal: 21300,
      deliveryFee: 1990,
      serviceFee: 500,
      discountAmount: 0,
      total: 23790,
      platformCommission: 3195, // 15% of 21.300
      restaurantEarnings: 18105,
      driverEarnings: 1990,
      notes: 'Sin pepinillos en una de las burgers por favor. Salsa extra aparte.',
      estimatedMinutes: 18,
      distanceKm: 1.4,
      items: [
        {
          id: 'oitem-1',
          orderId: 'ord-1048',
          productId: 'prod-1',
          productName: 'Double Truffle & Aged Cheddar Smash',
          unitPrice: 11500,
          quantity: 1,
          selectedOptions: [
            { optionName: 'Guarnición Incluida', choiceLabel: 'Papas Rústicas al Romero', priceDelta: 0 },
            { optionName: 'Bebida del Combo', choiceLabel: 'Coca-Cola Sin Azúcar 350ml', priceDelta: 0 },
          ],
          selectedExtras: [{ extraId: 'ext-2', name: 'Palta Hass Laminada', price: 1600 }],
          notes: 'Bien dorada la costra smash',
          lineTotal: 11500,
        },
        {
          id: 'oitem-2',
          orderId: 'ord-1048',
          productId: 'prod-2',
          productName: 'Oklahoma Onion Bacon Burger',
          unitPrice: 9800,
          quantity: 1,
          selectedOptions: [
            { optionName: 'Guarnición Incluida', choiceLabel: 'Papas Rústicas al Romero', priceDelta: 0 },
          ],
          selectedExtras: [],
          lineTotal: 9800,
        },
      ],
      statusHistory: [
        { id: 'sh-1', orderId: 'ord-1048', status: OrderStatus.CREATED, actorRole: Role.CLIENT, timestamp: tenMinAgoIso, note: 'Pedido creado por cliente' },
        { id: 'sh-2', orderId: 'ord-1048', status: OrderStatus.PAID, actorRole: Role.CLIENT, timestamp: eightMinAgoIso, note: 'Pago aprobado vía Webpay Plus (Auth #849201)' },
        { id: 'sh-3', orderId: 'ord-1048', status: OrderStatus.ACCEPTED, actorRole: Role.RESTAURANT, timestamp: fiveMinAgoIso, note: 'Restaurante aceptó el pedido y envió comanda a cocina' },
        { id: 'sh-4', orderId: 'ord-1048', status: OrderStatus.PREPARING, actorRole: Role.KITCHEN, timestamp: nowIso, note: 'Cocina preparando el pedido en plancha' },
      ],
      transaction: {
        id: 'tx-1048',
        paymentId: 'pay-1048',
        orderId: 'ord-1048',
        tokenWs: '01ab94f82e1190c48291048webpayplus',
        buyOrder: 'ORD-1048',
        sessionId: 'SES-usr-client-1',
        amount: 23790,
        authorizationCode: '849201',
        paymentTypeCode: 'VD',
        responseCode: 0,
        cardNumberLast4: '6623',
        installments: 0,
        status: PaymentStatus.PAID,
        createdAt: eightMinAgoIso,
      },
      createdAt: tenMinAgoIso,
      updatedAt: nowIso,
    };

    // Also seed a completed historical order #1042 for repeat-order and metrics
    const yesterdayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const completedOrder1042: Order = {
      id: 'ord-1042',
      orderNumber: 1042,
      clientId: 'usr-client-1',
      clientName: 'Camila Valdés',
      clientPhone: '+56 9 8412 3901',
      restaurantId: 'rest-1',
      restaurantName: 'La Brasa Artesanal & Smash',
      restaurantAddress: 'Av. Providencia 2140, Providencia',
      restaurantLat: -33.4248,
      restaurantLng: -70.6118,
      addressId: 'addr-1',
      deliveryAddress: 'Av. Eliodoro Yáñez 1890, Depto 704, Providencia',
      deliveryLat: -33.4318,
      deliveryLng: -70.6045,
      driverId: 'drv-1',
      driverName: 'Diego Morales',
      driverPhone: '+56 9 6590 1122',
      driverVehicle: 'Moto Honda CB190R · Patente KXZ-84',
      status: OrderStatus.COMPLETED,
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: 'WEBPAY_PLUS',
      deliveryMethod: 'DELIVERY',
      subtotal: 19700,
      deliveryFee: 1990,
      serviceFee: 500,
      discountAmount: 0,
      total: 22190,
      platformCommission: 2955,
      restaurantEarnings: 16745,
      driverEarnings: 1990,
      estimatedMinutes: 25,
      distanceKm: 1.4,
      items: [
        {
          id: 'oitem-1042-1',
          orderId: 'ord-1042',
          productId: 'prod-1',
          productName: 'Double Truffle & Aged Cheddar Smash',
          unitPrice: 9900,
          quantity: 1,
          selectedOptions: [
            { optionName: 'Guarnición Incluida', choiceLabel: 'Papas Rústicas al Romero', priceDelta: 0 },
          ],
          selectedExtras: [],
          lineTotal: 9900,
        },
        {
          id: 'oitem-1042-2',
          orderId: 'ord-1042',
          productId: 'prod-2',
          productName: 'Oklahoma Onion Bacon Burger',
          unitPrice: 9800,
          quantity: 1,
          selectedOptions: [
            { optionName: 'Guarnición Incluida', choiceLabel: 'Papas Rústicas al Romero', priceDelta: 0 },
          ],
          selectedExtras: [],
          lineTotal: 9800,
        },
      ],
      statusHistory: [
        { id: 'sh-42-1', orderId: 'ord-1042', status: OrderStatus.COMPLETED, actorRole: Role.CLIENT, timestamp: yesterdayIso, note: 'Pedido entregado y calificado con 5 estrellas' },
      ],
      transaction: {
        id: 'tx-1042',
        paymentId: 'pay-1042',
        orderId: 'ord-1042',
        tokenWs: '01ab772019481042webpayplus',
        buyOrder: 'ORD-1042',
        sessionId: 'SES-usr-client-1',
        amount: 22190,
        authorizationCode: '512098',
        paymentTypeCode: 'VN',
        responseCode: 0,
        cardNumberLast4: '4019',
        installments: 0,
        status: PaymentStatus.PAID,
        createdAt: yesterdayIso,
      },
      review: {
        id: 'rev-1042',
        orderId: 'ord-1042',
        clientId: 'usr-client-1',
        clientName: 'Camila Valdés',
        restaurantId: 'rest-1',
        restaurantRating: 5,
        driverRating: 5,
        comment: 'Increíble el punto de la carne y las papas llegaron súper crocantes.',
        createdAt: yesterdayIso,
      },
      createdAt: yesterdayIso,
      updatedAt: yesterdayIso,
    };

    this.orders = [demoOrder1048, completedOrder1042];
    this.transactions = [demoOrder1048.transaction!, completedOrder1042.transaction!];
    this.reviews = [completedOrder1042.review!];

    this.driverLocations = [
      {
        id: 'loc-init-1',
        driverId: 'drv-1',
        orderId: 'ord-1048',
        lat: -33.4248,
        lng: -70.6118,
        heading: 135,
        speedKmh: 28,
        timestamp: nowIso,
      },
    ];

    this.notifications = [
      {
        id: 'notif-1',
        userId: 'usr-client-1',
        role: Role.CLIENT,
        orderId: 'ord-1048',
        orderNumber: 1048,
        title: 'Tu pedido está siendo preparado',
        message: 'La cocina de La Brasa Artesanal está preparando tu Pedido #1048.',
        read: false,
        createdAt: nowIso,
      },
      {
        id: 'notif-2',
        userId: 'usr-rest-1',
        role: Role.RESTAURANT,
        orderId: 'ord-1048',
        orderNumber: 1048,
        title: 'Nuevo pedido recibido #1048',
        message: 'Pago validado vía Webpay Plus ($23.790). Comanda en cocina.',
        read: false,
        createdAt: eightMinAgoIso,
      },
    ];
  }
}

export const db = new InMemoryDatabase();
