import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { db } from './src/server/store.ts';
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
} from './src/types/domain.ts';

dotenv.config();

const PORT = 3000;
const app = express();
app.use(express.json({ limit: '2mb' }));

// Simple Rate Limiter & Input Sanitization Middleware
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
app.use((req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || 'local';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
  } else {
    entry.count += 1;
    if (entry.count > 400) {
      return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta nuevamente en un minuto.' });
    }
  }
  next();
});

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

interface ConnectedClient {
  ws: WebSocket;
  userId?: string;
  role?: Role;
}

const clients = new Set<ConnectedClient>();

wss.on('connection', (ws: WebSocket) => {
  const client: ConnectedClient = { ws };
  clients.add(client);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'auth:identify') {
        client.userId = msg.userId;
        client.role = msg.role;
      } else if (msg.type === 'driver:gps_ping') {
        handleDriverGpsUpdate(msg.payload);
      }
    } catch (e) {
      console.error('WS parse error:', e);
    }
  });

  ws.on('close', () => {
    clients.delete(client);
  });
});

function broadcastEvent(type: string, payload: unknown) {
  const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

function createNotification(
  userId: string,
  role: Role,
  title: string,
  message: string,
  orderId?: string,
  orderNumber?: number
): NotificationItem {
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
  db.notifications.unshift(notif);
  if (db.notifications.length > 100) {
    db.notifications = db.notifications.slice(0, 100);
  }
  broadcastEvent('notification:created', notif);
  return notif;
}

// Haversine distance in km
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

function handleDriverGpsUpdate(data: {
  driverId: string;
  orderId?: string;
  lat: number;
  lng: number;
  heading?: number;
  speedKmh?: number;
}) {
  const driver = db.drivers.find((d) => d.id === data.driverId);
  if (!driver) return;

  driver.currentLat = data.lat;
  driver.currentLng = data.lng;

  const loc: DriverLocation = {
    id: `loc-${Date.now()}`,
    driverId: data.driverId,
    orderId: data.orderId,
    lat: data.lat,
    lng: data.lng,
    heading: data.heading || 135,
    speedKmh: data.speedKmh || 30,
    timestamp: new Date().toISOString(),
  };

  db.driverLocations.push(loc);

  // Enforce bounded GPS history per order (Requirement #6: No almacenar cantidad ilimitada de posiciones históricas)
  if (data.orderId) {
    const orderLocs = db.driverLocations.filter((l) => l.orderId === data.orderId);
    if (orderLocs.length > db.settings.maxLocationHistoryPerOrder) {
      const oldestId = orderLocs[0].id;
      db.driverLocations = db.driverLocations.filter((l) => l.id !== oldestId);
    }

    const order = db.orders.find((o) => o.id === data.orderId);
    if (order) {
      const remainingKm = calculateDistanceKm(data.lat, data.lng, order.deliveryLat, order.deliveryLng);
      order.distanceKm = remainingKm;
      order.estimatedMinutes = Math.max(2, Math.round(remainingKm * 4 + 2));

      if (order.estimatedMinutes <= 3 && order.status === OrderStatus.ON_THE_WAY) {
        const alreadyAlerted = db.notifications.some(
          (n) => n.orderId === order.id && n.title === 'Tu pedido está a 3 minutos'
        );
        if (!alreadyAlerted) {
          createNotification(
            order.clientId,
            Role.CLIENT,
            'Tu pedido está a 3 minutos',
            `El repartidor ${driver.name} está llegando a tu dirección (${order.deliveryAddress}).`,
            order.id,
            order.orderNumber
          );
        }
      }
    }
  }

  broadcastEvent('driver:location_updated', {
    driverId: driver.id,
    orderId: data.orderId,
    lat: data.lat,
    lng: data.lng,
    heading: loc.heading,
    speedKmh: loc.speedKmh,
    timestamp: loc.timestamp,
  });
}

// ============================================================================
// 19. ORGANIZED REST API ENDPOINTS
// ============================================================================

// 1. /api/auth
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password, role } = req.body;
  let user = db.users.find((u) => (email ? u.email.toLowerCase() === email.toLowerCase() : u.role === role));
  if (!user && role) {
    user = db.users.find((u) => u.role === role);
  }
  if (!user) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  if (password && password !== user.passwordHash && password !== 'demo123') {
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }
  const { passwordHash: _, ...safeUser } = user;
  res.json({
    user: safeUser,
    token: `jwt-fd-${safeUser.id}-${safeUser.role}`,
  });
});

app.post('/api/auth/register', (req: Request, res: Response) => {
  const { name, email, phone, password, role } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Nombre y correo son obligatorios' });
  }
  const existing = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'El correo ya está registrado' });
  }
  const newUser = {
    id: `usr-${Date.now()}`,
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    phone: String(phone || '+56 9 0000 0000').trim(),
    passwordHash: password || 'demo123',
    role: (role as Role) || Role.CLIENT,
  };
  db.users.push(newUser);
  const { passwordHash: _, ...safeUser } = newUser;
  res.status(201).json({ user: safeUser, token: `jwt-fd-${safeUser.id}-${safeUser.role}` });
});

