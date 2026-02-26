"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
    LiveKitRoom,
    RoomAudioRenderer,
    BarVisualizer,
    AgentState,
    useVoiceAssistant,
    useRoomContext,
    useConnectionState,
    useLocalParticipant,
    useRemoteParticipants,
    DisconnectButton,
    TrackToggle,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { Mic, MicOff, Settings, Terminal, Activity, MessageSquare } from "lucide-react";

export function AgentPlayground() {
    const [token, setToken] = useState("");
    const [url, setUrl] = useState("");
    const [connecting, setConnecting] = useState(false);

    const connect = async () => {
        setConnecting(true);
        try {
            const res = await fetch("/api/livekit/token?room=calcai-voice");
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
            <div className="flex flex-col items-center justify-center p-12 bg-neutral-900 border border-neutral-800 rounded-xl mt-6">
                <Activity className="h-16 w-16 text-blue-500 mb-6 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                <h2 className="text-2xl font-bold text-white mb-2">Clawdbot AntiGravity Edition</h2>
                <p className="text-neutral-400 mb-8 max-w-md text-center">
                    Initialize the voice session to connect directly to the LiveKit python agent.
                </p>
                <button
                    onClick={connect}
                    disabled={connecting}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-medium transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] disabled:opacity-50"
                >
                    {connecting ? "Initializing..." : "Engage Agent"}
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
            className="mt-6 font-sans"
        >
            <RoomAudioRenderer />
            <AgentInterface />
        </LiveKitRoom>
    );
}

