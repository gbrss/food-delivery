import React, { useState } from 'react';
import {
  Search,
  MapPin,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Phone,
  Navigation,
  Star,
  RotateCcw,
  ArrowLeft,
  X,
  Compass,
  Tag,
  User as UserIcon,
} from 'lucide-react';
import {
  User,
  Address,
  RestaurantCategory,
  Restaurant,
  RestaurantStatus,
  Product,
  CartItem,
  SelectedOption,
  SelectedExtra,
  Order,
  OrderStatus,
  Driver,
} from '../types/domain.ts';
import { LiveTrackingMap } from './LiveTrackingMap.tsx';
import { BUNDLED_IMAGES } from '../lib/images.ts';

interface ClientViewProps {
  user: User;
  addresses: Address[];
  categories: RestaurantCategory[];
  restaurants: Restaurant[];
  products: Product[];
  orders: Order[];
  driver: Driver;
  cart: CartItem[];
  selectedRestaurant: Restaurant | null;
  activeSubView: 'EXPLORE' | 'MENU' | 'TRACKING' | 'HISTORY' | 'PROFILE';
  selectedOrderForTracking: Order | null;
  onSelectSubView: (view: 'EXPLORE' | 'MENU' | 'TRACKING' | 'HISTORY' | 'PROFILE') => void;
  onSelectRestaurant: (rest: Restaurant) => void;
  onAddToCart: (
    product: Product,
    qty: number,
    options: SelectedOption[],
    extras: SelectedExtra[],
    notes: string
  ) => void;
  onUpdateCartQty: (itemId: string, delta: number) => void;
  onClearCart: () => void;
  onCheckoutWithWebpay: (params: {
    addressId: string;
    deliveryMethod: 'DELIVERY' | 'PICKUP';
    couponCode?: string;
    notes?: string;
  }) => Promise<void>;
  onAddAddress: (addr: Partial<Address>) => Promise<void>;
  onUpdateProfile: (data: { name: string; phone: string; email: string }) => Promise<void>;
  onSubmitReview: (
    orderId: string,
    restaurantRating: number,
    driverRating: number,
    comment: string
  ) => Promise<void>;
  onRepeatOrder: (order: Order) => void;
  onSelectTrackingOrder: (order: Order) => void;
}

const HERO_IMAGE = BUNDLED_IMAGES.hero;

