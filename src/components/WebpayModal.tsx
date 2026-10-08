import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Link2,
} from 'lucide-react';
import { Order } from '../types/domain.ts';

interface WebpayModalProps {
  order: Order;
  tokenWs: string;
  url: string;
  paymentLink: string;
  commerceCode: string;
  realTransbankConnected?: boolean;
  onCommitSuccess: (order: Order) => void;
  onCancelOrReject: (order: Order, reason: string) => void;
}

export const WebpayModal: React.FC<WebpayModalProps> = ({
  order,
  tokenWs,
  url,
  paymentLink,
  commerceCode,
  realTransbankConnected,
  onCommitSuccess,
  onCancelOrReject,
}) => {
  const [copied, setCopied] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(paymentLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleVerifyBackendCallback = async (simulateAction: 'APPROVED' | 'CANCELLED') => {
    setProcessing(true);
    try {
      const res = await fetch('/api/webpay/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_ws: tokenWs,
          simulateAction,
        }),
      });
      const data = await res.json();
      if (data.approved) {
        onCommitSuccess(data.order);
      } else {
        onCancelOrReject(
          data.order || order,
          'El enlace de pago de Transbank fue anulado o expiró.'
        );
      }
    } catch (e) {
      console.error('Webpay commit error:', e);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-[#0F172A] px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center font-display font-bold text-sm">
              tbk
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight">
                Enlace de Pago Oficial · API Transbank Webpay Plus
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                Comercio #{commerceCode} · Orden #{order.orderNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <Lock className="w-3.5 h-3.5" />
            <span>PCI-DSS Externo</span>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Comercio receptor</p>
            <p className="text-sm font-bold text-slate-900">{order.restaurantName}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Total a pagar</p>
            <p className="text-xl font-bold font-mono tabular-nums text-slate-900">
              ${order.total.toLocaleString('es-CL')}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Security Notice: Zero Card Data on Platform */}
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Pago 100% externo en portal seguro de Transbank</p>
              <p className="text-emerald-800 mt-0.5">
                Por tu seguridad, esta plataforma <strong>jamás solicita ni almacena números de tarjetas</strong>. La transacción se realiza directamente mediante un enlace único generado por la API REST v1.2 de Transbank (`webpay3gint.transbank.cl`).
              </p>
            </div>
          </div>

          {/* Generated Payment Link Box */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-orange-600" />
                Enlace de Pago Transbank Generado
              </span>
              {realTransbankConnected && (
                <span className="text-[11px] font-mono text-emerald-600">
                  ● Token Oficial Activo
                </span>
              )}
            </label>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={paymentLink}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-mono text-slate-700 select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Link</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] font-mono text-slate-400 truncate">
              token_ws: {tokenWs}
            </p>
          </div>

          {/* Official POST Form to Transbank Server */}
          <form method="POST" action={url} target="_blank" className="pt-1">
            <input type="hidden" name="token_ws" value={tokenWs} />
            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <span>Ir a Pagar en Portal Oficial Transbank Webpay</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          </form>

          {/* Webhook / Return Callback Confirmation */}
          <div className="pt-4 border-t border-slate-200 space-y-2.5">
            <p className="text-xs font-semibold text-slate-600">
              Una vez completado el pago en el enlace de Transbank (o para confirmar la recepción del webhook en modo desarrollo):
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={processing}
                onClick={() => handleVerifyBackendCallback('APPROVED')}
                className="py-2.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Confirmar Pago Recibido</span>
              </button>

              <button
                type="button"
                disabled={processing}
                onClick={() => handleVerifyBackendCallback('CANCELLED')}
                className="py-2.5 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Cancelar Orden</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
