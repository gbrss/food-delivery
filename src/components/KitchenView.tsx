import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Clock, AlertCircle, CheckCircle2, Flame, PackageCheck, MapPin, User } from 'lucide-react';
import { Order, OrderStatus, Role } from '../types/domain.ts';

interface KitchenViewProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, newStatus: OrderStatus, actorRole: Role, note?: string) => Promise<void>;
}

// Synthesize a clean kitchen bell chime using Web Audio API (no external MP3 dependencies)
export function playKitchenBellSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.frequency.setValueAtTime(1174.66, now + 0.14); // D6
    osc2.frequency.setValueAtTime(1760, now);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.75);
    osc2.stop(now + 0.75);
  } catch {
    // Ignore if browser blocked autoplay before interaction
  }
}

export const KitchenView: React.FC<KitchenViewProps> = ({ orders, onUpdateStatus }) => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Group orders into the 4 mandatory Kitchen columns: NUEVOS, PREPARANDO, LISTOS, ENTREGADOS
  const colNuevos = orders.filter(
    (o) => o.status === OrderStatus.RECEIVED_BY_RESTAURANT || o.status === OrderStatus.ACCEPTED || o.status === OrderStatus.PAID
  );
  const colPreparando = orders.filter((o) => o.status === OrderStatus.PREPARING);
  const colListos = orders.filter(
    (o) =>
      o.status === OrderStatus.READY ||
      o.status === OrderStatus.ASSIGNED_TO_DRIVER ||
      o.status === OrderStatus.DRIVER_PICKED_UP
  );
  const colEntregados = orders.filter(
    (o) =>
      o.status === OrderStatus.ON_THE_WAY ||
      o.status === OrderStatus.DELIVERED ||
      o.status === OrderStatus.COMPLETED
  );

  const getElapsedMinutes = (iso: string) => {
    const diff = Math.max(1, Math.round((nowMs - new Date(iso).getTime()) / 60000));
    return diff;
  };

  const renderTicket = (order: Order, columnType: 'NUEVOS' | 'PREPARANDO' | 'LISTOS' | 'ENTREGADOS') => {
    const elapsedMin = getElapsedMinutes(order.createdAt);
    const isDelayed = elapsedMin >= 15 && (columnType === 'NUEVOS' || columnType === 'PREPARANDO');

    return (
      <div
        key={order.id}
        className={`rounded-2xl border p-4 transition-all ${
          isDelayed
            ? 'bg-red-950/40 border-red-500/70'
            : columnType === 'NUEVOS'
            ? 'bg-slate-900 border-amber-500/60'
            : 'bg-slate-900 border-slate-800'
        }`}
      >
        {/* Ticket Header */}
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold font-mono tabular-nums text-white">
                #{order.orderNumber}
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-medium text-orange-400">
                {order.deliveryMethod === 'PICKUP' ? 'Retiro en Local' : 'Delivery'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              {order.clientName}
            </p>
          </div>

          <div className="text-right">
            <div
              className={`inline-flex items-center gap-1 text-xs font-mono tabular-nums font-semibold ${
                isDelayed ? 'text-red-400' : 'text-amber-400'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Hace {elapsedMin} min</span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">
              Meta: {order.estimatedMinutes} min
            </p>
          </div>
        </div>

        {/* Delay Visual Alert */}
        {isDelayed && (
          <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-red-300 bg-red-950/80 px-3 py-1.5 rounded-lg border border-red-800">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>Prioridad Alta: Tiempo de espera elevado</span>
          </div>
        )}

        {/* Products, Quantities, Modifiers & Extras */}
        <div className="py-3 space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-bold text-white">
                  <span className="font-mono text-orange-400 mr-1.5">{item.quantity}x</span>
                  {item.productName}
                </p>
              </div>

              {item.selectedOptions.length > 0 && (
                <div className="pl-5 space-y-0.5">
                  {item.selectedOptions.map((opt, i) => (
                    <p key={i} className="text-xs text-slate-300">
                      • {opt.optionName}: <span className="text-white font-medium">{opt.choiceLabel}</span>
                    </p>
                  ))}
                </div>
              )}

              {item.selectedExtras.length > 0 && (
                <div className="pl-5 space-y-0.5">
                  {item.selectedExtras.map((ext, i) => (
                    <p key={i} className="text-xs text-emerald-400 font-medium">
                      + Extra: {ext.name}
                    </p>
                  ))}
                </div>
              )}

              {item.notes && (
                <p className="pl-5 text-xs text-amber-300 italic">
                  Nota ítem: &ldquo;{item.notes}&rdquo;
                </p>
              )}
            </div>
          ))}
        </div>

        {/* General Order Observations & Address */}
        {order.notes && (
          <div className="mb-3 rounded-xl bg-amber-950/50 border border-amber-700/50 p-2.5 text-xs text-amber-200">
            <span className="font-bold">Observación Cocina: </span>
            {order.notes}
          </div>
        )}

        <div className="text-[11px] text-slate-400 flex items-start gap-1.5 pb-3 border-b border-slate-800">
          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
          <span className="truncate">{order.deliveryAddress}</span>
        </div>

        {/* KDS Action Button: NUEVO -> PREPARANDO -> LISTO */}
        <div className="pt-3">
          {columnType === 'NUEVOS' && (
            <button
              onClick={() => {
                if (soundEnabled) playKitchenBellSound();
                onUpdateStatus(
                  order.id,
                  OrderStatus.PREPARING,
                  Role.KITCHEN,
                  'Cocina inició preparación de comanda'
                );
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Flame className="w-4 h-4" />
              <span>INICIAR PREPARACIÓN (NUEVO → PREPARANDO)</span>
            </button>
          )}

          {columnType === 'PREPARANDO' && (
            <button
              onClick={() => {
                if (soundEnabled) playKitchenBellSound();
                onUpdateStatus(
                  order.id,
                  OrderStatus.READY,
                  Role.KITCHEN,
                  'Comanda lista y empaquetada para retiro de repartidor'
                );
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <PackageCheck className="w-4 h-4" />
              <span>MARCAR PEDIDO LISTO (PREPARANDO → LISTO)</span>
            </button>
          )}

          {columnType === 'LISTOS' && (
            <div className="flex items-center justify-between text-xs text-emerald-400 font-medium px-1">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Esperando retiro de repartidor
              </span>
              <span className="font-mono text-slate-400">{order.driverName || 'Por asignar'}</span>
            </div>
          )}

          {columnType === 'ENTREGADOS' && (
            <div className="text-xs text-slate-400 font-mono flex items-center justify-between">
              <span>Despachado / Finalizado</span>
              <span className="text-emerald-400">{order.status}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-white p-4 sm:p-6">
      {/* KDS Top Header */}
      <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Sistema de Comandas para Cocina (KDS)
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Sincronización en tiempo real mediante WebSockets · Alertas acústicas y semáforo de demora
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) playKitchenBellSound();
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              soundEnabled
                ? 'border-emerald-500/50 bg-emerald-950/50 text-emerald-300'
                : 'border-slate-700 bg-slate-900 text-slate-400'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{soundEnabled ? 'Sonido Alerta Activo' : 'Sonido Silenciado'}</span>
          </button>

          <button
            onClick={() => playKitchenBellSound()}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
          >
            Probar Campana
          </button>
        </div>
      </div>

      {/* 4 KDS Columns */}
      <div className="max-w-[1440px] mx-auto mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Column 1: NUEVOS */}
        <div className="flex flex-col rounded-2xl bg-slate-900/50 border border-slate-800/90 p-4">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <h2 className="text-sm font-bold tracking-wide text-white">NUEVOS</h2>
            </div>
            <span className="font-mono text-xs font-bold text-amber-400 tabular-nums">
              {colNuevos.length}
            </span>
          </div>
          <div className="space-y-3.5 flex-1">
            {colNuevos.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">
                Sin comandas nuevas pendientes
              </p>
            ) : (
              colNuevos.map((o) => renderTicket(o, 'NUEVOS'))
            )}
          </div>
        </div>

        {/* Column 2: PREPARANDO */}
        <div className="flex flex-col rounded-2xl bg-slate-900/50 border border-slate-800/90 p-4">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <h2 className="text-sm font-bold tracking-wide text-white">PREPARANDO</h2>
            </div>
            <span className="font-mono text-xs font-bold text-orange-400 tabular-nums">
              {colPreparando.length}
            </span>
          </div>
          <div className="space-y-3.5 flex-1">
            {colPreparando.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">
                Ningún pedido en preparación
              </p>
            ) : (
              colPreparando.map((o) => renderTicket(o, 'PREPARANDO'))
            )}
          </div>
        </div>

        {/* Column 3: LISTOS */}
        <div className="flex flex-col rounded-2xl bg-slate-900/50 border border-slate-800/90 p-4">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <h2 className="text-sm font-bold tracking-wide text-white">LISTOS</h2>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-400 tabular-nums">
              {colListos.length}
            </span>
          </div>
          <div className="space-y-3.5 flex-1">
            {colListos.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">
                Sin pedidos esperando retiro
              </p>
            ) : (
              colListos.map((o) => renderTicket(o, 'LISTOS'))
            )}
          </div>
        </div>

        {/* Column 4: ENTREGADOS */}
        <div className="flex flex-col rounded-2xl bg-slate-900/50 border border-slate-800/90 p-4">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
              <h2 className="text-sm font-bold tracking-wide text-slate-300">ENTREGADOS</h2>
            </div>
            <span className="font-mono text-xs font-bold text-slate-400 tabular-nums">
              {colEntregados.length}
            </span>
          </div>
          <div className="space-y-3.5 flex-1">
            {colEntregados.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">
                Sin entregas finalizadas hoy
              </p>
            ) : (
              colEntregados.slice(0, 5).map((o) => renderTicket(o, 'ENTREGADOS'))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
