import React, { useState } from 'react';
import { ShieldCheck, Lock, CreditCard, Building2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Order } from '../types/domain.ts';

interface WebpayModalProps {
  order: Order;
  tokenWs: string;
  commerceCode: string;
  onCommitSuccess: (order: Order) => void;
  onCancelOrReject: (order: Order, reason: string) => void;
}

export const WebpayModal: React.FC<WebpayModalProps> = ({
  order,
  tokenWs,
  commerceCode,
  onCommitSuccess,
  onCancelOrReject,
}) => {
  const [paymentType, setPaymentType] = useState<'VD' | 'VN'>('VD');
  const [cardNumber, setCardNumber] = useState('4532 •••• •••• 6623');
  const [installments, setInstallments] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<'FORM' | 'BANK_AUTH'>('FORM');

  const handleCommit = async (simulateAction: 'APPROVED' | 'REJECTED' | 'CANCELLED') => {
    setProcessing(true);
    try {
      const res = await fetch('/api/webpay/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_ws: tokenWs,
          simulateAction,
          paymentTypeCode: paymentType,
          cardNumberLast4: cardNumber.slice(-4) || '6623',
          installments,
        }),
      });
      const data = await res.json();
      if (data.approved) {
        onCommitSuccess(data.order);
      } else {
        onCancelOrReject(
          data.order || order,
          simulateAction === 'CANCELLED'
            ? 'Pago anulado voluntariamente en Webpay.'
            : 'Transacción rechazada por el banco emisor.'
        );
      }
    } catch (e) {
      console.error('Webpay commit error:', e);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Official Webpay Plus Header */}
        <div className="bg-[#0F172A] px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center font-display font-bold text-sm">
              tbk
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight">Webpay Plus · Transbank</p>
              <p className="text-[11px] text-slate-400 font-mono">
                Código Comercio {commerceCode} · Orden #{order.orderNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <Lock className="w-3.5 h-3.5" />
            <span>TLS 1.3 Seguro</span>
          </div>
        </div>

        {/* Order Amount Summary Bar */}
        <div className="bg-slate-50 px-6 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Comercio receptor</p>
            <p className="text-sm font-semibold text-slate-900">{order.restaurantName}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Monto total a pagar (CLP)</p>
            <p className="text-lg font-bold font-mono tabular-nums text-slate-900">
              ${order.total.toLocaleString('es-CL')}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {step === 'FORM' ? (
            <>
              {/* Payment Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Selecciona medio de pago Transbank
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentType('VD')}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      paymentType === 'VD'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Building2 className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="text-xs font-bold">Redcompra Débito</p>
                      <p className="text-[11px] opacity-80">Venta Débito (VD)</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('VN')}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      paymentType === 'VN'
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="text-xs font-bold">Tarjeta de Crédito</p>
                      <p className="text-[11px] opacity-80">Cuotas o Sin Cuotas</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Card Details */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Tarjeta de prueba Transbank Integración
                  </label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                {paymentType === 'VN' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Número de cuotas
                    </label>
                    <select
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                    >
                      <option value={0}>Sin cuotas (Venta Normal)</option>
                      <option value={3}>3 cuotas sin interés</option>
                      <option value={6}>6 cuotas</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Validación estricta en Backend (`/api/webpay/commit`)
                </p>
                <p className="font-mono text-[11px] text-slate-500 truncate">
                  token_ws: {tokenWs}
                </p>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => handleCommit('CANCELLED')}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Anular y volver
                </button>
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => setStep('BANK_AUTH')}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-colors cursor-pointer"
                >
                  Continuar a Autenticación Bancaria →
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-900 text-white p-4 space-y-2">
                <p className="text-xs text-slate-400">Simulador 3D Secure / Banco Emisor Transbank</p>
                <p className="text-sm font-semibold">
                  Confirma el resultado de la transacción para probar la máquina de estados del pedido:
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => handleCommit('APPROVED')}
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 text-left">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold">Aprobar Pago Webpay Plus (responseCode = 0)</p>
                      <p className="text-xs text-emerald-100">
                        Valida monto en backend, pasa a PAID y envía el pedido al restaurante en vivo
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-sm font-bold shrink-0">
                    ${order.total.toLocaleString('es-CL')}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={processing}
                  onClick={() => handleCommit('REJECTED')}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 text-left">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold">Simular Pago Rechazado (PAYMENT_FAILED)</p>
                      <p className="text-[11px] text-red-600">
                        Prueba el manejo de errores cuando el banco rechaza el cargo
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={processing}
                  onClick={() => handleCommit('CANCELLED')}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 text-left">
                    <XCircle className="w-4 h-4 text-slate-500 shrink-0" />
                    <div>
                      <p className="text-xs font-bold">Anular Compra (CANCELLED)</p>
                      <p className="text-[11px] text-slate-500">
                        Cancela la orden antes de autorizar
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