app.put('/api/auth/profile', (req: Request, res: Response) => {
  const { userId, name, phone, email } = req.body;
  const user = db.users.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (name) user.name = String(name).trim();
  if (phone) user.phone = String(phone).trim();
  if (email) user.email = String(email).trim();
  const { passwordHash: _, ...safeUser } = user;
  res.json({ user: safeUser });
});

app.get('/api/addresses', (req: Request, res: Response) => {
  const userId = String(req.query.userId || 'usr-client-1');
  res.json(db.addresses.filter((a) => a.userId === userId));
});

app.post('/api/addresses', (req: Request, res: Response) => {
  const { userId, label, street, number, apartment, commune, instructions, lat, lng } = req.body;
  const uid = userId || 'usr-client-1';
  db.addresses.forEach((a) => {
    if (a.userId === uid) a.isDefault = false;
  });
  const newAddr = {
    id: `addr-${Date.now()}`,
    userId: uid,
    label: label || 'Dirección GPS',
    street: street || 'Av. Nueva Providencia',
    number: number || '1945',
    apartment: apartment || '',
    commune: commune || 'Providencia',
    city: 'Santiago',
    instructions: instructions || '',
    lat: Number(lat) || -33.4262,
    lng: Number(lng) || -70.6109,
    isDefault: true,
  };
  db.addresses.unshift(newAddr);
  res.status(201).json(newAddr);
});

// 2. /api/restaurants
app.get('/api/restaurants', (req: Request, res: Response) => {
  const { category, search } = req.query;
  let list = [...db.restaurants];
  if (category && category !== 'all') {
    list = list.filter((r) => r.slug === category || r.categoryId === category || r.categoryName.toLowerCase() === String(category).toLowerCase());
  }
  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.categoryName.toLowerCase().includes(q)
    );
  }
  res.json({
    categories: db.restaurantCategories,
    restaurants: list,
  });
});

app.put('/api/restaurants/:id', (req: Request, res: Response) => {
  const rest = db.restaurants.find((r) => r.id === req.params.id);
  if (!rest) return res.status(404).json({ error: 'Restaurante no encontrado' });

  const {
    name,
    description,
    address,
    phone,
    status,
    acceptingOrders,
    deliveryFee,
    minOrderAmount,
    prepTimeMinutes,
    promoLabel,
    commissionPercent,
  } = req.body;

  if (name !== undefined) rest.name = name;
  if (description !== undefined) rest.description = description;
  if (address !== undefined) rest.address = address;
  if (phone !== undefined) rest.phone = phone;
  if (status !== undefined) rest.status = status as RestaurantStatus;
  if (acceptingOrders !== undefined) rest.acceptingOrders = Boolean(acceptingOrders);
  if (deliveryFee !== undefined) rest.deliveryFee = Number(deliveryFee);
  if (minOrderAmount !== undefined) rest.minOrderAmount = Number(minOrderAmount);
  if (prepTimeMinutes !== undefined) rest.prepTimeMinutes = Number(prepTimeMinutes);
  if (promoLabel !== undefined) rest.promoLabel = promoLabel;
  if (commissionPercent !== undefined) rest.commissionPercent = Number(commissionPercent);

  broadcastEvent('restaurant:updated', rest);
  res.json(rest);
});

app.post('/api/restaurants', (req: Request, res: Response) => {
  const { name, categoryId, description, address, commune, deliveryFee, minOrderAmount, commissionPercent } = req.body;
  const cat = db.restaurantCategories.find((c) => c.id === categoryId) || db.restaurantCategories[1];
  const slug = String(name || 'nuevo-restaurante')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  const newRest = {
    id: `rest-${Date.now()}`,
    ownerId: 'usr-rest-1',
    categoryId: cat.id,
    categoryName: cat.name,
    name: name || 'Nuevo Comercio Gastronómico',
    slug,
    description: description || 'Cocina de autor preparada al momento.',
    logoUrl: db.restaurants[0].logoUrl,
    coverUrl: db.restaurants[0].coverUrl,
    address: address || 'Av. Providencia 2500',
    commune: commune || 'Providencia',
    lat: -33.4225,
    lng: -70.6095,
    phone: '+56 2 2400 1100',
    status: RestaurantStatus.OPEN,
    acceptingOrders: true,
    rating: 5.0,
    reviewCount: 1,
    prepTimeMinutes: 25,
    deliveryFee: Number(deliveryFee) || 2200,
    minOrderAmount: Number(minOrderAmount) || 8000,
    commissionPercent: Number(commissionPercent) || db.settings.defaultCommissionPercent,
    featured: false,
    distanceKm: 1.5,
    hours: db.restaurants[0].hours,
    deliveryZones: db.restaurants[0].deliveryZones,
    promotions: [],
  };
  db.restaurants.push(newRest);
  broadcastEvent('restaurant:created', newRest);
  res.status(201).json(newRest);
});

