"use client";

import { useEffect, useState, useRef } from "react";
import {
    LiveKitRoom,
    RoomAudioRenderer,
    BarVisualizer,
    useVoiceAssistant,
    useRoomContext,
    TrackToggle,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { MicOff, Terminal, MessageSquare, Activity } from "lucide-react";

export function AgentPlayground() {
    const [token, setToken] = useState("");
    const [url, setUrl] = useState("");
    const [connecting, setConnecting] = useState(false);

    const connect = async () => {
        setConnecting(true);
        try {
            const uniqueRoom = `calcai-voice-${Math.floor(Math.random() * 100000)}`;
            const res = await fetch(`/api/livekit/token?room=${uniqueRoom}`);
            const data = await res.json();
            setToken(data.token);
            setUrl(data.url);
        } catch (e) {
            console.error(e);
        }
        setConnecting(false);
    };

    const disconnect = () => {
        setToken("");
        setUrl("");
    };

    if (!token) {
        return (
            <div className="flex flex-col flex-1 items-center justify-center p-12 h-full w-full bg-black/40">
                <Activity className="h-20 w-20 text-cyan-500 mb-8 drop-shadow-[0_0_20px_rgba(6,182,212,0.6)]" />
                <h2 className="text-3xl font-bold tracking-[0.3em] text-neutral-200 mb-4 uppercase text-center w-full">AntiGravity Kernel</h2>
                <p className="text-neutral-500 mb-10 max-w-sm text-center font-mono text-xs leading-relaxed tracking-widest">
                    ESTABLISH DIRECT SECURE LINK WITH LIVEKIT VOICE WORKER.
                </p>
                <button
                    onClick={connect}
                    disabled={connecting}
                    className="px-10 py-4 bg-transparent border-2 border-cyan-500/50 hover:border-cyan-400 hover:bg-cyan-900/20 text-cyan-400 rounded font-mono font-bold tracking-[0.2em] transition-all disabled:opacity-50"
                >
                    {connecting ? "INITIALIZING..." : "ENGAGE_LINK"}
                </button>
            </div>
        );
    }

    return (
        <LiveKitRoom
            serverUrl={url}
            token={token}
            connect={true}
            audio={true}
            video={false}
            onDisconnected={disconnect}
            className="flex-1 w-full font-sans absolute inset-0 m-0 p-0 flex flex-col"
        >
            <RoomAudioRenderer />
            <AgentInterface />
        </LiveKitRoom>
    );
}

function AgentInterface() {
    const room = useRoomContext();
    const { state, audioTrack } = useVoiceAssistant();

    const [messages, setMessages] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const logScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    useEffect(() => {
        if (logScrollRef.current) logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }, [logs]);

    useEffect(() => {
        if (!room) return;

        const handleData = (payload: Uint8Array) => {
            try {
                const text = new TextDecoder().decode(payload);
                const data = JSON.parse(text);
                if (data.type === "log" || data.text) {
                    setLogs(prev => [...prev.slice(-200), { time: new Date().toLocaleTimeString(), text: data.text }]);
                }
            } catch (e) {
                setLogs(prev => [...prev.slice(-200), { time: new Date().toLocaleTimeString(), text: `SYS_EVENT: Generic packet received` }]);
            }
        };

        const handleTranscription = (segments: any[], participant: any) => {
            if (!segments || segments.length === 0) return;
            const ts = segments[0];
            const isAgent = participant?.identity?.startsWith("agent") || !participant?.isLocal;

            setMessages(prev => {
                let newMsgs = [...prev];
                const lastMsg = newMsgs[newMsgs.length - 1];
                if (lastMsg && lastMsg.participant === (isAgent ? "Agent" : "You") && lastMsg.id === ts.id) {
                    lastMsg.text = ts.text;
                    lastMsg.isFinal = ts.final;
                } else {
                    newMsgs.push({ id: ts.id, participant: isAgent ? "Agent" : "You", text: ts.text, isFinal: ts.final });
                }
                return newMsgs.slice(-100);
            });
        };

        room.on("dataReceived", handleData);
        room.on("transcriptionReceived", handleTranscription);

        return () => {
            room.off("dataReceived", handleData);
            room.off("transcriptionReceived", handleTranscription);
        };
    }, [room]);

    return (
        <div className="flex flex-col h-full w-full bg-transparent absolute inset-0 m-0 divide-y divide-neutral-800/80">

            {/* Top Bar: Visualizer / Core UI */}
            <div className="shrink-0 flex flex-col relative bg-[radial-gradient(ellipse_at_top,rgba(20,20,30,0.8)_0%,rgba(0,0,0,0.9)_100%)] px-6 py-4 justify-center items-center h-[180px]">

                {/* Status indicator - Top Left */}
                <div className="absolute top-4 left-6 flex items-center gap-3 z-10">
                    <h3 className="font-mono text-[10px] tracking-[0.3em] text-neutral-500 uppercase">Comm_Link</h3>
                    <span className={`px-2 py-0.5 rounded-sm font-mono text-[10px] tracking-widest ${state === 'disconnected' ? 'bg-red-900/30 text-red-500' : 'bg-emerald-900/30 text-emerald-400'}`}>
                        {state === "disconnected" ? "OFFLINE" : "LINKED"}
                    </span>
                </div>

                {/* Visualizer centered horizontally */}
                <div className="w-full h-[60px] flex items-center justify-center pointer-events-none mt-2">
                    {(state === "listening" || state === "speaking" || state === "thinking") ? (
                        <BarVisualizer
                            state={state}
                            barCount={31}
                            trackRef={audioTrack}
                            className="w-full flex items-center justify-center gap-[4px] opacity-80"
                            style={{ '--lk-va-bar-width': '6px', color: '#aaaaaa', height: '60px' } as any}
                        />
                    ) : (
                        <div className="flex items-center justify-center gap-[4px] opacity-30 h-[60px]">
                            {Array.from({ length: 31 }).map((_, i) => (
                                <div key={i} className="w-[6px] rounded-full bg-[#aaaaaa] transition-all h-[10px]"></div>
                            ))}
                        </div>
                    )}
                </div>

                {/* State Label */}
                <div className="flex flex-col items-center mt-3">
                    {(state === "connecting" || state === "disconnected") && (
                        <span className={`font-mono text-[10px] tracking-[0.3em] font-bold uppercase ${state === 'disconnected' ? 'text-red-500/70' : 'text-cyan-500 animate-pulse'}`}>
                            {state === "connecting" ? "AWAITING DISPATCH..." : "CORE_TERMINATED"}
                        </span>
                    )}
                    {(state === "listening" || state === "speaking" || state === "thinking") && (
                        <span className={`font-mono text-[10px] tracking-[0.4em] font-bold uppercase ${state === 'speaking' ? 'text-neutral-300' : state === 'listening' ? 'text-neutral-500' : 'text-neutral-600 animate-pulse'}`}>
                            SYS_{state}
                        </span>
                    )}
                </div>

                {/* Action Buttons - Top Right */}
                <div className="absolute top-4 right-6 flex justify-center gap-3 z-20">
                    <TrackToggle
                        source={Track.Source.Microphone}
                        showIcon={true}
                        className="w-8 h-8 rounded border border-neutral-700/50 bg-neutral-900/60 hover:bg-neutral-800 flex items-center justify-center text-neutral-300 backdrop-blur"
                    />
                    <button onClick={() => room?.disconnect()} className="w-8 h-8 rounded border border-red-900/30 bg-red-950/20 hover:bg-red-900/40 text-red-500 flex items-center justify-center backdrop-blur transition-all">
                        <MicOff className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Bottom Area: Transcript & Logs Side-by-Side */}
            <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-transparent divide-y md:divide-y-0 md:divide-x divide-neutral-800/80">

                {/* Transcript Panel (Left) */}
                <div className="flex-1 flex flex-col bg-black/40 min-h-0 relative">
                    <div className="px-5 py-3 border-b border-neutral-800/50 bg-neutral-900/40 flex items-center gap-2 shrink-0">
                        <MessageSquare className="w-3.5 h-3.5 text-neutral-500" />
                        <span className="text-[10px] font-mono tracking-[0.2em] text-neutral-500">SESSION.TRANSCRIPT</span>
                    </div>
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 font-mono text-xs w-full">
                        {messages.length === 0 && <span className="text-neutral-700 italic tracking-widest text-[10px]">NO AUDIO DETECTED</span>}
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.participant === "You" ? "justify-end" : "justify-start"} w-full`}>
                                <div className={`max-w-[85%] rounded px-3 py-2 ${m.participant === "You" ? "bg-cyan-950/20 text-cyan-100 border-r-2 border-cyan-500" : "bg-neutral-800/30 text-neutral-300 border-l-2 border-neutral-500"}`}>
                                    <span className="text-[9px] uppercase tracking-[0.2em] text-cyan-700 block mb-1">{m.participant}</span>
                                    <span className={`leading-relaxed text-[11px] ${m.isFinal ? "opacity-100" : "opacity-70"}`}>{m.text}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Backend Terminal Log Panel (Right) */}
                <div className="flex-[1.2] flex flex-col bg-[#020202] min-h-0 relative">
                    <div className="px-5 py-3 border-b border-emerald-900/30 bg-[#060a08] flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <Terminal className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-[10px] font-mono tracking-[0.2em] text-emerald-600 font-bold">SYSTEM.LOG</span>
                        </div>
                        <div className="flex gap-1.5 opacity-60">
                            <div className="w-1.5 h-1.5 rounded-sm bg-emerald-900 animate-pulse"></div>
                        </div>
                    </div>
                    <div ref={logScrollRef} className="flex-1 overflow-y-auto p-5 font-mono text-[10.5px] leading-tight w-full space-y-1">
                        <div className="text-emerald-500/40 mb-5 mix-blend-screen opacity-50">
                            <p>INITIALIZING TERMINAL BUFFER...</p>
                            <p>AWAITING DATA PACKETS.</p>
                            <p className="mt-2 text-neutral-600">----------------------------------</p>
                        </div>
                        {logs.map((l, i) => (
                            <div key={i} className="flex gap-3 text-emerald-500 hover:bg-emerald-900/20 px-1 py-0.5 transition-colors break-words w-full">
                                <span className="text-emerald-800/80 shrink-0 select-none">[{l.time}]</span>
                                <span className="whitespace-pre-wrap">{l.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

        </div>
    );
}
