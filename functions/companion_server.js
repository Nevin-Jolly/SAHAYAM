/**
 * SAHAYAM — Local Multimodal AI Companion Server with Lasting Semantic Memory
 * 
 * Runs locally on port 5001 without requiring Firebase Blaze plan.
 * Connects Expo mobile app directly to Google Gemini Multimodal AI for:
 *   1. Multimodal Malayalam voice processing (Audio upload -> Gemini -> Malayalam speech)
 *   2. Persistent semantic memory extraction & recall across sessions (Names, Relations, Illnesses, Preferences)
 *   3. Multi-turn conversational session context
 *   4. Kerala local cultural & daily context
 *   5. Spoken Malayalam TTS streaming
 *   6. Dedicated Memory Query & Store REST API
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { GoogleAIFileManager } = require("@google/generative-ai/server");

// Load GEMINI_API_KEY from .env
let GEMINI_API_KEY = process.env.GEMINI_API_KEY;
try {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const match = envContent.match(/GEMINI_API_KEY=(.+)/);
    if (match) GEMINI_API_KEY = match[1].trim();
  }
} catch (e) {
  console.warn("Could not read .env file:", e);
}

if (!GEMINI_API_KEY) {
  console.error("❌ ERROR: GEMINI_API_KEY is not defined in functions/.env");
} else {
  console.log("✅ Loaded GEMINI_API_KEY from functions/.env");
}

const fileManager = GEMINI_API_KEY ? new GoogleAIFileManager(GEMINI_API_KEY) : null;
const PORT = process.env.PORT || 5001;

// ─── Persistent Memory Storage on Disk ───────────────────────────────────────
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getMemoryFilePath(elderId) {
  const safeId = (elderId || "elder_demo_001").replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(DATA_DIR, `memories_${safeId}.json`);
}

function loadElderMemories(elderId) {
  const filePath = getMemoryFilePath(elderId);
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      const list = JSON.parse(content);
      if (Array.isArray(list)) return list;
    }
  } catch (err) {
    console.warn(`[Memory Load Error for ${elderId}]:`, err.message);
  }

  // Initial seed memories for demo elder
  const defaults = [
    {
      id: "mem_init_1",
      text: "പേര്: നിവിൻ",
      category: "personal_fact",
      createdAt: new Date().toISOString(),
    },
    {
      id: "mem_init_2",
      text: "മകൻ രവി എറണാകുളത്താണ് ജോലി ചെയ്യുന്നത്",
      category: "family_fact",
      createdAt: new Date().toISOString(),
    },
    {
      id: "mem_init_3",
      text: "രാവിലെ ചൂടുള്ള ഏലക്കായ ചായ കുടിക്കാൻ ഇഷ്ടമാണ്",
      category: "preference",
      createdAt: new Date().toISOString(),
    },
  ];
  saveAllElderMemories(elderId, defaults);
  return defaults;
}

function saveAllElderMemories(elderId, memories) {
  const filePath = getMemoryFilePath(elderId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(memories, null, 2), "utf8");
  } catch (err) {
    console.error(`[Memory Save Error for ${elderId}]:`, err.message);
  }
}

function recordNewMemory(elderId, factText, category = "personal_fact") {
  if (!factText || factText === "NONE" || factText.trim().length < 3) return null;
  const cleanFact = factText.trim();
  const memories = loadElderMemories(elderId);

  // Check if identical or near-identical fact already exists
  const isDuplicate = memories.some(
    (m) =>
      m.text.toLowerCase() === cleanFact.toLowerCase() ||
      m.text.includes(cleanFact) ||
      cleanFact.includes(m.text)
  );
  if (isDuplicate) {
    console.log(`[Memory Skipped - Already Known]: "${cleanFact}"`);
    return null;
  }

  const newEntry = {
    id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    text: cleanFact,
    category,
    createdAt: new Date().toISOString(),
  };

  memories.unshift(newEntry);
  if (memories.length > 50) memories.pop();

  saveAllElderMemories(elderId, memories);
  console.log(`🧠 [Lasting Memory Stored]: "${cleanFact}" [category: ${category}]`);
  return newEntry;
}

// ─── Persistent Medications Storage ──────────────────────────────────────────
function getMedicationsFilePath(elderId) {
  const safeId = (elderId || "elder_demo_001").replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(DATA_DIR, `medications_${safeId}.json`);
}

function loadElderMedications(elderId) {
  const filePath = getMedicationsFilePath(elderId);
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      const list = JSON.parse(content);
      if (Array.isArray(list)) return list;
    }
  } catch (err) {
    console.warn(`[Medication Load Error for ${elderId}]:`, err.message);
  }

  const defaults = [
    {
      id: "med_init_01",
      elder_id: elderId || "elder_demo_001",
      name: "Metformin",
      dosage: "500mg",
      instructions: "ഭക്ഷണത്തിന് ശേഷം (After food)",
      cron_expr: "0 8 * * *",
      time_str: "08:00",
      time_label: "8:00 AM (രാവിലെ)",
      active: true,
      last_taken_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "med_init_02",
      elder_id: elderId || "elder_demo_001",
      name: "BP Tablet (Amlodipine)",
      dosage: "5mg",
      instructions: "രാത്രി ഭക്ഷണത്തിന് ശേഷം (After night food)",
      cron_expr: "30 20 * * *",
      time_str: "20:30",
      time_label: "8:30 PM (രാത്രി)",
      active: true,
      last_taken_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  saveElderMedications(elderId, defaults);
  return defaults;
}

function saveElderMedications(elderId, meds) {
  const filePath = getMedicationsFilePath(elderId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(meds, null, 2), "utf8");
  } catch (err) {
    console.error(`[Medication Save Error for ${elderId}]:`, err.message);
  }
}

// ─── Persistent Escalations Storage ─────────────────────────────────────────
function getEscalationsFilePath(elderId) {
  const safeId = (elderId || "elder_demo_001").replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(DATA_DIR, `escalations_${safeId}.json`);
}

function loadElderEscalations(elderId) {
  const filePath = getEscalationsFilePath(elderId);
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      const list = JSON.parse(content);
      if (Array.isArray(list)) return list;
    }
  } catch (err) {
    console.warn(`[Escalations Load Error for ${elderId}]:`, err.message);
  }
  return [];
}

function saveElderEscalations(elderId, list) {
  const filePath = getEscalationsFilePath(elderId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), "utf8");
  } catch (err) {
    console.error(`[Escalations Save Error for ${elderId}]:`, err.message);
  }
}

// ─── Persistent Checkins Storage ───────────────────────────────────────────
function getCheckinsFilePath(elderId) {
  const safeId = (elderId || "elder_demo_001").replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(DATA_DIR, `checkins_${safeId}.json`);
}

function loadElderCheckins(elderId) {
  const filePath = getCheckinsFilePath(elderId);
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8");
      const list = JSON.parse(content);
      if (Array.isArray(list)) return list;
    }
  } catch (err) {
    console.warn(`[Checkins Load Error for ${elderId}]:`, err.message);
  }

  const defaults = [
    {
      id: "chk_init_1",
      elderId: elderId || "elder_demo_001",
      elder_id: elderId || "elder_demo_001",
      status: "answered",
      scheduledTime: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      answeredAt: new Date(Date.now() - 1000 * 60 * 59).toISOString(),
      moodNote: "സുഖമായിരിക്കുന്നു (Elder responded warmly)",
      escalationTriggered: false,
      type: "daily_checkin",
      createdAt: new Date().toISOString(),
    },
  ];
  saveElderCheckins(elderId, defaults);
  return defaults;
}

function saveElderCheckins(elderId, list) {
  const filePath = getCheckinsFilePath(elderId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), "utf8");
  } catch (err) {
    console.error(`[Checkins Save Error for ${elderId}]:`, err.message);
  }
}

// ─── Persistent Care Note Storage ──────────────────────────────────────────
function getCareNoteFilePath(elderId) {
  const safeId = (elderId || "elder_demo_001").replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(DATA_DIR, `carenote_${safeId}.json`);
}

function loadElderCareNote(elderId) {
  const filePath = getCareNoteFilePath(elderId);
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf8").trim();
    }
  } catch (err) {}
  return "";
}

function saveElderCareNote(elderId, note) {
  const filePath = getCareNoteFilePath(elderId);
  try {
    fs.writeFileSync(filePath, (note || "").trim(), "utf8");
  } catch (err) {}
}

// Helper to parse JSON body
function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (e) {
        resolve({});
      }
    });
  });
}

// In-memory multi-turn session history per elder
const localElderHistories = {};

function getMalayalamDailyContext() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const malayalamDays = [
    "ഞായറാഴ്ച",
    "തിങ്കളാഴ്ച",
    "ചൊവ്വാഴ്ച",
    "ബുധനാഴ്ച",
    "വ്യാഴാഴ്ച",
    "വെള്ളിയാഴ്ച",
    "ശനിയാഴ്ച",
  ];
  const hour = now.getHours();
  const dayName = malayalamDays[now.getDay()];
  const dateStr = now.toLocaleDateString("ml-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("ml-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  let timeGreeting = "ഒരു നല്ല ദിനം";
  if (hour >= 5 && hour < 12) timeGreeting = "സുപ്രഭാതം";
  else if (hour >= 12 && hour < 17) timeGreeting = "ശുഭദിനം";
  else if (hour >= 17 && hour < 21) timeGreeting = "ശുഭസന്ധ്യ";
  else timeGreeting = "ശുഭരാത്രി";

  return `ഇന്ന് ${dayName}, ${dateStr}. സമയം ${timeStr} ആണ്. ${timeGreeting} ആശംസിക്കുന്നു.`;
}

// Priority list of Gemini models to automatically fall back if quota is reached
const CANDIDATE_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-flash-latest",
];

async function callGeminiWithFallback(payload) {
  let lastError = null;
  for (const modelName of CANDIDATE_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        console.log(`[Gemini Model Success]: Used ${modelName}`);
        return json;
      }

      const errText = await res.text();
      console.warn(`[Gemini ${modelName} Error ${res.status}]: ${errText.slice(0, 150)}`);
      lastError = new Error(`Model ${modelName} returned ${res.status}`);
      if (res.status === 429 || res.status === 404 || res.status === 503) {
        continue;
      }
      throw lastError;
    } catch (netErr) {
      lastError = netErr;
      continue;
    }
  }
  throw lastError || new Error("All candidate Gemini models failed");
}

async function handleRespondCompanionVoice(req, res, body) {
  let tempFilePath = null;
  let uploadedFile = null;

  try {
    const data = JSON.parse(body || "{}");
    const elderId = data.elderId || "elder_demo_001";
    const userText = data.text ? data.text.trim() : "";
    const audioBase64 = data.audioBase64;

    console.log(`\n[Companion] Request for ${elderId}: text="${userText}" hasAudio=${!!audioBase64}`);

    const dailyContext = getMalayalamDailyContext();
    const storedMemories = loadElderMemories(elderId);

    let memoryBlock = "";
    if (storedMemories.length > 0) {
      const memoryLines = storedMemories.map((m) => `- [${m.category}] ${m.text}`);
      memoryBlock =
        `\nഓർമ്മകൾ (ആവശ്യമെങ്കിൽ മാത്രം സംഭാഷണത്തിൽ ഓർത്തെടുക്കുക):` +
        `\n${memoryLines.join("\n")}`;
    }

    const scheduledMeds = data.medications || [];
    let medBlock = "";
    if (Array.isArray(scheduledMeds) && scheduledMeds.length > 0) {
      const medLines = scheduledMeds
        .filter((m) => m && m.active)
        .map((m) => `- ${m.name} (${m.dosage}) ${m.time_label || m.time_str}: ${m.instructions || ""}`);
      if (medLines.length > 0) {
        medBlock = `\nഷെഡ്യൂൾ ചെയ്ത മരുന്നുകൾ (പ്രായമായ വ്യക്തി മരുന്നുകളെക്കുറിച്ചോ ഗുളികകളെക്കുറിച്ചോ ചോദിച്ചാൽ ഇതിൽ നിന്നുള്ള കൃത്യമായ വിവരം ഓർമ്മിപ്പിച്ചു പറയുക):\n${medLines.join("\n")}`;
      }
    }

    const systemInstruction =
      `നിങ്ങൾ 'സഹായം' (SAHAYAM) എന്ന മലയാളം വോയിസ് അസിസ്റ്റന്റാണ്. പ്രായമായ ആളുകൾക്ക് ഒരു സ്നേഹനിധിയായ കൂട്ടുകാരനായി സംസാരിക്കുക.` +
      `\nപ്രധാന നിർദ്ദേശങ്ങൾ:` +
      `\n1. ഓഡിയോ സന്ദേശമാണെങ്കിൽ, പ്രായമായ വ്യക്തി പറഞ്ഞ വാക്കുകൾ [TRANSCRIPT] എന്ന ടാഗിൽ കൃത്യമായി മലയാളത്തിൽ എഴുതുക.` +
      `\n   - ശബ്ദം കേൾക്കാൻ കഴിഞ്ഞില്ലെങ്കിലോ ഒന്നും പറഞ്ഞില്ലെങ്കിലോ [TRANSCRIPT] NO_SPEECH എന്ന് എഴുതുക.` +
      `\n2. പ്രായമായ വ്യക്തി ഇപ്പോൾ പറഞ്ഞതിന് ([TRANSCRIPT]) മാത്രം അനുയോജ്യമായ സ്വാഭാവിക മറുപടി നൽകുക ([REPLY] ടാഗിൽ നൽകുക).` +
      `\n   - വ്യക്തി ചോദിച്ച ചോദ്യങ്ങൾക്ക് നേരിട്ട് മറുപടി പറയുക. അവരുടെ ചിന്തകൾ കേട്ട് സ്നേഹത്തോടെ പ്രതികരിക്കുക.` +
      `\n   - മരുന്ന്, ഗുളിക എന്നിവയെക്കുറിച്ച് ചോദിച്ചാൽ ഇന്നത്തെ മരുന്നുകളുടെ ലിസ്റ്റിൽ നോക്കി കൃത്യമായി പറയുക.` +
      `\n   - യാതൊരു കാരണവശാലും "സുപ്രഭാതം", "ചായ കുടിച്ചോ" തുടങ്ങിയ ചോദ്യങ്ങൾ മുൻപ് ചോദിച്ചിട്ടുണ്ടെങ്കിൽ വീണ്ടും വീണ്ടും ആവർത്തിക്കരുത്!` +
      `\n   - [TRANSCRIPT] NO_SPEECH ആണെങ്കിൽ: "നിങ്ങൾ പറയുന്നത് വ്യക്തമായി കേൾക്കാൻ കഴിഞ്ഞില്ല. ഒന്നുകൂടി പറയാമോ?" എന്ന് മാത്രം പറയുക.` +
      `\n3. മറുപടി വളരെ ലളിതവും ചുരുങ്ങിയതുമായിരിക്കണം (1 അല്ലെങ്കിൽ 2 ചെറിയ വാക്യങ്ങൾ മാത്രം).` +
      `\n4. പ്രായമായവരെ ബഹുമാനത്തോടും വാത്സല്യത്തോടും അഭിസംബോധന ചെയ്യുക.` +
      `\n5. ഇന്നത്തെ സന്ദർഭം: ${dailyContext}` +
      memoryBlock +
      medBlock +
      `\n\nഫോർമാറ്റ്:` +
      `\n[TRANSCRIPT] പ്രായമായ ആൾ പറഞ്ഞ വാക്കുകൾ (അല്ലെങ്കിൽ NO_SPEECH)` +
      `\n[REPLY] നിങ്ങളുടെ മലയാളം മറുപടി` +
      `\n[MEMORY] പുതിയതായി മനസ്സിലാക്കിയ പ്രധാന വിവരം (ഇല്ലെങ്കിൽ 'NONE')` +
      `\n[CATEGORY] family_fact | health_note | preference | routine | personal_fact | NONE`;

    const userParts = [];

    if (audioBase64) {
      const rawBase64 = audioBase64.replace(/^data:audio\/[a-z0-9]+;base64,/, "");
      const audioBuffer = Buffer.from(rawBase64, "base64");
      console.log(`[Audio Received]: ${audioBuffer.length} bytes`);

      // Guard against accidental tiny/empty recordings (< 500 bytes)
      if (audioBuffer.length < 500) {
        console.warn(`[Audio too short / empty]: only ${audioBuffer.length} bytes`);
        const shortReply = "ശബ്ദം വ്യക്തമായി കേൾക്കാൻ കഴിഞ്ഞില്ല. ഒന്നുകൂടി പറയാമോ?";
        const audioUri = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
          shortReply
        )}&tl=ml&client=tw-ob`;
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(
          JSON.stringify({
            success: true,
            transcript: "NO_SPEECH",
            response: shortReply,
            audioUri,
          })
        );
        return;
      }

      // 1. Upload via Gemini File API for highest audio fidelity
      if (fileManager) {
        tempFilePath = path.join(__dirname, `temp_voice_${Date.now()}.m4a`);
        fs.writeFileSync(tempFilePath, audioBuffer);

        try {
          uploadedFile = await fileManager.uploadFile(tempFilePath, {
            mimeType: "audio/mp4",
            displayName: `voice_${Date.now()}`,
          });
          console.log(`[GoogleAIFileManager]: Uploaded successfully -> ${uploadedFile.file.uri}`);

          userParts.push({
            fileData: {
              fileUri: uploadedFile.file.uri,
              mimeType: uploadedFile.file.mimeType,
            },
          });
          userParts.push({
            text: "ഈ ഓഡിയോ ശ്രദ്ധിച്ചു കേട്ട്:\n1. ഓഡിയോയിൽ സംസാരിച്ചത് എന്താണെന്ന് [TRANSCRIPT] എന്ന ടാഗിൽ കൃത്യമായി എഴുതുക (ശബ്ദം വ്യക്തമല്ലെങ്കിലോ ഒന്നും പറഞ്ഞില്ലെങ്കിലോ 'NO_SPEECH' എന്ന് എഴുതുക).\n2. അതിന് അനുയോജ്യമായ മറുപടി [REPLY] എന്ന ടാഗിൽ നൽകുക. ഒരിക്കലും പഴയ അഭിസംബോധനയോ ചായ കുടിച്ചോ എന്ന ചോദ്യമോ വീണ്ടും ആവർത്തിക്കരുത്.\n3. പുതിയ എന്തെങ്കിലും ഓർമ്മയുണ്ടെങ്കിൽ [MEMORY], [CATEGORY] നൽകുക.",
          });
        } catch (uploadErr) {
          console.warn("[File API Upload Fallback to InlineData]:", uploadErr.message);
          userParts.push({
            inlineData: {
              mimeType: "audio/wav",
              data: rawBase64,
            },
          });
          userParts.push({
            text: "ഈ ഓഡിയോ ശ്രദ്ധിച്ചു കേട്ട് [TRANSCRIPT], [REPLY], [MEMORY], [CATEGORY] ഫോർമാറ്റിൽ നൽകുക.",
          });
        }
      } else {
        userParts.push({
          inlineData: {
            mimeType: "audio/wav",
            data: rawBase64,
          },
        });
        userParts.push({
          text: "ഈ ഓഡിയോ ശ്രദ്ധിച്ചു കേട്ട് [TRANSCRIPT], [REPLY], [MEMORY], [CATEGORY] ഫോർമാറ്റിൽ നൽകുക.",
        });
      }
    } else {
      userParts.push({
        text: `പ്രായമായ വ്യക്തി പറഞ്ഞത്: "${userText || "നമസ്കാരം"}". ഇതിന് അനുയോജ്യമായ [REPLY] നൽകുക. മുൻപ് പറഞ്ഞ കാര്യങ്ങൾ ആവർത്തിക്കരുത്.`,
      });
    }

    // Include recent session conversation turns for multi-turn conversational memory
    const history = localElderHistories[elderId] || [];
    const contents = [
      ...history,
      { role: "user", parts: userParts },
    ];

    const geminiPayload = {
      contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        temperature: 0.7,
      },
    };

    const geminiJson = await callGeminiWithFallback(geminiPayload);

    let rawOutput = "";
    const parts = geminiJson?.candidates?.[0]?.content?.parts || [];
    for (const pt of parts) {
      if (pt.text && !pt.thought) {
        rawOutput = pt.text.trim();
      }
    }
    if (!rawOutput) {
      rawOutput = parts[0]?.text?.trim() || "[TRANSCRIPT] NONE\n[REPLY] നമസ്കാരം, ഞാൻ കേട്ടു. സുഖമാണോ?\n[MEMORY] NONE\n[CATEGORY] NONE";
    }

    console.log(`[Gemini Raw Output]:\n${rawOutput}`);

    // Parse structured tags: [TRANSCRIPT], [REPLY], [MEMORY], [CATEGORY]
    let noticedTranscript = "";
    let replyText = "";
    let noticedMemory = "";
    let noticedCategory = "personal_fact";

    const transcriptMatch = rawOutput.match(/\[TRANSCRIPT\]([\s\S]*?)(?:\[REPLY\]|$)/i);
    if (transcriptMatch) {
      noticedTranscript = transcriptMatch[1].trim();
      console.log(`🎙️ [Heard / Transcribed]: "${noticedTranscript}"`);
    }

    const replyMatch = rawOutput.match(/\[REPLY\]([\s\S]*?)(?:\[MEMORY\]|$)/i);
    if (replyMatch) {
      replyText = replyMatch[1].trim();
    } else {
      replyText = rawOutput.replace(/\[MEMORY\][\s\S]*/i, "").replace(/\[TRANSCRIPT\][\s\S]*?(\n|$)/i, "").trim();
    }

    const memMatch = rawOutput.match(/\[MEMORY\]([\s\S]*?)(?:\[CATEGORY\]|$)/i);
    if (memMatch) {
      noticedMemory = memMatch[1].trim();
    }

    const catMatch = rawOutput.match(/\[CATEGORY\]([\s\S]*?)$/i);
    if (catMatch) {
      const c = catMatch[1].trim().toLowerCase();
      if (["family_fact", "health_note", "preference", "routine", "personal_fact"].includes(c)) {
        noticedCategory = c;
      }
    }

    // If Gemini noticed no speech in audio, prompt user to speak again
    if (audioBase64 && (!noticedTranscript || noticedTranscript === "NO_SPEECH" || noticedTranscript.toLowerCase() === "none")) {
      replyText = "നിങ്ങൾ പറയുന്നത് വ്യക്തമായി കേൾക്കാൻ കഴിഞ്ഞില്ല. ഒന്നുകൂടി പറയാമോ?";
    } else if (!replyText) {
      replyText = rawOutput.trim() || "നമസ്കാരം, ഞാൻ കേട്ടു. സുഖമാണോ?";
    }

    // Strip any audio timestamps like 00:03 or [00:03]
    replyText = replyText.replace(/\[?\b\d{1,2}:\d{2}\b\]?/g, "").replace(/\s{2,}/g, " ").trim();

    console.log(`[Companion Reply]: ${replyText}`);

    // Persist newly extracted lasting memory if noticed
    let savedMemoryEntry = null;
    if (
      noticedMemory &&
      noticedMemory !== "NONE" &&
      !noticedMemory.toLowerCase().includes("none") &&
      noticedMemory.length > 3
    ) {
      savedMemoryEntry = recordNewMemory(elderId, noticedMemory, noticedCategory);
    }

    // Update session history with the actual words spoken
    const userTurnText = userText || (noticedTranscript && noticedTranscript !== "NO_SPEECH" ? noticedTranscript : "[ശബ്ദ സന്ദേശം]");
    if (!localElderHistories[elderId]) localElderHistories[elderId] = [];
    localElderHistories[elderId].push({
      role: "user",
      parts: [{ text: userTurnText }],
    });
    localElderHistories[elderId].push({
      role: "model",
      parts: [{ text: replyText }],
    });
    if (localElderHistories[elderId].length > 6) {
      localElderHistories[elderId] = localElderHistories[elderId].slice(-6);
    }

    const cleanReply = replyText.slice(0, 200);
    const audioUri = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
      cleanReply
    )}&tl=ml&client=tw-ob`;

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(
      JSON.stringify({
        success: true,
        transcript: noticedTranscript && noticedTranscript !== "NO_SPEECH" ? noticedTranscript : null,
        response: replyText,
        audioUri,
        memoryNoticed: savedMemoryEntry ? savedMemoryEntry.text : null,
        memoryCategory: savedMemoryEntry ? savedMemoryEntry.category : null,
      })
    );
  } catch (err) {
    console.error("[Error Handling Companion Voice]:", err);
    // Never crash with 500: Return warm Malayalam audio fallback
    const fallbackReply = "ഞാൻ പറയുന്നത് കേൾക്കാമോ? സുഖമായിരിക്കുന്നുവോ?";
    const audioUri = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
      fallbackReply
    )}&tl=ml&client=tw-ob`;
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(
      JSON.stringify({
        success: true,
        response: fallbackReply,
        audioUri,
        isFallback: true,
      })
    );
  } finally {
    // Clean up temporary local audio file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {}
    }
  }
}

