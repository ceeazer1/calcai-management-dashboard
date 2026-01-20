import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

async function shippoFetch(path: string) {
    const token = process.env.SHIPPO_API_TOKEN;
    if (!token) throw new Error("Missing SHIPPO_API_TOKEN");

    const url = `https://api.goshippo.com${path}`;
    const r = await fetch(url, {
        headers: {
            Authorization: `ShippoToken ${token}`,
            "Content-Type": "application/json",
        },
    });

    if (!r.ok) {
        const text = await r.text();
        throw new Error(`Shippo error: ${text}`);
    }

    return r.json();
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const carrier = searchParams.get("carrier");
        const trackingNumber = searchParams.get("trackingNumber");

        if (!carrier || !trackingNumber) {
            return NextResponse.json({ error: "carrier and trackingNumber required" }, { status: 400 });
        }

        // Shippo Tracking API: GET /tracks/<carrier>/<tracking_number>/
        const data = await shippoFetch(`/tracks/${carrier.toLowerCase()}/${trackingNumber}/`);

        // Shippo tracking status: UNKNOWN, PRE_TRANSIT, TRANSIT, DELIVERED, RETURNED, FAILURE
        return NextResponse.json({
            ok: true,
            status: data.tracking_status?.status || "UNKNOWN",
            statusDetails: data.tracking_status?.status_details || "",
            eta: data.eta || null
        });
    } catch (e: any) {
        console.error("[orders/tracking/status] error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
