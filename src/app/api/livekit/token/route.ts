import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export async function GET(req: NextRequest) {
    const roomName = req.nextUrl.searchParams.get('room') || 'calcai-voice-room';
    const participantName = req.nextUrl.searchParams.get('name') || 'Chris (Admin)';

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
        return NextResponse.json(
            { error: 'LiveKit API Key or Secret is missing in env' },
            { status: 500 }
        );
    }

    const at = new AccessToken(apiKey, apiSecret, {
        identity: `admin-${Math.floor(Math.random() * 10000)}`,
        name: participantName,
    });

    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

    const token = await at.toJwt();

    return NextResponse.json({ token, url: process.env.LIVEKIT_URL });
}
