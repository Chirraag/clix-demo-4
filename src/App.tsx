import { useState, useRef, useEffect } from 'react';
import { Headphones, Globe } from 'lucide-react';
import { createCall, connectWebSocket } from './services/ultravox';

type CallState = 'idle' | 'connecting' | 'connected' | 'disconnected';

function App() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioWorkletRef = useRef<AudioWorkletNode | null>(null);
  const audioQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);


  const startCall = async () => {
    try {
      setCallState('connecting');
      setError(null);

      const callData = await createCall();

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

      const ws = await connectWebSocket(callData.joinUrl);
      wsRef.current = ws;

      const sendAudio = () => {
        audioWorklet.port.onmessage = (event) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        };
      };

      sendAudio();

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
        setCallState('disconnected');
        disconnect();
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setError('Connection error occurred');
        disconnect();
      };

      source.connect(audioWorklet);
      audioWorklet.connect(audioContext.destination);

      setCallState('connected');
    } catch (err) {
      console.error('Failed to start call:', err);
      setError(err instanceof Error ? err.message : 'Failed to start call');
      setCallState('idle');
      disconnect();
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

  const disconnect = () => {
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

    setCallState('idle');
  };

  const toggleCall = () => {
    if (callState === 'idle') {
      startCall();
    } else {
      disconnect();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Header with Logo */}
      <header className="w-full py-4 sm:py-8">
        <div className="container mx-auto px-4 flex justify-center">
          <img
            src="https://www.clix.capital/wp-content/themes/clix/assets/resources/img/Logo.png"
            alt="CLIX Capital"
            className="h-8 sm:h-12"
          />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="max-w-md w-full text-center">
          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold mb-8 sm:mb-12 tracking-wider" style={{ color: '#E91E63' }}>
            VOICE DEMO
          </h1>

          {/* Language Display */}
          <div className="mb-8 sm:mb-12 flex justify-center">
            <div className="bg-white border border-slate-300 rounded-full px-6 sm:px-8 py-2.5 sm:py-3 shadow-sm flex items-center gap-2.5 sm:gap-3">
              <Globe size={18} className="text-slate-600 sm:w-5 sm:h-5" />
              <span className="text-slate-700 font-medium text-sm sm:text-base">Hindi</span>
            </div>
          </div>

          {/* Call Button */}
          <div className="flex justify-center mb-6 sm:mb-8">
            <button
              onClick={toggleCall}
              disabled={callState === 'connecting'}
              className="group relative active:scale-95 transition-transform"
            >
              <div
                className={`absolute inset-0 rounded-full blur-xl sm:blur-2xl transition-opacity ${
                  callState === 'connected' ? 'bg-red-400 opacity-30' : 'bg-emerald-400 opacity-30'
                }`}
              ></div>
              <div
                className={`relative w-48 h-48 sm:w-64 sm:h-64 rounded-full flex items-center justify-center transition-all transform hover:scale-105 ${
                  callState === 'connected'
                    ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-2xl'
                    : callState === 'connecting'
                    ? 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-2xl animate-pulse'
                    : 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-2xl'
                }`}
                style={{
                  boxShadow: callState === 'connected'
                    ? '0 15px 50px rgba(239, 68, 68, 0.4)'
                    : callState === 'connecting'
                    ? '0 15px 50px rgba(245, 158, 11, 0.4)'
                    : '0 15px 50px rgba(16, 185, 129, 0.4)'
                }}
              >
                <Headphones size={64} className="text-white sm:w-20 sm:h-20" strokeWidth={1.5} />
              </div>
            </button>
          </div>

          {/* Status Text */}
          <div className="text-slate-600 text-sm sm:text-base px-4">
            {callState === 'idle' && 'Click to start voice call'}
            {callState === 'connecting' && 'Connecting...'}
            {callState === 'connected' && 'Connected - Speak now'}
            {callState === 'disconnected' && 'Call ended'}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 sm:mt-6 mx-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-xs sm:text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
