import { NextRequest, NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";

export const runtime = "nodejs";

function mustEnv(name: string) {
    const v = process.env[name];
    if (!v || !String(v).trim()) throw new Error(`Missing env: ${name}`);
    return String(v).trim();
}

async function shippoFetch(path: string, init: RequestInit) {
    const token = mustEnv("SHIPPO_API_TOKEN");
    const url = `https://api.goshippo.com${path}`;
    const r = await fetch(url, {
        ...init,
        headers: {
            Authorization: `ShippoToken ${token}`,
            "Content-Type": "application/json",
            ...(init.headers || {}),
        },
    });
    const text = await r.text();
    let json: any = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        // ignore
    }
    if (!r.ok) {
        const msg = json?.detail || json?.message || text || "shippo_error";
        throw new Error(`Shippo error (${r.status}): ${msg}`);
    }
    return json;
}

export async function POST(req: NextRequest) {
    try {
        const { orderId } = (await req.json()) as { orderId?: string };
        if (!orderId) {
            return NextResponse.json({ error: "orderId required" }, { status: 400 });
        }

        const kv = getKvClient();
        const key = `orders:shipment:${orderId}`;
        const record = await kv.get<any>(key);

        if (!record || !record.transactionId) {
            return NextResponse.json({ error: "No shipping label found for this order" }, { status: 404 });
        }

        // 1. Request refund from Shippo
        console.log(`[ship-refund] Requesting refund for transaction: ${record.transactionId}`);
        const refund = await shippoFetch("/refunds/", {
            method: "POST",
            body: JSON.stringify({
                transaction: record.transactionId,
                async: false,
            }),
        });

        console.log(`[ship-refund] Refund status: ${refund.status}`);

        // even if it's PENDING or QUEUED, we count the request as made
        if (refund.status === "ERROR") {
            throw new Error("Shippo rejected the refund request");
        }

        // 2. Remove the shipment record from our KV store so the UI shows "No label yet"
        await kv.del(key);

        return NextResponse.json({ ok: true, refund });
    } catch (e: any) {
        const msg = e instanceof Error ? e.message : "server_error";
        console.error("[orders/ship-refund] error:", e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
