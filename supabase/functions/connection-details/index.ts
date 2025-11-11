import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { AccessToken, AgentDispatchClient } from "npm:livekit-server-sdk@2.7.2";

const LIVEKIT_API_KEY = 'APIrnvUvfrWt8E6';
const LIVEKIT_API_SECRET = '1GszXTXxjfCqAm9emwPeDvsdYZ6mVmudLpvoMLNHjrrA';
const LIVEKIT_URL = 'wss://pipe-9i8t5pt2.livekit.cloud';
const ENGLISH_AGENT_ID = '1fzxSZCTgdiUk9R5ly151';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const participantIdentity = `voice_assistant_user_${Math.floor(Math.random() * 10_000)}`;
    const roomName = `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`;
    const agentName = 'calldash-agent';

    const agentDispatchClient = new AgentDispatchClient(
      LIVEKIT_URL,
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET
    );

    const dispatchOptions = {
      metadata: JSON.stringify({
        agent_id: ENGLISH_AGENT_ID,
      }),
    };

    const dispatch = await agentDispatchClient.createDispatch(
      roomName,
      agentName,
      dispatchOptions
    );
    console.log('Dispatch created:', dispatch);

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantIdentity,
      name: 'User',
      ttl: '15m',
      attributes: {
        agentId: ENGLISH_AGENT_ID,
      },
      metadata: 'user-metadata',
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    });

    const participantToken = await at.toJwt();

    const data = {
      serverUrl: LIVEKIT_URL,
      roomName: roomName,
      participantToken: participantToken,
      participantName: participantIdentity,
      callId: roomName,
      joinUrl: LIVEKIT_URL,
    };

    return new Response(
      JSON.stringify(data),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});