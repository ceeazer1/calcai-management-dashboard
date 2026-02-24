import { NextResponse } from "next/server";
import { getKvClient } from "@/lib/kv";

export async function POST(req: Request) {
    const kv = getKvClient();
    try {
        const { itemId, decision, reason } = await req.json();

        if (!itemId || !decision) {
            return NextResponse.json({ ok: false, message: "Missing itemId or decision" }, { status: 400 });
        }

        // 1. Log the decision
        const decisions = (await kv.get("clawdbot:ebay_decisions") as any[]) || [];
        decisions.push({
            itemId,
            decision, // 'approve' | 'disapprove'
            reason,
            ts: Date.now()
        });
        await kv.set("clawdbot:ebay_decisions", decisions.slice(-1000)); // Keep last 1000

        // 2. Remove from active picks
        const picks = (await kv.get("clawdbot:ebay_picks") as any[]) || [];
        const pickToMove = picks.find((p: any) => p.itemId === itemId);
        const updatedPicks = picks.filter((p: any) => p.itemId !== itemId);
        await kv.set("clawdbot:ebay_picks", updatedPicks);

        // 3. If approved, add to the playback queue for ebay-offer.js
        if (decision === 'approve' && pickToMove) {
            const approved = (await kv.get("clawdbot:ebay_approved") as any[]) || [];
            // Only add if not already in queue
            if (!approved.some((a: any) => a.itemId === itemId)) {
                approved.push({ ...pickToMove, approvedAt: Date.now() });
                await kv.set("clawdbot:ebay_approved", approved);
            }
        }

        // 4. If disapproved, add to negative feedback for the AI
        if (decision === 'disapprove' && reason) {
            const feedback = (await kv.get("clawdbot:ebay_feedback") as any[]) || [];
            feedback.push({ itemId, reason, ts: Date.now() });
            await kv.set("clawdbot:ebay_feedback", feedback.slice(-500));
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ ok: false, message: e.message }, { status: 500 });
    }
}