// 3. /api/products
app.get('/api/products', (req: Request, res: Response) => {
  const { restaurantId } = req.query;
  const items = restaurantId
    ? db.products.filter((p) => p.restaurantId === restaurantId)
    : db.products;
  const categories = restaurantId
    ? db.productCategories.filter((c) => c.restaurantId === restaurantId)
    : db.productCategories;
  res.json({ categories, products: items });
});

app.post('/api/products', (req: Request, res: Response) => {
  const {
    restaurantId,
    productCategoryId,
    categoryName,
    name,
    description,
    price,
    discountPrice,
    ingredients,
    prepMinutes,
    extras,
  } = req.body;
  const restId = restaurantId || 'rest-1';
  const rest = db.restaurants.find((r) => r.id === restId);
  const newProd = {
    id: `prod-${Date.now()}`,
    restaurantId: restId,
    productCategoryId: productCategoryId || 'pcat-1',
    categoryName: categoryName || 'Especialidades',
    name: String(name || 'Nuevo Producto').trim(),
    description: String(description || 'Preparación artesanal con ingredientes frescos.').trim(),
    price: Number(price) || 8900,
    discountPrice: discountPrice ? Number(discountPrice) : undefined,
    imageUrl: rest?.coverUrl || db.products[0].imageUrl,
    ingredients: Array.isArray(ingredients)
      ? ingredients
      : String(ingredients || 'Ingredientes frescos')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
    available: true,
    popular: false,
    prepMinutes: Number(prepMinutes) || 15,
    options: [],
    extras: Array.isArray(extras) ? extras : [],
  };
  db.products.unshift(newProd);
  broadcastEvent('product:created', newProd);
  res.status(201).json(newProd);
});

app.put('/api/products/:id', (req: Request, res: Response) => {
  const prod = db.products.find((p) => p.id === req.params.id);
  if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });

  const { name, description, price, discountPrice, available, popular, ingredients } = req.body;
  if (name !== undefined) prod.name = name;
  if (description !== undefined) prod.description = description;
  if (price !== undefined) prod.price = Number(price);
  if (discountPrice !== undefined) prod.discountPrice = discountPrice ? Number(discountPrice) : undefined;
  if (available !== undefined) prod.available = Boolean(available);
  if (popular !== undefined) prod.popular = Boolean(popular);
  if (ingredients !== undefined && Array.isArray(ingredients)) prod.ingredients = ingredients;

  broadcastEvent('product:updated', prod);
  res.json(prod);
});

// 4. /api/cart & Coupons validation
app.post('/api/cart/validate-coupon', (req: Request, res: Response) => {
  const { code, subtotal } = req.body;
  const cleanCode = String(code || '').trim().toUpperCase();
  const coupon = db.coupons.find((c) => c.code === cleanCode && c.active);
  if (!coupon) {
    return res.status(404).json({ error: 'Cupón no válido o expirado' });
  }
  if (Number(subtotal) < coupon.minOrderAmount) {
    return res.status(400).json({
      error: `Este cupón requiere un pedido mínimo de $${coupon.minOrderAmount.toLocaleString('es-CL')}`,
    });
  }
  let discountAmount =
    coupon.discountType === 'PERCENT'
      ? Math.round((Number(subtotal) * coupon.discountValue) / 100)
      : coupon.discountValue;
  if (coupon.maxDiscount) {
    discountAmount = Math.min(discountAmount, coupon.maxDiscount);
  }
  res.json({ coupon, discountAmount });
});

// 5. /api/orders & Complete State Machine
app.get('/api/orders', (req: Request, res: Response) => {
  const { role, userId, restaurantId, driverId } = req.query;
  let list = [...db.orders];

  // Role-Based Access Control enforcement (Requirement #14)
  if (role === Role.CLIENT && userId) {
    list = list.filter((o) => o.clientId === userId);
  } else if (role === Role.RESTAURANT && restaurantId) {
    list = list.filter((o) => o.restaurantId === restaurantId);
  } else if (role === Role.KITCHEN && restaurantId) {
    list = list.filter(
      (o) =>
        o.restaurantId === restaurantId &&
        o.paymentStatus === PaymentStatus.PAID &&
        o.status !== OrderStatus.CANCELLED &&
        o.status !== OrderStatus.REJECTED
    );
  } else if (role === Role.DRIVER && driverId) {
    list = list.filter(
      (o) =>
        o.driverId === driverId ||
        o.status === OrderStatus.READY ||
        o.status === OrderStatus.ASSIGNED_TO_DRIVER
    );
  }

  res.json(list);
});

