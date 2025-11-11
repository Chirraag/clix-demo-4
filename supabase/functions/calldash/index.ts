import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ULTRAVOX_API_KEY = 'e4EbV5aX.t6q7lyOtbphcLZS9zAtSMrrSDR0P2UwQ';
const ULTRAVOX_API_BASE_URL = 'https://api.ultravox.ai/api';
const HINDI_AGENT_ID = 'ad69ddb2-363f-4279-adf4-5961f127ec2f';

const LIVEKIT_API_KEY = 'APIrnvUvfrWt8E6';
const LIVEKIT_API_SECRET = '1GszXTXxjfCqAm9emwPeDvsdYZ6mVmudLpvoMLNHjrrA';
const LIVEKIT_URL = 'wss://pipe-9i8t5pt2.livekit.cloud';
const ENGLISH_AGENT_ID = '1fzxSZCTgdiUk9R5ly151';

const HINDI_SYSTEM_PROMPT = `
### **1. Opening & Verification**

**Agent:**
"Namaste **Avinash ji**, main *Arjun* bol raha hoon **Clix Capital** se. Aap kaise hain?"

*(If someone else picks up)*
"Namaste, kya main **Avinash ji** se baat kar sakta hoon?
Main Clix Capital se Arjun bol raha hoon."

---

### **2. Purpose of Call**

**Agent:**
"Avinash ji, yeh call **LAP (Loan Against Property)** product ke update aur **fresh customer enquiries** capture karne ke liye hai."

---

### **3. Short Product Reminder**

**Agent:**
"Sir, **Clix LAP loans** business ya personal funding ke liye available hain.
Interest **approximately 12% se 18%** tak hota hai profile ke hisaab se.
Aur **DSA payout** generally **1.25% se 1.50%** tak milta hai."

*(Say lightly, without push.)*

---

### **4. Lead Collection Question**

**Agent:**
"Avinash ji, filhaal aapke paas **koi customer enquiry** hai kya jise aap **LAP** mein refer karna chahenge?"

---

## ✅ **IF AVINASH SAYS "Haan hai" → LEAD CAPTURE MODE**

**Agent:**
"Bahut accha Sir, main note kar raha hoon."

Ask one-by-one, calmly:

1. "Customer ka **poora naam** kya hai, Sir?"
2. "Unka **mobile number** please?"
3. "Approx **loan requirement** kitna hoga?"
4. "Property / customer **kahan ka hai**?"
5. "Aap chahte hain **SM abhi contact kare** ya aap batayenge jab call karna ho?"

**Agent Confirmation:**
"Perfect Sir, main is enquiry ko **aapke mapped SM** ko forward kar deta hoon.
Aapko update mil jayega."

---

## ❌ **IF AVINASH SAYS "Aaj koi enquiry nahi hai"**

**Agent:**
"Koi baat nahi Avinash ji. Jab enquiry aaye, bas mujhe bata dena.
Main har week **ek short follow-up** kar lunga. 👍"

---

## 🕒 **IF AVINASH SAYS "Busy hoon" / "Call later"**

**Agent (Soft & Respectful):**
"Bilkul Avinash ji, koi tension nahi.
Aap boliye **aapka suitable time** kaunsa hoga?
Main **exact ussi time** pe call kar lunga."

→ Schedule callback → End politely.

---

## 😐 **IF AVINASH SOUNDS IRRITATED**

**Agent (Calm & Soft):**
"Bilkul samajh raha hoon Avinash ji, main aapka time respect karta hoon.
Chaliye, aaj ke liye main disturb nahi karta.
Bas aap bata dein **kab** connect karna theek rahega, main wahi time call kar lunga."

---

### **5. Closing**

**Agent:**
"Thank you **Avinash ji**.
Aapka din shubh ho.
Main phir connect karta hoon. **Dhanyavaad.**"

---

# ⭐ Agent Behavioral Rules (Stay Consistent)

* Speak **slow and friendly**.
* Pause after every question.
* Never oversell.
* Name usage should feel natural — **not forced**.
* If Avinash gives short replies → **shorten your replies** too.
`;

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
    const { language } = await req.json();
    
    if (language === 'english') {
      return await handleEnglishAgent();
    } else {
      return await handleHindiAgent();
    }
  } catch (error) {
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

async function handleEnglishAgent() {
  try {
    const participantIdentity = `voice_assistant_user_${Math.floor(Math.random() * 10_000)}`;
    const roomName = `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`;
    const agentName = 'calldash-agent';

    // Create a server token for API authentication
    const serverToken = await createServerToken();

    // First, create the dispatch to ensure agent will join the room
    const dispatchUrl = `https://pipe-9i8t5pt2.livekit.cloud/twirp/livekit.AgentDispatchService/CreateDispatch`;

    const dispatchPayload = {
      room: roomName,
      agent_name: agentName,
      metadata: JSON.stringify({
        agent_id: ENGLISH_AGENT_ID,
      }),
    };

    const dispatchResponse = await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serverToken}`,
      },
      body: JSON.stringify(dispatchPayload),
    });

    if (!dispatchResponse.ok) {
      const errorText = await dispatchResponse.text();
      console.error('Dispatch failed:', errorText);
      throw new Error(`Failed to dispatch agent: ${errorText}`);
    }

    const dispatchData = await dispatchResponse.json();
    console.log('Dispatch created:', dispatchData);

    // Now create the participant token
    const participantToken = await createLiveKitToken(
      {
        identity: participantIdentity,
        name: 'User',
        metadata: 'user-metadata',
        attributes: {
          agentId: ENGLISH_AGENT_ID,
        },
      },
      roomName
    );

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
    console.error('English agent error:', error);
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
}

async function handleHindiAgent() {
  try {
    const response = await fetch(`${ULTRAVOX_API_BASE_URL}/calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': ULTRAVOX_API_KEY,
      },
      body: JSON.stringify({
        systemPrompt: HINDI_SYSTEM_PROMPT,
        initialOutputMedium: 'MESSAGE_MEDIUM_VOICE',
        languageHint: 'hi-IN',
        recordingEnabled: true,
        selectedTools: [],
        voice: HINDI_AGENT_ID,
        medium: {
          serverWebSocket: {
            inputSampleRate: 48000,
            outputSampleRate: 48000,
          }
        }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return new Response(
        JSON.stringify({ error: `Failed to create call: ${error}` }),
        {
          status: response.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const data = await response.json();
    
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
}

async function createLiveKitToken(
  userInfo: { identity: string; name: string; metadata: string; attributes?: Record<string, string> },
  roomName: string
): Promise<string> {
  const encoder = new TextEncoder();

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 900; // 15 minutes

  const payload: any = {
    exp: exp,
    iss: LIVEKIT_API_KEY,
    nbf: now,
    sub: userInfo.identity,
    name: userInfo.name,
    metadata: userInfo.metadata,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    }
  };

  // Add attributes if provided (like the reference code)
  if (userInfo.attributes) {
    payload.attributes = userInfo.attributes;
  }

  const base64url = (input: Uint8Array): string => {
    const base64 = btoa(String.fromCharCode(...input));
    return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  };

  const headerB64 = base64url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64url(encoder.encode(JSON.stringify(payload)));
  const message = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(LIVEKIT_API_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  );

  const signatureB64 = base64url(new Uint8Array(signature));

  return `${message}.${signatureB64}`;
}

async function createServerToken(): Promise<string> {
  const encoder = new TextEncoder();

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1 hour

  const payload = {
    exp: exp,
    iss: LIVEKIT_API_KEY,
    nbf: now,
    video: {
      roomCreate: true,
      roomList: true,
      roomRecord: true,
      roomAdmin: true,
      agentDispatch: true,
      room: '*',
    }
  };

  const base64url = (input: Uint8Array): string => {
    const base64 = btoa(String.fromCharCode(...input));
    return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  };

  const headerB64 = base64url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64url(encoder.encode(JSON.stringify(payload)));
  const message = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(LIVEKIT_API_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  );

  const signatureB64 = base64url(new Uint8Array(signature));

  return `${message}.${signatureB64}`;
}