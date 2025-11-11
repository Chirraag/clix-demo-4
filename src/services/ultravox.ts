import { Room } from 'livekit-client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export type Language = 'hindi' | 'english';

interface CallResponse {
  callId: string;
  joinUrl: string;
  participantToken?: string;
  serverUrl?: string;
  roomName?: string;
}

let livekitRoom: Room | null = null;

export async function createCall(language: Language): Promise<CallResponse> {
  const apiUrl = `${SUPABASE_URL}/functions/v1/calldash`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ language }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create call: ${error}`);
  }

  const data = await response.json();
  return {
    callId: data.callId,
    joinUrl: data.joinUrl,
  };
}

export function connectWebSocket(joinUrl: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(joinUrl);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      console.log('WebSocket connected');
      resolve(ws);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      reject(error);
    };
  });
}

export async function connectLiveKit(
  callData: CallResponse,
  callbacks: {
    onStateChange: (state: 'connected' | 'disconnected') => void;
    onDisconnect: () => void;
    onError: (error: Error) => void;
  }
): Promise<void> {
  try {
    if (!callData.serverUrl || !callData.participantToken) {
      throw new Error('Missing LiveKit connection details');
    }

    livekitRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    livekitRoom.on('disconnected', () => {
      callbacks.onDisconnect();
    });

    livekitRoom.on('connectionStateChanged', (state) => {
      console.log('LiveKit connection state:', state);
    });

    await livekitRoom.connect(callData.serverUrl, callData.participantToken, {
      autoSubscribe: true,
    });

    await livekitRoom.localParticipant.setMicrophoneEnabled(true);

    callbacks.onStateChange('connected');
    console.log('LiveKit connected successfully');
  } catch (error) {
    console.error('LiveKit connection error:', error);
    callbacks.onError(error as Error);
    throw error;
  }
}

export function disconnectLiveKit(): void {
  if (livekitRoom) {
    livekitRoom.disconnect();
    livekitRoom = null;
  }
}
