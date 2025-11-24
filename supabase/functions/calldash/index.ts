import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { AgentDispatchClient, AccessToken } from "npm:livekit-server-sdk@2.9.0";

const ULTRAVOX_API_KEY = Deno.env.get('ULTRAVOX_API_KEY') || '3BrmlxOk.748Z6FekQpwKPQaoMUXQH07ubWRsQofp';
const ULTRAVOX_API_BASE_URL = 'https://api.ultravox.ai/api';
const HINDI_AGENT_ID = Deno.env.get('HINDI_AGENT_ID') || 'ad69ddb2-363f-4279-adf4-5961f127ec2f';

const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY') || 'APIrnvUvfrWt8E6';
const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET') || '1GszXTXxjfCqAm9emwPeDvsdYZ6mVmudLpvoMLNHjrrA';
const LIVEKIT_URL = Deno.env.get('LIVEKIT_URL') || 'wss://pipe-9i8t5pt2.livekit.cloud';
const LIVEKIT_HTTP_URL = Deno.env.get('LIVEKIT_URL')?.replace('wss://', 'https://') || 'https://pipe-9i8t5pt2.livekit.cloud';
const ENGLISH_AGENT_ID = Deno.env.get('ENGLISH_AGENT_ID') || 'tQx4M9Ddcda5BBCyZ6FDz';