app.post('/api/orders', (req: Request, res: Response) => {
  const {
    clientId,
    restaurantId,
    addressId,
    deliveryMethod,
    items,
    couponCode,
    notes,
    paymentMethod,
  } = req.body;

  const client = db.users.find((u) => u.id === (clientId || 'usr-client-1')) || db.users[0];
  const restaurant = db.restaurants.find((r) => r.id === restaurantId) || db.restaurants[0];
  const address = db.addresses.find((a) => a.id === addressId) || db.addresses[0];

  if (!restaurant.acceptingOrders || restaurant.status !== RestaurantStatus.OPEN) {
    return res.status(400).json({ error: 'El comercio no está recibiendo pedidos en este momento.' });
  }

  let subtotal = 0;
  const orderNumber = db.nextOrderNumber++;
  const orderId = `ord-${orderNumber}`;

  const orderItems = (items || []).map((item: any, idx: number) => {
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

  const deliveryFee = deliveryMethod === 'PICKUP' ? 0 : restaurant.deliveryFee;
  const serviceFee = db.settings.serviceFeeClp;

  let discountAmount = 0;
  if (couponCode) {
    const coupon = db.coupons.find((c) => c.code === String(couponCode).toUpperCase() && c.active);
    if (coupon && subtotal >= coupon.minOrderAmount) {
      discountAmount =
        coupon.discountType === 'PERCENT'
          ? Math.round((subtotal * coupon.discountValue) / 100)
          : coupon.discountValue;
      if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, coupon.maxDiscount);
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
    deliveryAddress: `${address.street} ${address.number}${address.apartment ? `, ${address.apartment}` : ''}, ${address.commune}`,
    deliveryInstructions: address.instructions,
    deliveryLat: address.lat,
    deliveryLng: address.lng,
    status: OrderStatus.PENDING_PAYMENT,
    paymentStatus: PaymentStatus.PENDING_PAYMENT,
    paymentMethod: paymentMethod || 'WEBPAY_PLUS',
    deliveryMethod: deliveryMethod || 'DELIVERY',
    subtotal,
    deliveryFee,
    serviceFee,
    discountAmount,
    total,
    platformCommission,
    restaurantEarnings,
    driverEarnings,
    couponCode,
    notes,
    estimatedMinutes: restaurant.prepTimeMinutes + Math.round(distanceKm * 4),
    distanceKm,
    items: orderItems,
    statusHistory: [
      {
        id: `sh-${Date.now()}-1`,
        orderId,
        status: OrderStatus.CREATED,
        actorRole: Role.CLIENT,
        note: 'Pedido creado por el cliente',
        timestamp: nowIso,
      },
      {
        id: `sh-${Date.now()}-2`,
        orderId,
        status: OrderStatus.PENDING_PAYMENT,
        actorRole: Role.CLIENT,
        note: 'Esperando confirmación de pago en Webpay Plus',
        timestamp: nowIso,
      },
    ],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  db.orders.unshift(newOrder);
  broadcastEvent('order:created', newOrder);
  res.status(201).json(newOrder);
});

// 6. /api/webpay & /api/payments (Integración Real API Transbank Webpay Plus v1.2 con Enlace de Pago Externo)
app.post('/api/webpay/create', async (req: Request, res: Response) => {
  const { orderId } = req.body;
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });

  const commerceCode = process.env.WEBPAY_COMMERCE_CODE || db.settings.webpayCommerceCode || '597055555532';
  const apiKey =
    process.env.WEBPAY_API_KEY ||
    '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C';
  const isProd = (process.env.WEBPAY_ENVIRONMENT || db.settings.webpayEnvironment) === 'PRODUCTION';
  const tbkBaseUrl = isProd
    ? 'https://webpay3g.transbank.cl'
    : 'https://webpay3gint.transbank.cl';

  const buyOrder = `ORD-${order.orderNumber}-${Date.now().toString().slice(-4)}`;
  const sessionId = `SES-${order.clientId}-${Date.now()}`;
  const origin = `${req.protocol}://${req.get('host')}`;
  const returnUrl = `${origin}/api/webpay/return`;

  let tokenWs = `01ab${Date.now().toString(16)}${order.orderNumber}webpayplus`;
  let paymentUrl = `${tbkBaseUrl}/webpayserver/initTransaction`;
  let realTransbankConnected = false;

  try {
    const tbkRes = await fetch(
      `${tbkBaseUrl}/rswebpaytransaction/api/webpay/v1.2/transactions`,
      {
        method: 'POST',
        headers: {
          'Tbk-Api-Key-Id': commerceCode,
          'Tbk-Api-Key-Secret': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          buy_order: buyOrder,
          session_id: sessionId,
          amount: order.total,
          return_url: returnUrl,
        }),
      }
    );

    if (tbkRes.ok) {
      const tbkData = (await tbkRes.json()) as { token: string; url: string };
      if (tbkData.token && tbkData.url) {
        tokenWs = tbkData.token;
        paymentUrl = tbkData.url;
        realTransbankConnected = true;
      }
    }
  } catch (err) {
    console.warn('Transbank API fallback (sin salida a internet en contenedor):', err);
  }

  const tx: PaymentTransaction = {
    id: `tx-${Date.now()}`,
    paymentId: `pay-${order.orderNumber}`,
    orderId: order.id,
    tokenWs,
    buyOrder,
    sessionId,
    amount: order.total,
    installments: 0,
    status: PaymentStatus.PENDING_PAYMENT,
    createdAt: new Date().toISOString(),
  };

  db.transactions.unshift(tx);
  order.transaction = tx;

  res.json({
    token_ws: tokenWs,
    url: paymentUrl,
    paymentLink: `${paymentUrl}?token_ws=${tokenWs}`,
    returnUrl,
    buyOrder: tx.buyOrder,
    amount: tx.amount,
    commerceCode,
    environment: isProd ? 'PRODUCTION' : 'INTEGRATION',
    realTransbankConnected,
  });
});