function AgentInterface() {
    const room = useRoomContext();
    const { state, audioTrack } = useVoiceAssistant();
    const connectionState = useConnectionState();

    // Custom states for chat/console
    const [messages, setMessages] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const logScrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logic
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        if (logScrollRef.current) {
            logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
        }
    }, [logs]);

    // Hook into room events for transcriptions & data packets (function calls)
    useEffect(() => {
        if (!room) return;

        const handleData = (payload: Uint8Array, participant?: any, kind?: any, topic?: string) => {
            try {
                const text = new TextDecoder().decode(payload);
                const data = JSON.parse(text);

                // Handling function calls / tool outputs if they come via RPC or custom data
                if (data.type === "tool_call") {
                    setLogs(prev => [...prev.slice(-100), { time: new Date().toLocaleTimeString(), text: `Tool Call: ${data.name}` }]);
                } else if (JSON.stringify(data).includes("tool")) {
                    setLogs(prev => [...prev.slice(-100), { time: new Date().toLocaleTimeString(), text: `Sys: ${JSON.stringify(data)}` }]);
                } else {
                    setLogs(prev => [...prev.slice(-100), { time: new Date().toLocaleTimeString(), text: `${topic || 'Log'}: ${text}` }]);
                }
            } catch (e) {
                // Not JSON
                setLogs(prev => [...prev.slice(-100), { time: new Date().toLocaleTimeString(), text: `Sys: Native packet received` }]);
            }
        };

        // LiveKit Transcription event
        const handleTranscription = (segments: any[], participant: any, publication: any) => {
            if (!segments || segments.length === 0) return;
            const ts = segments[0]; // grab the text
            const isAgent = participant?.identity?.startsWith("agent") || !participant?.isLocal;

            setMessages(prev => {
                // check if compiling same sentence
                let newMsgs = [...prev];
                const lastMsg = newMsgs[newMsgs.length - 1];
                if (lastMsg && lastMsg.participant === (isAgent ? "Agent" : "You") && lastMsg.id === ts.id) {
                    lastMsg.text = ts.text;
                    lastMsg.isFinal = ts.final;
                } else {
                    newMsgs.push({
                        id: ts.id,
                        participant: isAgent ? "Agent" : "You",
                        text: ts.text,
                        isFinal: ts.final,
                    });
                }
                return newMsgs.slice(-50);
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 rounded-xl overflow-hidden glassmorphism bg-neutral-900 border border-neutral-800 shadow-2xl p-6 relative">
            <div className="lg:col-span-2 flex flex-col items-center">
                {/* Visualizer Area */}
                <div className="relative w-full h-[300px] flex items-center justify-center bg-black/40 rounded-2xl border border-neutral-800/80 mb-6 overflow-hidden">
                    {/* Subtle grid background */}
                    <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>

                    <div className="z-10 flex flex-col items-center">
                        {state === "connecting" && <span className="text-neutral-400 font-mono text-sm animate-pulse mb-6">ESTABLISHING LINK...</span>}
                        {state === "disconnected" && <span className="text-red-400 font-mono text-sm">OFFLINE</span>}
                        {(state === "listening" || state === "speaking" || state === "thinking") && (
                            <>
                                <span className={`font-mono text-sm mb-6 ${state === 'speaking' ? 'text-blue-400' : state === 'listening' ? 'text-green-400' : 'text-purple-400'}`}>
                                    SYS.{state.toUpperCase()}
                                </span>
                                <BarVisualizer
                                    state={state}
                                    barCount={7}
                                    trackRef={audioTrack}
                                    className="w-48 h-16 flex items-center justify-center gap-1"
                                    style={{ '--lk-va-bar-width': '12px' } as any}
                                />
                            </>
                        )}

                    </div>
                </div>

                {/* Chat / Transcript Area */}
                <div className="w-full h-[250px] bg-black/60 rounded-xl border border-neutral-800 flex flex-col">
                    <div className="px-4 py-2 border-b border-neutral-800/50 bg-neutral-900/50 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-neutral-400" />
                        <span className="text-xs font-mono text-neutral-400">SESSION.TRANSCRIPT</span>
                    </div>
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 font-mono text-sm">
                        {messages.length === 0 && <span className="text-neutral-600 italic text-xs">Awaiting voice input...</span>}
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.participant === "You" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[80%] rounded-lg px-3 py-2 ${m.participant === "You" ? "bg-blue-900/40 text-blue-100 border border-blue-800/50" : "bg-neutral-800/80 border border-neutral-700/50 text-neutral-200"}`}>
                                    <span className="text-[10px] uppercase text-neutral-500 block mb-1">{m.participant}</span>
                                    <span className={`${m.isFinal ? "opacity-100" : "opacity-70 animate-pulse"}`}>{m.text}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Control Bar */}
                <div className="flex gap-4 items-center justify-center mt-6 w-full px-4 py-3 bg-black/40 rounded-full border border-neutral-800/80 backdrop-blur-md w-max mx-auto shadow-xl">
                    <TrackToggle
                        source={Track.Source.Microphone}
                        showIcon={true}
                        className="w-12 h-12 rounded-full border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center"
                    />
                    <button onClick={() => room?.disconnect()} className="w-12 h-12 rounded-full border border-red-900/50 bg-red-900/30 hover:bg-red-800/50 text-red-500 flex items-center justify-center transition-colors">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
                    </button>
                </div>
            </div>

            {/* Terminal / Logging Area */}
            <div className="flex flex-col bg-black/80 rounded-xl border border-neutral-800 overflow-hidden shadow-inner h-[600px] lg:h-auto">
                <div className="px-4 py-3 border-b border-neutral-800/80 bg-neutral-900/80 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-green-400" />
                        <span className="text-xs font-mono text-neutral-300 font-semibold tracking-wider">ANTIGRAVITY_SYS.LOG</span>
                    </div>
                    <div className="flex gap-1.5 items-center">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    </div>
                </div>
                <div ref={logScrollRef} className="flex-1 overflow-y-auto p-4 font-mono text-xs overflow-x-hidden space-y-1 bg-[#0a0a0c]">
                    <div className="text-green-500/70 mb-4 opacity-75">
                        <p>{`[${new Date().toLocaleTimeString()}] SYS: INITIALIZING ANTIGRAVITY KERNEL...`}</p>
                        <p>{`[${new Date().toLocaleTimeString()}] SYS: LINK TO LIVEKIT WORKER SECURED.`}</p>
                        <p>{`[${new Date().toLocaleTimeString()}] SYS: READY FOR OPERATION.`}</p>
                    </div>
                    {logs.map((l, i) => (
                        <div key={i} className="flex gap-3 text-neutral-300 border-l border-neutral-800 pl-2">
                            <span className="text-neutral-600 shrink-0">[{l.time}]</span>
                            <span className="break-words font-medium text-green-400/90">{l.text}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
