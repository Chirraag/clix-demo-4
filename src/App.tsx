import { useState, useRef, useEffect, useCallback } from 'react';
import { Headphones, Globe, ChevronDown, Loader2 } from 'lucide-react';
import { LiveKitRoom, useVoiceAssistant, AgentState, RoomAudioRenderer } from '@livekit/components-react';
import { MediaDeviceFailure } from 'livekit-client';
import { createCall, connectWebSocket, Language } from './services/ultravox';

type CallState = 'idle' | 'connecting' | 'connected' | 'disconnected';

interface ConnectionDetails {
  participantToken?: string;
  serverUrl?: string;
  roomName?: string;
  joinUrl?: string;
}

function App() {
  const [connectionDetails, setConnectionDetails] = useState<ConnectionDetails | undefined>(undefined);
  const [language, setLanguage] = useState<Language>('english');
  const [hasError, setHasError] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hindiCallState, setHindiCallState] = useState<CallState>('idle');

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioWorkletRef = useRef<AudioWorkletNode | null>(null);
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayTimeRef = useRef<number>(0);

  const disconnectHindi = useCallback(() => {
    audioQueueRef.current.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Already stopped
      }
    });
    audioQueueRef.current = [];
    nextPlayTimeRef.current = 0;

    if (audioWorkletRef.current) {
      audioWorkletRef.current.disconnect();
      audioWorkletRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setHindiCallState('idle');
  }, []);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      console.error('Unhandled promise rejection:', event.reason);
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      disconnectHindi();
    };
  }, [disconnectHindi]);

  const handleEndCall = useCallback(() => {
    if (language === 'hindi') {
      disconnectHindi();
    }
    setConnectionDetails(undefined);
    setIsConnecting(false);
    setHasError(false);
  }, [language, disconnectHindi]);

  const initiateConnection = useCallback(async () => {
    if (isConnecting || connectionDetails) {
      return;
    }

    try {
      setIsConnecting(true);
      setHasError(false);

      const callData = await createCall(language);

      if (language === 'english') {
        setConnectionDetails({
          participantToken: callData.participantToken,
          serverUrl: callData.serverUrl,
          roomName: callData.roomName,
        });
        setIsConnecting(false);
      } else {
        setConnectionDetails({
          joinUrl: callData.joinUrl,
        });
        await setupHindiCall(callData.joinUrl);
      }
    } catch (error) {
      console.error('Failed to connect:', error);
      setHasError(true);
      setIsConnecting(false);
    }
  }, [connectionDetails, isConnecting, language]);

  const setupHindiCall = async (joinUrl: string) => {
    try {
      setHindiCallState('connecting');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000
        }
      });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 48000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);

      await audioContext.audioWorklet.addModule('/audio-processor.js');
      const audioWorklet = new AudioWorkletNode(audioContext, 'audio-processor');
      audioWorkletRef.current = audioWorklet;

      const ws = await connectWebSocket(joinUrl);
      wsRef.current = ws;

      audioWorklet.port.onmessage = (event) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(event.data);
        }
      };

      ws.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          try {
            const message = JSON.parse(event.data);
            console.log('Message received:', message);
          } catch (e) {
            console.log('Non-JSON message:', event.data);
          }
        } else if (event.data instanceof ArrayBuffer) {
          const audioData = new Int16Array(event.data);
          playAudio(audioData);
        } else if (event.data instanceof Blob) {
          const arrayBuffer = await event.data.arrayBuffer();
          const audioData = new Int16Array(arrayBuffer);
          playAudio(audioData);
        }
      };

      ws.onclose = () => {
        setHindiCallState('disconnected');
        handleEndCall();
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setHasError(true);
        handleEndCall();
      };

      source.connect(audioWorklet);
      audioWorklet.connect(audioContext.destination);

      setHindiCallState('connected');
      setIsConnecting(false);
    } catch (error) {
      console.error('Failed to setup Hindi call:', error);
      setHasError(true);
      setIsConnecting(false);
      disconnectHindi();
    }
  };

  const playAudio = (audioData: Int16Array) => {
    if (!audioContextRef.current) return;

    const audioContext = audioContextRef.current;

    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const buffer = audioContext.createBuffer(1, audioData.length, audioContext.sampleRate);
    const channelData = buffer.getChannelData(0);

    for (let i = 0; i < audioData.length; i++) {
      channelData[i] = audioData[i] / 32768.0;
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);

    const currentTime = audioContext.currentTime;
    if (nextPlayTimeRef.current < currentTime) {
      nextPlayTimeRef.current = currentTime;
    }

    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += buffer.duration;

    source.onended = () => {
      const index = audioQueueRef.current.indexOf(source);
      if (index > -1) {
        audioQueueRef.current.splice(index, 1);
      }
    };

    audioQueueRef.current.push(source);
  };

  const onDeviceFailure = (error?: MediaDeviceFailure) => {
    console.error('Media device failure:', error);
    setHasError(true);
  };

  const isEnglishMode = language === 'english' && connectionDetails?.participantToken;
  const isHindiMode = language === 'hindi' && connectionDetails?.joinUrl;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      <header className="w-full py-4 sm:py-8">
        <div className="container mx-auto px-4 flex justify-center">
          <img
            src="https://uidai.gov.in/images/langPage/Page-1.svg"
            alt="AADHAAR"
            className="h-8 sm:h-12"
          />
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl sm:text-3xl font-bold mb-8 sm:mb-12 tracking-wider" style={{ color: '#E91E63' }}>
            AADHAAR Helpdesk
          </h1>

          {isEnglishMode ? (
            <LiveKitRoom
              token={connectionDetails.participantToken}
              serverUrl={connectionDetails.serverUrl}
              connect={true}
              audio={true}
              video={false}
              onMediaDeviceFailure={onDeviceFailure}
              onError={(error) => {
                console.error('LiveKit error:', error);
                setHasError(true);
              }}
              onDisconnected={handleEndCall}
            >
              <ActiveStateEnglish
                onDisconnect={handleEndCall}
                language={language}
                onLanguageChange={(value) => setLanguage(value)}
              />
              <RoomAudioRenderer />
            </LiveKitRoom>
          ) : isHindiMode ? (
            <ActiveStateHindi
              onDisconnect={handleEndCall}
              language={language}
              onLanguageChange={(value) => setLanguage(value)}
              callState={hindiCallState}
            />
          ) : (
            <InactiveState
              onConnect={initiateConnection}
              hasError={hasError}
              isConnecting={isConnecting}
              language={language}
              onLanguageChange={(value) => setLanguage(value)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function LanguageSelector({
  language,
  onChange,
  disabled = false,
}: {
  language: Language;
  onChange: (value: Language) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mb-8 sm:mb-12 flex justify-center">
      <div className="relative">
        <select
          value={language}
          onChange={(e) => onChange(e.target.value as Language)}
          disabled={disabled}
          className="appearance-none bg-white border border-slate-300 rounded-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-2.5 sm:py-3 shadow-sm text-slate-700 font-medium text-sm sm:text-base cursor-pointer hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <option value="english">English</option>
          <option value="hindi">Hindi</option>
        </select>
        <Globe size={18} className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none sm:w-5 sm:h-5" />
        <ChevronDown size={16} className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none sm:w-4 sm:h-4" />
      </div>
    </div>
  );
}

function InactiveState({
  onConnect,
  hasError = false,
  isConnecting = false,
  language,
  onLanguageChange,
}: {
  onConnect: () => void;
  hasError?: boolean;
  isConnecting?: boolean;
  language: Language;
  onLanguageChange: (value: Language) => void;
}) {
  return (
    <>
      <LanguageSelector language={language} onChange={onLanguageChange} disabled={isConnecting} />

      <div className="flex justify-center mb-6 sm:mb-8">
        <button
          onClick={onConnect}
          disabled={isConnecting}
          className="group relative active:scale-95 transition-transform"
        >
          <div className="absolute inset-0 rounded-full blur-xl sm:blur-2xl transition-opacity bg-emerald-400 opacity-30"></div>
          <div
            className={`relative w-48 h-48 sm:w-64 sm:h-64 rounded-full flex items-center justify-center transition-all transform hover:scale-105 ${
              isConnecting
                ? 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-2xl animate-pulse'
                : 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-2xl'
            }`}
            style={{
              boxShadow: isConnecting
                ? '0 15px 50px rgba(245, 158, 11, 0.4)'
                : '0 15px 50px rgba(16, 185, 129, 0.4)'
            }}
          >
            {isConnecting ? (
              <Loader2 size={64} className="text-white sm:w-20 sm:h-20 animate-spin" strokeWidth={1.5} />
            ) : (
              <Headphones size={64} className="text-white sm:w-20 sm:h-20" strokeWidth={1.5} />
            )}
          </div>
        </button>
      </div>

      <div className="text-slate-600 text-sm sm:text-base px-4">
        {isConnecting ? 'Connecting...' : 'Click to start voice call'}
      </div>

      {hasError && (
        <div className="mt-4 sm:mt-6 mx-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-xs sm:text-sm">Failed to start call. Please try again.</p>
        </div>
      )}
    </>
  );
}

function ActiveStateEnglish({
  onDisconnect,
  language,
  onLanguageChange,
}: {
  onDisconnect: () => void;
  language: Language;
  onLanguageChange: (value: Language) => void;
}) {
  const [agentState, setAgentState] = useState<AgentState>('disconnected');
  const { state: liveKitState } = useVoiceAssistant();

  useEffect(() => {
    try {
      if (liveKitState) {
        setAgentState(liveKitState);
      }
    } catch (error) {
      console.error('Error updating agent state:', error);
    }
  }, [liveKitState]);

  const gradient = getOrbGradient(agentState);

  return (
    <>
      <LanguageSelector language={language} onChange={onLanguageChange} disabled={true} />

      <div className="flex justify-center mb-6 sm:mb-8">
        <button
          onClick={onDisconnect}
          className="group relative active:scale-95 transition-transform"
        >
          <div className={`absolute inset-0 rounded-full blur-xl sm:blur-2xl transition-opacity ${gradient === 'from-[#fbbf24] via-[#f97316] to-[#ef4444]' ? 'bg-amber-400' : 'bg-red-400'} opacity-30`}></div>
          <div
            className={`relative w-48 h-48 sm:w-64 sm:h-64 rounded-full flex items-center justify-center transition-all transform hover:scale-105 bg-gradient-to-br ${gradient} shadow-2xl`}
            style={{
              boxShadow: gradient === 'from-[#fbbf24] via-[#f97316] to-[#ef4444]'
                ? '0 15px 50px rgba(245, 158, 11, 0.4)'
                : '0 15px 50px rgba(239, 68, 68, 0.4)'
            }}
          >
            {agentState === 'connecting' ? (
              <>
                <span className="absolute h-40 w-40 rounded-full border border-white/35 animate-ping" />
                <Loader2 size={64} className="relative text-white sm:w-20 sm:h-20 animate-spin" strokeWidth={1.5} />
              </>
            ) : (
              <>
                <span className="absolute h-40 w-40 rounded-full border border-white/35 animate-ping" />
                <Headphones size={64} className="relative text-white sm:w-20 sm:h-20" strokeWidth={1.5} />
              </>
            )}
          </div>
        </button>
      </div>

      <div className="text-slate-600 text-sm sm:text-base px-4">
        {getStateText(agentState)}
      </div>
    </>
  );
}

function ActiveStateHindi({
  onDisconnect,
  language,
  onLanguageChange,
  callState,
}: {
  onDisconnect: () => void;
  language: Language;
  onLanguageChange: (value: Language) => void;
  callState: CallState;
}) {
  const gradient = callState === 'connecting'
    ? 'from-[#fbbf24] via-[#f97316] to-[#ef4444]'
    : 'from-[#ef4444] via-[#dc2626] to-[#7f1d1d]';

  return (
    <>
      <LanguageSelector language={language} onChange={onLanguageChange} disabled={true} />

      <div className="flex justify-center mb-6 sm:mb-8">
        <button
          onClick={onDisconnect}
          className="group relative active:scale-95 transition-transform"
        >
          <div className={`absolute inset-0 rounded-full blur-xl sm:blur-2xl transition-opacity ${callState === 'connecting' ? 'bg-amber-400' : 'bg-red-400'} opacity-30`}></div>
          <div
            className={`relative w-48 h-48 sm:w-64 sm:h-64 rounded-full flex items-center justify-center transition-all transform hover:scale-105 bg-gradient-to-br ${gradient} shadow-2xl`}
            style={{
              boxShadow: callState === 'connecting'
                ? '0 15px 50px rgba(245, 158, 11, 0.4)'
                : '0 15px 50px rgba(239, 68, 68, 0.4)'
            }}
          >
            {callState === 'connecting' ? (
              <>
                <span className="absolute h-40 w-40 rounded-full border border-white/35 animate-ping" />
                <Loader2 size={64} className="relative text-white sm:w-20 sm:h-20 animate-spin" strokeWidth={1.5} />
              </>
            ) : (
              <>
                <span className="absolute h-40 w-40 rounded-full border border-white/35 animate-ping" />
                <Headphones size={64} className="relative text-white sm:w-20 sm:h-20" strokeWidth={1.5} />
              </>
            )}
          </div>
        </button>
      </div>

      <div className="text-slate-600 text-sm sm:text-base px-4">
        {callState === 'connecting' ? 'Connecting...' : 'Connected - Speak now'}
      </div>
    </>
  );
}

function getOrbGradient(state: AgentState) {
  switch (state) {
    case 'connecting':
      return 'from-[#fbbf24] via-[#f97316] to-[#ef4444]';
    case 'listening':
    case 'speaking':
    case 'thinking':
      return 'from-[#ef4444] via-[#dc2626] to-[#7f1d1d]';
    default:
      return 'from-[#ef4444] via-[#dc2626] to-[#7f1d1d]';
  }
}

function getStateText(state: AgentState) {
  switch (state) {
    case 'connecting':
      return 'Connecting to agent...';
    case 'listening':
      return 'Listening...';
    case 'speaking':
      return 'Agent is speaking...';
    case 'thinking':
      return 'Agent is thinking...';
    default:
      return 'Connected';
  }
}

export default App;