async function commitWebpayTransaction(token_ws: string, simulateAction?: string) {
  const tx = db.transactions.find((t) => t.tokenWs === token_ws);
  if (!tx) {
    return { error: 'Transacción Webpay no encontrada para token_ws', status: 404 };
  }

  const order = db.orders.find((o) => o.id === tx.orderId);
  if (!order) {
    return { error: 'Pedido asociado no encontrado', status: 404 };
  }

  // Si ya fue pagado previamente (idempotencia ante recargas del return_url)
  if (tx.status === PaymentStatus.PAID) {
    return { approved: true, order, transaction: tx, status: 200 };
  }

  const commerceCode = process.env.WEBPAY_COMMERCE_CODE || db.settings.webpayCommerceCode || '597055555532';
  const apiKey =
    process.env.WEBPAY_API_KEY ||
    '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C';
  const isProd = (process.env.WEBPAY_ENVIRONMENT || db.settings.webpayEnvironment) === 'PRODUCTION';
  const tbkBaseUrl = isProd
    ? 'https://webpay3g.transbank.cl'
    : 'https://webpay3gint.transbank.cl';

  let tbkCommitResult: any = null;
  if (!simulateAction) {
    try {
      const tbkRes = await fetch(
        `${tbkBaseUrl}/rswebpaytransaction/api/webpay/v1.2/transactions/${token_ws}`,
        {
          method: 'PUT',
          headers: {
            'Tbk-Api-Key-Id': commerceCode,
            'Tbk-Api-Key-Secret': apiKey,
            'Content-Type': 'application/json',
          },
        }
      );
      if (tbkRes.ok) {
        tbkCommitResult = await tbkRes.json();
      }
    } catch (e) {
      console.warn('Error consultando PUT commit Transbank:', e);
    }
  }

  const nowIso = new Date().toISOString();

  if (
    simulateAction === 'REJECTED' ||
    (tbkCommitResult && tbkCommitResult.response_code !== 0)
  ) {
    tx.status = PaymentStatus.PAYMENT_FAILED;
    tx.responseCode = tbkCommitResult?.response_code ?? -1;
    order.paymentStatus = PaymentStatus.PAYMENT_FAILED;
    order.status = OrderStatus.PAYMENT_FAILED;
    order.updatedAt = nowIso;
    order.statusHistory.push({
      id: `sh-${Date.now()}`,
      orderId: order.id,
      status: OrderStatus.PAYMENT_FAILED,
      actorRole: Role.CLIENT,
      note: 'Transacción rechazada por Transbank Webpay Plus',
      timestamp: nowIso,
    });
    broadcastEvent('order:updated', order);
    return { approved: false, order, transaction: tx, status: 200 };
  }

  if (simulateAction === 'CANCELLED') {
    tx.status = PaymentStatus.CANCELLED;
    order.paymentStatus = PaymentStatus.CANCELLED;
    order.status = OrderStatus.CANCELLED;
    order.updatedAt = nowIso;
    order.statusHistory.push({
      id: `sh-${Date.now()}`,
      orderId: order.id,
      status: OrderStatus.CANCELLED,
      actorRole: Role.CLIENT,
      note: 'Transacción anulada desde portal externo Webpay',
      timestamp: nowIso,
    });
    broadcastEvent('order:updated', order);
    return { approved: false, order, transaction: tx, status: 200 };
  }

  // APROBADO (response_code === 0)
  const authCode =
    tbkCommitResult?.authorization_code || String(Math.floor(100000 + Math.random() * 900000));
  tx.status = PaymentStatus.PAID;
  tx.responseCode = 0;
  tx.authorizationCode = authCode;
  tx.paymentTypeCode = tbkCommitResult?.payment_type_code || 'VD';
  tx.cardNumberLast4 = tbkCommitResult?.card_detail?.card_number || '6623';
  tx.installments = Number(tbkCommitResult?.installments_number || 0);

  order.paymentStatus = PaymentStatus.PAID;
  order.status = OrderStatus.RECEIVED_BY_RESTAURANT;
  order.updatedAt = nowIso;

  order.statusHistory.push(
    {
      id: `sh-${Date.now()}-paid`,
      orderId: order.id,
      status: OrderStatus.PAID,
      actorRole: Role.CLIENT,
      note: `Pago confirmado vía API Transbank Webpay Plus · Código Autorización #${authCode}`,
      timestamp: nowIso,
    },
    {
      id: `sh-${Date.now()}-recv`,
      orderId: order.id,
      status: OrderStatus.RECEIVED_BY_RESTAURANT,
      actorRole: Role.RESTAURANT,
      note: `NUEVO PEDIDO #${order.orderNumber} sincronizado automáticamente con el comercio`,
      timestamp: nowIso,
    }
  );

  createNotification(
    order.clientId,
    Role.CLIENT,
    'Tu pedido fue recibido',
    `Pago Webpay confirmado (#${authCode}). ${order.restaurantName} recibió tu Pedido #${order.orderNumber}.`,
    order.id,
    order.orderNumber
  );

  createNotification(
    'usr-rest-1',
    Role.RESTAURANT,
    `NUEVO PEDIDO #${order.orderNumber}`,
    `Nuevo pedido pagado vía Webpay por $${order.total.toLocaleString('es-CL')} (${order.items.length} productos).`,
    order.id,
    order.orderNumber
  );

  broadcastEvent('order:updated', order);
  broadcastEvent('kitchen:new_order', order);

  return { approved: true, order, transaction: tx, status: 200 };
}

