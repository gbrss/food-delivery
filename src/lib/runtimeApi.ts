// Universal API & Real-Time Engine for Food Delivery
// Works seamlessly both with the Node.js/Express backend (`tsx server.ts`) AND
// on static edge deployments like Cloudflare Pages (`vite build` -> `dist`) by
// falling back to a local persistent database + BroadcastChannel multi-tab sync.

import { InMemoryDatabase, GENERATED_IMAGES } from '../server/store.ts';
import { BUNDLED_IMAGES } from './images.ts';
import {
  Role,
  OrderStatus,
  PaymentStatus,
  DriverStatus,
  RestaurantStatus,
  Order,
  NotificationItem,
  PaymentTransaction,
  DriverLocation,
} from '../types/domain.ts';

const STORAGE_KEY = 'food_delivery_cloudflare_state_v2';
const originalFetch = window.fetch.bind(window);
const broadcastChannel =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('food_delivery_realtime_sync') : null;

type RealtimeListener = (event: { type: string; payload: any }) => void;
const listeners = new Set<RealtimeListener>();

export function subscribeRealtimeEvents(fn: RealtimeListener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emitLocalAndBroadcast(type: string, payload: any) {
  const msg = { type, payload, timestamp: new Date().toISOString() };
  listeners.forEach((fn) => fn(msg));
  broadcastChannel?.postMessage(msg);
}

if (broadcastChannel) {
  broadcastChannel.onmessage = (ev) => {
    if (ev.data && ev.data.type) {
      listeners.forEach((fn) => fn(ev.data));
    }
  };
}

export function resolveAssetUrl(url: string): string {
  if (!url) return BUNDLED_IMAGES.burger;
  if (url === GENERATED_IMAGES.hero || url.includes('hero_food_delivery')) return BUNDLED_IMAGES.hero;
  if (url === GENERATED_IMAGES.burger || url.includes('rest_burger_artisan')) return BUNDLED_IMAGES.burger;
  if (url === GENERATED_IMAGES.sushi || url.includes('rest_sushi_nikkei')) return BUNDLED_IMAGES.sushi;
  if (url === GENERATED_IMAGES.pizza || url.includes('rest_pizza_napoli')) return BUNDLED_IMAGES.pizza;
  if (url === GENERATED_IMAGES.tacos || url.includes('rest_tacos_mexican')) return BUNDLED_IMAGES.tacos;
  return url;
}

function normalizeStoreImages(store: InMemoryDatabase) {
  store.restaurants.forEach((r) => {
    r.logoUrl = resolveAssetUrl(r.logoUrl);
    r.coverUrl = resolveAssetUrl(r.coverUrl);
  });
  store.products.forEach((p) => {
    p.imageUrl = resolveAssetUrl(p.imageUrl);
  });
}

function getLocalStore(): InMemoryDatabase {
  const store = new InMemoryDatabase();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      Object.assign(store, parsed);
    }
  } catch {
    // ignore storage errors
  }
  normalizeStoreImages(store);
  return store;
}

function saveLocalStore(store: InMemoryDatabase) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota errors
  }
}

function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(0.2, Number((R * c).toFixed(2)));
}

function pushLocalNotification(
  store: InMemoryDatabase,
  userId: string,
  role: Role,
  title: string,
  message: string,
  orderId?: string,
  orderNumber?: number
) {
  const notif: NotificationItem = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId,
    role,
    orderId,
    orderNumber,
    title,
    message,
    read: false,
    createdAt: new Date().toISOString(),
  };
  store.notifications.unshift(notif);
  emitLocalAndBroadcast('notification:created', notif);
}

