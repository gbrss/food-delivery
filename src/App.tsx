/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  CheckCircle2,
  X,
  Store,
  ChefHat,
  Bike,
  ShoppingBag,
  Shield,
  ArrowRight,
  ExternalLink,
  Grid,
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
import { subscribeRealtimeEvents } from './lib/runtimeApi.ts';

type PortalPath = '/portales' | '/cliente' | '/comercio' | '/cocina' | '/repartidor' | '/admin';

function resolvePortalFromPathname(pathname: string): PortalPath {
  const clean = pathname.toLowerCase();
  if (clean.startsWith('/cliente')) return '/cliente';
  if (clean.startsWith('/comercio') || clean.startsWith('/restaurante')) return '/comercio';
  if (clean.startsWith('/cocina') || clean.startsWith('/kds')) return '/cocina';
  if (clean.startsWith('/repartidor') || clean.startsWith('/driver')) return '/repartidor';
  if (clean.startsWith('/admin')) return '/admin';
  if (clean.startsWith('/portales')) return '/portales';
  return '/cliente'; // El sitio principal por defecto es el Portal de Clientes
}

function roleForPortal(portal: PortalPath): Role {
  switch (portal) {
    case '/comercio':
      return Role.RESTAURANT;
    case '/cocina':
      return Role.KITCHEN;
    case '/repartidor':
      return Role.DRIVER;
    case '/admin':
      return Role.ADMIN;
    default:
      return Role.CLIENT;
  }
}