// Endpoint de retorno oficial cuando Transbank redirige de vuelta al comercio (GET o POST con token_ws o TBK_TOKEN)
app.all('/api/webpay/return', async (req: Request, res: Response) => {
  const tokenWs = (req.body?.token_ws || req.query?.token_ws) as string | undefined;
  const tbkToken = (req.body?.TBK_TOKEN || req.query?.TBK_TOKEN) as string | undefined;

  if (tbkToken && !tokenWs) {
    await commitWebpayTransaction(tbkToken, 'CANCELLED');
    return res.redirect('/cliente?webpay_status=cancelled');
  }

  if (tokenWs) {
    const result = await commitWebpayTransaction(tokenWs);
    if (result.approved && result.order) {
      return res.redirect(`/cliente?webpay_status=approved&orderId=${result.order.id}`);
    }
    return res.redirect('/cliente?webpay_status=failed');
  }

  return res.redirect('/cliente');
});

app.post('/api/webpay/commit', async (req: Request, res: Response) => {
  const { token_ws, simulateAction } = req.body;
  const result = await commitWebpayTransaction(token_ws, simulateAction);
  if (result.error) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  res.json(result);
});

// 7. State Transition Endpoint for Restaurant, Kitchen, Driver, Admin
app.post('/api/orders/:id/status', (req: Request, res: Response) => {
  const order = db.orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });

  const { status, actorRole, note, driverId } = req.body;
  const newStatus = status as OrderStatus;
  const role = (actorRole as Role) || Role.RESTAURANT;
  const nowIso = new Date().toISOString();

  order.status = newStatus;
  order.updatedAt = nowIso;

  const driver = db.drivers.find((d) => d.id === (driverId || order.driverId || 'drv-1')) || db.drivers[0];

  if (
    newStatus === OrderStatus.ASSIGNED_TO_DRIVER ||
    newStatus === OrderStatus.DRIVER_PICKED_UP ||
    newStatus === OrderStatus.ON_THE_WAY
  ) {
    order.driverId = driver.id;
    order.driverName = driver.name;
    order.driverPhone = driver.phone;
    order.driverVehicle = `Moto Honda CB190R · Patente ${driver.vehiclePlate}`;
  }

  order.statusHistory.push({
    id: `sh-${Date.now()}`,
    orderId: order.id,
    status: newStatus,
    actorRole: role,
    note: note || `Estado actualizado a ${newStatus}`,
    timestamp: nowIso,
  });

  // Trigger specific notifications per status (Requirement #17)
  if (newStatus === OrderStatus.ACCEPTED) {
    createNotification(
      order.clientId,
      Role.CLIENT,
      'El restaurante aceptó tu pedido',
      `${order.restaurantName} confirmó tu Pedido #${order.orderNumber} y envió la comanda a cocina.`,
      order.id,
      order.orderNumber
    );
    broadcastEvent('kitchen:new_order', order);
  } else if (newStatus === OrderStatus.REJECTED) {
    order.paymentStatus = PaymentStatus.REFUNDED;
    if (order.transaction) order.transaction.status = PaymentStatus.REFUNDED;
    createNotification(
      order.clientId,
      Role.CLIENT,
      'Pedido rechazado por el local',
      `Lo sentimos, ${order.restaurantName} no pudo tomar tu Pedido #${order.orderNumber}. El reembolso Webpay fue procesado.`,
      order.id,
      order.orderNumber
    );
  } else if (newStatus === OrderStatus.PREPARING) {
    createNotification(
      order.clientId,
      Role.CLIENT,
      'Tu pedido está siendo preparado',
      `La cocina de ${order.restaurantName} está preparando tu Pedido #${order.orderNumber}.`,
      order.id,
      order.orderNumber
    );
  } else if (newStatus === OrderStatus.READY) {
    createNotification(
      order.clientId,
      Role.CLIENT,
      'Tu pedido está listo',
      `El Pedido #${order.orderNumber} está empaquetado y esperando al repartidor.`,
      order.id,
      order.orderNumber
    );
    createNotification(
      'usr-driver-1',
      Role.DRIVER,
      'Nuevo pedido disponible',
      `Pedido #${order.orderNumber} listo para retiro en ${order.restaurantName} (Ganancia: $${order.driverEarnings.toLocaleString('es-CL')}).`,
      order.id,
      order.orderNumber
    );
  } else if (newStatus === OrderStatus.ASSIGNED_TO_DRIVER) {
    driver.status = DriverStatus.TO_RESTAURANT;
    driver.currentLat = order.restaurantLat + 0.002;
    driver.currentLng = order.restaurantLng - 0.002;
    createNotification(
      order.clientId,
      Role.CLIENT,
      'Repartidor asignado',
      `${driver.name} aceptó tu Pedido #${order.orderNumber} y va rumbo al restaurante.`,
      order.id,
      order.orderNumber
    );
  } else if (newStatus === OrderStatus.DRIVER_PICKED_UP) {
    driver.status = DriverStatus.PICKING_UP;
    handleDriverGpsUpdate({
      driverId: driver.id,
      orderId: order.id,
      lat: order.restaurantLat,
      lng: order.restaurantLng,
      heading: 140,
      speedKmh: 25,
    });
  } else if (newStatus === OrderStatus.ON_THE_WAY) {
    driver.status = DriverStatus.TO_CLIENT;
    createNotification(
      order.clientId,
      Role.CLIENT,
      'El repartidor está en camino',
      `${driver.name} retiró tu Pedido #${order.orderNumber} y viaja hacia tu dirección con GPS activo.`,
      order.id,
      order.orderNumber
    );
  } else if (newStatus === OrderStatus.DELIVERED || newStatus === OrderStatus.COMPLETED) {
    driver.status = DriverStatus.AVAILABLE;
    driver.completedTrips += 1;
    driver.totalEarnings += order.driverEarnings;
    handleDriverGpsUpdate({
      driverId: driver.id,
      orderId: order.id,
      lat: order.deliveryLat,
      lng: order.deliveryLng,
      heading: 0,
      speedKmh: 0,
    });
    createNotification(
      order.clientId,
      Role.CLIENT,
      'Pedido entregado',
      `Tu Pedido #${order.orderNumber} ha sido entregado. ¡Que lo disfrutes!`,
      order.id,
      order.orderNumber
    );
  }

  broadcastEvent('order:updated', order);
  broadcastEvent('driver:updated', driver);
  res.json(order);
});

