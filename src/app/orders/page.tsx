"use client";

import { useState, useEffect, useMemo } from "react";
import { RefreshCw, Package, Mail, ExternalLink, ChevronDown, ChevronUp, Truck, FileText, Search, Filter } from "lucide-react";

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
  shipment?: {
    status: string;
    shippedAt?: number;
    carrier?: string;
    service?: string;
    labelUrl?: string;
    trackingNumber?: string;
    trackingUrl?: string;
  } | null;
}

type FilterType = "all" | "complete" | "shipped" | "expired";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [emailResult, setEmailResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const [shippingOrderId, setShippingOrderId] = useState<string | null>(null);
  const [shipResult, setShipResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  const createLabel = async (orderId: string) => {
    setShippingOrderId(orderId);
    setShipResult(null);
    try {
      const r = await fetch("/api/orders/ship-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await r.json();
      if (r.ok && data.ok) {
        setShipResult({ id: orderId, ok: true, msg: "Label created" });
        await fetchOrders();
      } else {
        setShipResult({ id: orderId, ok: false, msg: data.error || "Failed to create label" });
      }
    } catch {
      setShipResult({ id: orderId, ok: false, msg: "Network error" });
    } finally {
      setShippingOrderId(null);
    }
  };

  const formatDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleString();
  };
  const formatDateMs = (ms?: number) => {
    if (!ms || !Number.isFinite(ms)) return "—";
    return new Date(ms).toLocaleString();
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

  // Filter and search orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Apply status filter
      if (filter === "complete" && order.status !== "complete") return false;
      if (filter === "shipped" && order.shipment?.status !== "label_created") return false;
      if (filter === "expired" && order.status !== "expired") return false;

      // Apply search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = order.id.toLowerCase().includes(q);
        const matchesEmail = order.customerEmail?.toLowerCase().includes(q);
        const matchesName = order.customerName?.toLowerCase().includes(q);
        if (!matchesId && !matchesEmail && !matchesName) return false;
      }

      return true;
    });
  }, [orders, filter, searchQuery]);

  const filterButtons: { label: string; value: FilterType }[] = [
    { label: "All", value: "all" },
    { label: "Completed", value: "complete" },
    { label: "Shipped", value: "shipped" },
    { label: "Expired", value: "expired" },
  ];

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

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search by order ID, email, or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 text-sm"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
          {filterButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setFilter(btn.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === btn.value
                  ? "bg-neutral-700 text-white"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
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
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12 text-neutral-400">
          <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No orders match your filter</p>
          <button
            onClick={() => { setFilter("all"); setSearchQuery(""); }}
            className="mt-2 text-blue-400 hover:text-blue-300 text-sm"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
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
                    {order.shipment?.status === "label_created" ? (
                      <span className="px-2 py-0.5 rounded text-xs border bg-blue-900/30 text-blue-300 border-blue-700/30">
                        Shipped
                      </span>
                    ) : null}
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

                  {/* Shipping */}
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-neutral-400 mb-2">Shipping</h4>
                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-sm">
                      {order.shipment?.status === "label_created" ? (
                        <div className="space-y-1">
                          <div className="text-neutral-200">
                            <span className="text-neutral-400">Status:</span> Shipped (label created)
                          </div>
                          <div className="text-neutral-300">
                            <span className="text-neutral-400">Created:</span> {formatDateMs(order.shipment.shippedAt)}
                          </div>
                          {order.shipment.carrier || order.shipment.service ? (
                            <div className="text-neutral-300">
                              <span className="text-neutral-400">Service:</span>{" "}
                              {[order.shipment.carrier, order.shipment.service].filter(Boolean).join(" • ")}
                            </div>
                          ) : null}
                          {order.shipment.trackingNumber ? (
                            <div className="text-neutral-300">
                              <span className="text-neutral-400">Tracking:</span>{" "}
                              {order.shipment.trackingUrl ? (
                                <a
                                  href={order.shipment.trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {order.shipment.trackingNumber}
                                </a>
                              ) : (
                                order.shipment.trackingNumber
                              )}
                            </div>
                          ) : null}
                          {order.shipment.labelUrl ? (
                            <div>
                              <a
                                href={order.shipment.labelUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-neutral-200 transition-colors mt-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <FileText className="h-4 w-4" />
                                Download label (PDF)
                              </a>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-neutral-400">No label yet</div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              createLabel(order.id);
                            }}
                            disabled={shippingOrderId === order.id || !order.shippingAddress}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-green-900/40 disabled:text-neutral-500 disabled:cursor-not-allowed rounded-lg text-sm text-white transition-colors"
                            title={!order.shippingAddress ? "Order has no shipping address" : "Buy USPS label (cheapest rate) via Shippo"}
                          >
                            <Truck className="h-4 w-4" />
                            {shippingOrderId === order.id ? "Creating…" : "Create USPS label"}
                          </button>
                        </div>
                      )}
                      {shipResult && shipResult.id === order.id ? (
                        <div className={`mt-2 text-sm ${shipResult.ok ? "text-green-400" : "text-red-400"}`}>
                          {shipResult.msg}
                        </div>
                      ) : null}
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


