import React, { useState, useEffect } from 'react';
import {
  Navigation,
  MapPin,
  Phone,
  CheckCircle2,
  Bike,
  Radio,
  DollarSign,
  Package,
  ArrowRight,
  Compass,
} from 'lucide-react';
import { Driver, DriverStatus, Order, OrderStatus, Role } from '../types/domain.ts';
import { LiveTrackingMap } from './LiveTrackingMap.tsx';

interface DriverViewProps {
  driver: Driver;
  orders: Order[];
  onUpdateOrderStatus: (orderId: string, status: OrderStatus, actorRole: Role, note?: string) => Promise<void>;
  onSendGpsCoordinate: (orderId: string | undefined, lat: number, lng: number) => Promise<void>;
  onToggleDriverStatus: (status: DriverStatus) => Promise<void>;
}

const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  [DriverStatus.OFFLINE]: 'Offline',
  [DriverStatus.AVAILABLE]: 'Disponible',
  [DriverStatus.TO_RESTAURANT]: 'En camino al comercio',
  [DriverStatus.AT_RESTAURANT]: 'En comercio',
  [DriverStatus.PICKING_UP]: 'Retirando pedido',
  [DriverStatus.TO_CLIENT]: 'En camino al cliente',
  [DriverStatus.DELIVERED]: 'Entregado',
};

