import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ULTRAVOX_API_KEY = 'e4EbV5aX.t6q7lyOtbphcLZS9zAtSMrrSDR0P2UwQ';
const API_BASE_URL = 'https://api.ultravox.ai/api';

const SYSTEM_PROMPT = `
Understood. I will **remove repetitive use of the DSA’s name** and use it **only once at the start**, then switch to **"Sir"** or **second-person references** naturally.

Here is your **cleaned, non-repetitive** final version:

---

# 🎙️ **DSA Voice Bot – Hinglish Call Flow (No Name Repetition)**

### **System Rule (Add to Prompt)**

> Use the DSA's name **only once at the beginning** to establish connection.
> After that, refer to them as **"Sir"**.
> Do **not** repeat the name again during the call unless:
>
> * You are closing the call, or
> * They specifically ask you to.

---

### **1. Opening & Verification**

**Agent:**
"Namaste Avinash ji, main *Arjun* bol raha hoon **Clix Capital** se. Aap kaise hain?"

*(If someone else picks up)*
"Namaste, kya main Avinash ji se baat kar sakta hoon?
Main Clix Capital se Arjun bol raha hoon."

---

### **2. Purpose of Call**

**Agent:**
"Sir, yeh call **LAP (Loan Against Property)** product ke update aur **fresh customer enquiries** capture karne ke liye hai."

---

### **3. Short Product Reminder**

**Agent:**
"**Clix LAP loans** business ya personal funding ke liye available hote hain.
Interest **approx 12% se 18%** hota hai profile ke hisaab se.
Aur **DSA payout** generally **1.25% se 1.50%** hota hai."

(Keep tone light and natural.)

---

### **4. Lead Collection Question**

**Agent:**
"Kya aapke paas abhi **koi customer enquiry** hai LAP ke liye?"

---

## ✅ **If “Yes” → Lead Capture**

**Agent:**
"Great Sir, main details note kar leta hoon."

Ask calmly, one by one:

1. "Customer ka **poora naam** kya hai?"
2. "Unka **mobile number** please?"
3. "Approx **loan requirement** kitni hogi?"
4. "Customer / property **kaunsa area** hai?"
5. "Aap chahte hain **SM seedha contact kare**, ya aap pehle batayenge?"

**Agent (Confirm):**
"Noted Sir, main is enquiry ko **aapke mapped SM** ko forward kar deta hoon.
Aapko progress update milta rahega."

---

## ❌ **If “No lead right now”**

**Agent:**
"Koi baat nahi Sir. Jab enquiry aaye to bas bata dena.
Main haftay mein ek chhota follow-up kar loonga."

---

## 🕒 **If “Busy / Call later”**

**Agent (Soft):**
"Bilkul Sir. Aap batayein **kaunsa time** theek rahega?
Main **ussi waqt** call kar loonga."

→ Schedule callback.

---

## 😐 **If Irritated**

**Agent (Calm):**
"Koi tension nahi Sir.
Aap bata dein **kab** connect karna theek rahega — main wahi time call kar loonga."

---

### **5. Closing**

**Agent:**
"Thank you Sir.
Aapka din shubh ho.
Main phir connect karta hoon."

---

# ⭐ Behavioral Rules

* Speak **slow & friendly**
* Do **not** repeat phrases
* Do **not** repeat the name
* If the DSA replies short → you also **keep responses short**
* Always pause after questions

---

## Would you like me to now:

A) Convert this into **English-only** version
B) Create **High Accuracy NLU Intents + Sample Training Utterances**
C) Convert to **JSON / Retell Agent Format** for direct upload

Reply with **A, B, or C**.
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
    const response = await fetch(`${API_BASE_URL}/calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': ULTRAVOX_API_KEY,
      },
      body: JSON.stringify({
        systemPrompt: SYSTEM_PROMPT,
        initialOutputMedium: 'MESSAGE_MEDIUM_VOICE',
        languageHint: 'hi-IN',
        recordingEnabled: true,
        selectedTools: [],
        voice: 'ad69ddb2-363f-4279-adf4-5961f127ec2f',
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
});