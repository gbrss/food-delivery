import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Store,
  CreditCard,
  Percent,
  Tag,
  Plus,
  ShieldCheck,
  Code2,
} from 'lucide-react';
import {
  Restaurant,
  RestaurantStatus,
  Order,
  Coupon,
  PaymentTransaction,
  PlatformSettings,
} from '../types/domain.ts';

interface AdminViewProps {
  restaurants: Restaurant[];
  orders: Order[];
  onUpdateRestaurant: (id: string, updates: Partial<Restaurant>) => Promise<void>;
  onCreateRestaurant: (data: Partial<Restaurant>) => Promise<void>;
}

export const AdminView: React.FC<AdminViewProps> = ({
  restaurants,
  orders,
  onUpdateRestaurant,
  onCreateRestaurant,
}) => {
  const [tab, setTab] = useState<'OVERVIEW' | 'RESTAURANTS' | 'MONETIZATION' | 'TRANSACTIONS' | 'API_DOCS'>('OVERVIEW');
  const [summary, setSummary] = useState<{
    metrics: any;
    settings: PlatformSettings;
    coupons: Coupon[];
    transactions: PaymentTransaction[];
  } | null>(null);

  const [newRestName, setNewRestName] = useState('');
  const [newRestAddress, setNewRestAddress] = useState('');
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponValue, setNewCouponValue] = useState('3500');

  const fetchSummary = async () => {
    try {
      const res = await fetch('/api/admin/summary');
      const data = await res.json();
      setSummary(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [orders, restaurants]);

  const handleSaveCommission = async (commission: number, serviceFee: number) => {
    await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        defaultCommissionPercent: commission,
        serviceFeeClp: serviceFee,
      }),
    });
    fetchSummary();
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCouponCode.trim()) return;
    await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: newCouponCode,
        discountType: 'FIXED',
        discountValue: Number(newCouponValue),
        minOrderAmount: 10000,
        description: `Descuento directo de $${Number(newCouponValue).toLocaleString('es-CL')}`,
      }),
    });
    setNewCouponCode('');
    fetchSummary();
  };

  const m = summary?.metrics || {
    dailySales: 45980,
    monthlySales: 4895980,
    totalOrders: orders.length,
    activeRestaurants: restaurants.length,
    activeDrivers: 1,
    registeredClients: 145,
    totalCommissions: 6150,
    totalServiceFees: 1000,
    pendingOrders: 1,
    completedOrders: 1,
    cancelledOrders: 0,
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Panel de Administración & Monetización
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Control financiero, comisiones por restaurante, auditoría Webpay Plus, cupones y analítica operativa
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
          {(
            [
              { id: 'OVERVIEW', label: 'Analítica & Ventas', icon: BarChart3 },
              { id: 'RESTAURANTS', label: 'Comercios', icon: Store },
              { id: 'MONETIZATION', label: 'Comisiones & Cupones', icon: Percent },
              { id: 'TRANSACTIONS', label: 'Pagos Webpay', icon: CreditCard },
              { id: 'API_DOCS', label: 'Arquitectura & API', icon: Code2 },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  tab === item.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Top 5 KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Ventas del Día</p>
          <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            ${m.dailySales.toLocaleString('es-CL')}
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Ventas del Mes</p>
          <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            ${m.monthlySales.toLocaleString('es-CL')}
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Comisiones Plataforma (15%)</p>
          <p className="text-xl font-bold font-mono tabular-nums text-emerald-600 mt-1">
            +${m.totalCommissions.toLocaleString('es-CL')}
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Restaurantes / Repartidores</p>
          <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {m.activeRestaurants} activos · {m.activeDrivers} GPS
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Pedidos (Activos / Completados)</p>
          <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {m.pendingOrders} en curso · {m.completedOrders} listos
          </p>
        </div>
      </div>

      {tab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sales by Restaurant Visual Breakdown */}
          <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Ventas y Comisiones por Restaurante
            </h2>
            <div className="space-y-4">
              {restaurants.map((r, i) => {
                const restOrders = orders.filter((o) => o.restaurantId === r.id);
                const vol = restOrders.reduce((acc, o) => acc + o.total, 0) + (i === 0 ? 1250000 : i === 1 ? 980000 : 740000);
                const maxVol = 1500000;
                const pct = Math.min(100, Math.round((vol / maxVol) * 100));
                return (
                  <div key={r.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">
                        {r.name} · Comisión {r.commissionPercent}%
                      </span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        ${vol.toLocaleString('es-CL')}
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-orange-600 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Peak Hours & Zones Breakdown */}
          <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Horarios de Mayor Demanda & Pedidos por Zona
            </h2>
            <div className="space-y-2.5 text-xs">
              {[
                { slot: '12:30 – 14:30 (Almuerzo Ejecutivo)', share: '34%', zona: 'Providencia / El Golf' },
                { slot: '19:30 – 22:30 (Cena Prime)', share: '48%', zona: 'Providencia / Ñuñoa / Barrio Italia' },
                { slot: '22:30 – 00:30 (Late Night)', share: '18%', zona: 'Bellavista / Las Condes' },
              ].map((row, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold text-slate-900">{row.slot}</p>
                    <p className="text-slate-500">Zona líder: {row.zona}</p>
                  </div>
                  <span className="text-sm font-mono font-bold text-orange-600 tabular-nums">
                    {row.share}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'RESTAURANTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newRestName.trim()) return;
              await onCreateRestaurant({
                name: newRestName,
                address: newRestAddress || 'Av. Providencia 2300',
              });
              setNewRestName('');
              setNewRestAddress('');
            }}
            className="lg:col-span-4 rounded-2xl bg-white border border-slate-200 p-5 space-y-4 h-fit"
          >
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-orange-600" />
              <span>Incorporar Nuevo Restaurante</span>
            </h2>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nombre del Comercio
              </label>
              <input
                type="text"
                required
                value={newRestName}
                onChange={(e) => setNewRestName(e.target.value)}
                placeholder="Ej: Bao Bar & Ramen House"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Dirección Comercial
              </label>
              <input
                type="text"
                value={newRestAddress}
                onChange={(e) => setNewRestAddress(e.target.value)}
                placeholder="Av. Nueva Costanera 3900"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
            >
              Crear y Aprobar Comercio
            </button>
          </form>

          <div className="lg:col-span-8 rounded-2xl bg-white border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 bg-slate-50">
                  <th className="py-3 px-4 font-semibold">Comercio</th>
                  <th className="py-3 px-4 font-semibold">Categoría</th>
                  <th className="py-3 px-4 font-semibold text-right">Comisión</th>
                  <th className="py-3 px-4 font-semibold">Estado</th>
                  <th className="py-3 px-4 font-semibold text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {restaurants.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-semibold text-slate-900">{r.name}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{r.categoryName}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                      {r.commissionPercent}%
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700">{r.status}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() =>
                          onUpdateRestaurant(r.id, {
                            status:
                              r.status === RestaurantStatus.SUSPENDED
                                ? RestaurantStatus.OPEN
                                : RestaurantStatus.SUSPENDED,
                          })
                        }
                        className="text-xs font-semibold text-orange-600 hover:underline cursor-pointer"
                      >
                        {r.status === RestaurantStatus.SUSPENDED ? 'Reactivar' : 'Suspender'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'MONETIZATION' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Monetization Model Example & Calculator */}
          <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Modelo de Negocio & Desglose de Cargos
            </h2>
            <p className="text-xs text-slate-600">
              Todos los cargos se transparentan al cliente antes de redirigir a Webpay Plus:
            </p>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-xs font-mono tabular-nums">
              <div className="flex justify-between">
                <span>Ejemplo Pedido Productos:</span>
                <span className="font-bold">$20.000</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Comisión Plataforma ({summary?.settings.defaultCommissionPercent || 15}%):</span>
                <span className="font-bold">$3.000</span>
              </div>
              <div className="flex justify-between">
                <span>Costo Despacho Repartidor:</span>
                <span className="font-bold">$2.500</span>
              </div>
              <div className="flex justify-between">
                <span>Tarifa de Servicio Plataforma:</span>
                <span className="font-bold">${(summary?.settings.serviceFeeClp || 500).toLocaleString('es-CL')}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                <span>Total Pagado por Cliente (Webpay):</span>
                <span>$23.000</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => handleSaveCommission(15, 500)}
                className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold cursor-pointer"
              >
                Estándar (15% + $500)
              </button>
              <button
                onClick={() => handleSaveCommission(12, 400)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Promoción Partners (12% + $400)
              </button>
            </div>
          </div>

          {/* Discount Coupons */}
          <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Tag className="w-4 h-4 text-orange-600" />
              <span>Códigos de Descuento Activos</span>
            </h2>
            <form onSubmit={handleCreateCoupon} className="flex gap-2">
              <input
                type="text"
                placeholder="Código (ej: INVIERNO3000)"
                value={newCouponCode}
                onChange={(e) => setNewCouponCode(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono uppercase"
              />
              <input
                type="number"
                value={newCouponValue}
                onChange={(e) => setNewCouponValue(e.target.value)}
                className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold cursor-pointer"
              >
                Crear Cupón
              </button>
            </form>

            <div className="space-y-2">
              {(summary?.coupons || []).map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-mono font-bold text-slate-900">{c.code}</p>
                    <p className="text-slate-500">{c.description}</p>
                  </div>
                  <span className="font-mono font-semibold text-emerald-700">
                    Min. ${c.minOrderAmount.toLocaleString('es-CL')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'TRANSACTIONS' && (
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Registro de Transacciones Webpay Plus Validadas en Backend</span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 bg-slate-50">
                  <th className="py-3 px-4 font-semibold">Orden Compra</th>
                  <th className="py-3 px-4 font-semibold">Token WS</th>
                  <th className="py-3 px-4 font-semibold">Código Autorización</th>
                  <th className="py-3 px-4 font-semibold">Medio</th>
                  <th className="py-3 px-4 font-semibold text-right">Monto CLP</th>
                  <th className="py-3 px-4 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-mono tabular-nums">
                {(summary?.transactions || []).map((t) => (
                  <tr key={t.id}>
                    <td className="py-3 px-4 font-bold text-slate-900">{t.buyOrder}</td>
                    <td className="py-3 px-4 text-slate-500">{t.tokenWs.slice(0, 18)}...</td>
                    <td className="py-3 px-4 text-emerald-700 font-bold">
                      {t.authorizationCode || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {t.paymentTypeCode || 'VD'} ****{t.cardNumberLast4 || '6623'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      ${t.amount.toLocaleString('es-CL')}
                    </td>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-800">{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'API_DOCS' && (
        <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Documentación de Endpoints REST & WebSockets (`/api/*`)
          </h2>
          <p className="text-xs text-slate-600">
            Esquema relacional completo de 22 modelos documentado en <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">prisma/schema.prisma</code>.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
            {[
              { m: 'POST', p: '/api/auth/login', d: 'Autenticación RBAC y sesión segura por rol' },
              { m: 'GET', p: '/api/restaurants', d: 'Catálogo de restaurantes, filtros y horarios' },
              { m: 'GET', p: '/api/products', d: 'Productos con opciones obligatorias y extras' },
              { m: 'POST', p: '/api/cart/validate-coupon', d: 'Validación de cupones en servidor' },
              { m: 'POST', p: '/api/orders', d: 'Crea pedido en PENDING_PAYMENT y calcula comisiones' },
              { m: 'POST', p: '/api/webpay/create', d: 'Genera transacción Webpay Plus y token_ws' },
              { m: 'POST', p: '/api/webpay/commit', d: 'Valida pago en backend, autoriza y notifica al comercio' },
              { m: 'POST', p: '/api/orders/:id/status', d: 'Transición de estados + broadcast WebSocket' },
              { m: 'POST', p: '/api/location', d: 'Telemetría GPS en tiempo real con historial acotado' },
              { m: 'GET', p: '/api/admin/summary', d: 'KPIs financieros, comisiones y auditoría Transbank' },
            ].map((ep, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                <span className="font-bold text-orange-600 shrink-0">{ep.m}</span>
                <div>
                  <p className="font-bold text-slate-900">{ep.p}</p>
                  <p className="font-sans text-slate-500 mt-0.5">{ep.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