export const DriverView: React.FC<DriverViewProps> = ({
  driver,
  orders,
  onUpdateOrderStatus,
  onSendGpsCoordinate,
  onToggleDriverStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'HISTORY' | 'EARNINGS'>('ACTIVE');
  const [gpsStreaming, setGpsStreaming] = useState(false);
  const [stepProgress, setStepProgress] = useState(0.25);

  // Active order assigned or ready for pickup
  const activeOrder = orders.find(
    (o) =>
      o.status === OrderStatus.READY ||
      o.status === OrderStatus.ASSIGNED_TO_DRIVER ||
      o.status === OrderStatus.DRIVER_PICKED_UP ||
      o.status === OrderStatus.ON_THE_WAY
  );

  const completedOrders = orders.filter(
    (o) => o.status === OrderStatus.DELIVERED || o.status === OrderStatus.COMPLETED
  );

  // Automatic or manual efficient GPS tracking along route
  useEffect(() => {
    if (!gpsStreaming || !activeOrder) return;

    const interval = setInterval(() => {
      setStepProgress((prev) => {
        const next = Math.min(0.95, prev + 0.14);
        const interpLat =
          activeOrder.restaurantLat +
          (activeOrder.deliveryLat - activeOrder.restaurantLat) * next;
        const interpLng =
          activeOrder.restaurantLng +
          (activeOrder.deliveryLng - activeOrder.restaurantLng) * next;
        onSendGpsCoordinate(activeOrder.id, Number(interpLat.toFixed(5)), Number(interpLng.toFixed(5)));
        return next;
      });
    }, 3200);

    return () => clearInterval(interval);
  }, [gpsStreaming, activeOrder, onSendGpsCoordinate]);

  const handleManualStepGps = () => {
    if (!activeOrder) return;
    const next = Math.min(0.96, stepProgress + 0.2);
    setStepProgress(next);
    const interpLat =
      activeOrder.restaurantLat + (activeOrder.deliveryLat - activeOrder.restaurantLat) * next;
    const interpLng =
      activeOrder.restaurantLng + (activeOrder.deliveryLng - activeOrder.restaurantLng) * next;
    onSendGpsCoordinate(activeOrder.id, Number(interpLat.toFixed(5)), Number(interpLng.toFixed(5)));
  };

  const handleBrowserGeolocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onSendGpsCoordinate(activeOrder?.id, pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        // Fallback if permission denied in sandbox iframe
        handleManualStepGps();
      }
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Driver Header & Availability Switch */}
      <div className="rounded-2xl bg-slate-900 text-white p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-orange-600 flex items-center justify-center">
            <Bike className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">{driver.name}</h1>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-mono text-amber-400">★ {driver.rating}</span>
            </div>
            <p className="text-xs text-slate-300">
              {driver.vehicleType} · Patente {driver.vehiclePlate} · Estado:{' '}
              <strong className="text-emerald-400">{DRIVER_STATUS_LABELS[driver.status]}</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              DriverStatus.OFFLINE,
              DriverStatus.AVAILABLE,
              DriverStatus.TO_RESTAURANT,
              DriverStatus.AT_RESTAURANT,
              DriverStatus.PICKING_UP,
              DriverStatus.TO_CLIENT,
            ] as DriverStatus[]
          ).map((st) => (
            <button
              key={st}
              onClick={() => onToggleDriverStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                driver.status === st
                  ? 'bg-orange-600 text-white font-semibold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {DRIVER_STATUS_LABELS[st]}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('ACTIVE')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'ACTIVE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Despacho Activo & GPS ({activeOrder ? 1 : 0})
        </button>
        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'HISTORY' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Historial de Entregas ({completedOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('EARNINGS')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === 'EARNINGS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Mis Ganancias
        </button>
      </div>

      {activeTab === 'ACTIVE' && (
        <>
          {!activeOrder ? (
            <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center space-y-3">
              <Package className="w-10 h-10 text-slate-400 mx-auto" />
              <h2 className="text-lg font-bold text-slate-900">
                Sin pedidos listos para retiro en este instante
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Cuando Cocina marque un pedido como <strong>LISTO</strong>, aparecerá aquí inmediatamente con alerta en tiempo real para que puedas aceptarlo e iniciar el recorrido GPS.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Order Dispatch Card & Controls */}
              <div className="lg:col-span-6 rounded-2xl bg-white border border-slate-200 p-5 space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <p className="text-xs text-slate-500">Orden asignada a repartidor</p>
                    <h2 className="text-xl font-bold font-mono text-slate-900">
                      Pedido #{activeOrder.orderNumber}
                    </h2>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Ganancia del viaje</p>
                    <p className="text-lg font-bold font-mono tabular-nums text-emerald-600">
                      +${activeOrder.driverEarnings.toLocaleString('es-CL')}
                    </p>
                  </div>
                </div>

                {/* Pickup & Dropoff Addresses */}
                <div className="space-y-3.5 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 text-xs font-bold">
                      1
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-500">Retiro en Comercio</p>
                      <p className="font-bold text-slate-900">{activeOrder.restaurantName}</p>
                      <p className="text-xs text-slate-600">{activeOrder.restaurantAddress}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 text-xs font-bold">
                      2
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-500">Entrega al Cliente</p>
                      <p className="font-bold text-slate-900">{activeOrder.clientName}</p>
                      <p className="text-xs text-slate-600">{activeOrder.deliveryAddress}</p>
                      {activeOrder.deliveryInstructions && (
                        <p className="text-xs text-amber-700 mt-1">
                          Nota: {activeOrder.deliveryInstructions}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Primary Step Progression Buttons for Driver */}
                <div className="pt-2 space-y-2.5 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-700">
                    Acciones de Entrega (Sincroniza con Cliente en Vivo):
                  </p>

                  {activeOrder.status === OrderStatus.READY && (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() =>
                          onUpdateOrderStatus(
                            activeOrder.id,
                            OrderStatus.ASSIGNED_TO_DRIVER,
                            Role.DRIVER,
                            `Repartidor ${driver.name} aceptó el despacho`
                          )
                        }
                        className="col-span-2 py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[48px]"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Aceptar Pedido #{activeOrder.orderNumber}</span>
                      </button>
                    </div>
                  )}

                  {activeOrder.status === OrderStatus.ASSIGNED_TO_DRIVER && (
                    <button
                      onClick={() =>
                        onUpdateOrderStatus(
                          activeOrder.id,
                          OrderStatus.DRIVER_PICKED_UP,
                          Role.DRIVER,
                          'Repartidor retiró la bolsa sellada desde el restaurante'
                        )
                      }
                      className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[48px]"
                    >
                      <Package className="w-4 h-4" />
                      <span>Confirmar Retiro en Restaurante (DRIVER_PICKED_UP)</span>
                    </button>
                  )}

                  {activeOrder.status === OrderStatus.DRIVER_PICKED_UP && (
                    <button
                      onClick={() => {
                        setGpsStreaming(true);
                        onUpdateOrderStatus(
                          activeOrder.id,
                          OrderStatus.ON_THE_WAY,
                          Role.DRIVER,
                          'Repartidor en camino al domicilio con transmisión GPS activa'
                        );
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[48px]"
                    >
                      <Navigation className="w-4 h-4" />
                      <span>Iniciar Viaje al Cliente + Activar GPS (ON_THE_WAY)</span>
                    </button>
                  )}

                  {activeOrder.status === OrderStatus.ON_THE_WAY && (
                    <button
                      onClick={() => {
                        setGpsStreaming(false);
                        onUpdateOrderStatus(
                          activeOrder.id,
                          OrderStatus.DELIVERED,
                          Role.DRIVER,
                          'Pedido entregado en manos del cliente'
                        );
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[48px]"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar Pedido Entregado (DELIVERED)</span>
                    </button>
                  )}
                </div>

                {/* Real-time GPS Transmitter Controls */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Radio
                        className={`w-4 h-4 ${
                          gpsStreaming ? 'text-orange-600 animate-pulse' : 'text-slate-400'
                        }`}
                      />
                      <span className="text-xs font-bold text-slate-900">
                        Telemetría GPS en Tiempo Real
                      </span>
                    </div>
                    <span className="font-mono text-xs text-slate-600 tabular-nums">
                      {driver.currentLat.toFixed(4)}, {driver.currentLng.toFixed(4)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setGpsStreaming(!gpsStreaming)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        gpsStreaming
                          ? 'bg-orange-600 text-white'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      {gpsStreaming ? 'Pausar Transmisión Automática' : 'Transmitir Ruta GPS Automática'}
                    </button>

                    <button
                      onClick={handleManualStepGps}
                      className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Avanzar 250m en Ruta</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={handleBrowserGeolocation}
                      className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Compass className="w-3.5 h-3.5 text-orange-600" />
                      <span>Usar GPS Dispositivo</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Navigation Map */}
              <div className="lg:col-span-6 space-y-4">
                <LiveTrackingMap
                  restaurantLat={activeOrder.restaurantLat}
                  restaurantLng={activeOrder.restaurantLng}
                  restaurantName={activeOrder.restaurantName}
                  clientLat={activeOrder.deliveryLat}
                  clientLng={activeOrder.deliveryLng}
                  clientAddress={activeOrder.deliveryAddress}
                  driverLat={driver.currentLat}
                  driverLng={driver.currentLng}
                  driverName={driver.name}
                  heightClass="h-80 sm:h-96"
                />

                <div className="rounded-2xl bg-white border border-slate-200 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-orange-600" />
                    <div>
                      <p className="text-xs text-slate-500">Distancia restante estimada</p>
                      <p className="text-sm font-bold font-mono tabular-nums text-slate-900">
                        {activeOrder.distanceKm} km · Llegada en ~{activeOrder.estimatedMinutes} min
                      </p>
                    </div>
                  </div>
                  <a
                    href={`tel:${activeOrder.clientPhone}`}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Llamar Cliente</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'HISTORY' && (
        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">Historial de Entregas Completadas</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {completedOrders.map((o) => (
              <div key={o.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Pedido #{o.orderNumber} · {o.restaurantName}
                  </p>
                  <p className="text-xs text-slate-500">{o.deliveryAddress}</p>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <p className="text-sm font-bold text-emerald-600">
                    +${o.driverEarnings.toLocaleString('es-CL')}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(o.updatedAt).toLocaleTimeString('es-CL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'EARNINGS' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <p className="text-xs text-slate-500">Ganancias Acumuladas</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              ${driver.totalEarnings.toLocaleString('es-CL')}
            </p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <p className="text-xs text-slate-500">Viajes Completados</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {driver.completedTrips}
            </p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-5">
            <p className="text-xs text-slate-500">Calificación Promedio</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600 mt-1">
              ★ {driver.rating}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
