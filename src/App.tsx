/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Play,
  CheckCircle2,
  X,
  LogIn,
} from 'lucide-react';
import {
  Role,
  User,
  Address,
  RestaurantCategory,
  Restaurant,
  Product,
  CartItem,
  SelectedOption,
  SelectedExtra,
  Order,
  OrderStatus,
  Driver,
  DriverStatus,
  NotificationItem,
} from './types/domain.ts';
import { ClientView } from './components/ClientView.tsx';
import { RestaurantView } from './components/RestaurantView.tsx';
import { KitchenView, playKitchenBellSound } from './components/KitchenView.tsx';
import { DriverView } from './components/DriverView.tsx';
import { AdminView } from './components/AdminView.tsx';
import { WebpayModal } from './components/WebpayModal.tsx';
import { PWAInstallButton, OfflineIndicator } from './components/PWAInstallButton.tsx';

export default function App() {
  const [activeRole, setActiveRole] = useState<Role>(Role.CLIENT);
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'usr-client-1',
    email: 'cliente@demo.cl',
    name: 'Camila Valdés',
    phone: '+56 9 8412 3901',
    role: Role.CLIENT,
  });

  const [categories, setCategories] = useState<RestaurantCategory[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [driver, setDriver] = useState<Driver>({
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
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  const [toastBanner, setToastBanner] = useState<{ title: string; message: string } | null>(null);

  // Client Sub-View & Cart State
  const [clientSubView, setClientSubView] = useState<
    'EXPLORE' | 'MENU' | 'TRACKING' | 'HISTORY' | 'PROFILE'
  >('EXPLORE');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [selectedTrackingOrder, setSelectedTrackingOrder] = useState<Order | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Active Webpay Payment Gateway Modal State
  const [webpaySession, setWebpaySession] = useState<{
    order: Order;
    tokenWs: string;
    commerceCode: string;
  } | null>(null);

  // Auth Switcher Modal
  const [showAuthModal, setShowAuthModal] = useState(false);

  // End-to-End Automated Flow Simulator State (Requirement #25)
  const [simulatingFlow, setSimulatingFlow] = useState(false);
  const [simStepLabel, setSimStepLabel] = useState<string | null>(null);

  const fetchAllData = useCallback(async () => {
    try {
      const [restRes, prodRes, ordRes, addrRes, drvRes, notifRes] = await Promise.all([
        fetch('/api/restaurants'),
        fetch('/api/products'),
        fetch('/api/orders'),
        fetch('/api/addresses?userId=usr-client-1'),
        fetch('/api/drivers'),
        fetch('/api/notifications'),
      ]);

      const restData = await restRes.json();
      const prodData = await prodRes.json();
      const ordData = await ordRes.json();
      const addrData = await addrRes.json();
      const drvData = await drvRes.json();
      const notifData = await notifRes.json();

      setCategories(restData.categories || []);
      setRestaurants(restData.restaurants || []);
      setProducts(prodData.products || []);
      setOrders(ordData || []);
      setAddresses(addrData || []);
      if (drvData && drvData[0]) setDriver(drvData[0]);
      setNotifications(notifData || []);
    } catch (e) {
      console.error('Initial data load error:', e);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Real-Time WebSocket Connection & Event Listener
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        ws?.send(
          JSON.stringify({
            type: 'auth:identify',
            userId: currentUser.id,
            role: activeRole,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'order:created' || msg.type === 'order:updated') {
            const incomingOrder: Order = msg.payload;
            setOrders((prev) => {
              const exists = prev.some((o) => o.id === incomingOrder.id);
              if (!exists) return [incomingOrder, ...prev];
              return prev.map((o) => (o.id === incomingOrder.id ? incomingOrder : o));
            });
            setSelectedTrackingOrder((prev) =>
              prev && prev.id === incomingOrder.id ? incomingOrder : prev
            );
          } else if (msg.type === 'kitchen:new_order') {
            playKitchenBellSound();
          } else if (msg.type === 'driver:location_updated') {
            const loc = msg.payload;
            setDriver((prev) => ({
              ...prev,
              currentLat: loc.lat,
              currentLng: loc.lng,
            }));
          } else if (msg.type === 'driver:updated') {
            setDriver(msg.payload);
          } else if (msg.type === 'restaurant:updated') {
            const updatedRest: Restaurant = msg.payload;
            setRestaurants((prev) =>
              prev.map((r) => (r.id === updatedRest.id ? updatedRest : r))
            );
          } else if (msg.type === 'restaurant:created') {
            const createdRest: Restaurant = msg.payload;
            setRestaurants((prev) => {
              if (prev.some((r) => r.id === createdRest.id)) return prev;
              return [...prev, createdRest];
            });
          } else if (msg.type === 'product:created') {
            const createdProd: Product = msg.payload;
            setProducts((prev) => {
              if (prev.some((p) => p.id === createdProd.id)) return prev;
              return [createdProd, ...prev];
            });
          } else if (msg.type === 'product:updated') {
            const updatedProd: Product = msg.payload;
            setProducts((prev) =>
              prev.map((p) => (p.id === updatedProd.id ? updatedProd : p))
            );
          } else if (msg.type === 'notification:created') {
            const notif: NotificationItem = msg.payload;
            setNotifications((prev) => {
              if (prev.some((n) => n.id === notif.id)) return prev;
              return [notif, ...prev];
            });
            setToastBanner({ title: notif.title, message: notif.message });
          }
        } catch (err) {
          console.error('WS message error:', err);
        }
      };

      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 2500);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [currentUser.id, activeRole]);

  // Auto-hide toast banner after 4.5s
  useEffect(() => {
    if (!toastBanner) return;
    const t = setTimeout(() => setToastBanner(null), 4500);
    return () => clearTimeout(t);
  }, [toastBanner]);

  const handleRoleSwitch = async (role: Role) => {
    setActiveRole(role);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (data.user) {
        setCurrentUser(data.user);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Cart Handlers
  const handleAddToCart = (
    product: Product,
    quantity: number,
    selectedOptions: SelectedOption[],
    selectedExtras: SelectedExtra[],
    notes: string
  ) => {
    const basePrice = product.discountPrice || product.price;
    const optionsDelta = selectedOptions.reduce((a, b) => a + b.priceDelta, 0);
    const extrasDelta = selectedExtras.reduce((a, b) => a + b.price, 0);
    const unitPriceWithModifiers = basePrice + optionsDelta + extrasDelta;

    const newItem: CartItem = {
      id: `citem-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      productId: product.id,
      product,
      quantity,
      selectedOptions,
      selectedExtras,
      notes,
      unitPriceWithModifiers,
      lineTotal: unitPriceWithModifiers * quantity,
    };

    setCart((prev) => [...prev, newItem]);
  };

  const handleUpdateCartQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== itemId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          return {
            ...item,
            quantity: nextQty,
            lineTotal: item.unitPriceWithModifiers * nextQty,
          };
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleClearCart = () => setCart([]);

  // Checkout -> Create PENDING_PAYMENT Order -> Open Webpay Plus Modal
  const handleCheckoutWithWebpay = async (params: {
    addressId: string;
    deliveryMethod: 'DELIVERY' | 'PICKUP';
    couponCode?: string;
    notes?: string;
  }) => {
    if (cart.length === 0) return;
    const restId = cart[0].product.restaurantId;

    const orderRes = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: currentUser.id,
        restaurantId: restId,
        addressId: params.addressId,
        deliveryMethod: params.deliveryMethod,
        items: cart,
        couponCode: params.couponCode,
        notes: params.notes,
        paymentMethod: 'WEBPAY_PLUS',
      }),
    });
    const createdOrder: Order = await orderRes.json();

    const wpRes = await fetch('/api/webpay/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: createdOrder.id }),
    });
    const wpData = await wpRes.json();

    setWebpaySession({
      order: createdOrder,
      tokenWs: wpData.token_ws,
      commerceCode: wpData.commerceCode,
    });
  };

  const handleUpdateOrderStatus = async (
    orderId: string,
    status: OrderStatus,
    actorRole: Role,
    note?: string
  ) => {
    await fetch(`/api/orders/${orderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, actorRole, note }),
    });
  };

  const handleSendGpsCoordinate = useCallback(
    async (orderId: string | undefined, lat: number, lng: number) => {
      await fetch('/api/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: driver.id,
          orderId,
          lat,
          lng,
        }),
      });
    },
    [driver.id]
  );

  // ===========================================================================
  // 25. AUTOMATED 13-STEP END-TO-END FLOW VERIFIER (CLIENTE -> WEBPAY -> REST -> COCINA -> REPARTIDOR -> GPS -> CLIENTE)
  // ===========================================================================
  const runCompleteEndToEndSimulation = async () => {
    if (simulatingFlow) return;
    setSimulatingFlow(true);

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    try {
      setActiveRole(Role.CLIENT);
      setSimStepLabel('Paso 1/8: Cliente creando pedido y generando transacción Webpay Plus...');
      const sampleProd = products[0];
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'usr-client-1',
          restaurantId: 'rest-1',
          addressId: 'addr-1',
          deliveryMethod: 'DELIVERY',
          items: [
            {
              productId: sampleProd.id,
              productName: sampleProd.name,
              unitPriceWithModifiers: sampleProd.discountPrice || sampleProd.price,
              quantity: 2,
              selectedOptions: [
                { optionName: 'Guarnición Incluida', choiceLabel: 'Papas Rústicas al Romero', priceDelta: 0 },
              ],
              selectedExtras: [{ extraId: 'ext-2', name: 'Palta Hass Laminada', price: 1600 }],
            },
          ],
          notes: 'Pedido de prueba flujo completo E2E',
          paymentMethod: 'WEBPAY_PLUS',
        }),
      });
      const newOrder: Order = await orderRes.json();
      await sleep(900);

      setSimStepLabel(`Paso 2/8: Validando pago Webpay Plus en backend para Pedido #${newOrder.orderNumber}...`);
      const wpCreateRes = await fetch('/api/webpay/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: newOrder.id }),
      });
      const wpCreate = await wpCreateRes.json();

      const wpCommitRes = await fetch('/api/webpay/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_ws: wpCreate.token_ws,
          simulateAction: 'APPROVED',
          paymentTypeCode: 'VD',
          cardNumberLast4: '6623',
        }),
      });
      const wpCommit = await wpCommitRes.json();
      setSelectedTrackingOrder(wpCommit.order);
      setClientSubView('TRACKING');
      await sleep(1200);

      setSimStepLabel(`Paso 3/8: Restaurante recibe y acepta Pedido #${newOrder.orderNumber}...`);
      await handleUpdateOrderStatus(
        newOrder.id,
        OrderStatus.ACCEPTED,
        Role.RESTAURANT,
        'Restaurante aceptó el pedido y envió comanda a KDS Cocina'
      );
      await sleep(1100);

      setSimStepLabel(`Paso 4/8: Cocina prepara comanda #${newOrder.orderNumber} (PREPARING)...`);
      await handleUpdateOrderStatus(
        newOrder.id,
        OrderStatus.PREPARING,
        Role.KITCHEN,
        'Cocina preparando hamburguesas smash en plancha'
      );
      await sleep(1100);

      setSimStepLabel(`Paso 5/8: Cocina marca Pedido #${newOrder.orderNumber} como LISTO (READY)...`);
      await handleUpdateOrderStatus(
        newOrder.id,
        OrderStatus.READY,
        Role.KITCHEN,
        'Comanda lista para retiro de repartidor'
      );
      await sleep(1100);

      setSimStepLabel(`Paso 6/8: Repartidor acepta y retira el pedido en el local...`);
      await handleUpdateOrderStatus(
        newOrder.id,
        OrderStatus.ASSIGNED_TO_DRIVER,
        Role.DRIVER,
        'Repartidor asignado en ruta al comercio'
      );
      await sleep(800);
      await handleUpdateOrderStatus(
        newOrder.id,
        OrderStatus.DRIVER_PICKED_UP,
        Role.DRIVER,
        'Repartidor retiró el pedido en el restaurante'
      );
      await sleep(800);
      await handleUpdateOrderStatus(
        newOrder.id,
        OrderStatus.ON_THE_WAY,
        Role.DRIVER,
        'Repartidor en camino al domicilio con GPS activo'
      );

      setSimStepLabel(`Paso 7/8: Transmitiendo coordenadas GPS del repartidor en tiempo real...`);
      const steps = [0.3, 0.65, 0.92];
      for (const frac of steps) {
        const lat = newOrder.restaurantLat + (newOrder.deliveryLat - newOrder.restaurantLat) * frac;
        const lng = newOrder.restaurantLng + (newOrder.deliveryLng - newOrder.restaurantLng) * frac;
        await handleSendGpsCoordinate(newOrder.id, Number(lat.toFixed(5)), Number(lng.toFixed(5)));
        await sleep(950);
      }

      setSimStepLabel(`Paso 8/8: Repartidor entrega pedido en destino (DELIVERED). ¡Listo para calificar!`);
      await handleUpdateOrderStatus(
        newOrder.id,
        OrderStatus.DELIVERED,
        Role.DRIVER,
        'Pedido entregado exitosamente al cliente'
      );
      await sleep(1500);
    } catch (e) {
      console.error('Simulation error:', e);
    } finally {
      setSimulatingFlow(false);
      setSimStepLabel(null);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#F9F9F8] text-slate-900">
      <OfflineIndicator />

      {/* =====================================================================
          STRICT 3-ZONE TOP BAR CONTRACT (Frontend Design Skill Section 2)
          Zone 1: Single Text Element Brand Wordmark
          Zone 2: 5 Role Navigation Links (Single-line)
          Zone 3: 2 Primary Actions (Simulate E2E Flow + Notifications/PWA)
      ===================================================================== */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveRole(Role.CLIENT);
            setClientSubView('EXPLORE');
          }}
          className="text-xl font-bold font-display tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          Food Delivery
        </a>

        {/* Zone 2: 5 clean text navigation links for Role Switching */}
        <nav className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm font-medium text-slate-600 overflow-x-auto">
          {(
            [
              { role: Role.CLIENT, label: 'Cliente' },
              { role: Role.RESTAURANT, label: 'Comercio' },
              { role: Role.KITCHEN, label: 'Cocina' },
              { role: Role.DRIVER, label: 'Repartidor' },
              { role: Role.ADMIN, label: 'Administrador' },
            ] as const
          ).map((item) => (
            <button
              key={item.role}
              onClick={() => handleRoleSwitch(item.role)}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeRole === item.role
                  ? 'text-orange-600 font-bold underline underline-offset-8 decoration-2'
                  : 'hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: 1-2 Primary Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <PWAInstallButton />

          <button
            disabled={simulatingFlow}
            onClick={runCompleteEndToEndSimulation}
            className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title="Ejecutar simulación completa de 13 pasos: Cliente -> Webpay -> Restaurante -> Cocina -> Repartidor -> GPS"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span className="hidden md:inline">
              {simulatingFlow ? 'Simulando Flujo...' : 'Simular Flujo Completo'}
            </span>
          </button>

          <button
            onClick={() => setShowNotifDrawer(true)}
            className="relative p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
            aria-label="Notificaciones en tiempo real"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-600 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Live E2E Simulation Status Banner */}
      {simStepLabel && (
        <div className="bg-slate-900 text-white px-4 py-2.5 text-xs font-medium flex items-center justify-center gap-2 border-b border-slate-800">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
          <span className="font-mono">{simStepLabel}</span>
        </div>
      )}

      {/* Real-time WebSocket Toast Notification */}
      {toastBanner && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl bg-slate-900 text-white p-4 shadow-2xl border border-slate-700 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <p className="font-bold text-white">{toastBanner.title}</p>
            <p className="text-slate-300 mt-0.5">{toastBanner.message}</p>
          </div>
          <button
            onClick={() => setToastBanner(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =====================================================================
          MAIN ROLE WORKSPACE
      ===================================================================== */}
      <main className="flex-1">
        {activeRole === Role.CLIENT && (
          <ClientView
            user={currentUser}
            addresses={addresses}
            categories={categories}
            restaurants={restaurants}
            products={products}
            orders={orders}
            driver={driver}
            cart={cart}
            selectedRestaurant={selectedRestaurant}
            activeSubView={clientSubView}
            selectedOrderForTracking={selectedTrackingOrder}
            onSelectSubView={setClientSubView}
            onSelectRestaurant={setSelectedRestaurant}
            onAddToCart={handleAddToCart}
            onUpdateCartQty={handleUpdateCartQty}
            onClearCart={handleClearCart}
            onCheckoutWithWebpay={handleCheckoutWithWebpay}
            onAddAddress={async (addr) => {
              const res = await fetch('/api/addresses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...addr, userId: currentUser.id }),
              });
              const created = await res.json();
              setAddresses((prev) => [created, ...prev]);
            }}
            onUpdateProfile={async (profileData) => {
              const res = await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id, ...profileData }),
              });
              const updated = await res.json();
              if (updated.user) setCurrentUser(updated.user);
              setToastBanner({
                title: 'Perfil actualizado',
                message: 'Tus datos de contacto fueron guardados.',
              });
            }}
            onSubmitReview={async (orderId, restaurantRating, driverRating, comment) => {
              await fetch(`/api/orders/${orderId}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ restaurantRating, driverRating, comment }),
              });
              setToastBanner({
                title: '¡Gracias por tu calificación!',
                message: 'El pedido ha quedado en estado COMPLETED.',
              });
            }}
            onRepeatOrder={(ord) => {
              const repeatedItems: CartItem[] = ord.items
                .map((oi) => {
                  const foundProd =
                    products.find((p) => p.id === oi.productId) || products[0];
                  return {
                    id: `citem-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                    productId: foundProd.id,
                    product: foundProd,
                    quantity: oi.quantity,
                    selectedOptions: oi.selectedOptions,
                    selectedExtras: oi.selectedExtras,
                    notes: oi.notes,
                    unitPriceWithModifiers: oi.unitPrice,
                    lineTotal: oi.lineTotal,
                  };
                });
              setCart(repeatedItems);
            }}
            onSelectTrackingOrder={(ord) => setSelectedTrackingOrder(ord)}
          />
        )}

        {activeRole === Role.RESTAURANT && restaurants[0] && (
          <RestaurantView
            restaurant={restaurants[0]}
            products={products}
            orders={orders}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onUpdateRestaurant={async (updates) => {
              await fetch(`/api/restaurants/${restaurants[0].id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
              });
            }}
            onCreateProduct={async (newProd) => {
              await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProd),
              });
            }}
            onToggleProductAvailability={async (prod) => {
              await fetch(`/api/products/${prod.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ available: !prod.available }),
              });
            }}
          />
        )}

        {activeRole === Role.KITCHEN && (
          <KitchenView
            orders={orders}
            onUpdateStatus={handleUpdateOrderStatus}
          />
        )}

        {activeRole === Role.DRIVER && (
          <DriverView
            driver={driver}
            orders={orders}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onSendGpsCoordinate={handleSendGpsCoordinate}
            onToggleDriverStatus={async (status) => {
              await fetch(`/api/drivers/${driver.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
              });
            }}
          />
        )}

        {activeRole === Role.ADMIN && (
          <AdminView
            restaurants={restaurants}
            orders={orders}
            onUpdateRestaurant={async (id, updates) => {
              await fetch(`/api/restaurants/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
              });
            }}
            onCreateRestaurant={async (data) => {
              await fetch('/api/restaurants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
              });
            }}
          />
        )}
      </main>

      {/* =====================================================================
          WEBPAY PLUS TRANSACTION MODAL
      ===================================================================== */}
      {webpaySession && (
        <WebpayModal
          order={webpaySession.order}
          tokenWs={webpaySession.tokenWs}
          commerceCode={webpaySession.commerceCode}
          onCommitSuccess={(paidOrder) => {
            setWebpaySession(null);
            setCart([]);
            setSelectedTrackingOrder(paidOrder);
            setClientSubView('TRACKING');
          }}
          onCancelOrReject={(_failedOrder, reason) => {
            setWebpaySession(null);
            setToastBanner({
              title: 'Transacción Webpay no completada',
              message: reason,
            });
          }}
        />
      )}

      {/* =====================================================================
          NOTIFICATIONS & DEMO ACCOUNTS DRAWER
      ===================================================================== */}
      {showNotifDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Centro de Notificaciones & Cuentas Demo
                  </h2>
                  <p className="text-xs text-slate-500">
                    Sesión activa: {currentUser.name} ({activeRole})
                  </p>
                </div>
                <button
                  onClick={() => setShowNotifDrawer(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Demo Accounts Quick Switcher (Requirement #24) */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2.5">
                <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <LogIn className="w-3.5 h-3.5 text-orange-600" />
                  <span>Usuarios de Prueba Preconfigurados (1-Click Login):</span>
                </p>
                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  {[
                    { role: Role.CLIENT, email: 'cliente@demo.cl', desc: 'Camila Valdés (Cliente)' },
                    { role: Role.RESTAURANT, email: 'restaurante@demo.cl', desc: 'La Brasa Artesanal (Comercio)' },
                    { role: Role.KITCHEN, email: 'cocina@demo.cl', desc: 'Pantalla KDS Comandas (Cocina)' },
                    { role: Role.DRIVER, email: 'repartidor@demo.cl', desc: 'Diego Morales · Moto GPS (Repartidor)' },
                    { role: Role.ADMIN, email: 'admin@demo.cl', desc: 'Panel Control & Comisiones (Admin)' },
                  ].map((u) => (
                    <button
                      key={u.role}
                      onClick={() => {
                        handleRoleSwitch(u.role);
                        setShowNotifDrawer(false);
                      }}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
                        activeRole === u.role
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <span className="font-semibold">{u.desc}</span>
                      <span className="font-mono text-[11px] opacity-75">{u.email}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Real-time Notification Feed */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Alertas Recientes en Tiempo Real
                  </h3>
                  <button
                    onClick={async () => {
                      await fetch('/api/notifications/read-all', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({}),
                      });
                      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                    }}
                    className="text-xs font-semibold text-orange-600 hover:underline cursor-pointer"
                  >
                    Marcar leídas
                  </button>
                </div>

                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                      n.read ? 'bg-white border-slate-200' : 'bg-orange-50/50 border-orange-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{n.title}</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {new Date(n.createdAt).toLocaleTimeString('es-CL', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-slate-600">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowNotifDrawer(false)}
              className="mt-6 w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
            >
              Cerrar Panel
            </button>
          </div>
        </div>
      )}

      {/* Quiet Editorial Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-6 px-4 sm:px-6 text-xs text-slate-500">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <p>
            © {new Date().getFullYear()} <strong>Food Delivery</strong> · Plataforma Gastronómica con Webpay Plus y Seguimiento GPS en Tiempo Real.
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleRoleSwitch(Role.CLIENT)}
              className="hover:text-slate-900 cursor-pointer"
            >
              Clientes
            </button>
            <button
              onClick={() => handleRoleSwitch(Role.RESTAURANT)}
              className="hover:text-slate-900 cursor-pointer"
            >
              Restaurantes
            </button>
            <button
              onClick={() => handleRoleSwitch(Role.KITCHEN)}
              className="hover:text-slate-900 cursor-pointer"
            >
              KDS Cocina
            </button>
            <button
              onClick={() => handleRoleSwitch(Role.DRIVER)}
              className="hover:text-slate-900 cursor-pointer"
            >
              Repartidores GPS
            </button>
            <button
              onClick={() => handleRoleSwitch(Role.ADMIN)}
              className="hover:text-slate-900 cursor-pointer"
            >
              Administración
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