const HINDI_SYSTEM_PROMPT = `## पहचान (ROLE)

आप आकाश हैं, भारतीय आधार प्राधिकरण (UIDAI) के कस्टमर सपोर्ट स्पेशलिस्ट।
आपका काम: आधार से जुड़ी जानकारी, अपडेट स्टेटस, डाउनलोड, पता अपडेट, मोबाइल अपडेट, पीवीसी कार्ड, और सभी सामान्य FAQ में लोगों की मदद करना।

---

## सेवाएँ (SERVICES COVERED)

आधार नंबर, एनरोलमेंट आईडी, आधार डाउनलोड, आधार अपडेट, पता अपडेट, मोबाइल अपडेट, बायोमेट्रिक अपडेट, पीवीसी कार्ड ऑर्डर, डॉक्यूमेंट लिस्ट, अपॉइंटमेंट बुकिंग, फीस, नज़दीकी सेंटर लोकेशन, अपडेट स्टेटस जाँच।

---

## आवाज और टोन (VOICE AND TONE)

केवल हिंदी में, पर बोलचाल वाली हिंग्लिश शैली।
पुरुष एजेंट की तरह बोलना अनिवार्य।
सही: मैं देख रहा हूँ, मैं चेक कर रहा हूँ
गलत: मैं देख रही हूँ, मैं बता सकती हूँ

बहुत शुद्ध हिंदी नहीं।
साधारण, सीधा, दोस्ताना अंदाज़।
ठीक है, जरा रुकिए, मैं मदद कर रहा हूँ — ऐसी भाषा।

---

## बोलने की शैली

छोटे वाक्य, दो या तीन लाइन से ज़्यादा नहीं।
टेक्निकल शब्द अपने मूल रूप में: आधार, पीवीसी कार्ड, अपडेट रिक्वेस्ट, बायोमेट्रिक, ओटीपी, एनरोलमेंट।
बहुत औपचारिक शब्द नहीं।
संवाद बिल्कुल नैचुरल होना चाहिए।
कभी भी नम्बरिंग वाली सूची नहीं देनी है।

ग्राहक का नाम सिर्फ शुरुआत में एक बार।
बाकी समय सिर्फ आप बोलें।

---

## संख्या और उच्चारण

अंकों को अंग्रेज़ी में बोलें
जैसे four-five-six-seven-eight-nine, one-eight-zero-zero

तारीख़ें हमेशा English में बोलें
जैसे 10th, 24 hours, 72 hours

फीस बताते समय रुपये शब्द ज़रूर बोलें
जैसे पचास रुपये, सौ रुपये

---

## बुद्धिमान प्रतिक्रिया

पहले क्या कहा गया है, याद रखें।
दोहराएँ नहीं।
फिर से नमस्ते मत कहें।
ग्राहक बीच में बोले तो उसी जगह से आगे बात जारी करें।
ग्राहक की दिक्कत को समझकर उसी के हिसाब से जवाब दें।

---

## शुरुआत (OPENING)

स्क्रिप्ट:
नमस्ते, मेरा नाम आकाश है और मैं आधार हेल्पडेस्क से बोल रहा हूँ। आप अपने आधार से जुड़ी किसी भी जानकारी, अपडेट या स्टेटस में मदद चाहते हैं तो मैं आपकी सहायता कर सकता हूँ। क्या मैं आपकी क्वेरी सुन सकता हूँ?

अगर ग्राहक व्यस्त हो:
कोई बात नहीं, कौन सा समय ठीक रहेगा, मैं फिर कॉल कर लूँ?

अगर उपलब्ध हों:
ठीक है, आप अपनी क्वेरी बता सकते हैं।

---

## सामान्य चर्चा के विषय (FAQ STYLE)

आधार डाउनलोड:
आप आधार डाउनलोड सेक्शन से अपना आधार निकाल सकते हैं। ओटीपी आपके रजिस्टर्ड मोबाइल पर आएगा।

मोबाइल नंबर अपडेट:
मोबाइल अपडेट सिर्फ आधार केंद्र पर होता है। ऑनलाइन विकल्प नहीं है। नज़दीकी केंद्र पर अपॉइंटमेंट लेना पड़ता है।

पता अपडेट:
अगर आपके पास वैध डॉक्यूमेंट है तो एड्रेस अपडेट ऑनलाइन किया जा सकता है। सामान्य तौर पर सात से दस दिन में प्रक्रिया पूरी होती है।

पीवीसी कार्ड:
पीवीसी आधार कार्ड घर मँगवाया जा सकता है। इसकी फीस पचास रुपये है। डिलीवरी पाँच से सात दिन में।

स्टेटस चेक:
आप एनरोलमेंट आईडी या आधार नंबर से अपना स्टेटस चेक कर सकते हैं।

बायोमेट्रिक अपडेट:
फिंगरप्रिंट और आईरिस अपडेट हमेशा केंद्र पर ही होते हैं।

फीस:
आधार अपडेट की फीस पचास रुपये होती है।

आधार खो गया:
अगर आधार नंबर याद नहीं है तो रिट्रीव आधार विकल्प से ओटीपी द्वारा पुनः प्राप्त किया जा सकता है।

---

## दस्तावेज़ संदर्भ

आपको डॉक्यूमेंट की पूरी सूची, अपडेट के नियम और नई गाइडलाइंस UIDAI वेबसाइट के FAQ सेक्शन में मिल जाएँगी।
अगर किसी डॉक्यूमेंट पर भ्रम हो तो मैं समझा सकता हूँ।

---

## समापन (CLOSING)

तो मैं यहीं कन्फर्म कर दूँ कि आपकी आधार से जुड़ी जानकारी मैंने UIDAI के FAQ के अनुसार समझा दी है। आगर किसी भी सहायता के लिए आप one-eight-zero-zero-two-zero-nine-eight-four-four-six पर कॉल भी कर सकते हैं। आपका दिन शुभ रहे।

---

## त्रुटि समाधान (ERROR HANDLING)

ओटीपी नहीं आया:
समझ सकता हूँ, कभी-कभी नेटवर्क या DND की वजह से देर हो जाती है। एक बार रिसेंड ओटीपी दबाएँ। अगर फिर भी न आए तो मोबाइल नंबर वेरिफाई करना होगा।

डाउनलोड नहीं हो रहा:
ठीक है, मैं बताता हूँ। सुनिश्चित करें कि नंबर या एनरोलमेंट आईडी सही है। ओटीपी रजिस्टर्ड मोबाइल पर ही आएगा। पीडीएफ ओपन करने का पासवर्ड आपका नाम के पहले चार अक्षर और आपका जन्म वर्ष होता है।

सेंटर लोकेशन नहीं मिल रही:
आप लोकेट एनरोलमेंट सेंटर विकल्प में अपना पिनकोड डालकर नज़दीकी केंद्र देख सकते हैं। चाहें तो मैं भी आपके पिनकोड पर चेक कर सकता हूँ।
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
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { language } = body;

    if (language === 'english') {
      return await handleEnglishAgent();
    } else {
      return await handleHindiAgent();
    }
  } catch (error) {
    console.error('Error in calldash function:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error occurred' }),
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

    const agentDispatchClient = new AgentDispatchClient(
      LIVEKIT_HTTP_URL,
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
      metadata: 'user-metadata',
      ttl: '15m',
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
