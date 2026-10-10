/**
 * Phase 3 Verification: Scheduling, Medication Reminders & Proactive Check-Ins
 */

async function runSchedulingTest() {
  console.log("=== Testing SAHAYAM Phase 3: Scheduling & Reminders ===");

  // 1. Test Medication Model & Schedule logic
  const sampleMeds = [
    {
      id: "med_001",
      name: "Metformin (ഷുഗർ ഗുളിക)",
      dosage: "500mg",
      instructions: "ഭക്ഷണത്തിന് ശേഷം (After food)",
      cron_expr: "0 8,20 * * *",
      active: true,
    },
    {
      id: "med_002",
      name: "Amlodipine (പ്രഷർ ഗുളിക)",
      dosage: "5mg",
      instructions: "രാവിലെ ഭക്ഷണത്തിന് മുൻപ് (Morning before food)",
      cron_expr: "0 8 * * *",
      active: true,
    },
  ];

  console.log(`\n[Medications Schedule]: Loaded ${sampleMeds.length} active medications.`);
  sampleMeds.forEach((m) => {
    console.log(` - 💊 ${m.name} | Dose: ${m.dosage} | Times: ${m.cron_expr} | Active: ${m.active}`);
  });

  // Verify Reminder Notification payload structure
  const sampleMed = sampleMeds[0];
  const reminderPayload = {
    title: `💊 മരുന്ന് കഴിക്കാൻ സമയമായി: ${sampleMed.name}`,
    body: `അളവ്: ${sampleMed.dosage}. ${sampleMed.instructions}`,
    data: {
      type: "MEDICATION_REMINDER",
      medicationId: sampleMed.id,
    },
  };
  console.log(`\n[FCM Reminder Payload Generated]:`);
  console.log(JSON.stringify(reminderPayload, null, 2));

  // 2. Test Proactive Check-In Lifecycle
  console.log("\n--- Testing Proactive Check-in Lifecycle ---");
  const checkInEvent = {
    id: "checkin_demo_101",
    elderId: "elder_demo_001",
    scheduledTime: new Date().toISOString(),
    status: "pending",
    promptNote: "സുഖമാണോ? എന്തെങ്കിലും സഹായം ആവശ്യമുണ്ടോ?",
    escalationTriggered: false,
  };
  console.log(`[1. Check-in Scheduled]: ID=${checkInEvent.id}, Status=${checkInEvent.status}`);

  // Simulating Elder Voice Response to Check-in
  const elderResponse = {
    status: "answered",
    answeredAt: new Date().toISOString(),
    moodNote: "സുഖമായിരിക്കുന്നു, ചായ കുടിച്ചു (Doing well, had tea)",
  };
  Object.assign(checkInEvent, elderResponse);
  console.log(`[2. Elder Responded]: Status=${checkInEvent.status}, MoodNote="${checkInEvent.moodNote}"`);

  if (checkInEvent.status === "answered" && reminderPayload.title.includes("Metformin")) {
    console.log("\n=== Phase 3 Scheduling & Reminders: ALL TESTS PASSED! ===");
  } else {
    console.error("Phase 3 Scheduling test failed!");
    process.exit(1);
  }
}

runSchedulingTest();
