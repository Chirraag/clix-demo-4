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

export async function createCall(language: Language): Promise<CallResponse> {
  const apiUrl = `${SUPABASE_URL}/functions/v1/calldash`;

  console.log('Creating call with:', { language, apiUrl });

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ language }),
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('Error response:', error);
      throw new Error(`Failed to create call: ${error}`);
    }

    const data = await response.json();
    console.log('Call data received:', data);
    return {
      callId: data.callId,
      joinUrl: data.joinUrl,
      participantToken: data.participantToken,
      serverUrl: data.serverUrl,
      roomName: data.roomName,
    };
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
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