export default function App() {
  const [currentPortal, setCurrentPortal] = useState<PortalPath>(() =>
    resolvePortalFromPathname(window.location.pathname)
  );
  const activeRole = roleForPortal(currentPortal);

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

  // Active Webpay Payment Link Session
  const [webpaySession, setWebpaySession] = useState<{
    order: Order;
    tokenWs: string;
    url: string;
    paymentLink: string;
    commerceCode: string;
    realTransbankConnected?: boolean;
  } | null>(null);

  // Navigate between independent portals using History API
  const navigateToPortal = useCallback((portal: PortalPath) => {
    window.history.pushState({}, '', portal);
    setCurrentPortal(portal);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setCurrentPortal(resolvePortalFromPathname(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Sync user credentials when entering a specific portal
  useEffect(() => {
    const role = roleForPortal(currentPortal);
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.user) setCurrentUser(data.user);
      })
      .catch(console.error);
  }, [currentPortal]);

  // Handle return from official Transbank Webpay URL (?webpay_status=approved&orderId=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wpStatus = params.get('webpay_status');
    const returnedOrderId = params.get('orderId');

    if (wpStatus === 'approved') {
      setCart([]);
      setClientSubView('TRACKING');
      setToastBanner({
        title: 'Pago confirmado por Transbank Webpay',
        message: 'Tu pedido ha sido enviado automáticamente al restaurante.',
      });
      if (returnedOrderId) {
        fetch('/api/orders')
          .then((r) => r.json())
          .then((allOrders: Order[]) => {
            const found = allOrders.find((o) => o.id === returnedOrderId);
            if (found) setSelectedTrackingOrder(found);
          });
      }
      window.history.replaceState({}, '', '/cliente');
    } else if (wpStatus === 'cancelled' || wpStatus === 'failed') {
      setToastBanner({
        title: 'Transacción Webpay no completada',
        message: 'El proceso de pago en Transbank fue anulado o rechazado.',
      });
      window.history.replaceState({}, '', '/cliente');
    }
  }, []);

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

  // Real-Time WebSocket Connection & Event Listener across all separated browser windows
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const handleRealtimeMessage = (msg: { type: string; payload: any }) => {
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
        if (currentPortal === '/cocina' || currentPortal === '/comercio') {
          playKitchenBellSound();
        }
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
        if (notif.role === activeRole) {
          setToastBanner({ title: notif.title, message: notif.message });
        }
      }
    };

    const unsubscribeLocal = subscribeRealtimeEvents(handleRealtimeMessage);

    const connect = () => {
      try {
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
            handleRealtimeMessage(msg);
          } catch (err) {
            console.error('WS message error:', err);
          }
        };

        ws.onclose = () => {
          reconnectTimer = setTimeout(connect, 4000);
        };
      } catch {
        // Ignore WS connection error on static hosting
      }
    };

    connect();

    return () => {
      unsubscribeLocal();
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [currentUser.id, activeRole, currentPortal]);

  useEffect(() => {
    if (!toastBanner) return;
    const t = setTimeout(() => setToastBanner(null), 4500);
    return () => clearTimeout(t);
  }, [toastBanner]);

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

  // Checkout -> Create PENDING_PAYMENT Order -> Generate Real Transbank Payment Link
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
      url: wpData.url,
      paymentLink: wpData.paymentLink,
      commerceCode: wpData.commerceCode,
      realTransbankConnected: wpData.realTransbankConnected,
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

  const roleNotifications = notifications.filter((n) => n.role === activeRole);
  const unreadCount = roleNotifications.filter((n) => !n.read).length;

  // ===========================================================================
  // LAUNCHER DIRECTORY VIEW (/portales) — Opens each separated application
  // ===========================================================================
  if (currentPortal === '/portales') {
    const portalsList: {
      path: PortalPath;
      title: string;
      subtitle: string;
      description: string;
      urlLabel: string;
      icon: React.FC<{ className?: string }>;
      accent: string;
    }[] = [
      {
        path: '/cliente',
        title: 'Sitio Web Clientes',
        subtitle: 'Tienda Gastronómica, Carrito, Enlace Webpay & Mapa GPS',
        description:
          'Aplicación exclusiva para comensales: buscador de restaurantes, personalización de platos, enlace de pago oficial Transbank Webpay Plus y seguimiento GPS en vivo.',
        urlLabel: 'http://localhost:3000/cliente',
        icon: ShoppingBag,
        accent: 'bg-orange-600 text-white',
      },
      {
        path: '/cocina',
        title: 'Pantalla KDS Cocina',
        subtitle: 'Sistema de Comandas en Tiempo Real para Tablets / Monitores',
        description:
          'Interfaz independiente de alto contraste para cocineros con alertas sonoras y columnas NUEVOS → PREPARANDO → LISTOS → ENTREGADOS.',
        urlLabel: 'http://localhost:3000/cocina',
        icon: ChefHat,
        accent: 'bg-amber-500 text-slate-950',
      },
      {
        path: '/repartidor',
        title: 'App Móvil Repartidor',
        subtitle: 'Despachos Asignados, Ruta y Telemetría GPS en Tiempo Real',
        description:
          'Sitio independiente optimizado para smartphones de repartidores: activación de disponibilidad, retiro en local, navegación y envío de coordenadas GPS.',
        urlLabel: 'http://localhost:3000/repartidor',
        icon: Bike,
        accent: 'bg-emerald-600 text-white',
      },
      {
        path: '/comercio',
        title: 'Portal Comercio / Restaurante',
        subtitle: 'Gestión de Pedidos Entrantes, Menú, Horarios y Zonas',
        description:
          'Panel exclusivo para dueños y encargados de local: aceptar o rechazar órdenes pagadas, administrar catálogo de productos, precios y disponibilidad.',
        urlLabel: 'http://localhost:3000/comercio',
        icon: Store,
        accent: 'bg-slate-900 text-white',
      },
      {
        path: '/admin',
        title: 'Consola Administrador',
        subtitle: 'Finanzas, Comisiones, Cupones y Auditoría Transbank',
        description:
          'Backoffice corporativo independiente para monitorear ventas diarias/mensuales, configurar comisiones de la plataforma y auditar transacciones Webpay.',
        urlLabel: 'http://localhost:3000/admin',
        icon: Shield,
        accent: 'bg-slate-800 text-white',
      },
    ];

    return (
      <div className="min-h-screen bg-[#0F172A] text-white p-6 sm:p-12">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-orange-400">
                Arquitectura Multi-Sitio Desacoplada
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold font-display mt-1">
                Food Delivery · Directorio de Sitios Independientes
              </h1>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                Cada rol opera en su propia ruta y aplicación dedicada, sincronizados en tiempo real mediante WebSockets (`/ws`). Puedes abrir cada sitio en una ventana o dispositivo distinto.
              </p>
            </div>
            <PWAInstallButton />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {portalsList.map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.path}
                  className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between gap-6 hover:border-slate-700 transition-all"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${p.accent}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="font-mono text-xs text-slate-400 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
                        {p.path}
                      </span>
                    </div>

                    <div>
                      <h2 className="text-xl font-bold text-white">{p.title}</h2>
                      <p className="text-xs font-semibold text-orange-400 mt-0.5">{p.subtitle}</p>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">{p.description}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 flex items-center gap-2.5">
                    <button
                      onClick={() => navigateToPortal(p.path)}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>Entrar al Sitio</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <a
                      href={p.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors"
                      title={`Abrir ${p.title} en nueva pestaña independiente`}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // DEDICATED HEADER PER INDEPENDENT PORTAL (NO MIXED ROLES ON THE SAME PAGE)
  // ===========================================================================
  const portalTitles: Record<PortalPath, { brand: string; badge: string }> = {
    '/cliente': { brand: 'Food Delivery', badge: 'Portal Clientes' },
    '/comercio': { brand: 'Food Delivery Partners', badge: 'Dashboard Comercio' },
    '/cocina': { brand: 'Food Delivery KDS', badge: 'Pantalla Comandas Cocina' },
    '/repartidor': { brand: 'Food Delivery Rider', badge: 'App Repartidor GPS' },
    '/admin': { brand: 'Food Delivery Admin', badge: 'Backoffice Central' },
    '/portales': { brand: 'Food Delivery', badge: 'Directorio' },
  };

  const currentHeaderInfo = portalTitles[currentPortal];

  return (
    <div className="min-h-screen flex flex-col bg-[#F9F9F8] text-slate-900">
      <OfflineIndicator />

      {/* Independent Portal Header */}
      <header
        className={`sticky top-0 z-40 px-4 sm:px-6 h-16 flex items-center justify-between gap-4 border-b ${
          currentPortal === '/cocina'
            ? 'bg-slate-950 text-white border-slate-800'
            : 'bg-white/95 backdrop-blur-md text-slate-900 border-slate-200'
        }`}
      >
        {/* Zone 1: Independent Site Brand */}
        <div className="flex items-center gap-3">
          <a
            href={currentPortal}
            onClick={(e) => {
              e.preventDefault();
              if (currentPortal === '/cliente') setClientSubView('EXPLORE');
            }}
            className="text-lg sm:text-xl font-bold font-display tracking-tight whitespace-nowrap"
          >
            {currentHeaderInfo.brand}
          </a>
          <span className="text-xs opacity-40">·</span>
          <span className="text-xs font-medium opacity-75 hidden sm:inline">
            {currentHeaderInfo.badge}
          </span>
        </div>

        {/* Zone 2: Contextual Info for the Current Dedicated Site Only */}
        <div className="hidden md:flex items-center gap-4 text-xs opacity-80">
          <span>Sesión activa: <strong>{currentUser.name}</strong></span>
          <span>·</span>
          <span className="font-mono">Ruta: {currentPortal}</span>
        </div>

        {/* Zone 3: Portal Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <PWAInstallButton />

          <button
            onClick={() => navigateToPortal('/portales')}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              currentPortal === '/cocina'
                ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            title="Ir al directorio de sitios separados (/cliente, /cocina, /repartidor, /comercio, /admin)"
          >
            <Grid className="w-3.5 h-3.5 text-orange-600" />
            <span>Cambiar de Sitio / Rol</span>
          </button>

          <button
            onClick={() => setShowNotifDrawer(true)}
            className={`relative p-2 rounded-xl border transition-colors cursor-pointer ${
              currentPortal === '/cocina'
                ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
            }`}
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
          INDEPENDENT SITE CONTENT PER URL PATH
      ===================================================================== */}
      <main className="flex-1">
        {currentPortal === '/cliente' && (
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
              const repeatedItems: CartItem[] = ord.items.map((oi) => {
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

        {currentPortal === '/comercio' && restaurants[0] && (
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

        {currentPortal === '/cocina' && (
          <KitchenView
            orders={orders}
            onUpdateStatus={handleUpdateOrderStatus}
          />
        )}

        {currentPortal === '/repartidor' && (
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

        {currentPortal === '/admin' && (
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
          TRANSBANK WEBPAY PLUS EXTERNAL PAYMENT LINK MODAL
      ===================================================================== */}
      {webpaySession && (
        <WebpayModal
          order={webpaySession.order}
          tokenWs={webpaySession.tokenWs}
          url={webpaySession.url}
          paymentLink={webpaySession.paymentLink}
          commerceCode={webpaySession.commerceCode}
          realTransbankConnected={webpaySession.realTransbankConnected}
          onCommitSuccess={(paidOrder) => {
            setWebpaySession(null);
            setCart([]);
            setSelectedTrackingOrder(paidOrder);
            setClientSubView('TRACKING');
          }}
          onCancelOrReject={(_failedOrder, reason) => {
            setWebpaySession(null);
            setToastBanner({
              title: 'Enlace de pago cancelado',
              message: reason,
            });
          }}
        />
      )}

      {/* =====================================================================
          NOTIFICATIONS DRAWER (SCOPED TO CURRENT PORTAL)
      ===================================================================== */}
      {showNotifDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white text-slate-900 h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Notificaciones · {currentHeaderInfo.badge}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Usuario: {currentUser.name}
                  </p>
                </div>
                <button
                  onClick={() => setShowNotifDrawer(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Alertas de este sitio
                  </h3>
                  <button
                    onClick={async () => {
                      await fetch('/api/notifications/read-all', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ role: activeRole }),
                      });
                      setNotifications((prev) =>
                        prev.map((n) => (n.role === activeRole ? { ...n, read: true } : n))
                      );
                    }}
                    className="text-xs font-semibold text-orange-600 hover:underline cursor-pointer"
                  >
                    Marcar leídas
                  </button>
                </div>

                {roleNotifications.length === 0 ? (
                  <p className="text-xs text-slate-500 py-8 text-center">
                    No hay notificaciones recientes para este portal.
                  </p>
                ) : (
                  roleNotifications.map((n) => (
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
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => setShowNotifDrawer(false)}
              className="mt-6 w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Clean Footer with Direct Links to Open Separated Sites in New Tabs */}
      <footer className="bg-white border-t border-slate-200/80 py-5 px-4 sm:px-6 text-xs text-slate-500">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <p>
            © {new Date().getFullYear()} <strong>{currentHeaderInfo.brand}</strong> ({currentPortal})
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <a href="/cliente" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900">
              Sitio Cliente (/cliente) ↗
            </a>
            <a href="/cocina" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900">
              Sitio Cocina (/cocina) ↗
            </a>
            <a href="/repartidor" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900">
              Sitio Repartidor (/repartidor) ↗
            </a>
            <a href="/comercio" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900">
              Sitio Comercio (/comercio) ↗
            </a>
            <a href="/admin" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900">
              Sitio Admin (/admin) ↗
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
