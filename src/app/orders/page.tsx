"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Package, Mail, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

interface OrderItem {
  description: string;
  quantity: number;
  amount: number;
}

interface Order {
  id: string;
  created: number;
  amount: number;
  currency: string;
  status: string;
  customerEmail: string;
  customerName: string;
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  } | null;
  items: OrderItem[];
  paymentStatus: string;
  receiptUrl?: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [emailResult, setEmailResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/orders/list");
      if (!r.ok) throw new Error("Failed to fetch orders");
      const data = await r.json();
      setOrders(data.orders || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const resendConfirmation = async (orderId: string, email: string) => {
    setResendingEmail(orderId);
    setEmailResult(null);
    try {
      const r = await fetch("/api/orders/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, email }),
      });
      const data = await r.json();
      if (r.ok && data.ok) {
        setEmailResult({ id: orderId, ok: true, msg: "Email sent!" });
      } else {
        setEmailResult({ id: orderId, ok: false, msg: data.error || "Failed to send" });
      }
    } catch {
      setEmailResult({ id: orderId, ok: false, msg: "Network error" });
    } finally {
      setResendingEmail(null);
    }
  };

  const formatDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleString();
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "complete":
      case "paid":
        return "bg-green-900/50 text-green-300 border-green-700/50";
      case "open":
      case "pending":
        return "bg-yellow-900/50 text-yellow-300 border-yellow-700/50";
      case "expired":
      case "canceled":
        return "bg-red-900/50 text-red-300 border-red-700/50";
      default:
        return "bg-neutral-800 text-neutral-300 border-neutral-700";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Orders</h1>
          <p className="text-neutral-400 text-sm mt-1">
            View and manage orders from Stripe
          </p>
        </div>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors text-sm text-neutral-200 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="text-center py-12 text-neutral-400">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-neutral-400">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No orders yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden"
            >
              {/* Order Header */}
              <div
                className="p-4 cursor-pointer hover:bg-neutral-800/50 transition-colors"
                onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {expandedOrder === order.id ? (
                        <ChevronUp className="h-4 w-4 text-neutral-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-neutral-400" />
                      )}
                      <span className="font-mono text-sm text-neutral-400">
                        {order.id.slice(0, 20)}...
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-xs border ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-neutral-400 text-sm">
                      {formatDate(order.created)}
                    </span>
                    <span className="font-semibold text-white">
                      {formatCurrency(order.amount, order.currency)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-4 text-sm">
                  <span className="text-neutral-300">{order.customerName || "—"}</span>
                  <span className="text-neutral-500">{order.customerEmail || "—"}</span>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedOrder === order.id && (
                <div className="border-t border-neutral-800 p-4 bg-neutral-950/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Items */}
                    <div>
                      <h4 className="text-sm font-medium text-neutral-400 mb-2">Items</h4>
                      <div className="space-y-2">
                        {order.items.map((item, i) => (
                          <div
                            key={i}
                            className="flex justify-between text-sm bg-neutral-900 p-2 rounded"
                          >
                            <span className="text-neutral-300">
                              {item.quantity}× {item.description}
                            </span>
                            <span className="text-neutral-400">
                              {formatCurrency(item.amount, order.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Shipping Address */}
                    <div>
                      <h4 className="text-sm font-medium text-neutral-400 mb-2">
                        Shipping Address
                      </h4>
                      {order.shippingAddress ? (
                        <div className="text-sm text-neutral-300 bg-neutral-900 p-3 rounded">
                          <p>{order.shippingAddress.line1}</p>
                          {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                          <p>
                            {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                            {order.shippingAddress.postal_code}
                          </p>
                          <p>{order.shippingAddress.country}</p>
                        </div>
                      ) : (
                        <p className="text-neutral-500 text-sm">No shipping address</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-4 border-t border-neutral-800 flex items-center gap-3">
                    {order.customerEmail && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          resendConfirmation(order.id, order.customerEmail);
                        }}
                        disabled={resendingEmail === order.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 rounded-lg text-sm text-white transition-colors"
                      >
                        <Mail className="h-4 w-4" />
                        {resendingEmail === order.id ? "Sending..." : "Resend Confirmation"}
                      </button>
                    )}
                    {order.receiptUrl && (
                      <a
                        href={order.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-neutral-200 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-4 w-4" />
                        View Receipt
                      </a>
                    )}
                    {emailResult && emailResult.id === order.id && (
                      <span
                        className={`text-sm ${
                          emailResult.ok ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {emailResult.msg}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


