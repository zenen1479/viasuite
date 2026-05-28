// netlify/functions/check-trials.js
// Runs daily to send trial warning and expiry emails
// Schedule: every day at 9am UTC via Netlify scheduled functions

const SUPA_URL = "https://fclsntukwmkpikbmrity.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjbHNudHVrd21rcGlrYm1yaXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTgzODUsImV4cCI6MjA5NDg3NDM4NX0.XbRM0j-3pYVvmD8_jb7AamRUNBfxq0hUowDRVkTTBEA";
const SITE_URL = "https://viasuite.app";

const H = {
  "apikey": SUPA_KEY,
  "Authorization": `Bearer ${SUPA_KEY}`,
  "Content-Type": "application/json",
};

async function sendEmail(type, agency) {
  try {
    const res = await fetch(`${SITE_URL}/.netlify/functions/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, agency }),
    });
    const data = await res.json();
    console.log(`Email ${type} sent to ${agency.email}:`, data);
    return data;
  } catch(e) {
    console.error(`Failed to send ${type} to ${agency.email}:`, e.message);
  }
}

exports.handler = async () => {
  console.log("Checking trials...", new Date().toISOString());

  try {
    // Get all active trial agencies
    const res  = await fetch(`${SUPA_URL}/rest/v1/agencies?plan=eq.trial&status=eq.active`, { headers: H });
    const agencies = await res.json();

    console.log(`Found ${agencies.length} trial agencies`);

    const results = { warning: [], expired: [], skipped: [] };

    for (const agency of agencies) {
      if (!agency.trial_ends_at) { results.skipped.push(agency.email); continue; }

      const daysLeft = Math.ceil((new Date(agency.trial_ends_at) - new Date()) / 86400000);
      console.log(`${agency.name}: ${daysLeft} days left`);

      if (daysLeft === 2 || daysLeft === 1) {
        // Send warning email
        await sendEmail("trial-warning", agency);
        results.warning.push(agency.email);
      } else if (daysLeft <= 0) {
        // Send expired email and suspend account
        await sendEmail("trial-expired", agency);

        // Suspend the agency
        await fetch(`${SUPA_URL}/rest/v1/agencies?id=eq.${agency.id}`, {
          method: "PATCH",
          headers: H,
          body: JSON.stringify({ status: "suspended" }),
        });

        results.expired.push(agency.email);
      } else {
        results.skipped.push(agency.email);
      }
    }

    console.log("Results:", results);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, results }),
    };

  } catch(e) {
    console.error("check-trials error:", e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
