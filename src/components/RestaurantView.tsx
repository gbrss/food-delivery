import React, { useState } from 'react';
import {
  Store,
  Plus,
  Check,
  X,
  Clock,
  DollarSign,
  ShoppingBag,
  Settings,
  Utensils,
} from 'lucide-react';
import {
  Restaurant,
  RestaurantStatus,
  Product,
  Order,
  OrderStatus,
  Role,
} from '../types/domain.ts';

interface RestaurantViewProps {
  restaurant: Restaurant;
  products: Product[];
  orders: Order[];
  onUpdateOrderStatus: (orderId: string, status: OrderStatus, actorRole: Role, note?: string) => Promise<void>;
  onUpdateRestaurant: (updates: Partial<Restaurant>) => Promise<void>;
  onCreateProduct: (newProd: Partial<Product>) => Promise<void>;
  onToggleProductAvailability: (product: Product) => Promise<void>;
}

export const RestaurantView: React.FC<RestaurantViewProps> = ({
  restaurant,
  products,
  orders,
  onUpdateOrderStatus,
  onUpdateRestaurant,
  onCreateProduct,
  onToggleProductAvailability,
}) => {
  const [tab, setTab] = useState<'ORDERS' | 'CATALOG' | 'SETTINGS'>('ORDERS');
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('9500');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdIngredients, setNewProdIngredients] = useState('Carne Angus, Queso Cheddar, Pan Brioche');
  const [deliveryFeeInput, setDeliveryFeeInput] = useState(String(restaurant.deliveryFee));
  const [minOrderInput, setMinOrderInput] = useState(String(restaurant.minOrderAmount));
  const [promoLabelInput, setPromoLabelInput] = useState(restaurant.promoLabel || '');

  const restOrders = orders.filter((o) => o.restaurantId === restaurant.id);
  const restProducts = products.filter((p) => p.restaurantId === restaurant.id);

  const totalSales = restOrders.reduce((acc, o) => acc + o.subtotal, 0);
  const netEarnings = restOrders.reduce((acc, o) => acc + o.restaurantEarnings, 0);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return;
    await onCreateProduct({
      restaurantId: restaurant.id,
      name: newProdName,
      price: Number(newProdPrice) || 8900,
      description: newProdDesc || 'Preparado al momento con ingredientes seleccionados.',
      ingredients: newProdIngredients.split(',').map((s) => s.trim()),
      categoryName: 'Especialidades de la Casa',
    });
    setNewProdName('');
    setNewProdDesc('');
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Restaurant Control Header */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src={restaurant.logoUrl}
            alt={restaurant.name}
            referrerPolicy="no-referrer"
            className="w-14 h-14 rounded-2xl object-cover border border-slate-200"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{restaurant.name}</h1>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-mono text-slate-600">{restaurant.address}</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comisión plataforma: {restaurant.commissionPercent}% · Despacho: $
              {restaurant.deliveryFee.toLocaleString('es-CL')} · Pedido mínimo: $
              {restaurant.minOrderAmount.toLocaleString('es-CL')}
            </p>
          </div>
        </div>

        {/* Status Switcher: Abierto / Cerrado / Temporalmente no disponible */}
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { st: RestaurantStatus.OPEN, label: 'Abierto' },
              { st: RestaurantStatus.TEMPORARILY_UNAVAILABLE, label: 'Pausado Temporal' },
              { st: RestaurantStatus.CLOSED, label: 'Cerrado' },
            ] as const
          ).map((item) => (
            <button
              key={item.st}
              onClick={() =>
                onUpdateRestaurant({
                  status: item.st,
                  acceptingOrders: item.st === RestaurantStatus.OPEN,
                })
              }
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                restaurant.status === item.st
                  ? item.st === RestaurantStatus.OPEN
                    ? 'bg-emerald-600 text-white'
                    : item.st === RestaurantStatus.TEMPORARILY_UNAVAILABLE
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Ventas Brutas del Comercio</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            ${totalSales.toLocaleString('es-CL')}
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Ingreso Líquido (Neto)</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600 mt-1">
            ${netEarnings.toLocaleString('es-CL')}
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Pedidos Totales</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {restOrders.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Productos Activos en Menú</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {restProducts.filter((p) => p.available).length} / {restProducts.length}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl w-fit">
        <button
          onClick={() => setTab('ORDERS')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            tab === 'ORDERS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Recepción de Pedidos ({restOrders.length})</span>
        </button>
        <button
          onClick={() => setTab('CATALOG')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            tab === 'CATALOG' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Utensils className="w-3.5 h-3.5" />
          <span>Catálogo de Productos & Precios</span>
        </button>
        <button
          onClick={() => setTab('SETTINGS')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            tab === 'SETTINGS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Horarios, Zonas & Promociones</span>
        </button>
      </div>

      {tab === 'ORDERS' && (
        <div className="space-y-4">
          {restOrders.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl bg-white border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 text-xs text-slate-500">
                  <span className="text-base font-bold font-mono text-slate-900">
                    NUEVO PEDIDO #{order.orderNumber}
                  </span>
                  <span>·</span>
                  <span className="font-semibold text-orange-600">{order.status}</span>
                  <span>·</span>
                  <span>Cliente: {order.clientName}</span>
                  <span>·</span>
                  <span className="font-mono">
                    Webpay {order.paymentStatus} (Subtotal ${order.subtotal.toLocaleString('es-CL')})
                  </span>
                </div>

                <div className="text-xs text-slate-700 space-y-0.5">
                  {order.items.map((item) => (
                    <p key={item.id}>
                      <strong className="font-mono">{item.quantity}x</strong> {item.productName}{' '}
                      {item.selectedExtras.length > 0 &&
                        `(+ ${item.selectedExtras.map((e) => e.name).join(', ')})`}
                    </p>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {(order.status === OrderStatus.RECEIVED_BY_RESTAURANT ||
                  order.status === OrderStatus.PAID) && (
                  <>
                    <button
                      onClick={() =>
                        onUpdateOrderStatus(
                          order.id,
                          OrderStatus.ACCEPTED,
                          Role.RESTAURANT,
                          'PEDIDO ACEPTADO por el restaurante y enviado a cocina'
                        )
                      }
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Aceptar Pedido y Enviar a Cocina</span>
                    </button>
                    <button
                      onClick={() =>
                        onUpdateOrderStatus(
                          order.id,
                          OrderStatus.REJECTED,
                          Role.RESTAURANT,
                          'PEDIDO RECHAZADO por falta de stock puntual'
                        )
                      }
                      className="px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>Rechazar</span>
                    </button>
                  </>
                )}

                {order.status === OrderStatus.ACCEPTED && (
                  <button
                    onClick={() =>
                      onUpdateOrderStatus(
                        order.id,
                        OrderStatus.PREPARING,
                        Role.RESTAURANT,
                        'En preparación en cocina'
                      )
                    }
                    className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold cursor-pointer"
                  >
                    Pasar a PREPARANDO
                  </button>
                )}

                {order.status === OrderStatus.PREPARING && (
                  <button
                    onClick={() =>
                      onUpdateOrderStatus(
                        order.id,
                        OrderStatus.READY,
                        Role.RESTAURANT,
                        'Pedido listo para retiro de repartidor'
                      )
                    }
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                  >
                    Marcar LISTO PARA REPARTIDOR
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'CATALOG' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Add New Product Form */}
          <form
            onSubmit={handleAddProduct}
            className="lg:col-span-4 rounded-2xl bg-white border border-slate-200 p-5 space-y-4 h-fit"
          >
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-orange-600" />
              <span>Crear Nuevo Producto</span>
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nombre del plato
              </label>
              <input
                type="text"
                required
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                placeholder="Ej: Crispy Jalapeño Smash Burger"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Precio CLP ($)
              </label>
              <input
                type="number"
                required
                value={newProdPrice}
                onChange={(e) => setNewProdPrice(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Ingredientes separados por coma
              </label>
              <input
                type="text"
                value={newProdIngredients}
                onChange={(e) => setNewProdIngredients(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Descripción gastronómica
              </label>
              <textarea
                rows={3}
                value={newProdDesc}
                onChange={(e) => setNewProdDesc(e.target.value)}
                placeholder="Describe ingredientes, técnica y acompañamientos..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Agregar al Menú en Tiempo Real
            </button>
          </form>

          {/* Product List */}
          <div className="lg:col-span-8 space-y-3">
            {restProducts.map((prod) => (
              <div
                key={prod.id}
                className="rounded-2xl bg-white border border-slate-200 p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  <img
                    src={prod.imageUrl}
                    alt={prod.name}
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-xl object-cover border border-slate-100"
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-900">{prod.name}</p>
                    <p className="text-xs text-slate-500 line-clamp-1">{prod.description}</p>
                    <p className="text-xs font-mono font-bold text-slate-900 mt-1">
                      ${(prod.discountPrice || prod.price).toLocaleString('es-CL')}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onToggleProductAvailability(prod)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                    prod.available
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  {prod.available ? 'Disponible en Menú' : 'Agotado Temporal'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'SETTINGS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-orange-600" />
              <span>Configuración de Despacho, Pedido Mínimo y Promociones</span>
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Costo de Despacho Base (CLP)
              </label>
              <input
                type="number"
                value={deliveryFeeInput}
                onChange={(e) => setDeliveryFeeInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Pedido Mínimo (CLP)
              </label>
              <input
                type="number"
                value={minOrderInput}
                onChange={(e) => setMinOrderInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Campaña / Promoción Destacada
              </label>
              <input
                type="text"
                value={promoLabelInput}
                onChange={(e) => setPromoLabelInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <button
              onClick={() =>
                onUpdateRestaurant({
                  deliveryFee: Number(deliveryFeeInput),
                  minOrderAmount: Number(minOrderInput),
                  promoLabel: promoLabelInput,
                })
              }
              className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer"
            >
              Guardar Configuración del Comercio
            </button>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" />
              <span>Horarios de Atención & Zonas de Reparto</span>
            </h2>
            <div className="space-y-2 text-xs">
              {restaurant.hours.map((h) => (
                <div key={h.id} className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="font-semibold text-slate-700">{h.dayName}</span>
                  <span className="font-mono text-slate-900">
                    {h.openTime} – {h.closeTime} hrs
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-2 space-y-2">
              <p className="text-xs font-bold text-slate-800">Zonas de Cobertura Activas:</p>
              {restaurant.deliveryZones.map((dz) => (
                <div
                  key={dz.id}
                  className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-center justify-between text-xs"
                >
                  <span className="font-medium text-slate-800">
                    {dz.name} (Radio {dz.radiusKm} km)
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    Base ${dz.baseFee.toLocaleString('es-CL')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
