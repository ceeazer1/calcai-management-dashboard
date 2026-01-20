"use client";

import { useState, useEffect, useMemo } from "react";
import { RefreshCw, Package, Mail, ExternalLink, ChevronDown, ChevronUp, Truck, FileText, Search, Filter, Plus, X, Trash2, Download } from "lucide-react";

interface OrderItem {
  description: string;
  quantity: number;
  amount: number;
}

interface Order {
  id: string;
  type?: "custom" | "square";
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
  paymentId?: string; // Square payment ID for refunds
  items: OrderItem[];
  paymentStatus: string;
  receiptUrl?: string;
  notes?: string;
  customerPhone?: string;
  shippingMethod?: string;
  weight_oz?: number;
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

type FilterType = "all" | "complete" | "shipped" | "expired" | "custom" | "square";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [emailResult, setEmailResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const [resendingShipped, setResendingShipped] = useState<string | null>(null);
  const [shippedEmailResult, setShippedEmailResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const [shippingOrderId, setShippingOrderId] = useState<string | null>(null);
  const [shipResult, setShipResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  const [voidingLabel, setVoidingLabel] = useState<string | null>(null);
  const [refundingOrder, setRefundingOrder] = useState<string | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMonthlyReportModal, setShowMonthlyReportModal] = useState(false);
  const [reportDate, setReportDate] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [isReportView, setIsReportView] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customOrderLoading, setCustomOrderLoading] = useState(false);
  const [customForm, setCustomForm] = useState({
    customerName: "",
    customerEmail: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "US",
    itemDescription: "CalcAI - TI-84 Plus with ChatGPT",
    itemQuantity: 1,
    itemPrice: 89.99,
    notes: "",
    shippingMethod: "usps_priority",
    weight_oz: 32,
  });
  const [deletingOrder, setDeletingOrder] = useState<string | null>(null);
  const [trackingStatuses, setTrackingStatuses] = useState<Record<string, { status: string; loading: boolean }>>({});

  const fetchTrackingStatus = async (orderId: string, carrier: string, trackingNumber: string) => {
    if (!carrier || !trackingNumber) return;
    setTrackingStatuses(prev => ({ ...prev, [orderId]: { ...prev[orderId], loading: true } }));
    try {
      const r = await fetch(`/api/orders/tracking/status?carrier=${encodeURIComponent(carrier)}&trackingNumber=${encodeURIComponent(trackingNumber)}`);
      const data = await r.json();
      if (data.ok) {
        setTrackingStatuses(prev => ({ ...prev, [orderId]: { status: data.status, loading: false } }));
      }
    } catch (e) {
      console.error("Tracking fetch failed", e);
    } finally {
      setTrackingStatuses(prev => ({ ...prev, [orderId]: { ...prev[orderId], loading: false } }));
    }
  };

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

  // Auto-fetch tracking for recently shipped orders that aren't marked as delivered yet
  useEffect(() => {
    const shippedOrders = orders.filter(o =>
      o.shipment?.status === "label_created" &&
      o.shipment?.trackingNumber &&
      o.shipment?.carrier &&
      !trackingStatuses[o.id]
    ).slice(0, 10); // Batch first 10 to avoid rate limits

    shippedOrders.forEach(o => {
      if (o.shipment) {
        fetchTrackingStatus(o.id, o.shipment.carrier || "USPS", o.shipment.trackingNumber || "");
      }
    });
  }, [orders]);

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

  const resendShippedEmail = async (orderId: string, email: string) => {
    setResendingShipped(orderId);
    setShippedEmailResult(null);
    try {
      const r = await fetch("/api/orders/resend-shipped", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, email }),
      });
      const data = await r.json();
      if (r.ok && data.ok) {
        setShippedEmailResult({ id: orderId, ok: true, msg: "Shipped email sent!" });
      } else {
        setShippedEmailResult({ id: orderId, ok: false, msg: data.error || "Failed to send" });
      }
    } catch {
      setShippedEmailResult({ id: orderId, ok: false, msg: "Network error" });
    } finally {
      setResendingShipped(null);
    }
  };


  const refundSquareOrder = async (order: Order) => {
    if (!order.paymentId) {
      alert("Cannot refund: No Payment ID associated with this order.");
      return;
    }

    if (!confirm(`Are you sure you want to refund ${new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency }).format(order.amount / 100)} to this customer? This cannot be undone.`)) {
      return;
    }

    setRefundingOrder(order.id);
    try {
      const r = await fetch("/api/orders/square-refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          paymentId: order.paymentId
        }),
      });

      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Refund failed");

      alert("Refund processed successfully!");
      fetchOrders(); // Refresh status
    } catch (e: any) {
      alert(`Error processing refund: ${e.message}`);
    } finally {
      setRefundingOrder(null);
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

  const voidLabel = async (orderId: string) => {
    if (!confirm("Are you sure you want to void this label? This will request a refund from Shippo and remove the tracking information.")) return;
    setVoidingLabel(orderId);
    setShipResult(null);
    try {
      const r = await fetch("/api/orders/ship-refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await r.json();
      if (r.ok && data.ok) {
        setShipResult({ id: orderId, ok: true, msg: "Label voided / Refund pending" });
        await fetchOrders();
      } else {
        setShipResult({ id: orderId, ok: false, msg: data.error || "Failed to void label" });
      }
    } catch {
      setShipResult({ id: orderId, ok: false, msg: "Network error" });
    } finally {
      setVoidingLabel(null);
    }
  };

  const createCustomOrder = async () => {
    setCustomOrderLoading(true);
    try {
      const r = await fetch("/api/orders/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customForm.customerName,
          customerEmail: customForm.customerEmail,
          address: customForm.line1 ? {
            line1: customForm.line1,
            line2: customForm.line2,
            city: customForm.city,
            state: customForm.state,
            postal_code: customForm.postal_code,
            country: customForm.country,
          } : null,
          items: [{
            description: customForm.itemDescription,
            quantity: customForm.itemQuantity,
            price: customForm.itemPrice,
          }],
          notes: customForm.notes,
          shippingMethod: customForm.shippingMethod,
          weight_oz: customForm.weight_oz,
        }),
      });
      const data = await r.json();
      if (r.ok && data.ok) {
        setShowCustomModal(false);
        setCustomForm({
          customerName: "",
          customerEmail: "",
          line1: "",
          line2: "",
          city: "",
          state: "",
          postal_code: "",
          country: "US",
          itemDescription: "CalcAI - TI-84 Plus with ChatGPT",
          itemQuantity: 1,
          itemPrice: 89.99,
          notes: "",
          shippingMethod: "usps_priority",
          weight_oz: 32,
        });
        await fetchOrders();
      } else {
        alert(data.error || "Failed to create order");
      }
    } catch {
      alert("Network error");
    } finally {
      setCustomOrderLoading(false);
    }
  };

  const deleteGeneralOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to delete this order? This cannot be undone.")) return;
    setDeletingOrder(orderId);
    try {
      const r = await fetch("/api/orders/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (r.ok) {
        await fetchOrders();
      } else {
        const data = await r.json();
        alert(data.error || "Failed to delete order");
      }
    } catch {
      alert("Failed to delete order");
    } finally {
      setDeletingOrder(null);
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

  const getTrackingColor = (status: string) => {
    switch (status) {
      case "DELIVERED":
        return "bg-green-900/40 text-green-300 border-green-700/40";
      case "TRANSIT":
        return "bg-blue-900/40 text-blue-300 border-blue-700/40";
      case "PRE_TRANSIT":
        return "bg-neutral-800 text-neutral-400 border-neutral-700";
      case "FAILURE":
      case "RETURNED":
        return "bg-red-900/40 text-red-300 border-red-700/40";
      default:
        return "bg-neutral-800 text-neutral-400 border-neutral-700";
    }
  };

  const formatTracking = (s: string) => {
    if (s === 'TRANSIT') return 'In Transit';
    if (s === 'PRE_TRANSIT') return 'Pre-Transit';
    return s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ');
  };

  // Filter and search orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Apply status filter
      if (filter === "complete" && order.status !== "complete") return false;
      if (filter === "shipped" && order.shipment?.status !== "label_created") return false;
      if (filter === "expired" && order.status !== "expired") return false;
      if (filter === "custom" && order.type !== "custom") return false;

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
    { label: "Custom", value: "custom" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Orders</h1>
          <p className="text-neutral-400 text-sm mt-1">
            View and manage all customer orders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMonthlyReportModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-neutral-200 transition-colors"
          >
            <Download className="h-4 w-4" />
            Monthly Report
          </button>
          <button
            onClick={() => setShowCustomModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm text-white transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Custom Order
          </button>
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors text-sm text-neutral-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
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
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filter === btn.value
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
                    {order.type === "custom" && (
                      <span className="px-2 py-0.5 rounded text-xs border bg-orange-900/30 text-orange-300 border-orange-700/30">
                        Custom
                      </span>
                    )}
                    {order.shipment?.status === "label_created" ? (
                      <span className="px-2 py-0.5 rounded text-xs border bg-blue-900/30 text-blue-300 border-blue-700/30">
                        Shipped
                      </span>
                    ) : null}
                    {trackingStatuses[order.id]?.status && (
                      <span className={`px-2 py-0.5 rounded text-xs border ${getTrackingColor(trackingStatuses[order.id].status)}`}>
                        {formatTracking(trackingStatuses[order.id].status)}
                      </span>
                    )}
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
                <div className="mt-2 flex items-center gap-4 text-sm justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-neutral-300">{order.customerName || "—"}</span>
                    <span className="text-neutral-500">{order.customerEmail || "—"}</span>
                    {order.customerPhone && <span className="text-neutral-500">{order.customerPhone}</span>}
                  </div>
                  {order.shipment?.trackingNumber && (
                    <div className="text-[10px] font-mono text-neutral-600 flex items-center gap-2">
                      {order.shipment.trackingNumber}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (order.shipment) fetchTrackingStatus(order.id, order.shipment.carrier || "USPS", order.shipment.trackingNumber || "");
                        }}
                        className="hover:text-neutral-400 transition-colors"
                        title="Refresh Tracking"
                      >
                        <RefreshCw className={`h-3 w-3 ${trackingStatuses[order.id]?.loading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  )}
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
                      {order.shippingMethod && (
                        <div className="mt-3 text-xs text-neutral-400">
                          <span className="font-medium">Customer Selected:</span> {order.shippingMethod}
                        </div>
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
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  voidLabel(order.id);
                                }}
                                disabled={voidingLabel === order.id}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border border-red-900/50 hover:bg-red-900/20 rounded-lg text-sm text-red-400 transition-colors mt-2 ml-2"
                                title="Void label and request refund from Shippo"
                              >
                                {voidingLabel === order.id ? "Voiding..." : "Void Label"}
                              </button>
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
                  <div className="mt-4 pt-4 border-t border-neutral-800 flex flex-wrap items-center gap-3">
                    {
                      order.customerEmail && (
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
                      )
                    }
                    {
                      order.customerEmail && order.shipment?.status === "label_created" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            resendShippedEmail(order.id, order.customerEmail);
                          }}
                          disabled={resendingShipped === order.id}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 rounded-lg text-sm text-white transition-colors"
                        >
                          <Truck className="h-4 w-4" />
                          {resendingShipped === order.id ? "Sending..." : "Resend Shipped Email"}
                        </button>
                      )
                    }
                    {
                      order.receiptUrl && (
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
                      )
                    }
                    {emailResult && emailResult.id === order.id && (
                      <span className={`text-sm ${emailResult.ok ? "text-green-400" : "text-red-400"}`}>
                        {emailResult.msg}
                      </span>
                    )}
                    {shippedEmailResult && shippedEmailResult.id === order.id && (
                      <span className={`text-sm ${shippedEmailResult.ok ? "text-green-400" : "text-red-400"}`}>
                        {shippedEmailResult.msg}
                      </span>
                    )}
                    {shippedEmailResult && shippedEmailResult.id === order.id && (
                      <span className={`text-sm ${shippedEmailResult.ok ? "text-green-400" : "text-red-400"}`}>
                        {shippedEmailResult.msg}
                      </span>
                    )}

                    {/* Square Refund Button */}
                    {order.type === "square" && (order.paymentStatus === "paid" || order.paymentStatus === "COMPLETED") && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          refundSquareOrder(order);
                        }}
                        disabled={refundingOrder === order.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 border border-red-800 disabled:opacity-50 rounded-lg text-sm text-red-200 transition-colors"
                      >
                        <RefreshCw className={`h-4 w-4 ${refundingOrder === order.id ? 'animate-spin' : ''}`} />
                        {refundingOrder === order.id ? "Refunding..." : "Refund"}
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteGeneralOrder(order.id);
                      }}
                      disabled={deletingOrder === order.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-red-800 rounded-lg text-sm text-white transition-colors ml-auto"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingOrder === order.id ? "Deleting..." : "Delete"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInvoiceOrder(order);
                      }}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-neutral-200 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      View Invoice
                    </button>
                  </div>
                  {order.notes && (
                    <div className="mt-3 pt-3 border-t border-neutral-800">
                      <h4 className="text-sm font-medium text-neutral-400 mb-1">Notes</h4>
                      <p className="text-sm text-neutral-300">{order.notes}</p>
                    </div>
                  )}
                </div>
              )
              }
            </div >
          ))}
        </div >
      )
      }

      {/* Custom Order Modal */}
      {
        showCustomModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-neutral-800">
                <h2 className="text-lg font-semibold text-white">Create Custom Order</h2>
                <button
                  onClick={() => setShowCustomModal(false)}
                  className="p-1 hover:bg-neutral-800 rounded"
                >
                  <X className="h-5 w-5 text-neutral-400" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-neutral-400 mb-1">Customer Name *</label>
                    <input
                      type="text"
                      value={customForm.customerName}
                      onChange={(e) => setCustomForm({ ...customForm, customerName: e.target.value })}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm focus:outline-none focus:border-neutral-500"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-400 mb-1">Email *</label>
                    <input
                      type="email"
                      value={customForm.customerEmail}
                      onChange={(e) => setCustomForm({ ...customForm, customerEmail: e.target.value })}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm focus:outline-none focus:border-neutral-500"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div className="border-t border-neutral-800 pt-4">
                  <h3 className="text-sm font-medium text-neutral-300 mb-3">Shipping Address</h3>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={customForm.line1}
                      onChange={(e) => setCustomForm({ ...customForm, line1: e.target.value })}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm focus:outline-none focus:border-neutral-500"
                      placeholder="Street Address"
                    />
                    <input
                      type="text"
                      value={customForm.line2}
                      onChange={(e) => setCustomForm({ ...customForm, line2: e.target.value })}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm focus:outline-none focus:border-neutral-500"
                      placeholder="Apt, Suite, etc. (optional)"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={customForm.city}
                        onChange={(e) => setCustomForm({ ...customForm, city: e.target.value })}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm focus:outline-none focus:border-neutral-500"
                        placeholder="City"
                      />
                      <input
                        type="text"
                        value={customForm.state}
                        onChange={(e) => setCustomForm({ ...customForm, state: e.target.value })}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm focus:outline-none focus:border-neutral-500"
                        placeholder="State"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={customForm.postal_code}
                        onChange={(e) => setCustomForm({ ...customForm, postal_code: e.target.value })}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm focus:outline-none focus:border-neutral-500"
                        placeholder="ZIP Code"
                      />
                      <input
                        type="text"
                        value={customForm.country}
                        onChange={(e) => setCustomForm({ ...customForm, country: e.target.value })}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm focus:outline-none focus:border-neutral-500"
                        placeholder="Country"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-neutral-800 pt-4">
                  <h3 className="text-sm font-medium text-neutral-300 mb-3">Item</h3>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={customForm.itemDescription}
                      onChange={(e) => setCustomForm({ ...customForm, itemDescription: e.target.value })}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm focus:outline-none focus:border-neutral-500"
                      placeholder="Item description"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm text-neutral-400 mb-1">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={customForm.itemQuantity}
                          onChange={(e) => setCustomForm({ ...customForm, itemQuantity: parseInt(e.target.value) || 1 })}
                          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm focus:outline-none focus:border-neutral-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-neutral-400 mb-1">Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={customForm.itemPrice}
                          onChange={(e) => setCustomForm({ ...customForm, itemPrice: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm focus:outline-none focus:border-neutral-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-neutral-800 pt-4">
                  <label className="block text-sm text-neutral-400 mb-1">Notes (optional)</label>
                  <textarea
                    value={customForm.notes}
                    onChange={(e) => setCustomForm({ ...customForm, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm focus:outline-none focus:border-neutral-500 resize-none"
                    rows={2}
                    placeholder="Internal notes about this order..."
                  />
                </div>

                <div className="border-t border-neutral-800 pt-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-neutral-400 mb-1">Shipping Method</label>
                    <select
                      value={customForm.shippingMethod}
                      onChange={(e) => setCustomForm({ ...customForm, shippingMethod: e.target.value })}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm focus:outline-none"
                    >
                      <option value="usps_ground_advantage">USPS Ground Advantage</option>
                      <option value="usps_priority">USPS Priority Mail</option>
                      <option value="usps_priority_express">USPS Priority Mail Express</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-neutral-400 mb-1">Weight (oz)</label>
                    <input
                      type="number"
                      value={customForm.weight_oz}
                      onChange={(e) => setCustomForm({ ...customForm, weight_oz: parseInt(e.target.value) || 32 })}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-neutral-300">
                    Total: <span className="font-semibold text-white">${(customForm.itemPrice * customForm.itemQuantity).toFixed(2)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCustomModal(false)}
                      className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-neutral-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createCustomOrder}
                      disabled={customOrderLoading || !customForm.customerName || !customForm.customerEmail}
                      className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed rounded-lg text-sm text-white transition-colors"
                    >
                      {customOrderLoading ? "Creating..." : "Create Order"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }


      {/* Invoice Modal */}
      {
        invoiceOrder && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 print:p-0 print:bg-white print:fixed print:inset-0">
            <div className="bg-white text-black rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto print:max-h-none print:max-w-none print:w-full print:h-full print:rounded-none selection:bg-blue-200">
              {/* Modal Header (Hide when printing) */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 print:hidden">
                <h2 className="text-lg font-semibold text-gray-900">Invoice Preview</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Print / Save PDF
                  </button>
                  <button
                    onClick={() => setInvoiceOrder(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Invoice Content */}
              <div className="p-12 print:p-0">
                <div className="flex justify-between items-start mb-12">
                  <div>
                    <img src="https://www.calcai.cc/logo.png" alt="CalcAI" className="h-10 mb-6" />
                    <h1 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">INVOICE</h1>
                    <div className="text-gray-500 text-sm space-y-0.5">
                      <p className="font-bold text-gray-800">CalcAI</p>
                      <p>contact@calcai.cc</p>
                      <p>www.calcai.cc</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-600 text-sm space-y-1">
                      <p><span className="font-medium text-gray-900">Invoice #:</span> {invoiceOrder?.id.slice(0, 8).toUpperCase()}</p>
                      <p><span className="font-medium text-gray-900">Date:</span> {invoiceOrder ? new Date(invoiceOrder.created * 1000).toLocaleDateString() : '—'}</p>
                      <p><span className="font-medium text-gray-900">Status:</span> {invoiceOrder?.paymentStatus === 'paid' ? 'Paid' : invoiceOrder?.status}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-12 mb-12">
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Bill To</h3>
                    <div className="text-gray-900 text-sm space-y-1">
                      <p className="font-medium">{invoiceOrder?.customerName}</p>
                      <p>{invoiceOrder?.customerEmail}</p>
                    </div>
                  </div>
                  {invoiceOrder.shippingAddress && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Ship To</h3>
                      <div className="text-gray-900 text-sm space-y-1">
                        <p className="font-medium">{invoiceOrder?.customerName}</p>
                        <p>{invoiceOrder?.shippingAddress?.line1}</p>
                        {invoiceOrder?.shippingAddress?.line2 && <p>{invoiceOrder.shippingAddress.line2}</p>}
                        <p>{invoiceOrder?.shippingAddress?.city}, {invoiceOrder?.shippingAddress?.state} {invoiceOrder?.shippingAddress?.postal_code}</p>
                        <p>{invoiceOrder?.shippingAddress?.country}</p>
                        {invoiceOrder?.shippingMethod && (
                          <p className="mt-2 text-xs text-gray-500 italic">Method: {invoiceOrder.shippingMethod}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <table className="w-full mb-12">
                  <thead>
                    <tr className="border-b-2 border-gray-900">
                      <th className="text-left py-3 text-xs font-semibold text-gray-900 uppercase tracking-wider">Item</th>
                      <th className="text-center py-3 text-xs font-semibold text-gray-900 uppercase tracking-wider w-24">Qty</th>
                      <th className="text-right py-3 text-xs font-semibold text-gray-900 uppercase tracking-wider w-32">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {invoiceOrder?.items.map((item, i) => (
                      <tr key={i}>
                        <td className="py-4 text-sm text-gray-900">{item.description}</td>
                        <td className="py-4 text-sm text-gray-900 text-center">{item.quantity}</td>
                        <td className="py-4 text-sm text-gray-900 text-right">
                          {invoiceOrder ? new Intl.NumberFormat('en-US', { style: 'currency', currency: invoiceOrder.currency.toUpperCase() }).format(item.amount / 100) : '—'}
                        </td>
                      </tr>
                    ))}
                    {/* Shipping Line - assume free if not split out, or minimal logic */}
                    {/* Since we don't track separate shipping costs in all order objects, this is simple */}
                  </tbody>
                </table>

                <div className="flex justify-between items-center border-t-2 border-gray-900 pt-6">
                  <div className="text-xs text-gray-400 max-w-[300px]">
                    <p className="font-bold text-gray-900 mb-1">Payment Info</p>
                    <p>Method: {invoiceOrder?.type === 'square' ? 'Credit Card / Square' : 'Custom / Invoice'}</p>
                    <p>Transaction ID: {invoiceOrder?.paymentId || invoiceOrder?.id.slice(0, 12)}</p>
                  </div>
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Subtotal</span>
                      <span className="font-semibold text-gray-900">
                        {invoiceOrder ? new Intl.NumberFormat('en-US', { style: 'currency', currency: invoiceOrder.currency.toUpperCase() }).format(invoiceOrder.amount / 100) : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Shipping</span>
                      <span className="font-semibold text-gray-900">
                        $0.00
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xl font-black border-t border-gray-100 pt-4 mt-2">
                      <span className="text-gray-900 uppercase">Total</span>
                      <span className="text-blue-600">
                        {invoiceOrder ? new Intl.NumberFormat('en-US', { style: 'currency', currency: invoiceOrder.currency.toUpperCase() }).format(invoiceOrder.amount / 100) : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-20 pt-8 border-t border-gray-100 text-center">
                  <p className="text-sm font-bold text-gray-900 mb-1">Thank you for your order!</p>
                  <p className="text-xs text-gray-400 italic">If you have any questions, please contact support at contact@calcai.cc</p>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Monthly Report Selection Modal */}
      {showMonthlyReportModal && (
        <MonthlyReportModal
          onClose={() => setShowMonthlyReportModal(false)}
          onGenerate={() => { setIsReportView(true); setShowMonthlyReportModal(false); }}
          reportDate={reportDate}
          setReportDate={setReportDate}
        />
      )}

      {/* Monthly Report Full Screen View */}
      {isReportView && (
        <ReportView
          onClose={() => setIsReportView(false)}
          month={reportDate.month}
          year={reportDate.year}
          orders={orders.filter(o => {
            const d = new Date(o.created * 1000);
            return d.getMonth() + 1 === reportDate.month && d.getFullYear() === reportDate.year;
          })}
        />
      )}
    </div>
  );
}

function MonthlyReportModal({
  onClose,
  onGenerate,
  reportDate,
  setReportDate
}: {
  onClose: () => void,
  onGenerate: () => void,
  reportDate: { month: number, year: number },
  setReportDate: (d: { month: number, year: number }) => void
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[110] p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-lg font-semibold text-white">Select Month</h2>
          <button onClick={onClose} className="p-1 hover:bg-neutral-800 rounded">
            <X className="h-5 w-5 text-neutral-400" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-neutral-500 uppercase font-bold mb-1">Month</label>
              <select
                value={reportDate.month}
                onChange={(e) => setReportDate({ ...reportDate, month: parseInt(e.target.value) })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2 text-white text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 uppercase font-bold mb-1">Year</label>
              <select
                value={reportDate.year}
                onChange={(e) => setReportDate({ ...reportDate, year: parseInt(e.target.value) })}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2 text-white text-sm"
              >
                {[2024, 2025, 2026].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={onGenerate}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors mt-2"
          >
            Generate Report
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportView({
  orders,
  month,
  year,
  onClose
}: {
  orders: any[],
  month: number,
  year: number,
  onClose: () => void
}) {
  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
  const totalSales = orders.reduce((sum, o) => sum + o.amount, 0);

  return (
    <div className="fixed inset-0 bg-white text-black z-[200] overflow-y-auto p-12 print:p-0 selection:bg-blue-100">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-start mb-12 print:hidden border-b pb-6">
          <h2 className="text-xl font-bold">Monthly Order Summary</h2>
          <div className="flex gap-4">
            <button onClick={() => window.print()} className="px-6 py-2 bg-black text-white rounded-lg font-bold">Print Report</button>
            <button onClick={onClose} className="px-6 py-2 border border-gray-300 rounded-lg font-bold">Close</button>
          </div>
        </div>

        <div className="flex justify-between items-center mb-10">
          <div>
            <img src="https://www.calcai.cc/logo.png" alt="CalcAI" className="h-10 mb-4" />
            <h1 className="text-4xl font-black uppercase tracking-tighter">Order Report</h1>
            <p className="text-gray-500 font-medium">{monthName} {year}</p>
          </div>
          <div className="text-right">
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase mb-1">Total Sales</p>
              <p className="text-3xl font-black text-gray-900">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalSales / 100)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{orders.length} orders total</p>
            </div>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-4 font-bold">Date</th>
              <th className="py-4 font-bold">ID</th>
              <th className="py-4 font-bold">Customer</th>
              <th className="py-4 font-bold">Shipping</th>
              <th className="py-4 font-bold text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((o, i) => (
              <tr key={i} className="hover:bg-gray-50/50">
                <td className="py-4 text-gray-600">{new Date(o.created * 1000).toLocaleDateString()}</td>
                <td className="py-4 font-mono text-xs text-gray-400 lowercase">{o.id.slice(0, 8)}</td>
                <td className="py-4">
                  <p className="font-bold text-gray-800">{o.customerName}</p>
                  <p className="text-xs text-gray-500">{o.customerEmail}</p>
                </td>
                <td className="py-4 text-gray-500 text-xs">
                  {o.shippingMethod || o.shipment?.service || "—"}
                </td>
                <td className="py-4 text-right font-bold">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: o.currency }).format(o.amount / 100)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {orders.length === 0 && (
          <div className="py-20 text-center text-gray-400 font-medium italic">
            No orders found for this period.
          </div>
        )}

        <div className="mt-20 pt-8 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400 font-medium uppercase tracking-widest">
          <p>CalcAI Internal Report</p>
          <p>Generated {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}


