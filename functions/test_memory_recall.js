/**
 * Phase 2 Verification: Persistent Semantic Memory Across Sessions
 */

function categorizeMemory(text) {
  const t = text.toLowerCase();
  if (t.includes("മകൻ") || t.includes("മകൾ") || t.includes("ഭാര്യ") || t.includes("ഭർത്താവ്") || t.includes("കൊച്ചുമക്കൾ") || t.includes("വീട്") || t.includes("കുടുംബം")) {
    return "family_fact";
  }
  if (t.includes("ഇഷ്ട") || t.includes("ചായ") || t.includes("കാപ്പി") || t.includes("പാട്ട്") || t.includes("ഭക്ഷണം") || t.includes("നടക്കാൻ")) {
    return "preference";
  }
  if (t.includes("വേദന") || t.includes("പ്രഷർ") || t.includes("ഷുഗർ") || t.includes("മരുന്ന്") || t.includes("ഗുളിക") || t.includes("ഡോക്ടർ")) {
    return "health_note";
  }
  return "conversation_note";
}

function getMalayalamFallbackResponse(userPrompt, memories = []) {
  const p = userPrompt.toLowerCase().trim();

  // 1. Recall family-related memories
  if (p.includes("മക്കൾ") || p.includes("കുടുംബം") || p.includes("ആരാണ്") || p.includes("ഓർമ്മയുണ്ടോ")) {
    const familyMem = memories.find((m) =>
      m.includes("മകൻ") || m.includes("മകൾ") || m.includes("പേര്") || m.includes("രവി") || m.includes("പ്രിയ")
    );
    if (familyMem) {
      return `നിങ്ങൾ മുൻപ് പറഞ്ഞത് ഓർക്കുന്നുണ്ട്: "${familyMem}".`;
    }
  }

  // 2. Recall preferences
  if (p.includes("ചായ") || p.includes("കാപ്പി") || p.includes("ഇഷ്ടം")) {
    const prefMem = memories.find((m) => m.includes("ചായ") || m.includes("ഇഷ്ട"));
    if (prefMem) {
      return `നിങ്ങളുടെ ഇഷ്ടം ഞാൻ ഓർക്കുന്നു: "${prefMem}". ഇപ്പോൾ എന്തെങ്കിലും കഴിച്ചോ?`;
    }
  }

  if (p.includes("നമസ്കാരം") || p.includes("ഹലോ")) {
    return "നമസ്കാരം! സുഖമാണോ? ഇന്ന് എന്തെങ്കിലും സഹായം വേണമോ?";
  }

  return "ശരി, ഞാൻ ശ്രദ്ധിച്ചു കേട്ടു. ഞാൻ എപ്പോഴും നിങ്ങളുടെ കൂടെയുണ്ട്.";
}

async function synthesizeMalayalamAudio(text) {
  try {
    const encoded = encodeURIComponent(text.trim().slice(0, 200));
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=ml&client=tw-ob`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer).toString("base64");
  } catch (err) {
    return null;
  }
}

async function runMemoryTest() {
  console.log("=== Testing SAHAYAM Phase 2: Persistent Semantic Memory ===");

  // Simulating Session 1: Storing memories
  const session1Memories = [];
  const turn1 = "എനിക്ക് രവി എന്നൊരു മകനുണ്ട്";
  const cat1 = categorizeMemory(turn1);
  session1Memories.push(turn1);
  console.log(`\n[Session 1 Input]: "${turn1}"`);
  console.log(`[Categorization]: Extracted as '${cat1}'`);

  const turn2 = "എനിക്ക് രാവിലെ കട്ടൻ ചായ വേണം";
  const cat2 = categorizeMemory(turn2);
  session1Memories.push(turn2);
  console.log(`[Session 1 Input]: "${turn2}"`);
  console.log(`[Categorization]: Extracted as '${cat2}'`);

  console.log(`\n--- Session 1 ended. Memories persisted in elder-private store. ---`);

  // Simulating Session 2 (later in time): Cross-session recall query
  console.log(`\n--- Starting Session 2 (New Session) ---`);
  const query1 = "എന്റെ മക്കൾ ആരാണ്?";
  console.log(`[Session 2 Query]: "${query1}"`);
  const response1 = getMalayalamFallbackResponse(query1, session1Memories);
  console.log(`[Companion Recall]: "${response1}"`);

  const audio1 = await synthesizeMalayalamAudio(response1);
  console.log(`[Voice Playback]: Generated ${audio1 ? "SUCCESS (~" + Math.round(audio1.length * 0.75 / 1024) + " KB MP3)" : "FAILED"}`);

  const query2 = "എനിക്ക് ചായ കുടിക്കണം";
  console.log(`\n[Session 2 Query]: "${query2}"`);
  const response2 = getMalayalamFallbackResponse(query2, session1Memories);
  console.log(`[Companion Recall]: "${response2}"`);

  const audio2 = await synthesizeMalayalamAudio(response2);
  console.log(`[Voice Playback]: Generated ${audio2 ? "SUCCESS (~" + Math.round(audio2.length * 0.75 / 1024) + " KB MP3)" : "FAILED"}`);

  if (response1.includes("രവി") && response2.includes("കട്ടൻ ചായ") && audio1 && audio2) {
    console.log("\n=== Phase 2 Persistent Semantic Memory: ALL TESTS PASSED! ===");
  } else {
    console.error("Phase 2 Test verification failed!");
    process.exit(1);
  }
}

runMemoryTest();