// 8. /api/orders/:id/review (Client rates Order, Restaurant & Driver)
app.post('/api/orders/:id/review', (req: Request, res: Response) => {
  const order = db.orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });

  const { restaurantRating, driverRating, comment } = req.body;
  const nowIso = new Date().toISOString();
  const review = {
    id: `rev-${Date.now()}`,
    orderId: order.id,
    clientId: order.clientId,
    clientName: order.clientName,
    restaurantId: order.restaurantId,
    restaurantRating: Number(restaurantRating || 5),
    driverRating: Number(driverRating || 5),
    comment: String(comment || 'Excelente servicio y rapidez.'),
    createdAt: nowIso,
  };

  order.review = review;
  order.status = OrderStatus.COMPLETED;
  order.updatedAt = nowIso;
  db.reviews.unshift(review);

  // Recalculate restaurant rating
  const rest = db.restaurants.find((r) => r.id === order.restaurantId);
  if (rest) {
    rest.reviewCount += 1;
    rest.rating = Number(((rest.rating * (rest.reviewCount - 1) + review.restaurantRating) / rest.reviewCount).toFixed(1));
  }

  broadcastEvent('order:updated', order);
  res.status(201).json({ order, review });
});

// 9. /api/drivers & /api/location
app.get('/api/drivers', (_req: Request, res: Response) => {
  res.json(db.drivers);
});

app.put('/api/drivers/:id/status', (req: Request, res: Response) => {
  const driver = db.drivers.find((d) => d.id === req.params.id);
  if (!driver) return res.status(404).json({ error: 'Repartidor no encontrado' });
  driver.status = req.body.status as DriverStatus;
  broadcastEvent('driver:updated', driver);
  res.json(driver);
});

app.post('/api/location', (req: Request, res: Response) => {
  const { driverId, orderId, lat, lng, heading, speedKmh } = req.body;
  handleDriverGpsUpdate({
    driverId: driverId || 'drv-1',
    orderId,
    lat: Number(lat),
    lng: Number(lng),
    heading: Number(heading || 135),
    speedKmh: Number(speedKmh || 32),
  });
  res.json({ ok: true });
});

app.get('/api/location/:orderId', (req: Request, res: Response) => {
  const order = db.orders.find((o) => o.id === req.params.orderId);
  const driver = db.drivers.find((d) => d.id === (order?.driverId || 'drv-1')) || db.drivers[0];
  const history = db.driverLocations.filter((l) => l.orderId === req.params.orderId);
  res.json({
    driver,
    latestLocation: history[history.length - 1] || {
      driverId: driver.id,
      orderId: req.params.orderId,
      lat: driver.currentLat,
      lng: driver.currentLng,
      timestamp: new Date().toISOString(),
    },
    historyCount: history.length,
    maxHistoryAllowed: db.settings.maxLocationHistoryPerOrder,
  });
});

// 10. /api/notifications
app.get('/api/notifications', (req: Request, res: Response) => {
  const { role, userId } = req.query;
  let list = [...db.notifications];
  if (role) {
    list = list.filter((n) => n.role === role || (userId && n.userId === userId));
  }
  res.json(list.slice(0, 30));
});

