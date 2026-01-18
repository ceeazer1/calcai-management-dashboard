"use client";

import { useState } from "react";
import { Mail, Send, CheckCircle2, AlertCircle, Info } from "lucide-react";

export default function TestingPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState<string | null>(null);
    const [result, setResult] = useState<{ type: string; ok: boolean; msg: string } | null>(null);

    const sendTestEmail = async (type: "confirmation" | "shipped" | "reset") => {
        if (!email) {
            setResult({ type, ok: false, msg: "Please enter a recipient email address" });
            return;
        }

        setLoading(type);
        setResult(null);

        try {
            const r = await fetch("/api/testing/email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, email }),
            });
            const data = await r.json();

            if (r.ok && data.ok) {
                const typeLabels = { confirmation: "Order Confirmation", shipped: "Shipping Notification", reset: "Password Reset" };
                setResult({ type, ok: true, msg: `Success! ${typeLabels[type]} email sent.` });
            } else {
                setResult({ type, ok: false, msg: data.error || "Failed to send email" });
            }
        } catch (err) {
            setResult({ type, ok: false, msg: "Network error occurred" });
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Testing & Debug</h1>
                <p className="text-neutral-400 text-sm mt-1">
                    Internal tools for testing system functionality and emails
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Email Testing Card */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Mail className="h-5 w-5 text-blue-400" />
                        <h2 className="text-lg font-semibold text-white">Email Testing</h2>
                    </div>

                    <p className="text-neutral-400 text-sm mb-6">
                        Send test versions of customer emails to a specific address to verify layout and delivery.
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                                Recipient Email
                            </label>
                            <input
                                type="email"
                                placeholder="test@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>

                        <div className="flex flex-col gap-2 pt-2">
                            <button
                                onClick={() => sendTestEmail("confirmation")}
                                disabled={!!loading}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                            >
                                {loading === "confirmation" ? (
                                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                                Send Order Confirmation
                            </button>

                            <button
                                onClick={() => sendTestEmail("shipped")}
                                disabled={!!loading}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                            >
                                {loading === "shipped" ? (
                                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                                Send Shipping Notification
                            </button>

                            <button
                                onClick={() => sendTestEmail("reset")}
                                disabled={!!loading}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                            >
                                {loading === "reset" ? (
                                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                                Send Password Reset
                            </button>
                        </div>

                        {result && (
                            <div
                                className={`flex items-start gap-3 p-4 rounded-lg mt-4 ${result.ok ? "bg-green-900/20 border border-green-800/30 text-green-400" : "bg-red-900/20 border border-red-800/30 text-red-400"
                                    }`}
                            >
                                {result.ok ? (
                                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
                                ) : (
                                    <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                                )}
                                <span className="text-sm">{result.msg}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Info/Notes Card */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Info className="h-5 w-5 text-yellow-400" />
                        <h2 className="text-lg font-semibold text-white">System Info</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 bg-neutral-950 rounded-lg border border-neutral-800">
                            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Email Configuration</h3>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-sm">
                                    <span className="text-neutral-400">Provider</span>
                                    <span className="text-neutral-200">Resend</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-neutral-400">Environment</span>
                                    <span className="text-green-400 font-medium">Production</span>
                                </div>
                            </div>
                        </div>

                        <div className="text-sm text-neutral-400 leading-relaxed italic">
                            "The testing tools use actual production API keys to send emails. Be careful with high-volume testing to avoid hitting rate limits or spam filters."
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