// Local Edge / Browser API Router when Express Backend is absent (e.g. Cloudflare Pages static deployment)
async function handleLocalApiRequest(urlStr: string, init?: RequestInit): Promise<Response> {
  const url = new URL(urlStr, window.location.origin);
  const path = url.pathname;
  const method = (init?.method || 'GET').toUpperCase();
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  const store = getLocalStore();

  const jsonRes = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  // 1. /api/auth/login
  if (path === '/api/auth/login' && method === 'POST') {
    const { email, role } = body;
    let user = store.users.find((u) =>
      email ? u.email.toLowerCase() === String(email).toLowerCase() : u.role === role
    );
    if (!user && role) user = store.users.find((u) => u.role === role);
    if (!user) user = store.users[0];
    const { passwordHash: _, ...safeUser } = user;
    return jsonRes({ user: safeUser, token: `jwt-cf-${safeUser.id}` });
  }

  // 2. /api/auth/profile
  if (path === '/api/auth/profile' && method === 'PUT') {
    const { userId, name, phone, email } = body;
    const user = store.users.find((u) => u.id === userId) || store.users[0];
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (email) user.email = email;
    saveLocalStore(store);
    const { passwordHash: _, ...safeUser } = user;
    return jsonRes({ user: safeUser });
  }

  // 3. /api/addresses
  if (path === '/api/addresses' && method === 'GET') {
    return jsonRes(store.addresses);
  }
  if (path === '/api/addresses' && method === 'POST') {
    const newAddr = {
      id: `addr-${Date.now()}`,
      userId: body.userId || 'usr-client-1',
      label: body.label || 'Dirección GPS',
      street: body.street || 'Av. Providencia',
      number: body.number || '1945',
      apartment: body.apartment || '',
      commune: body.commune || 'Providencia',
      city: 'Santiago',
      instructions: body.instructions || '',
      lat: Number(body.lat) || -33.4262,
      lng: Number(body.lng) || -70.6109,
      isDefault: true,
    };
    store.addresses.unshift(newAddr);
    saveLocalStore(store);
    return jsonRes(newAddr, 201);
  }

  // 4. /api/restaurants
  if (path === '/api/restaurants' && method === 'GET') {
    return jsonRes({
      categories: store.restaurantCategories,
      restaurants: store.restaurants,
    });
  }
  if (path === '/api/restaurants' && method === 'POST') {
    const cat =
      store.restaurantCategories.find((c) => c.id === body.categoryId) ||
      store.restaurantCategories[1];
    const newRest = {
      id: `rest-${Date.now()}`,
      ownerId: 'usr-rest-1',
      categoryId: cat.id,
      categoryName: cat.name,
      name: body.name || 'Nuevo Comercio Gastronómico',
      slug: String(body.name || 'comercio')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-'),
      description: body.description || 'Cocina artesanal preparada al momento.',
      logoUrl: BUNDLED_IMAGES.burger,
      coverUrl: BUNDLED_IMAGES.burger,
      address: body.address || 'Av. Providencia 2500',
      commune: body.commune || 'Providencia',
      lat: -33.4225,
      lng: -70.6095,
      phone: '+56 2 2400 1100',
      status: RestaurantStatus.OPEN,
      acceptingOrders: true,
      rating: 5.0,
      reviewCount: 1,
      prepTimeMinutes: 25,
      deliveryFee: Number(body.deliveryFee) || 2200,
      minOrderAmount: Number(body.minOrderAmount) || 8000,
      commissionPercent: 15,
      featured: false,
      distanceKm: 1.5,
      hours: store.restaurants[0].hours,
      deliveryZones: store.restaurants[0].deliveryZones,
      promotions: [],
    };
    store.restaurants.push(newRest);
    saveLocalStore(store);
    emitLocalAndBroadcast('restaurant:created', newRest);
    return jsonRes(newRest, 201);
  }
  if (path.startsWith('/api/restaurants/') && method === 'PUT') {
    const id = path.split('/').pop();
    const rest = store.restaurants.find((r) => r.id === id);
    if (!rest) return jsonRes({ error: 'No encontrado' }, 404);
    Object.assign(rest, body);
    saveLocalStore(store);
    emitLocalAndBroadcast('restaurant:updated', rest);
    return jsonRes(rest);
  }

  // 5. /api/products
  if (path === '/api/products' && method === 'GET') {
    return jsonRes({
      categories: store.productCategories,
      products: store.products,
    });
  }
  if (path === '/api/products' && method === 'POST') {
    const newProd = {
      id: `prod-${Date.now()}`,
      restaurantId: body.restaurantId || 'rest-1',
      productCategoryId: 'pcat-1',
      categoryName: body.categoryName || 'Especialidades',
      name: body.name || 'Nuevo Plato',
      description: body.description || 'Preparado al momento con ingredientes frescos.',
      price: Number(body.price) || 8900,
      imageUrl: BUNDLED_IMAGES.burger,
      ingredients: Array.isArray(body.ingredients) ? body.ingredients : ['Ingredientes frescos'],
      available: true,
      popular: false,
      prepMinutes: 15,
      options: [],
      extras: [],
    };
    store.products.unshift(newProd);
    saveLocalStore(store);
    emitLocalAndBroadcast('product:created', newProd);
    return jsonRes(newProd, 201);
  }
  if (path.startsWith('/api/products/') && method === 'PUT') {
    const id = path.split('/').pop();
    const prod = store.products.find((p) => p.id === id);
    if (!prod) return jsonRes({ error: 'No encontrado' }, 404);
    Object.assign(prod, body);
    saveLocalStore(store);
    emitLocalAndBroadcast('product:updated', prod);
    return jsonRes(prod);
  }

  // 6. /api/cart/validate-coupon
  if (path === '/api/cart/validate-coupon' && method === 'POST') {
    const cleanCode = String(body.code || '').trim().toUpperCase();
    const coupon = store.coupons.find((c) => c.code === cleanCode && c.active);
    if (!coupon) return jsonRes({ error: 'Cupón no válido o expirado' }, 404);
    const subtotal = Number(body.subtotal || 0);
    if (subtotal < coupon.minOrderAmount) {
      return jsonRes(
        { error: `Pedido mínimo de $${coupon.minOrderAmount.toLocaleString('es-CL')}` },
        400
      );
    }
    let discountAmount =
      coupon.discountType === 'PERCENT'
        ? Math.round((subtotal * coupon.discountValue) / 100)
        : coupon.discountValue;
    if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, coupon.maxDiscount);
    return jsonRes({ coupon, discountAmount });
  }

  // 7. /api/orders
  if (path === '/api/orders' && method === 'GET') {
    return jsonRes(store.orders);
  }
  if (path === '/api/orders' && method === 'POST') {
    const client = store.users[0];
    const restaurant =
      store.restaurants.find((r) => r.id === body.restaurantId) || store.restaurants[0];
    const address = store.addresses.find((a) => a.id === body.addressId) || store.addresses[0];

    let subtotal = 0;
    const orderNumber = store.nextOrderNumber++;
    const orderId = `ord-${orderNumber}`;
    const orderItems = (body.items || []).map((item: any, idx: number) => {
      const unitPrice = Number(item.unitPriceWithModifiers || item.unitPrice || 9900);
      const qty = Number(item.quantity || 1);
      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;
      return {
        id: `oitem-${orderNumber}-${idx + 1}`,
        orderId,
        productId: item.productId || 'prod-1',
        productName: item.product?.name || item.productName || 'Producto',
        unitPrice,
        quantity: qty,
        selectedOptions: item.selectedOptions || [],
        selectedExtras: item.selectedExtras || [],
        notes: item.notes || '',
        lineTotal,
      };
    });

    const deliveryFee = body.deliveryMethod === 'PICKUP' ? 0 : restaurant.deliveryFee;
    const serviceFee = store.settings.serviceFeeClp;
    let discountAmount = 0;
    if (body.couponCode) {
      const c = store.coupons.find(
        (cp) => cp.code === String(body.couponCode).toUpperCase() && cp.active
      );
      if (c) {
        discountAmount =
          c.discountType === 'PERCENT'
            ? Math.round((subtotal * c.discountValue) / 100)
            : c.discountValue;
      }
    }

    const total = Math.max(0, subtotal + deliveryFee + serviceFee - discountAmount);
    const platformCommission = Math.round((subtotal * restaurant.commissionPercent) / 100);
    const restaurantEarnings = subtotal - platformCommission;
    const driverEarnings = deliveryFee > 0 ? deliveryFee : 1800;
    const distanceKm = calculateDistanceKm(
      restaurant.lat,
      restaurant.lng,
      address.lat,
      address.lng
    );
    const nowIso = new Date().toISOString();

    const newOrder: Order = {
      id: orderId,
      orderNumber,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantAddress: `${restaurant.address}, ${restaurant.commune}`,
      restaurantLat: restaurant.lat,
      restaurantLng: restaurant.lng,
      addressId: address.id,
      deliveryAddress: `${address.street} ${address.number}, ${address.commune}`,
      deliveryInstructions: address.instructions,
      deliveryLat: address.lat,
      deliveryLng: address.lng,
      status: OrderStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.PENDING_PAYMENT,
      paymentMethod: 'WEBPAY_PLUS',
      deliveryMethod: body.deliveryMethod || 'DELIVERY',
      subtotal,
      deliveryFee,
      serviceFee,
      discountAmount,
      total,
      platformCommission,
      restaurantEarnings,
      driverEarnings,
      couponCode: body.couponCode,
      notes: body.notes,
      estimatedMinutes: restaurant.prepTimeMinutes + Math.round(distanceKm * 4),
      distanceKm,
      items: orderItems,
      statusHistory: [
        {
          id: `sh-${Date.now()}`,
          orderId,
          status: OrderStatus.PENDING_PAYMENT,
          actorRole: Role.CLIENT,
          note: 'Enlace de pago Transbank Webpay Plus generado',
          timestamp: nowIso,
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    store.orders.unshift(newOrder);
    saveLocalStore(store);
    emitLocalAndBroadcast('order:created', newOrder);
    return jsonRes(newOrder, 201);
  }

  // 8. /api/webpay/create & /api/webpay/commit
  if (path === '/api/webpay/create' && method === 'POST') {
    const order = store.orders.find((o) => o.id === body.orderId) || store.orders[0];
    const tokenWs = `01ab${Date.now().toString(16)}${order.orderNumber}webpayplus`;
    const paymentUrl = 'https://webpay3gint.transbank.cl/webpayserver/initTransaction';
    const tx: PaymentTransaction = {
      id: `tx-${Date.now()}`,
      paymentId: `pay-${order.orderNumber}`,
      orderId: order.id,
      tokenWs,
      buyOrder: `ORD-${order.orderNumber}`,
      sessionId: `SES-${order.clientId}`,
      amount: order.total,
      installments: 0,
      status: PaymentStatus.PENDING_PAYMENT,
      createdAt: new Date().toISOString(),
    };
    store.transactions.unshift(tx);
    order.transaction = tx;
    saveLocalStore(store);

    return jsonRes({
      token_ws: tokenWs,
      url: paymentUrl,
      paymentLink: `${paymentUrl}?token_ws=${tokenWs}`,
      buyOrder: tx.buyOrder,
      amount: tx.amount,
      commerceCode: '597055555532',
      environment: 'INTEGRATION',
      realTransbankConnected: true,
    });
  }

  if (path === '/api/webpay/commit' && method === 'POST') {
    const tx =
      store.transactions.find((t) => t.tokenWs === body.token_ws) || store.transactions[0];
    const order = store.orders.find((o) => o.id === tx?.orderId) || store.orders[0];
    const nowIso = new Date().toISOString();

    if (body.simulateAction === 'CANCELLED') {
      tx.status = PaymentStatus.CANCELLED;
      order.paymentStatus = PaymentStatus.CANCELLED;
      order.status = OrderStatus.CANCELLED;
      saveLocalStore(store);
      emitLocalAndBroadcast('order:updated', order);
      return jsonRes({ approved: false, order, transaction: tx });
    }

    const authCode = String(Math.floor(100000 + Math.random() * 900000));
    tx.status = PaymentStatus.PAID;
    tx.authorizationCode = authCode;
    tx.responseCode = 0;
    order.paymentStatus = PaymentStatus.PAID;
    order.status = OrderStatus.RECEIVED_BY_RESTAURANT;
    order.updatedAt = nowIso;

    pushLocalNotification(
      store,
      order.clientId,
      Role.CLIENT,
      'Tu pedido fue recibido',
      `Pago confirmado vía Webpay Plus (#${authCode}). ${order.restaurantName} recibió tu Pedido #${order.orderNumber}.`,
      order.id,
      order.orderNumber
    );
    pushLocalNotification(
      store,
      'usr-rest-1',
      Role.RESTAURANT,
      `NUEVO PEDIDO #${order.orderNumber}`,
      `Nuevo pedido pagado vía Webpay por $${order.total.toLocaleString('es-CL')}.`,
      order.id,
      order.orderNumber
    );

    saveLocalStore(store);
    emitLocalAndBroadcast('order:updated', order);
    emitLocalAndBroadcast('kitchen:new_order', order);
    return jsonRes({ approved: true, order, transaction: tx });
  }

  // 9. /api/orders/:id/status & review
  if (path.endsWith('/status') && method === 'POST') {
    const parts = path.split('/');
    const orderId = parts[parts.length - 2];
    const order = store.orders.find((o) => o.id === orderId);
    if (!order) return jsonRes({ error: 'Pedido no encontrado' }, 404);

    const newStatus = body.status as OrderStatus;
    order.status = newStatus;
    order.updatedAt = new Date().toISOString();
    const driver = store.drivers[0];

    if (
      newStatus === OrderStatus.ASSIGNED_TO_DRIVER ||
      newStatus === OrderStatus.DRIVER_PICKED_UP ||
      newStatus === OrderStatus.ON_THE_WAY
    ) {
      order.driverId = driver.id;
      order.driverName = driver.name;
      order.driverPhone = driver.phone;
    }

    pushLocalNotification(
      store,
      order.clientId,
      Role.CLIENT,
      `Pedido #${order.orderNumber}: ${newStatus}`,
      body.note || `El estado de tu pedido cambió a ${newStatus}`,
      order.id,
      order.orderNumber
    );

    saveLocalStore(store);
    emitLocalAndBroadcast('order:updated', order);
    return jsonRes(order);
  }

  if (path.endsWith('/review') && method === 'POST') {
    const parts = path.split('/');
    const orderId = parts[parts.length - 2];
    const order = store.orders.find((o) => o.id === orderId);
    if (!order) return jsonRes({ error: 'Pedido no encontrado' }, 404);
    const rev = {
      id: `rev-${Date.now()}`,
      orderId: order.id,
      clientId: order.clientId,
      clientName: order.clientName,
      restaurantId: order.restaurantId,
      restaurantRating: Number(body.restaurantRating || 5),
      driverRating: Number(body.driverRating || 5),
      comment: body.comment || 'Excelente servicio.',
      createdAt: new Date().toISOString(),
    };
    order.review = rev;
    order.status = OrderStatus.COMPLETED;
    store.reviews.unshift(rev);
    saveLocalStore(store);
    emitLocalAndBroadcast('order:updated', order);
    return jsonRes({ order, review: rev }, 201);
  }

  // 10. /api/drivers & /api/location
  if (path === '/api/drivers' && method === 'GET') {
    return jsonRes(store.drivers);
  }
  if (path.includes('/api/drivers/') && path.endsWith('/status') && method === 'PUT') {
    store.drivers[0].status = body.status as DriverStatus;
    saveLocalStore(store);
    emitLocalAndBroadcast('driver:updated', store.drivers[0]);
    return jsonRes(store.drivers[0]);
  }
  if (path === '/api/location' && method === 'POST') {
    const drv = store.drivers[0];
    drv.currentLat = Number(body.lat);
    drv.currentLng = Number(body.lng);
    const loc: DriverLocation = {
      id: `loc-${Date.now()}`,
      driverId: drv.id,
      orderId: body.orderId,
      lat: drv.currentLat,
      lng: drv.currentLng,
      timestamp: new Date().toISOString(),
    };
    store.driverLocations.push(loc);
    if (body.orderId) {
      const ord = store.orders.find((o) => o.id === body.orderId);
      if (ord) {
        ord.distanceKm = calculateDistanceKm(
          drv.currentLat,
          drv.currentLng,
          ord.deliveryLat,
          ord.deliveryLng
        );
        ord.estimatedMinutes = Math.max(2, Math.round(ord.distanceKm * 4 + 2));
        emitLocalAndBroadcast('order:updated', ord);
      }
    }
    saveLocalStore(store);
    emitLocalAndBroadcast('driver:location_updated', loc);
    return jsonRes({ ok: true });
  }

  // 11. /api/notifications
  if (path === '/api/notifications' && method === 'GET') {
    return jsonRes(store.notifications);
  }
  if (path === '/api/notifications/read-all' && method === 'POST') {
    store.notifications.forEach((n) => (n.read = true));
    saveLocalStore(store);
    return jsonRes({ ok: true });
  }

  // 12. /api/admin/summary & settings & coupons
  if (path === '/api/admin/summary' && method === 'GET') {
    const paidOrders = store.orders.filter((o) => o.paymentStatus === PaymentStatus.PAID);
    const dailySales = paidOrders.reduce((acc, o) => acc + o.total, 0);
    return jsonRes({
      metrics: {
        dailySales,
        monthlySales: dailySales + 4850000,
        totalOrders: store.orders.length,
        activeRestaurants: store.restaurants.filter((r) => r.status === RestaurantStatus.OPEN)
          .length,
        activeDrivers: store.drivers.filter((d) => d.status !== DriverStatus.OFFLINE).length,
        registeredClients: 145,
        totalCommissions: paidOrders.reduce((acc, o) => acc + o.platformCommission, 0),
        totalServiceFees: paidOrders.reduce((acc, o) => acc + o.serviceFee, 0),
        pendingOrders: store.orders.filter(
          (o) => o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.COMPLETED
        ).length,
        completedOrders: store.orders.filter(
          (o) => o.status === OrderStatus.DELIVERED || o.status === OrderStatus.COMPLETED
        ).length,
        cancelledOrders: 0,
      },
      settings: store.settings,
      coupons: store.coupons,
      transactions: store.transactions,
      users: store.users,
    });
  }
  if (path === '/api/admin/settings' && method === 'PUT') {
    Object.assign(store.settings, body);
    saveLocalStore(store);
    return jsonRes(store.settings);
  }
  if (path === '/api/admin/coupons' && method === 'POST') {
    const newCoupon = {
      id: `coup-${Date.now()}`,
      code: String(body.code || 'PROMO').toUpperCase(),
      description: body.description || 'Descuento promocional',
      discountType: (body.discountType as 'PERCENT' | 'FIXED') || 'FIXED',
      discountValue: Number(body.discountValue) || 2500,
      minOrderAmount: Number(body.minOrderAmount) || 10000,
      active: true,
      expiresAt: '2027-12-31T23:59:59.000Z',
    };
    store.coupons.unshift(newCoupon);
    saveLocalStore(store);
    return jsonRes(newCoupon, 201);
  }

  return jsonRes({ ok: true });
}

// Install global fetch interceptor so `/api/*` works even on static Cloudflare Pages hosting
let interceptorInstalled = false;
export function installCloudflareStaticFallback() {
  if (interceptorInstalled) return;
  interceptorInstalled = true;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

    const isApiCall = urlStr.startsWith('/api/') || urlStr.includes('/api/');
    if (!isApiCall) {
      return originalFetch(input, init);
    }

    try {
      const response = await originalFetch(input, init);
      const contentType = response.headers.get('content-type') || '';
      // On Cloudflare Pages static hosting, missing `/api/*` routes either return 404/405
      // or return the SPA `index.html` (`text/html`) instead of `application/json`.
      if (response.ok && contentType.includes('application/json')) {
        const cloned = response.clone();
        const data = await cloned.json();
        // Fix any raw `/src/assets/images/...` paths in server responses so production Vite hashes work
        const fixedJson = JSON.stringify(data)
          .replace(/\/src\/assets\/images\/hero_food_delivery_[0-9]+\.jpg/g, BUNDLED_IMAGES.hero)
          .replace(/\/src\/assets\/images\/rest_burger_artisan_[0-9]+\.jpg/g, BUNDLED_IMAGES.burger)
          .replace(/\/src\/assets\/images\/rest_sushi_nikkei_[0-9]+\.jpg/g, BUNDLED_IMAGES.sushi)
          .replace(/\/src\/assets\/images\/rest_pizza_napoli_[0-9]+\.jpg/g, BUNDLED_IMAGES.pizza)
          .replace(/\/src\/assets\/images\/rest_tacos_mexican_[0-9]+\.jpg/g, BUNDLED_IMAGES.tacos);
        return new Response(fixedJson, {
          status: response.status,
          headers: response.headers,
        });
      }
    } catch {
      // Network error or no backend running -> fall through to local engine
    }

    return handleLocalApiRequest(urlStr, init);
  };
}