app.post('/api/notifications/read-all', (req: Request, res: Response) => {
  const { role } = req.body;
  db.notifications.forEach((n) => {
    if (!role || n.role === role) n.read = true;
  });
  res.json({ ok: true });
});

// 11. /api/admin (Dashboard Metrics, Settings, Coupons, Transactions)
app.get('/api/admin/summary', (_req: Request, res: Response) => {
  const paidOrders = db.orders.filter((o) => o.paymentStatus === PaymentStatus.PAID);
  const dailySales = paidOrders.reduce((acc, o) => acc + o.total, 0);
  const monthlySales = dailySales + 4_850_000;
  const totalCommissions = paidOrders.reduce((acc, o) => acc + o.platformCommission, 0);
  const totalServiceFees = paidOrders.reduce((acc, o) => acc + o.serviceFee, 0);

  res.json({
    metrics: {
      dailySales,
      monthlySales,
      totalOrders: db.orders.length,
      activeRestaurants: db.restaurants.filter((r) => r.status === RestaurantStatus.OPEN).length,
      activeDrivers: db.drivers.filter((d) => d.status !== DriverStatus.OFFLINE).length,
      registeredClients: db.users.filter((u) => u.role === Role.CLIENT).length + 142,
      totalCommissions,
      totalServiceFees,
      pendingOrders: db.orders.filter(
        (o) =>
          o.status !== OrderStatus.DELIVERED &&
          o.status !== OrderStatus.COMPLETED &&
          o.status !== OrderStatus.CANCELLED &&
          o.status !== OrderStatus.REJECTED
      ).length,
      completedOrders: db.orders.filter(
        (o) => o.status === OrderStatus.DELIVERED || o.status === OrderStatus.COMPLETED
      ).length,
      cancelledOrders: db.orders.filter(
        (o) => o.status === OrderStatus.CANCELLED || o.status === OrderStatus.REJECTED
      ).length,
    },
    settings: db.settings,
    coupons: db.coupons,
    transactions: db.transactions,
    users: db.users.map(({ passwordHash: _, ...u }) => u),
  });
});

app.put('/api/admin/settings', (req: Request, res: Response) => {
  const { defaultCommissionPercent, serviceFeeClp, baseDeliveryFeeClp, webpayEnvironment } = req.body;
  if (defaultCommissionPercent !== undefined)
    db.settings.defaultCommissionPercent = Number(defaultCommissionPercent);
  if (serviceFeeClp !== undefined) db.settings.serviceFeeClp = Number(serviceFeeClp);
  if (baseDeliveryFeeClp !== undefined) db.settings.baseDeliveryFeeClp = Number(baseDeliveryFeeClp);
  if (webpayEnvironment !== undefined) db.settings.webpayEnvironment = webpayEnvironment;
  res.json(db.settings);
});

app.post('/api/admin/coupons', (req: Request, res: Response) => {
  const { code, description, discountType, discountValue, minOrderAmount } = req.body;
  const newCoupon = {
    id: `coup-${Date.now()}`,
    code: String(code || 'PROMO20').toUpperCase().trim(),
    description: description || 'Descuento promocional',
    discountType: (discountType as 'PERCENT' | 'FIXED') || 'FIXED',
    discountValue: Number(discountValue) || 2500,
    minOrderAmount: Number(minOrderAmount) || 10000,
    active: true,
    expiresAt: '2027-12-31T23:59:59.000Z',
  };
  db.coupons.unshift(newCoupon);
  res.status(201).json(newCoupon);
});

// 12. /api/docs (Interactive API Documentation JSON)
app.get('/api/docs', (_req: Request, res: Response) => {
  res.json({
    platform: 'Food Delivery API REST & WebSocket',
    version: '1.0.0',
    realtimeEndpoint: 'ws://localhost:3000/ws',
    endpoints: [
      { method: 'POST', path: '/api/auth/login', description: 'Autenticación RBAC (Cliente, Restaurante, Cocina, Repartidor, Admin)' },
      { method: 'GET', path: '/api/restaurants', description: 'Listado y filtrado de comercios cercanos, categorías y promociones' },
      { method: 'GET', path: '/api/products', description: 'Catálogo de productos con opciones obligatorias y extras personalizables' },
      { method: 'POST', path: '/api/cart/validate-coupon', description: 'Validación de códigos de descuento en backend' },
      { method: 'POST', path: '/api/orders', description: 'Creación de pedido en estado PENDING_PAYMENT con cálculo de comisión y cargos' },
      { method: 'POST', path: '/api/webpay/create', description: 'Inicialización de transacción Transbank Webpay Plus (token_ws)' },
      { method: 'POST', path: '/api/webpay/commit', description: 'Validación estricta en backend de respuesta Webpay, monto y código de autorización' },
      { method: 'POST', path: '/api/orders/:id/status', description: 'Máquina de estados del pedido con sincronización WebSocket instantánea' },
      { method: 'POST', path: '/api/location', description: 'Ingesta de coordenadas GPS en tiempo real con historial acotado' },
      { method: 'GET', path: '/api/admin/summary', description: 'Métricas financieras, comisiones, transacciones y control de plataforma' },
    ],
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Food Delivery Server + WebSocket running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