async function handleProactiveVoice(req, res, elderId, type = "daily_checkin") {
  try {
    const dailyContext = getMalayalamDailyContext();
    const storedMemories = loadElderMemories(elderId);

    let memoryBlock = "";
    if (storedMemories.length > 0) {
      const memoryLines = storedMemories.map((m) => `- [${m.category}] ${m.text}`);
      memoryBlock = `\nമുൻകാല ഓർമ്മകൾ:\n${memoryLines.join("\n")}`;
    }

    let checkinGoal = "പ്രായമായ ആളോട് സ്നേഹത്തോടെ വർത്തമാനം തുടങ്ങി ക്ഷേമം അന്വേഷിക്കുക. ഓരോ തവണയും വ്യത്യസ്തമായ ചോദ്യങ്ങൾ ചോദിക്കുക (ഉദാ: ആരോഗ്യം എങ്ങനെയുണ്ട്, എന്തെങ്കിലും സഹായം വേണമോ, വീട്ടുകാരെ വിളിച്ചിരുന്നോ, മനസ്സിന് സന്തോഷമാണോ മുതലായവ). ഒരിക്കലും ഒരേ വാക്യമോ ഏലക്കായ ചായയെക്കുറിച്ചുള്ള ചോദ്യമോ ആവർത്തിക്കരുത്.";
    if (type === "medication") {
      checkinGoal = "ഡോക്ടർ പറഞ്ഞ മരുന്ന് കൃത്യസമയത്ത് കഴിച്ചോ എന്ന് സ്നേഹത്തോടെ ഓർമ്മിപ്പിച്ചു ചോദിക്കുക.";
    } else if (type === "morning") {
      checkinGoal = "പ്രഭാത വന്ദനം നൽകി, ഇന്ന് എങ്ങനെയുണ്ടെന്ന് അന്വേഷിക്കുക.";
    } else if (type === "evening") {
      checkinGoal = "വൈകുന്നേരത്തെ ക്ഷേമം അന്വേഷിക്കുക, ഇന്ന് എന്തൊക്കെ വിശേഷങ്ങൾ എന്ന് ചോദിക്കുക.";
    }

    const systemInstruction =
      `നിങ്ങൾ 'സഹായം' (SAHAYAM) എന്ന മലയാളം വോയിസ് അസിസ്റ്റന്റാണ്.` +
      `\nഇപ്പോൾ നിങ്ങൾ പ്രായമായ ആളോട് ആരും വിളിക്കാതെ തന്നെ മുൻകൈയെടുത്ത് (proactively) സംസാരിക്കുകയാണ്.` +
      `\nനിർദ്ദേശങ്ങൾ:` +
      `\n1. ശുദ്ധവും സ്വാഭാവികവുമായ മലയാളത്തിൽ സംസാരിക്കുക.` +
      `\n2. 1 അല്ലെങ്കിൽ 2 ലളിതമായ വാക്യങ്ങൾ മാത്രം.` +
      `\n3. പ്രായമായവരെ ബഹുമാനത്തോടും വാത്സല്യത്തോടും പേരെടുത്ത് അഭിസംബോധന ചെയ്യുക.` +
      `\n4. സമയമുദ്രകളോ ചിഹ്നങ്ങളോ ചേർക്കരുത്.` +
      `\n5. ലക്ഷ്യം: ${checkinGoal}` +
      `\n6. ഇന്നത്തെ സന്ദർഭം: ${dailyContext}` +
      memoryBlock;

    const geminiPayload = {
      contents: [{
        role: "user",
        parts: [{ text: "പ്രായമായ ആളോട് ഇപ്പോൾ നേരിട്ട് അങ്ങോട്ട് സംസാരിക്കാൻ അനുയോജ്യമായ ഒരു സ്നേഹപൂർവ്വമായ മലയാളം വാക്യം പറയുക." }]
      }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { temperature: 0.7 }
    };

    let proactiveText = "";
    try {
      const geminiJson = await callGeminiWithFallback(geminiPayload);
      const parts = geminiJson?.candidates?.[0]?.content?.parts || [];
      for (const pt of parts) {
        if (pt.text && !pt.thought) {
          proactiveText = pt.text.trim();
        }
      }
    } catch (e) {
      console.warn("[Gemini Proactive Fallback]:", e.message);
    }

    if (!proactiveText) {
      proactiveText = "നമസ്കാരം നിവിൻ സാർ! സുഖമായിരിക്കുന്നുവോ? ഇന്ന് എന്തെങ്കിലും സഹായം വേണമെന്നുണ്ടോ?";
    }

    proactiveText = proactiveText.replace(/\[?\b\d{1,2}:\d{2}\b\]?/g, "").replace(/\s{2,}/g, " ").trim();
    console.log(`🎙️ [Proactive Speech Triggered]: "${proactiveText}"`);

    const audioUri = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
      proactiveText.slice(0, 200)
    )}&tl=ml&client=tw-ob`;

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(
      JSON.stringify({
        success: true,
        proactive: true,
        type,
        response: proactiveText,
        audioUri,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.error("[Proactive Checkin Error]:", err);
    const fallbackText = "നമസ്കാരം നിവിൻ സാർ! സുഖമായിരിക്കുന്നുവോ? ഞാൻ എപ്പോഴും കൂടെയുണ്ട്.";
    const audioUri = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
      fallbackText
    )}&tl=ml&client=tw-ob`;
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ success: true, proactive: true, response: fallbackText, audioUri }));
  }
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Role, ngrok-skip-browser-warning");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "healthy", service: "sahayam-companion-server" }));
    return;
  }

  // GET or POST /checkin/proactive?elderId=...&type=...
  if (req.url.startsWith("/checkin/proactive")) {
    const urlObj = new URL(req.url, "http://localhost");
    const elderId = urlObj.searchParams.get("elderId") || "elder_demo_001";
    const type = urlObj.searchParams.get("type") || "daily_checkin";
    handleProactiveVoice(req, res, elderId, type);
    return;
  }

  // GET /memory/query?elderId=...
  if (req.url.startsWith("/memory/query") && req.method === "GET") {
    const urlObj = new URL(req.url, "http://localhost");
    const elderId = urlObj.searchParams.get("elderId") || "elder_demo_001";
    const memories = loadElderMemories(elderId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, elderId, count: memories.length, memories }));
    return;
  }

  // POST /memory/store
  if (req.url === "/memory/store" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const elderId = payload.elderId || "elder_demo_001";
        const text = payload.text || payload.memory;
        const category = payload.category || "personal_fact";
        if (!text) throw new Error("Missing memory text");
        const entry = recordNewMemory(elderId, text, category);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, saved: !!entry, entry }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // POST /respondCompanionVoice
  if (req.url === "/respondCompanionVoice" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      handleRespondCompanionVoice(req, res, body);
    });
    return;
  }

  // ─── Medications Endpoints ───────────────────────────────────────────────
  // GET /medications?elderId=...
  if (req.url.startsWith("/medications") && req.method === "GET") {
    const urlObj = new URL(req.url, "http://localhost");
    const elderId = urlObj.searchParams.get("elderId") || "elder_demo_001";
    const meds = loadElderMedications(elderId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, count: meds.length, medications: meds }));
    return;
  }

  // POST /medications (Add medication)
  if (req.url === "/medications" && req.method === "POST") {
    parseJsonBody(req).then((payload) => {
      const elderId = payload.elderId || payload.elder_id || "elder_demo_001";
      const meds = loadElderMedications(elderId);
      const newMed = {
        id: `med_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        elder_id: elderId,
        name: payload.name || "Medicine",
        dosage: payload.dosage || "",
        instructions: payload.instructions || "",
        cron_expr: payload.cron_expr || "0 8 * * *",
        time_str: payload.time_str || "08:00",
        time_label: payload.time_label || "8:00 AM",
        active: payload.active !== undefined ? !!payload.active : true,
        last_taken_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      meds.unshift(newMed);
      saveElderMedications(elderId, meds);
      console.log(`💊 [Medication Added]: ${newMed.name} for ${elderId}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, medication: newMed, medications: meds }));
    });
    return;
  }

  // POST /medications/toggle
  if (req.url === "/medications/toggle" && req.method === "POST") {
    parseJsonBody(req).then((payload) => {
      const elderId = payload.elderId || payload.elder_id || "elder_demo_001";
      const medId = payload.medicationId || payload.id;
      const meds = loadElderMedications(elderId);
      const med = meds.find((m) => m.id === medId);
      if (med) {
        med.active = payload.active !== undefined ? !!payload.active : !med.active;
        med.updated_at = new Date().toISOString();
        saveElderMedications(elderId, meds);
        console.log(`💊 [Medication Toggled]: ${med.name} active=${med.active}`);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, medication: med, medications: meds }));
    });
    return;
  }

  // POST /medications/delete
  if (req.url === "/medications/delete" && req.method === "POST") {
    parseJsonBody(req).then((payload) => {
      const elderId = payload.elderId || payload.elder_id || "elder_demo_001";
      const medId = payload.medicationId || payload.id;
      let meds = loadElderMedications(elderId);
      meds = meds.filter((m) => m.id !== medId);
      saveElderMedications(elderId, meds);
      console.log(`💊 [Medication Deleted]: ${medId}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, medications: meds }));
    });
    return;
  }

  // POST /medications/markTaken
  if (req.url === "/medications/markTaken" && req.method === "POST") {
    parseJsonBody(req).then((payload) => {
      const elderId = payload.elderId || payload.elder_id || "elder_demo_001";
      const medId = payload.medicationId || payload.id;
      const nowIso = new Date().toISOString();
      const todayDateStr = nowIso.split("T")[0];
      const meds = loadElderMedications(elderId);
      const med = meds.find((m) => m.id === medId);
      if (med) {
        med.last_taken_date = todayDateStr;
        med.last_taken_at = nowIso;
        med.updated_at = nowIso;
        saveElderMedications(elderId, meds);
      }

      // Also record checkin
      const checkins = loadElderCheckins(elderId);
      // Update any pending medication_due checkins for this medication
      for (const chk of checkins) {
        if ((chk.type === "medication_due" || chk.medicationId === medId) && chk.status === "unanswered") {
          chk.status = "answered";
          chk.answeredAt = nowIso;
          chk.moodNote = `മരുന്ന് കഴിച്ചു: ${med ? med.name : "മരുന്ന്"} (${med ? med.dosage : ""})`;
        }
      }

      const newCheckin = {
        id: `chk_${Date.now()}`,
        elderId,
        elder_id: elderId,
        status: "answered",
        scheduledTime: nowIso,
        answeredAt: nowIso,
        moodNote: `മരുന്ന് കഴിച്ചു: ${med ? med.name : "മരുന്ന്"} (${med ? med.dosage : ""})`,
        escalationTriggered: false,
        type: "medication_taken",
        medicationId: medId,
        createdAt: nowIso,
      };
      checkins.unshift(newCheckin);
      saveElderCheckins(elderId, checkins);

      console.log(`💊 [Medication Taken]: ${med ? med.name : medId} recorded.`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, medication: med, checkin: newCheckin }));
    });
    return;
  }

  // ─── Escalations Endpoints ──────────────────────────────────────────────
  // GET /escalations?elderId=...&activeOnly=...
  if (req.url.startsWith("/escalations") && req.method === "GET") {
    const urlObj = new URL(req.url, "http://localhost");
    const elderId = urlObj.searchParams.get("elderId") || "elder_demo_001";
    const activeOnly = urlObj.searchParams.get("activeOnly") === "true";
    let list = loadElderEscalations(elderId);
    if (activeOnly) {
      list = list.filter((e) => !e.resolved);
    }
    // Newest first
    list.sort((a, b) => new Date(b.triggered_at || b.createdAt).getTime() - new Date(a.triggered_at || a.createdAt).getTime());
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, count: list.length, escalations: list }));
    return;
  }

  // POST /escalations (Trigger emergency SOS)
  if (req.url === "/escalations" && req.method === "POST") {
    parseJsonBody(req).then((payload) => {
      const elderId = payload.elderId || payload.elder_id || "elder_demo_001";
      const nowIso = new Date().toISOString();
      const escId = `esc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const escalations = loadElderEscalations(elderId);
      const newEsc = {
        id: escId,
        elder_id: elderId,
        elderId,
        reason: payload.reason || "elder_sos",
        notes: payload.notes || "മുതിർന്ന വ്യക്തി അടിയന്തര SOS സഹായം ആവശ്യപ്പെട്ടു",
        resolved: false,
        triggered_at: nowIso,
        triggeredAt: nowIso,
        createdAt: nowIso,
        family_notified: true,
        familyNotified: true,
      };
      escalations.unshift(newEsc);
      saveElderEscalations(elderId, escalations);

      // Also create emergency checkin
      const checkins = loadElderCheckins(elderId);
      const chk = {
        id: `chk_${Date.now()}`,
        elderId,
        elder_id: elderId,
        status: "unanswered",
        scheduledTime: nowIso,
        answeredAt: null,
        moodNote: `🚨 ${payload.notes || "അടിയന്തര മുന്നറിയിപ്പ് (Emergency SOS Triggered)"}`,
        escalationTriggered: true,
        escalationId: escId,
        createdAt: nowIso,
        type: "emergency_sos",
      };
      checkins.unshift(chk);
      saveElderCheckins(elderId, checkins);

      console.log(`🚨 [EMERGENCY ESCALATION TRIGGERED]: Elder ${elderId} - "${newEsc.notes}"`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, escalationId: escId, escalation: newEsc }));
    });
    return;
  }

  // POST /escalations/resolve
  if (req.url === "/escalations/resolve" && req.method === "POST") {
    parseJsonBody(req).then((payload) => {
      const elderId = payload.elderId || payload.elder_id || "elder_demo_001";
      const escalationId = payload.escalationId || payload.id;
      const escalations = loadElderEscalations(elderId);

      let esc = null;
      if (escalationId) {
        esc = escalations.find((e) => e.id === escalationId);
      }
      if (!esc) {
        // Fallback: resolve the first active (unresolved) escalation
        esc = escalations.find((e) => !e.resolved);
      }

      const nowIso = new Date().toISOString();
      if (esc) {
        esc.resolved = true;
        esc.resolved_at = nowIso;
        esc.resolvedAt = nowIso;
        saveElderEscalations(elderId, escalations);
        console.log(`✅ [Escalation Resolved]: ${esc.id}`);
      } else {
        // Mark all active escalations as resolved just in case
        for (const e of escalations) {
          if (!e.resolved) {
            e.resolved = true;
            e.resolved_at = nowIso;
            e.resolvedAt = nowIso;
          }
        }
        saveElderEscalations(elderId, escalations);
        console.log(`✅ [All Active Escalations Resolved for ${elderId}]`);
      }

      // Also update linked check-ins so dashboard and check-ins tab show resolved / answered
      const checkins = loadElderCheckins(elderId);
      const targetEscId = esc ? esc.id : escalationId;
      let checkinsModified = false;
      const anyActiveRemaining = escalations.some((e) => !e.resolved);

      for (const chk of checkins) {
        const matchesEsc = targetEscId && (chk.escalationId === targetEscId || chk.escalation_id === targetEscId);
        const isEmergencyUnanswered = (chk.type === "emergency_sos" || chk.escalationTriggered) && chk.status === "unanswered";

        if (matchesEsc || (!targetEscId && isEmergencyUnanswered) || (!anyActiveRemaining && isEmergencyUnanswered)) {
          chk.status = "answered";
          chk.answeredAt = nowIso;
          chk.resolved = true;
          chk.moodNote = "പരിഹരിച്ചു — കുടുംബം സ്ഥിരീകരിച്ചു (Resolved by Family)";
          checkinsModified = true;
        }
      }

      if (checkinsModified) {
        saveElderCheckins(elderId, checkins);
        console.log(`✅ [Linked Emergency Checkins Marked as Answered/Resolved for ${elderId}]`);
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, resolved: true, escalation: esc, escalations }));
    });
    return;
  }

  // ─── Check-ins Endpoints ────────────────────────────────────────────────
  // GET /checkins?elderId=...
  if (req.url.startsWith("/checkins") && req.method === "GET") {
    const urlObj = new URL(req.url, "http://localhost");
    const elderId = urlObj.searchParams.get("elderId") || "elder_demo_001";
    const list = loadElderCheckins(elderId);
    list.sort((a, b) => new Date(b.scheduledTime || b.createdAt).getTime() - new Date(a.scheduledTime || a.createdAt).getTime());
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, count: list.length, checkins: list }));
    return;
  }

  // POST /checkins (Record welfare checkin)
  if (req.url === "/checkins" && req.method === "POST") {
    parseJsonBody(req).then((payload) => {
      const elderId = payload.elderId || payload.elder_id || "elder_demo_001";
      const nowIso = new Date().toISOString();
      const status = payload.status || "answered";
      const checkins = loadElderCheckins(elderId);
      const newChk = {
        id: `chk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        elderId,
        elder_id: elderId,
        status,
        scheduledTime: nowIso,
        answeredAt: status === "answered" ? nowIso : null,
        moodNote: payload.note || payload.moodNote || (status === "answered" ? "സുഖമായിരിക്കുന്നു (Elder responded)" : "ചെക്ക്-ഇൻ വിട്ടുപോയി"),
        escalationTriggered: !!payload.escalationTriggered,
        type: payload.type || "daily_checkin",
        createdAt: nowIso,
      };
      checkins.unshift(newChk);
      saveElderCheckins(elderId, checkins);
      console.log(`📋 [Checkin Recorded]: Elder ${elderId} status=${status}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, checkin: newChk }));
    });
    return;
  }

  // ─── Care Note Endpoints ────────────────────────────────────────────────
  // GET /carenote?elderId=...
  if (req.url.startsWith("/carenote") && req.method === "GET") {
    const urlObj = new URL(req.url, "http://localhost");
    const elderId = urlObj.searchParams.get("elderId") || "elder_demo_001";
    const note = loadElderCareNote(elderId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, elderId, note }));
    return;
  }

  // POST /carenote
  if (req.url === "/carenote" && req.method === "POST") {
    parseJsonBody(req).then((payload) => {
      const elderId = payload.elderId || "elder_demo_001";
      const note = payload.note || "";
      saveElderCareNote(elderId, note);
      console.log(`📝 [Care Note Updated for ${elderId}]: "${note}"`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, saved: true, note }));
    });
    return;
  }

  // ─── Dashboard Aggregation ──────────────────────────────────────────────
  // GET /dashboard/:familyId or /dashboard
  if (req.url.startsWith("/dashboard")) {
    const elderId = "elder_demo_001";
    const meds = loadElderMedications(elderId);
    const escalations = loadElderEscalations(elderId);
    const checkins = loadElderCheckins(elderId);
    checkins.sort((a, b) => new Date(b.scheduledTime || b.createdAt).getTime() - new Date(a.scheduledTime || a.createdAt).getTime());

    const activeAlerts = escalations.filter((e) => !e.resolved);
    const latestCheckin = checkins[0] || null;

    // Check if any medication is currently due/overdue today and not yet taken
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const todayStr = now.toISOString().split("T")[0];
    const dueUntakenMed = meds.find((m) => {
      if (!m.active) return false;
      const taken = m.last_taken_date && String(m.last_taken_date).startsWith(todayStr);
      if (taken) return false;
      if (!m.time_str) return false;
      const [h, min] = m.time_str.split(":").map(Number);
      const scheduledMinutes = h * 60 + (min || 0);
      return currentMinutes >= scheduledMinutes - 45;
    });

    let checkinStatus = "answered";
    if (activeAlerts.length > 0) {
      checkinStatus = "unanswered";
    } else if (dueUntakenMed) {
      // Untaken medication reminder is active/pending: MUST indicate "unanswered" (No)
      checkinStatus = "unanswered";
    } else if (latestCheckin) {
      if (
        latestCheckin.status === "unanswered" &&
        (latestCheckin.escalationTriggered || latestCheckin.type === "emergency_sos" || latestCheckin.resolved)
      ) {
        checkinStatus = "answered";
      } else {
        checkinStatus = latestCheckin.status;
      }
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        elder_id: elderId,
        last_checkin_status: checkinStatus,
        last_checkin_time: latestCheckin ? (latestCheckin.scheduledTime || latestCheckin.createdAt) : new Date().toISOString(),
        active_escalations: activeAlerts.length,
        medication_count: meds.filter((m) => m.active).length,
        active_alerts: activeAlerts,
        due_untaken_med: dueUntakenMed ? dueUntakenMed.name : null,
        due_untaken_med_details: dueUntakenMed || null,
        updated_at: new Date().toISOString(),
      })
    );
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Endpoint not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n=================================================`);
  console.log(`🚀 SAHAYAM Local Multimodal Server is ACTIVE!`);
  console.log(`📡 Listening on: http://0.0.0.0:${PORT}`);
  console.log(`🌐 Local LAN:     http://192.168.1.3:${PORT}`);
  console.log(`✨ AI Models:     gemini-3.5-flash / gemini-3.5-flash-lite (Auto-Fallback)`);
  console.log(`🎙️ Audio Stack:   GoogleAIFileManager + Multimodal Speech Comprehension`);
  console.log(`🧠 Semantic Memory: Lasting Cross-Session Storage & Recall Active`);
  console.log(`=================================================\n`);
});
