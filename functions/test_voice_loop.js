/**
 * Test: Phase 1 Core Voice Loop verification
 * Tests Malayalam response reasoning and Google TTS synthesis pipeline.
 */

async function synthesizeMalayalamAudio(text) {
  try {
    if (!text || !text.trim()) return null;
    const cleanText = text.trim().slice(0, 200);
    const encoded = encodeURIComponent(cleanText);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=ml&client=tw-ob`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer).toString("base64");
  } catch (err) {
    console.error("TTS error:", err);
    return null;
  }
}

function getMalayalamFallbackResponse(userPrompt) {
  const p = userPrompt.toLowerCase().trim();
  if (p.includes("നമസ്കാരം") || p.includes("ഹലോ") || p.includes("hello")) {
    return "നമസ്കാരം! സുഖമാണോ? ഇന്ന് എന്തെങ്കിലും സഹായം വേണമോ?";
  }
  if (p.includes("മരുന്ന്") || p.includes("ഗുളിക")) {
    return "ഡോക്ടർ പറഞ്ഞ കൃത്യസമയത്ത് മരുന്ന് കഴിക്കാൻ മറക്കരുത്.";
  }
  if (p.includes("വിശക്കുന്നു") || p.includes("ഭക്ഷണം") || p.includes("ചായ")) {
    return "കൃത്യസമയത്ത് ആഹാരം കഴിക്കുക. ആരോഗ്യമാണ് പ്രധാനം.";
  }
  return "ശരി, ഞാൻ കേട്ടു. ഞാൻ എപ്പോഴും നിങ്ങളുടെ കൂടെയുണ്ട്.";
}

async function runTest() {
  console.log("=== Testing SAHAYAM Phase 1 Core Voice Loop ===");

  const testPrompts = [
    "നമസ്കാരം, സുഖമാണോ?",
    "എനിക്ക് മരുന്ന് കഴിക്കാൻ സമയമായോ?",
    "എനിക്ക് ചായ കുടിക്കണം",
  ];

  for (const prompt of testPrompts) {
    console.log(`\nElder Input: "${prompt}"`);
    const reply = getMalayalamFallbackResponse(prompt);
    console.log(`Companion Output: "${reply}"`);

    const audioBase64 = await synthesizeMalayalamAudio(reply);
    if (audioBase64) {
      console.log(`Audio Synthesized: SUCCESS (${audioBase64.length} base64 chars, ~${Math.round(audioBase64.length * 0.75 / 1024)} KB MP3)`);
      console.log(`Audio URI Prefix: data:audio/mpeg;base64,${audioBase64.slice(0, 30)}...`);
    } else {
      console.error("Audio Synthesized: FAILED");
      process.exit(1);
    }
  }

  console.log("\n=== Phase 1 Core Voice Loop: ALL TESTS PASSED! ===");
}

runTest();