export const ClientView: React.FC<ClientViewProps> = ({
  user,
  addresses,
  categories,
  restaurants,
  products,
  orders,
  driver,
  cart,
  selectedRestaurant,
  activeSubView,
  selectedOrderForTracking,
  onSelectSubView,
  onSelectRestaurant,
  onAddToCart,
  onUpdateCartQty,
  onClearCart,
  onCheckoutWithWebpay,
  onAddAddress,
  onUpdateProfile,
  onSubmitReview,
  onRepeatOrder,
  onSelectTrackingOrder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('all');
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [customQty, setCustomQty] = useState(1);
  const [customOptions, setCustomOptions] = useState<Record<string, SelectedOption>>({});
  const [customExtras, setCustomExtras] = useState<SelectedExtra[]>([]);
  const [customNotes, setCustomNotes] = useState('');

  // Cart & Checkout Drawer State
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState(addresses[0]?.id || 'addr-1');
  const [deliveryMethod, setDeliveryMethod] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // Profile & Address Form State
  const [profileName, setProfileName] = useState(user.name);
  const [profilePhone, setProfilePhone] = useState(user.phone);
  const [profileEmail, setProfileEmail] = useState(user.email);
  const [newAddrLabel, setNewAddrLabel] = useState('');
  const [newAddrStreet, setNewAddrStreet] = useState('');
  const [newAddrNumber, setNewAddrNumber] = useState('');
  const [newAddrCommune, setNewAddrCommune] = useState('Providencia');
  const [gpsStatusMsg, setGpsStatusMsg] = useState('');

  // Review Form State
  const [restStars, setRestStars] = useState(5);
  const [drvStars, setDrvStars] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const filteredRestaurants = restaurants.filter((r) => {
    const matchesCat =
      selectedCategorySlug === 'all' ||
      r.categoryId === selectedCategorySlug ||
      r.categoryName.toLowerCase() === selectedCategorySlug.toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.categoryName.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const openProductModal = (prod: Product) => {
    setCustomizingProduct(prod);
    setCustomQty(1);
    setCustomExtras([]);
    setCustomNotes('');
    const initialOpts: Record<string, SelectedOption> = {};
    prod.options.forEach((opt) => {
      if (opt.choices.length > 0) {
        initialOpts[opt.name] = {
          optionName: opt.name,
          choiceLabel: opt.choices[0].label,
          priceDelta: opt.choices[0].priceDelta,
        };
      }
    });
    setCustomOptions(initialOpts);
  };

  const handleConfirmAddToCart = () => {
    if (!customizingProduct) return;
    onAddToCart(
      customizingProduct,
      customQty,
      Object.values(customOptions),
      customExtras,
      customNotes
    );
    setCustomizingProduct(null);
    setCartOpen(true);
  };

  // Cart Totals Calculation
  const cartSubtotal = cart.reduce((acc, item) => acc + item.lineTotal, 0);
  const cartRestaurant =
    restaurants.find((r) => r.id === cart[0]?.product.restaurantId) ||
    selectedRestaurant ||
    restaurants[0];
  const deliveryFee = cart.length === 0 || deliveryMethod === 'PICKUP' ? 0 : cartRestaurant.deliveryFee;
  const serviceFee = cart.length === 0 ? 0 : 500;
  const discountAmount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const cartTotal = Math.max(0, cartSubtotal + deliveryFee + serviceFee - discountAmount);

  const handleValidateCoupon = async () => {
    setCouponError('');
    if (!couponInput.trim()) return;
    try {
      const res = await fetch('/api/cart/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponInput, subtotal: cartSubtotal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCouponError(data.error || 'Cupón inválido');
        setAppliedCoupon(null);
      } else {
        setAppliedCoupon({
          code: data.coupon.code,
          discountAmount: data.discountAmount,
        });
      }
    } catch {
      setCouponError('Error validando cupón');
    }
  };

  const handleLocateMeGps = () => {
    setGpsStatusMsg('Obteniendo coordenadas GPS...');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await onAddAddress({
            label: 'Mi Ubicación GPS Actual',
            street: 'Av. Providencia (Geolocalizado)',
            number: '2100',
            commune: 'Providencia',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setGpsStatusMsg('Ubicación GPS registrada correctamente.');
        },
        async () => {
          await onAddAddress({
            label: 'Ubicación GPS Santiago Centro/Providencia',
            street: 'Av. Nueva Providencia',
            number: '1860',
            commune: 'Providencia',
            lat: -33.4255,
            lng: -70.6102,
          });
          setGpsStatusMsg('Ubicación GPS registrada en Providencia.');
        }
      );
    }
  };

  const trackingOrder = selectedOrderForTracking || orders[0];

  // Tracking Progress Checklist Steps (Requirement #21)
  const getStepCompleted = (orderStatus: OrderStatus, targetStep: number): 'DONE' | 'CURRENT' | 'PENDING' => {
    const rankMap: Record<OrderStatus, number> = {
      [OrderStatus.CREATED]: 0,
      [OrderStatus.PENDING_PAYMENT]: 0,
      [OrderStatus.PAID]: 1,
      [OrderStatus.RECEIVED_BY_RESTAURANT]: 1,
      [OrderStatus.ACCEPTED]: 2,
      [OrderStatus.PREPARING]: 2,
      [OrderStatus.READY]: 3,
      [OrderStatus.ASSIGNED_TO_DRIVER]: 4,
      [OrderStatus.DRIVER_PICKED_UP]: 4,
      [OrderStatus.ON_THE_WAY]: 5,
      [OrderStatus.DELIVERED]: 6,
      [OrderStatus.COMPLETED]: 6,
      [OrderStatus.CANCELLED]: -1,
      [OrderStatus.PAYMENT_FAILED]: -1,
      [OrderStatus.REJECTED]: -1,
    };
    const currentRank = rankMap[orderStatus] ?? 1;
    if (currentRank > targetStep) return 'DONE';
    if (currentRank === targetStep) return 'CURRENT';
    return 'PENDING';
  };

  return (
    <div className="min-h-screen pb-16">
      {/* Sub-navigation bar for Client Views */}
      <div className="bg-white border-b border-slate-200/80">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex items-center gap-2">
            {(
              [
                { id: 'EXPLORE', label: 'Restaurantes & Categorías' },
                { id: 'MENU', label: selectedRestaurant ? `Menú: ${selectedRestaurant.name}` : 'Menú Comercio' },
                { id: 'TRACKING', label: `Tracking GPS #${trackingOrder?.orderNumber || 1048}` },
                { id: 'HISTORY', label: `Mis Pedidos (${orders.length})` },
                { id: 'PROFILE', label: 'Mi Perfil & Direcciones GPS' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => onSelectSubView(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeSubView === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCartOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-colors shrink-0 cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Carrito ({cart.reduce((a, b) => a + b.quantity, 0)})</span>
            {cartSubtotal > 0 && (
              <span className="font-mono">· ${cartSubtotal.toLocaleString('es-CL')}</span>
            )}
          </button>
        </div>
      </div>

      {/* =====================================================================
          VIEW 1: EXPLORE RESTAURANTS, HERO & 8 CATEGORIES
      ===================================================================== */}
      {activeSubView === 'EXPLORE' && (
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-10">
          {/* Hero Section with Search "¿Qué quieres comer hoy?" */}
          <section className="relative rounded-3xl overflow-hidden border border-slate-200 bg-slate-900 text-white">
            <img
              src={HERO_IMAGE}
              alt="Gastronomía artesanal a domicilio"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover opacity-55"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/55 to-slate-950/25" />

            <div className="relative z-10 px-6 py-12 sm:px-12 sm:py-16 max-w-3xl space-y-6">
              <div className="flex items-center gap-2 text-xs text-amber-300 font-medium">
                <MapPin className="w-3.5 h-3.5 text-orange-500" />
                <span>
                  Entregando en:{' '}
                  <strong className="text-white">
                    {addresses.find((a) => a.id === selectedAddressId)?.street || 'Av. Eliodoro Yáñez'}{' '}
                    {addresses.find((a) => a.id === selectedAddressId)?.number || '1890'}, Providencia
                  </strong>
                </span>
                <span>·</span>
                <button
                  onClick={() => onSelectSubView('PROFILE')}
                  className="underline hover:text-white cursor-pointer"
                >
                  Cambiar o usar GPS
                </button>
              </div>

              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
                ¿Qué quieres comer hoy?
              </h1>

              <p className="text-sm sm:text-base text-slate-200 max-w-xl">
                Cocina de autor, pizzerías napolitanas, sushi nikkei y smash burgers con pago directo en Webpay Plus y seguimiento GPS del repartidor en vivo.
              </p>

              {/* Search Bar */}
              <div className="flex flex-col sm:flex-row gap-2.5 bg-white/95 backdrop-blur-md p-2 rounded-2xl shadow-xl max-w-2xl">
                <div className="flex-1 flex items-center gap-2.5 px-3">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar restaurante, hamburguesa, sushi, pizza napolitana..."
                    className="w-full py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => {}}
                  className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                >
                  Buscar Comercios
                </button>
              </div>
            </div>
          </section>

          {/* 8 Interactive Culinary Categories */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Explorar por Categoría</h2>
              {selectedCategorySlug !== 'all' && (
                <button
                  onClick={() => setSelectedCategorySlug('all')}
                  className="text-xs font-semibold text-orange-600 hover:underline cursor-pointer"
                >
                  Ver todas las categorías
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {categories.map((cat) => {
                const isActive =
                  selectedCategorySlug === cat.id ||
                  selectedCategorySlug === cat.name.toLowerCase();
                return (
                  <button
                    key={cat.id}
                    onClick={() =>
                      setSelectedCategorySlug(isActive ? 'all' : cat.name.toLowerCase())
                    }
                    className={`flex items-center justify-center gap-2 p-3.5 rounded-2xl border text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-base">{cat.icon}</span>
                    <span className="whitespace-nowrap">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Featured Restaurants Grid (Zero-Pill Unboxed Metadata Discipline) */}
          <section className="space-y-5">
            <div className="flex items-baseline justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Restaurantes Destacados Cercanos
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tiempos de preparación verificados en cocina y despacho con GPS en vivo
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {filteredRestaurants.length} comercios disponibles
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredRestaurants.map((rest) => (
                <div
                  key={rest.id}
                  onClick={() => {
                    onSelectRestaurant(rest);
                    onSelectSubView('MENU');
                  }}
                  className="group rounded-2xl bg-white border border-slate-200 overflow-hidden hover:-translate-y-0.5 transition-transform duration-150 cursor-pointer flex flex-col"
                >
                  <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                    <img
                      src={rest.coverUrl}
                      alt={rest.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />

                    {/* Restaurant Logo & Promo Line */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 text-white">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={rest.logoUrl}
                          alt={rest.name}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-xl object-cover border-2 border-white shadow-sm"
                        />
                        <div>
                          <p className="text-[11px] font-medium text-amber-300">
                            {rest.promoLabel || 'Despacho Rápido GPS'}
                          </p>
                          <h3 className="text-base font-bold leading-snug text-white">
                            {rest.name}
                          </h3>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Body with Clean Unboxed Metadata Separators */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <p className="text-xs text-slate-600 line-clamp-2">{rest.description}</p>

                    <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600 font-mono tabular-nums">
                      <div className="flex items-center flex-wrap gap-1.5">
                        <span className="font-bold text-slate-900">★ {rest.rating}</span>
                        <span aria-hidden="true">·</span>
                        <span>{rest.prepTimeMinutes}–{rest.prepTimeMinutes + 10} min</span>
                        <span aria-hidden="true">·</span>
                        <span>{rest.distanceKm || 1.5} km</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-sans">
                        <span>
                          Envío: <strong className="font-mono text-slate-800">${rest.deliveryFee.toLocaleString('es-CL')}</strong>
                        </span>
                        <span>·</span>
                        <span>
                          Estado:{' '}
                          <strong
                            className={
                              rest.status === RestaurantStatus.OPEN
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                            }
                          >
                            {rest.status === RestaurantStatus.OPEN ? 'Abierto' : 'Cerrado'}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Popular Products Quick Section */}
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Platos Más Pedidos Hoy</h2>
              <p className="text-xs text-slate-500">
                Personaliza guarniciones, punto de cocción y extras antes de agregar al carrito
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {products
                .filter((p) => p.popular && p.available)
                .slice(0, 3)
                .map((prod) => {
                  const rest = restaurants.find((r) => r.id === prod.restaurantId);
                  return (
                    <div
                      key={prod.id}
                      className="rounded-2xl bg-white border border-slate-200 p-4 flex gap-4 items-center justify-between"
                    >
                      <div className="space-y-1.5 flex-1">
                        <p className="text-[11px] font-semibold text-orange-600 uppercase tracking-wider">
                          {rest?.name}
                        </p>
                        <h3 className="text-sm font-bold text-slate-900">{prod.name}</h3>
                        <p className="text-xs text-slate-500 line-clamp-2">{prod.description}</p>
                        <div className="pt-1 flex items-center gap-3">
                          <span className="text-sm font-bold font-mono tabular-nums text-slate-900">
                            ${(prod.discountPrice || prod.price).toLocaleString('es-CL')}
                          </span>
                          <button
                            onClick={() => {
                              if (rest) onSelectRestaurant(rest);
                              openProductModal(prod);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Personalizar +
                          </button>
                        </div>
                      </div>
                      <img
                        src={prod.imageUrl}
                        alt={prod.name}
                        referrerPolicy="no-referrer"
                        className="w-24 h-24 rounded-xl object-cover border border-slate-100 shrink-0"
                      />
                    </div>
                  );
                })}
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          VIEW 2: RESTAURANT MENU & PRODUCT CUSTOMIZATION
      ===================================================================== */}
      {activeSubView === 'MENU' && (
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
          <button
            onClick={() => onSelectSubView('EXPLORE')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a todos los restaurantes</span>
          </button>

          {(() => {
            const rest = selectedRestaurant || restaurants[0];
            const restProducts = products.filter((p) => p.restaurantId === rest.id);
            return (
              <>
                <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden">
                  <div className="relative h-52 sm:h-64 w-full bg-slate-900">
                    <img
                      src={rest.coverUrl}
                      alt={rest.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover opacity-70"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
                    <div className="absolute bottom-5 left-6 right-6 flex flex-wrap items-end justify-between gap-4 text-white">
                      <div className="space-y-1">
                        <p className="text-xs text-amber-300 font-medium">
                          {rest.categoryName} · {rest.address}, {rest.commune}
                        </p>
                        <h1 className="text-2xl sm:text-4xl font-bold">{rest.name}</h1>
                        <p className="text-xs sm:text-sm text-slate-200 max-w-2xl">
                          {rest.description}
                        </p>
                      </div>
                      <div className="text-xs font-mono tabular-nums bg-slate-900/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-700">
                        ★ {rest.rating} ({rest.reviewCount} reseñas) · {rest.prepTimeMinutes} min · Envío $
                        {rest.deliveryFee.toLocaleString('es-CL')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Menu Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {restProducts.map((prod) => (
                    <div
                      key={prod.id}
                      className="rounded-2xl bg-white border border-slate-200 p-5 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-3">
                        <div className="relative h-44 w-full rounded-xl overflow-hidden bg-slate-100">
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            {prod.categoryName}
                          </p>
                          <h3 className="text-base font-bold text-slate-900 mt-0.5">{prod.name}</h3>
                          <p className="text-xs text-slate-600 mt-1">{prod.description}</p>
                        </div>

                        <p className="text-[11px] text-slate-500">
                          <strong>Ingredientes:</strong> {prod.ingredients.join(' · ')}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="font-mono tabular-nums">
                          {prod.discountPrice ? (
                            <div className="flex items-baseline gap-2">
                              <span className="text-base font-bold text-slate-900">
                                ${prod.discountPrice.toLocaleString('es-CL')}
                              </span>
                              <span className="text-xs text-slate-400 line-through">
                                ${prod.price.toLocaleString('es-CL')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-base font-bold text-slate-900">
                              ${prod.price.toLocaleString('es-CL')}
                            </span>
                          )}
                        </div>

                        <button
                          disabled={!prod.available}
                          onClick={() => openProductModal(prod)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            prod.available
                              ? 'bg-orange-600 hover:bg-orange-700 text-white'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          {prod.available ? 'Personalizar y Agregar' : 'Agotado'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* =====================================================================
          VIEW 3: REAL-TIME ORDER TRACKING & GPS MAP (Requirement #21)
      ===================================================================== */}
      {activeSubView === 'TRACKING' && trackingOrder && (
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Attractive Status Stepper & Driver Card */}
            <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 p-6 space-y-6">
              <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                <div>
                  <p className="text-xs font-semibold text-orange-600">
                    Seguimiento en Tiempo Real (WebSocket + GPS)
                  </p>
                  <h1 className="text-2xl font-bold font-mono text-slate-900 mt-0.5">
                    PEDIDO #{trackingOrder.orderNumber}
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">{trackingOrder.restaurantName}</p>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <p className="text-xs text-slate-500">Total Webpay</p>
                  <p className="text-base font-bold text-slate-900">
                    ${trackingOrder.total.toLocaleString('es-CL')}
                  </p>
                </div>
              </div>

              {/* Estimated Arrival Headline */}
              <div className="rounded-2xl bg-slate-900 text-white p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Tiempo estimado de llegada</p>
                  <p className="text-base font-bold text-white mt-0.5">
                    {trackingOrder.status === OrderStatus.DELIVERED ||
                    trackingOrder.status === OrderStatus.COMPLETED
                      ? '¡Tu pedido ha sido entregado!'
                      : `Tu pedido llegará aproximadamente en ${trackingOrder.estimatedMinutes} minutos`}
                  </p>
                </div>
                <span className="font-mono text-lg font-bold text-orange-400 tabular-nums">
                  {trackingOrder.distanceKm} km
                </span>
              </div>

              {/* Visual Checklist (Requirement #21 exact layout) */}
              <div className="space-y-3">
                {[
                  { step: 1, label: 'Pedido confirmado (Pago Webpay validado)' },
                  { step: 2, label: 'Restaurante preparando en cocina' },
                  { step: 3, label: 'Pedido listo y sellado' },
                  { step: 4, label: 'Repartidor asignado' },
                  { step: 5, label: 'Repartidor en camino con GPS activo' },
                  { step: 6, label: 'Pedido entregado en tu dirección' },
                ].map((item) => {
                  const state = getStepCompleted(trackingOrder.status, item.step);
                  return (
                    <div key={item.step} className="flex items-center gap-3 text-sm">
                      {state === 'DONE' ? (
                        <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          ✓
                        </span>
                      ) : state === 'CURRENT' ? (
                        <span className="w-6 h-6 rounded-full bg-orange-600 text-white flex items-center justify-center text-xs font-bold animate-pulse shrink-0">
                          ●
                        </span>
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xs font-mono shrink-0">
                          {item.step}
                        </span>
                      )}
                      <span
                        className={
                          state === 'DONE'
                            ? 'text-slate-700 font-medium'
                            : state === 'CURRENT'
                            ? 'text-slate-900 font-bold'
                            : 'text-slate-400'
                        }
                      >
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Driver Info & Actions */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500">Repartidor asignado</p>
                    <p className="text-sm font-bold text-slate-900">
                      {trackingOrder.driverName || driver.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {trackingOrder.driverVehicle || `Moto · Patente ${driver.vehiclePlate}`}
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold text-emerald-700">
                    ★ {driver.rating}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <a
                    href={`tel:${trackingOrder.driverPhone || driver.phone}`}
                    className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5 text-orange-600" />
                    <span className="truncate">Contactar repartidor</span>
                  </a>
                  <button
                    onClick={() => {}}
                    className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5 text-orange-600" />
                    <span className="truncate">Ver ruta</span>
                  </button>
                  <button
                    onClick={() => onSelectSubView('HISTORY')}
                    className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span className="truncate">Ver detalles</span>
                  </button>
                </div>
              </div>

              {/* Rating Box once Delivered */}
              {(trackingOrder.status === OrderStatus.DELIVERED ||
                trackingOrder.status === OrderStatus.COMPLETED) &&
                !trackingOrder.review && (
                  <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span>Califica tu experiencia</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-600 mb-1">Restaurante (1-5)</label>
                        <select
                          value={restStars}
                          onChange={(e) => setRestStars(Number(e.target.value))}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono"
                        >
                          {[5, 4, 3, 2, 1].map((s) => (
                            <option key={s} value={s}>
                              {s} Estrellas
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Repartidor (1-5)</label>
                        <select
                          value={drvStars}
                          onChange={(e) => setDrvStars(Number(e.target.value))}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono"
                        >
                          {[5, 4, 3, 2, 1].map((s) => (
                            <option key={s} value={s}>
                              {s} Estrellas
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Escribe un comentario sobre la comida y entrega..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                    />
                    <button
                      onClick={() =>
                        onSubmitReview(trackingOrder.id, restStars, drvStars, reviewComment)
                      }
                      className="w-full py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                    >
                      Enviar Calificación y Completar Pedido
                    </button>
                  </div>
                )}

              {trackingOrder.review && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900">
                  <p className="font-bold">
                    ✓ Calificación enviada: ★ {trackingOrder.review.restaurantRating} Restaurante · ★{' '}
                    {trackingOrder.review.driverRating} Repartidor
                  </p>
                  <p className="mt-0.5 italic">&ldquo;{trackingOrder.review.comment}&rdquo;</p>
                </div>
              )}
            </div>

            {/* Right Column: Live Interactive Map + Order Items Summary */}
            <div className="lg:col-span-7 space-y-5">
              <LiveTrackingMap
                restaurantLat={trackingOrder.restaurantLat}
                restaurantLng={trackingOrder.restaurantLng}
                restaurantName={trackingOrder.restaurantName}
                clientLat={trackingOrder.deliveryLat}
                clientLng={trackingOrder.deliveryLng}
                clientAddress={trackingOrder.deliveryAddress}
                driverLat={driver.currentLat}
                driverLng={driver.currentLng}
                driverName={trackingOrder.driverName || driver.name}
                heightClass="h-96 sm:h-[430px]"
              />

              {/* Order Financial & Itemized Breakdown */}
              <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    Detalle del Pedido #{trackingOrder.orderNumber}
                  </h3>
                  <span className="text-xs font-mono text-slate-500">
                    Dirección: {trackingOrder.deliveryAddress}
                  </span>
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  {trackingOrder.items.map((item) => (
                    <div key={item.id} className="py-2 flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold mr-1.5">{item.quantity}x</span>
                        <span className="font-semibold text-slate-900">{item.productName}</span>
                      </div>
                      <span className="font-mono tabular-nums font-semibold">
                        ${item.lineTotal.toLocaleString('es-CL')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 4: ORDER HISTORY & REPEAT PREVIOUS ORDERS
      ===================================================================== */}
      {activeSubView === 'HISTORY' && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Historial de Mis Pedidos</h1>
          <div className="space-y-4">
            {orders.map((ord) => (
              <div
                key={ord.id}
                className="rounded-2xl bg-white border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="text-base font-bold font-mono text-slate-900">
                      Pedido #{ord.orderNumber}
                    </span>
                    <span>·</span>
                    <span className="font-semibold text-orange-600">{ord.status}</span>
                    <span>·</span>
                    <span className="font-mono">
                      ${ord.total.toLocaleString('es-CL')}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{ord.restaurantName}</p>
                  <p className="text-xs text-slate-600">
                    {ord.items.map((i) => `${i.quantity}x ${i.productName}`).join(' · ')}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => {
                      onSelectTrackingOrder(ord);
                      onSelectSubView('TRACKING');
                    }}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer"
                  >
                    Ver Tracking GPS
                  </button>
                  <button
                    onClick={() => {
                      onRepeatOrder(ord);
                      setCartOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Repetir Pedido</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 5: CLIENT PROFILE & MULTIPLE GPS ADDRESSES
      ===================================================================== */}
      {activeSubView === 'PROFILE' && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await onUpdateProfile({
                name: profileName,
                phone: profilePhone,
                email: profileEmail,
              });
            }}
            className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4 h-fit"
          >
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-orange-600" />
              <span>Mis Datos de Perfil</span>
            </h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre completo</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Correo electrónico</label>
              <input
                type="email"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Teléfono</label>
              <input
                type="text"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
            >
              Guardar Perfil
            </button>
          </form>

          <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Mis Direcciones de Entrega</h2>
              <button
                type="button"
                onClick={handleLocateMeGps}
                className="px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 border border-orange-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Detectar con GPS</span>
              </button>
            </div>

            {gpsStatusMsg && (
              <p className="text-xs font-medium text-emerald-700 bg-emerald-50 p-2.5 rounded-xl">
                {gpsStatusMsg}
              </p>
            )}

            <div className="space-y-2.5">
              {addresses.map((a) => (
                <div
                  key={a.id}
                  onClick={() => setSelectedAddressId(a.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedAddressId === a.id
                      ? 'border-slate-900 bg-slate-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900">{a.label}</p>
                    <span className="font-mono text-[11px] text-slate-400">
                      {a.lat.toFixed(4)}, {a.lng.toFixed(4)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {a.street} {a.number}, {a.commune}
                  </p>
                </div>
              ))}
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newAddrStreet.trim()) return;
                await onAddAddress({
                  label: newAddrLabel || 'Nueva Dirección',
                  street: newAddrStreet,
                  number: newAddrNumber || '100',
                  commune: newAddrCommune,
                  lat: -33.4285,
                  lng: -70.614,
                });
                setNewAddrLabel('');
                setNewAddrStreet('');
                setNewAddrNumber('');
              }}
              className="pt-3 border-t border-slate-100 space-y-2.5"
            >
              <p className="text-xs font-bold text-slate-800">Agregar nueva dirección:</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Etiqueta (Ej: Casa)"
                  value={newAddrLabel}
                  onChange={(e) => setNewAddrLabel(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Comuna"
                  value={newAddrCommune}
                  onChange={(e) => setNewAddrCommune(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Calle / Avenida"
                  value={newAddrStreet}
                  onChange={(e) => setNewAddrStreet(e.target.value)}
                  className="col-span-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="Número"
                  value={newAddrNumber}
                  onChange={(e) => setNewAddrNumber(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-mono"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-orange-600 text-white text-xs font-bold cursor-pointer"
              >
                Agregar Dirección
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: PRODUCT CUSTOMIZATION (OPTIONS, EXTRAS & NOTES)
      ===================================================================== */}
      {customizingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">{customizingProduct.name}</h3>
              <button
                onClick={() => setCustomizingProduct(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <p className="text-xs text-slate-600">{customizingProduct.description}</p>

              {/* Options */}
              {customizingProduct.options.map((opt) => (
                <div key={opt.id} className="space-y-2">
                  <p className="text-xs font-bold text-slate-900">
                    {opt.name} {opt.required && <span className="text-orange-600">(Obligatorio)</span>}
                  </p>
                  <div className="space-y-1.5">
                    {opt.choices.map((ch) => {
                      const selected = customOptions[opt.name]?.choiceLabel === ch.label;
                      return (
                        <label
                          key={ch.label}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer ${
                            selected ? 'border-slate-900 bg-slate-50 font-semibold' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={opt.id}
                              checked={selected}
                              onChange={() =>
                                setCustomOptions({
                                  ...customOptions,
                                  [opt.name]: {
                                    optionName: opt.name,
                                    choiceLabel: ch.label,
                                    priceDelta: ch.priceDelta,
                                  },
                                })
                              }
                            />
                            <span>{ch.label}</span>
                          </div>
                          {ch.priceDelta > 0 && (
                            <span className="font-mono">+${ch.priceDelta.toLocaleString('es-CL')}</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Extras */}
              {customizingProduct.extras.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-900">Agregar Extras Opcionales</p>
                  <div className="space-y-1.5">
                    {customizingProduct.extras.map((ext) => {
                      const checked = customExtras.some((e) => e.extraId === ext.id);
                      return (
                        <label
                          key={ext.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer ${
                            checked ? 'border-orange-600 bg-orange-50/40 font-semibold' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                if (checked) {
                                  setCustomExtras(customExtras.filter((e) => e.extraId !== ext.id));
                                } else {
                                  setCustomExtras([
                                    ...customExtras,
                                    { extraId: ext.id, name: ext.name, price: ext.price },
                                  ]);
                                }
                              }}
                            />
                            <span>{ext.name}</span>
                          </div>
                          <span className="font-mono">+${ext.price.toLocaleString('es-CL')}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Instrucciones especiales para Cocina
                </label>
                <input
                  type="text"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Ej: Sin cebolla, salsas aparte..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCustomQty(Math.max(1, customQty - 1))}
                  className="w-8 h-8 rounded-lg border border-slate-300 bg-white flex items-center justify-center cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono font-bold text-sm w-6 text-center">{customQty}</span>
                <button
                  type="button"
                  onClick={() => setCustomQty(customQty + 1)}
                  className="w-8 h-8 rounded-lg border border-slate-300 bg-white flex items-center justify-center cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleConfirmAddToCart}
                className="flex-1 py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer"
              >
                Agregar al Carrito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          DRAWER: CART, COUPONS & TRANSPARENT WEBPAY CHECKOUT
      ===================================================================== */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto">
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-orange-600" />
                  <h2 className="text-lg font-bold text-slate-900">Tu Carrito & Checkout</h2>
                </div>
                <button
                  onClick={() => setCartOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <p className="text-sm font-semibold text-slate-700">Tu carrito está vacío</p>
                  <p className="text-xs text-slate-500">
                    Agrega productos desde cualquier restaurante para iniciar el pago con Webpay Plus.
                  </p>
                </div>
              ) : (
                <>
                  {/* Delivery Method Toggle */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod('DELIVERY')}
                      className={`py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        deliveryMethod === 'DELIVERY' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Despacho a Domicilio
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod('PICKUP')}
                      className={`py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        deliveryMethod === 'PICKUP' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Retiro en Local ($0)
                    </button>
                  </div>

                  {/* Address Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Dirección de Entrega
                    </label>
                    <select
                      value={selectedAddressId}
                      onChange={(e) => setSelectedAddressId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900"
                    >
                      {addresses.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}: {a.street} {a.number}, {a.commune}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Cart Items */}
                  <div className="divide-y divide-slate-100 space-y-3">
                    {cart.map((item) => (
                      <div key={item.id} className="pt-3 flex items-start justify-between gap-3">
                        <div className="space-y-0.5 text-xs">
                          <p className="font-bold text-slate-900">{item.product.name}</p>
                          {item.selectedOptions.map((o, idx) => (
                            <p key={idx} className="text-slate-500">
                              • {o.optionName}: {o.choiceLabel}
                            </p>
                          ))}
                          {item.selectedExtras.map((e, idx) => (
                            <p key={idx} className="text-emerald-700 font-medium">
                              + {e.name} (${e.price.toLocaleString('es-CL')})
                            </p>
                          ))}
                          <p className="font-mono font-bold text-slate-900 pt-1">
                            ${item.lineTotal.toLocaleString('es-CL')}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onUpdateCartQty(item.id, -1)}
                            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-mono text-xs font-bold w-5 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => onUpdateCartQty(item.id, 1)}
                            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Coupon Box */}
                  <div className="pt-2 space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Cupón de descuento (Prueba: <code className="font-mono text-orange-600">BIENVENIDO</code> o <code className="font-mono text-orange-600">DELIVERY15</code>)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        placeholder="Ingresa código..."
                        className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono uppercase"
                      />
                      <button
                        type="button"
                        onClick={handleValidateCoupon}
                        className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                      >
                        Aplicar
                      </button>
                    </div>
                    {couponError && <p className="text-xs text-red-600">{couponError}</p>}
                    {appliedCoupon && (
                      <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5" />
                        Cupón {appliedCoupon.code} aplicado (-$
                        {appliedCoupon.discountAmount.toLocaleString('es-CL')})
                      </p>
                    )}
                  </div>

                  {/* General Notes */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Observaciones para el restaurante / repartidor
                    </label>
                    <input
                      type="text"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Ej: Llamar al llegar, sin cubiertos..."
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                    />
                  </div>

                  {/* Transparent Monetization Breakdown before Payment (Requirement #12) */}
                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-xs font-mono tabular-nums">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal Productos:</span>
                      <span>${cartSubtotal.toLocaleString('es-CL')}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Costo de Despacho:</span>
                      <span>${deliveryFee.toLocaleString('es-CL')}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Tarifa de Servicio Plataforma:</span>
                      <span>${serviceFee.toLocaleString('es-CL')}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Descuento Cupón ({appliedCoupon?.code}):</span>
                        <span>-${discountAmount.toLocaleString('es-CL')}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                      <span>Total a Pagar:</span>
                      <span>${cartTotal.toLocaleString('es-CL')}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-2.5">
                <button
                  onClick={async () => {
                    setCartOpen(false);
                    await onCheckoutWithWebpay({
                      addressId: selectedAddressId,
                      deliveryMethod,
                      couponCode: appliedCoupon?.code,
                      notes: orderNotes,
                    });
                  }}
                  className="w-full py-3.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>Pagar con Webpay Plus</span>
                  <span className="font-mono">${cartTotal.toLocaleString('es-CL')} →</span>
                </button>
                <button
                  onClick={onClearCart}
                  className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-red-600 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Vaciar carrito</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
