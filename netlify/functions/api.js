// netlify/functions/api.js
// VíaSuite Public API v1
// Base URL: https://api.viasuite.app/v1/
// Auth: Authorization: Bearer vs_live_xxxxx

const SUPA_URL = "https://fclsntukwmkpikbmrity.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjbHNudHVrd21rcGlrYm1yaXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTgzODUsImV4cCI6MjA5NDg3NDM4NX0.XbRM0j-3pYVvmD8_jb7AamRUNBfxq0hUowDRVkTTBEA";

const H = {
  "apikey": SUPA_KEY,
  "Authorization": `Bearer ${SUPA_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation",
};

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Content-Type": "application/json",
};

// ── HELPERS ───────────────────────────────────────────────────
const db = {
  get:   async (table, q="") => { const r = await fetch(`${SUPA_URL}/rest/v1/${table}${q}`, {headers:H}); return r.json(); },
  post:  async (table, body) => { const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, {method:"POST", headers:H, body:JSON.stringify(body)}); return r.json(); },
  patch: async (table, id, body) => { const r = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, {method:"PATCH", headers:H, body:JSON.stringify(body)}); return r.json(); },
  del:   async (table, id) => { await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, {method:"DELETE", headers:H}); },
  rpc:   async (fn, body) => { const r = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {method:"POST", headers:H, body:JSON.stringify(body)}); return r.json(); },
};

const ok  = (data, status=200)   => ({ statusCode:status, headers:cors, body:JSON.stringify({ success:true,  data }) });
const err = (msg,  status=400)   => ({ statusCode:status, headers:cors, body:JSON.stringify({ success:false, error:msg }) });

// ── AUTH MIDDLEWARE ───────────────────────────────────────────
async function authenticate(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization || "";
  const key = authHeader.replace("Bearer ", "").trim();

  if (!key || !key.startsWith("vs_live_")) {
    return { auth:null, error: err("Missing or invalid API key. Include Authorization: Bearer vs_live_xxx header.", 401) };
  }

  const result = await db.rpc("validate_api_key", { p_key: key });
  const auth = Array.isArray(result) ? result[0] : result;

  if (!auth?.valid) {
    return { auth:null, error: err("Invalid or revoked API key.", 401) };
  }
  if (auth.agency_status === "suspended") {
    return { auth:null, error: err("Agency account is suspended.", 403) };
  }

  // Log request
  try {
    await db.post("api_logs", {
      agency_id:  auth.agency_id,
      api_key_id: auth.api_key_id,
      method:     event.httpMethod,
      endpoint:   event.path,
      status_code:200,
      ip_address: event.headers?.["x-forwarded-for"] || "",
      user_agent: event.headers?.["user-agent"] || "",
    });
  } catch(e) {}

  return { auth, error:null };
}

// ── ROUTE HANDLERS ────────────────────────────────────────────

// GET /v1/agency/me
async function getAgency(auth) {
  const rows = await db.get("agencies", `?id=eq.${auth.agency_id}&select=id,name,slug,email,phone,country,city,plan,status,created_at,trial_ends_at`);
  if (!rows[0]) return err("Agency not found", 404);
  return ok(rows[0]);
}

// GET /v1/expedientes
async function getExpedientes(auth, params) {
  const limit  = parseInt(params.limit)||50;
  const offset = parseInt(params.offset)||0;
  const status = params.status;
  let q = `?agency_id=eq.${auth.agency_id}&order=created_at.desc&limit=${limit}&offset=${offset}`;
  if (status) q += `&status=eq.${status}`;
  const rows = await db.get("expedientes", q);
  return ok({ items: rows, limit, offset, count: rows.length });
}

// GET /v1/expedientes/:id
async function getExpediente(auth, id) {
  const rows = await db.get("expedientes", `?id=eq.${id}&agency_id=eq.${auth.agency_id}`);
  if (!rows[0]) return err("Expediente not found", 404);
  const items    = await db.get("exp_items",     `?expediente_id=eq.${id}`);
  const payments = await db.get("payments",      `?expediente_id=eq.${id}`);
  const alarms   = await db.get("alarms",        `?expediente_id=eq.${id}`);
  return ok({ ...rows[0], items, payments, alarms });
}

// POST /v1/expedientes
async function createExpediente(auth, body) {
  const { clientName, destination, dateFrom, dateTo, paxAdult=1, paxChild=0, advisorId, notes="" } = body;
  if (!clientName) return err("clientName is required");

  const row = {
    id:             crypto.randomUUID(),
    agency_id:      auth.agency_id,
    no:             Date.now().toString().slice(-7),
    venta_no:       "V-" + Date.now().toString().slice(-5),
    status:         "nuevo",
    advisor_id:     advisorId || null,
    client_name:    clientName,
    notes,
    trip_destination: destination || "",
    trip_date_from:   dateFrom || null,
    trip_date_to:     dateTo   || null,
    trip_pax_adult:   paxAdult,
    trip_pax_child:   paxChild,
    trip_category:    "economy",
    created_at:       new Date().toISOString(),
  };

  const result = await db.post("expedientes", row);
  return ok(Array.isArray(result) ? result[0] : row, 201);
}

// GET /v1/clients
async function getClients(auth, params) {
  const limit  = parseInt(params.limit)||50;
  const offset = parseInt(params.offset)||0;
  const q = `?agency_id=eq.${auth.agency_id}&order=created_at.desc&limit=${limit}&offset=${offset}`;
  const rows = await db.get("clients", q);
  return ok({ items: rows, limit, offset, count: rows.length });
}

// GET /v1/clients/:id
async function getClient(auth, id) {
  const rows = await db.get("clients", `?id=eq.${id}&agency_id=eq.${auth.agency_id}`);
  if (!rows[0]) return err("Client not found", 404);
  return ok(rows[0]);
}

// POST /v1/clients
async function createClient(auth, body) {
  const { name, email, phone, nationality, passport } = body;
  if (!name) return err("name is required");

  const row = {
    id:          crypto.randomUUID(),
    agency_id:   auth.agency_id,
    name,
    email:       email || "",
    phone:       phone || "",
    nationality: nationality || "",
    passport:    passport || "",
    status:      "activo",
    created_at:  new Date().toISOString(),
  };

  const result = await db.post("clients", row);
  return ok(Array.isArray(result) ? result[0] : row, 201);
}

// GET /v1/quotes
async function getQuotes(auth, params) {
  const rows = await db.get("expedientes",
    `?agency_id=eq.${auth.agency_id}&select=id,no,client_name,trip_destination,created_at&order=created_at.desc&limit=${parseInt(params.limit)||50}`
  );
  return ok({ items: rows, count: rows.length });
}

// GET /v1/reports/sales
async function getSalesReport(auth, params) {
  const from = params.from || new Date(Date.now() - 30*86400000).toISOString().slice(0,10);
  const to   = params.to   || new Date().toISOString().slice(0,10);

  const exps = await db.get("expedientes",
    `?agency_id=eq.${auth.agency_id}&created_at=gte.${from}&created_at=lte.${to}&select=id,no,client_name,status,trip_destination,created_at,advisor_id`
  );
  const items = await db.get("exp_items",
    `?agency_id=eq.${auth.agency_id}`
  );

  const totalRevenue = items.reduce((s,i) => {
    const base = parseFloat(i.base||0) + parseFloat(i.iva||0) + parseFloat(i.tua||0) + parseFloat(i.others||0);
    return s + base;
  }, 0);

  return ok({
    period: { from, to },
    summary: {
      totalExpedientes: exps.length,
      totalRevenue:     +totalRevenue.toFixed(2),
      byStatus: {
        nuevo:    exps.filter(e=>e.status==="nuevo").length,
        activo:   exps.filter(e=>e.status==="activo").length,
        cerrado:  exps.filter(e=>e.status==="cerrado").length,
      }
    },
    expedientes: exps,
  });
}

// POST /v1/ai/query — Natural language query
async function aiQuery(auth, body) {
  const { message, context="" } = body;
  if (!message) return err("message is required");

  // Fetch agency context
  const [exps, clients] = await Promise.all([
    db.get("expedientes", `?agency_id=eq.${auth.agency_id}&order=created_at.desc&limit=20&select=no,client_name,status,trip_destination,trip_date_from`),
    db.get("clients",     `?agency_id=eq.${auth.agency_id}&order=created_at.desc&limit=20&select=name,email,phone`),
  ]);

  const agencyContext = `
Agencia: ${auth.agency_name} (Plan: ${auth.agency_plan})
Expedientes recientes: ${JSON.stringify(exps.slice(0,5))}
Clientes recientes: ${JSON.stringify(clients.slice(0,5))}
${context}
  `.trim();

  // Call Claude via Anthropic API
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":         process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
      "Content-Type":      "application/json",
    },
    body: JSON.stringify({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `Eres el asistente de VíaSuite, un sistema de gestión para agencias de viajes. 
Tienes acceso a los datos de la agencia ${auth.agency_name}.
Responde en español, de forma concisa y útil.
Datos de la agencia: ${agencyContext}`,
      messages: [{ role:"user", content: message }],
    }),
  });

  const data = await response.json();
  const reply = data.content?.[0]?.text || "No pude procesar tu consulta.";

  return ok({ message, reply, context: agencyContext.slice(0,200) + "..." });
}

// POST /v1/ai/quote — Create quote from natural language
async function aiCreateQuote(auth, body) {
  const { message } = body;
  if (!message) return err("message is required");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":         process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
      "Content-Type":      "application/json",
    },
    body: JSON.stringify({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `Extrae información de viaje del mensaje del usuario y devuelve SOLO un JSON válido con estos campos:
{
  "clientName": "nombre del cliente o null",
  "destination": "destino del viaje",
  "dateFrom": "YYYY-MM-DD o null",
  "dateTo": "YYYY-MM-DD o null",
  "paxAdult": número de adultos (default 2),
  "paxChild": número de niños (default 0),
  "notes": "notas adicionales"
}
No incluyas texto adicional, solo el JSON.`,
      messages: [{ role:"user", content: message }],
    }),
  });

  const data   = await response.json();
  const text   = data.content?.[0]?.text || "{}";

  let parsed;
  try { parsed = JSON.parse(text.replace(/```json|```/g, "").trim()); }
  catch(e) { return err("Could not parse travel details from message"); }

  // Create the expediente
  const expResult = await createExpediente(auth, parsed);
  const expData   = JSON.parse(expResult.body);

  return ok({
    message,
    extracted: parsed,
    expediente: expData.data,
    note: "Expediente created from natural language. Review and complete details in VíaSuite."
  }, 201);
}

// GET /v1/keys — List API keys for agency
async function getApiKeys(auth) {
  const rows = await db.get("api_keys",
    `?agency_id=eq.${auth.agency_id}&select=id,key_prefix,name,status,scopes,created_at,last_used_at,requests_total`
  );
  return ok({ items: rows });
}

// POST /v1/keys — Generate new API key
async function createApiKey(auth, body) {
  const { name="Default", scopes=["read","write"] } = body;
  const result = await db.rpc("generate_api_key", {
    p_agency_id: auth.agency_id,
    p_name:      name,
    p_scopes:    scopes,
  });
  return ok({
    key:     result,
    name,
    scopes,
    warning: "Save this key now. It will never be shown again."
  }, 201);
}

// ── MAIN ROUTER ───────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode:200, headers:cors, body:"" };
  }

  // Strip /v1 prefix and function path
  const rawPath = event.path.replace("/.netlify/functions/api", "").replace("/v1", "") || "/";
  const method  = event.httpMethod;
  const params  = event.queryStringParameters || {};
  let   body    = {};

  try { body = JSON.parse(event.body || "{}"); } catch(e) {}

  // Root endpoint — API info
  if (rawPath === "/" || rawPath === "") {
    return ok({
      name:    "VíaSuite API",
      version: "v1",
      docs:    "https://docs.viasuite.app",
      status:  "operational",
      endpoints: [
        "GET  /v1/agency/me",
        "GET  /v1/expedientes",
        "GET  /v1/expedientes/:id",
        "POST /v1/expedientes",
        "GET  /v1/clients",
        "GET  /v1/clients/:id",
        "POST /v1/clients",
        "GET  /v1/quotes",
        "GET  /v1/reports/sales",
        "POST /v1/ai/query",
        "POST /v1/ai/quote",
        "GET  /v1/keys",
        "POST /v1/keys",
      ]
    });
  }

  // All other routes require auth
  const { auth, error } = await authenticate(event);
  if (error) return error;

  const parts = rawPath.split("/").filter(Boolean);
  const [r0, r1, r2] = parts;

  try {
    // Agency
    if (r0==="agency" && r1==="me" && method==="GET")  return await getAgency(auth);

    // Expedientes
    if (r0==="expedientes" && !r1 && method==="GET")   return await getExpedientes(auth, params);
    if (r0==="expedientes" && r1  && method==="GET")   return await getExpediente(auth, r1);
    if (r0==="expedientes" && !r1 && method==="POST")  return await createExpediente(auth, body);

    // Clients
    if (r0==="clients" && !r1 && method==="GET")       return await getClients(auth, params);
    if (r0==="clients" && r1  && method==="GET")       return await getClient(auth, r1);
    if (r0==="clients" && !r1 && method==="POST")      return await createClient(auth, body);

    // Quotes
    if (r0==="quotes" && !r1 && method==="GET")        return await getQuotes(auth, params);

    // Reports
    if (r0==="reports" && r1==="sales" && method==="GET") return await getSalesReport(auth, params);

    // AI
    if (r0==="ai" && r1==="query" && method==="POST")  return await aiQuery(auth, body);
    if (r0==="ai" && r1==="quote" && method==="POST")  return await aiCreateQuote(auth, body);

    // API Keys management
    if (r0==="keys" && !r1 && method==="GET")          return await getApiKeys(auth);
    if (r0==="keys" && !r1 && method==="POST")         return await createApiKey(auth, body);

    return err(`Endpoint not found: ${method} /v1/${parts.join("/")}`, 404);

  } catch(e) {
    console.error("API Error:", e);
    return err("Internal server error: " + e.message, 500);
  }
};
