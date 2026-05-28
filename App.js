import { useState } from "react";
import React from "react";

// ─── SUPABASE CONNECTION ──────────────────────────────────────────────────────
const SUPA_URL = "https://fclsntukwmkpikbmrity.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjbHNudHVrd21rcGlrYm1yaXR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTgzODUsImV4cCI6MjA5NDg3NDM4NX0.XbRM0j-3pYVvmD8_jb7AamRUNBfxq0hUowDRVkTTBEA";

const supa = {
  headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}`, "Content-Type": "application/json", "Prefer": "return=representation" },

  async get(table, params = "") {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}${params}`, { headers: this.headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async post(table, body) {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
      method: "POST", headers: this.headers, body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async patch(table, id, body) {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH", headers: this.headers, body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async delete(table, id) {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "DELETE", headers: this.headers
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  },

  async rpc(fn, body) {
    const res = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
      method: "POST", headers: this.headers, body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async registerAgency(params) {
    // 1. Create agency via RPC
    const agencyId = await this.rpc("register_agency", params);

    // 2. Send welcome email
    try {
      await fetch("/.netlify/functions/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "welcome",
          agency: {
            name: params.p_name,
            email: params.p_email,
            adminName: params.p_admin_name,
          }
        })
      });
    } catch(e) {
      console.warn("Welcome email failed:", e.message);
    }

    return agencyId;
  }
};

// ─── DATA HELPERS (convert DB rows to app format) ─────────────────────────────
const dbToClient = r => ({
  id: r.id, created: r.created_at?.slice(0,10),
  clientNo: r.client_no||"",
  tipo: r.tipo||"persona",
  cat: r.cat||"GENERAL", status: r.status||"activo", advisorId: r.advisor_id,
  // Persona
  firstName: r.first_name||"", lastNameP: r.last_name_p||"", lastNameM: r.last_name_m||"",
  birthdate: r.birthdate||"", alta: r.created_at?.slice(0,10)||"",
  // Empresa
  razonSocial: r.razon_social||"", ruc: r.ruc||"", representante: r.representante||"",
  // Contacto
  mobile: r.mobile||"", phone: r.phone||"", officePhone: r.office_phone||"",
  email: r.email||"", email2: r.email2||"",
  address: r.address||"", colonia: r.colonia||"", city: r.city||"",
  cp: r.cp||"", state: r.state||"", country: r.country||"Panama",
  nationality: r.nationality||"Panama - PA",
  contact: r.contact||"", recommended: r.recommended||"", howKnow: r.how_know||"",
  notes: r.notes||"",
  // Documentos
  passport: r.passport ? JSON.parse(r.passport) : { numero:"", vencimiento:"", foto:null },
  visas: r.visas ? JSON.parse(r.visas) : [],
  relaciones: r.relaciones ? JSON.parse(r.relaciones) : [],
  // Fiscal
  taxId: r.tax_id||"", taxName: r.tax_name||"", taxAddress: r.tax_address||"",
  docs: [],
});

const clientToDB = c => ({
  cat: c.cat, status: c.status, advisor_id: c.advisorId,
  first_name: c.firstName, last_name_p: c.lastNameP, last_name_m: c.lastNameM,
  birthdate: c.birthdate||null, mobile: c.mobile, phone: c.phone,
  email: c.email, email2: c.email2, address: c.address, city: c.city,
  country: c.country, nationality: c.nationality, notes: c.notes,
  how_know: c.howKnow, recommended: c.recommended, contact: c.contact,
});

const dbToExp = (r, items=[], payments=[], majorPayments=[], alarms=[]) => ({
  id: r.id, no: r.no, ventaNo: r.venta_no, created: r.created_at?.slice(0,10),
  status: r.status||"nuevo", advisorId: r.advisor_id, medium: r.medium||"WHATSAPP",
  clientId: r.client_id||"", clientName: r.client_name||"", notes: r.notes||"",
  contract: r.contract_data ? { name:r.contract_name, size:r.contract_size, type:r.contract_type, data:r.contract_data } : null,
  trip: {
    title: r.trip_title||"", destination: r.trip_destination||"",
    dateFrom: r.trip_date_from||"", dateTo: r.trip_date_to||"",
    paxAdult: r.trip_pax_adult||2, paxChild: r.trip_pax_child||0,
    category: r.trip_category||"",
  },
  items: items.map(it => ({
    id: it.id, concept: it.concept, wholesalerId: it.wholesaler_id,
    dateFrom: it.date_from||"", dateTo: it.date_to||"",
    boleto: it.boleto||"", reserva: it.reserva||"", description: it.description||"",
    base: parseFloat(it.base)||0, iva: parseFloat(it.iva)||0,
    tua: parseFloat(it.tua)||0, others: parseFloat(it.others)||0,
    csb: parseFloat(it.csb)||18, currency: it.currency||"USD", docs:[],
  })),
  payments: payments.map(p => ({
    id: p.id, date: p.date||"", agentId: p.agent_id, account: p.account||"",
    method: p.method||"", reference: p.reference||"",
    amount: parseFloat(p.amount)||0, confirmed: p.confirmed, receipt: p.receipt||"", note: p.note||"",
  })),
  majorPayments: majorPayments.map(p => ({
    id: p.id, date: p.date||"", agentId: p.agent_id, account: p.account||"",
    method: p.method||"", reference: p.reference||"",
    amount: parseFloat(p.amount)||0, confirmed: p.confirmed, receipt: p.receipt||"", note: p.note||"",
  })),
  alarms: alarms.map(a => ({
    id: a.id, type: a.type, date: a.date||"", note: a.note||"",
    status: a.status||"pending", auto: a.auto||false,
  })),
});

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const B = { blue:"#1565C0", dark:"#0D47A1", teal:"#00897B", gold:"#F57F17", red:"#C62828", green:"#2E7D32", gray:"#546E7A" };

const ADVISORS = [
  { id:"1", name:"Zenen Duartes",  wp:"6938-0957" },
  { id:"2", name:"Cristy López",   wp:"6920-1111" },
  { id:"3", name:"Irvin Méndez",   wp:"6945-2222" },
  { id:"4", name:"Leidis García",  wp:"6930-3333" },
  { id:"5", name:"Admin Sistema",  wp:"6938-0957" },
];

// ─── CATÁLOGO MAYORISTAS / AEROLÍNEAS / HOTELES ──────────────────────────────
// Se inicializa desde estado global (App) para permitir agregar/editar/eliminar
const WHOLESALERS_SEED = [
  // Hoteles nacionales
  { id:"bbr",       name:"Bijao Beach Resort",       code:"BBR",  tipo:"hotel",     pais:"Panama",  contacto:"", email:"", phone:"", web:"granevenia.com",    notas:"" },
  { id:"hyatt",     name:"Hyatt Hotels",             code:"HYT",  tipo:"hotel",     pais:"USA",     contacto:"", email:"", phone:"", web:"hyatt.com",         notas:"" },
  { id:"marriott",  name:"Marriott International",   code:"MRR",  tipo:"hotel",     pais:"USA",     contacto:"", email:"", phone:"", web:"marriott.com",      notas:"" },
  // Aerolíneas
  { id:"copa",      name:"Copa Airlines",            code:"CM",   tipo:"aerolinea", pais:"Panama",  contacto:"", email:"", phone:"", web:"copaair.com",       notas:"" },
  { id:"airfrance", name:"Air France",               code:"AF",   tipo:"aerolinea", pais:"Francia", contacto:"", email:"", phone:"", web:"airfrance.com",     notas:"" },
  { id:"wizz",      name:"Wizz Air",                 code:"W6",   tipo:"aerolinea", pais:"Hungria", contacto:"", email:"", phone:"", web:"wizzair.com",       notas:"" },
  { id:"united",    name:"United Airlines",          code:"UA",   tipo:"aerolinea", pais:"USA",     contacto:"", email:"", phone:"", web:"united.com",        notas:"" },
  { id:"american",  name:"American Airlines",        code:"AA",   tipo:"aerolinea", pais:"USA",     contacto:"", email:"", phone:"", web:"aa.com",            notas:"" },
  { id:"latam",     name:"LATAM Airlines",           code:"LA",   tipo:"aerolinea", pais:"Chile",   contacto:"", email:"", phone:"", web:"latam.com",         notas:"" },
  { id:"iberia",    name:"Iberia",                   code:"IB",   tipo:"aerolinea", pais:"España",  contacto:"", email:"", phone:"", web:"iberia.com",        notas:"" },
  // Mayoristas
  { id:"accessrail",name:"AccessRail",               code:"AR",   tipo:"mayorista", pais:"USA",     contacto:"", email:"", phone:"", web:"accessrail.com",    notas:"" },
  { id:"assistcard",name:"Assist-Card",              code:"AC",   tipo:"mayorista", pais:"Argentina",contacto:"",email:"", phone:"", web:"assistcard.com",   notas:"" },
  { id:"hotelbeds", name:"Hotelbeds",                code:"HB",   tipo:"mayorista", pais:"España",  contacto:"", email:"", phone:"", web:"hotelbeds.com",     notas:"" },
  { id:"tatajuba",  name:"Tatajuba Travel",          code:"TAT",  tipo:"mayorista", pais:"Brasil",  contacto:"", email:"", phone:"", web:"tatajuba.travel",   notas:"" },
  { id:"hyperguest",name:"HyperGuest",               code:"HG",   tipo:"mayorista", pais:"Israel",  contacto:"", email:"", phone:"", web:"hyperguest.com",    notas:"" },
  { id:"other",     name:"Otro",                     code:"OTR",  tipo:"mayorista", pais:"",        contacto:"", email:"", phone:"", web:"",                  notas:"" },
];
// Para el selector en expedientes usamos este array simplificado
const WHOLESALERS = WHOLESALERS_SEED;

const CONCEPTS = ["HOTELES NACIONALES","HOTELES INTERNACIONALES","VUELOS NACIONALES","VUELOS INTERNACIONALES","TOURS Y EXCURSIONES","TRASLADOS","SEGUROS DE VIAJE","CRUCEROS","PAQUETES TURISTICOS","OTROS SERVICIOS"];
const PAY_METHODS = ["Transferencia","Tarjeta crédito","Tarjeta débito","TPV/Tarjeta Crédito","Efectivo","Yappy","Zelle","PayPal","Cheque"];
const CURRENCIES  = ["USD","MXN","EUR","COP","PEN"];
const CLI_CATS    = ["GENERAL","VIP","CORPORATIVO","GRUPO","AGENCIA"];

const EXP_STATUS = {
  nuevo:      { label:"Nuevo",      c:"#1565C0", bg:"#E3F2FD" },
  cotizacion: { label:"Cotización", c:"#F57F17", bg:"#FFF8E1" },
  confirmado: { label:"Confirmado", c:"#2E7D32", bg:"#E8F5E9" },
  saldo:      { label:"Saldo",      c:"#6A1B9A", bg:"#F3E5F5" },
  pagado:     { label:"Pagado",     c:"#00695C", bg:"#E0F2F1" },
  credito:    { label:"Crédito",    c:"#E65100", bg:"#FBE9E7" },
  cerrado:    { label:"Cerrado",    c:"#546E7A", bg:"#ECEFF1" },
  cancelado:  { label:"Cancelado",  c:"#C62828", bg:"#FFEBEE" },
};

// ─── ALARM CONFIG ─────────────────────────────────────────────────────────────
const ALARM_TYPES = [
  { id:"birthday",     label:"Cumpleaños cliente",       icon:"🎂", color:"#E91E63", auto:true  },
  { id:"pay_client",   label:"Cobro a cliente",          icon:"💳", color:"#1565C0", auto:true  },
  { id:"pay_supplier", label:"Pago a proveedor",         icon:"💸", color:"#F57F17", auto:true  },
  { id:"pre_trip",     label:"Pre-viaje (48h antes)",    icon:"✈", color:"#7B1FA2", auto:true  },
  { id:"trip_start",   label:"Inicio de viaje",          icon:"🛫", color:"#00897B", auto:true  },
  { id:"trip_end",     label:"Fin de viaje / Regreso",   icon:"🛬", color:"#2E7D32", auto:true  },
  { id:"post_trip",    label:"Post-viaje (3 días después)",icon:"📞",color:"#546E7A", auto:true  },
  { id:"contract",     label:"Firma de contrato",        icon:"📝", color:"#5D4037", auto:false },
  { id:"document",     label:"Entrega de documentos",   icon:"📄", color:"#0288D1", auto:false },
  { id:"payment_due",  label:"Vencimiento de pago",      icon:"⏰", color:"#C62828", auto:false },
  { id:"manual",       label:"Recordatorio manual",      icon:"📌", color:"#455A64", auto:false },
];

const ALARM_STATUS = {
  pending:   { label:"Pendiente",  c:"#F57F17", bg:"#FFF8E1" },
  done:      { label:"Completada", c:"#2E7D32", bg:"#E8F5E9" },
  dismissed: { label:"Ignorada",   c:"#546E7A", bg:"#ECEFF1" },
};

// ─── CATALOG PRODUCTS (seed — in real app loaded from Back Office) ─────────────
const CATALOG_PRODUCTS = [
  { id:"cp1", concept:"HOTELES NACIONALES",      wholesalerId:"bbr",        name:"Gran Evenia Bijao — Todo Incluido",     description:"Alojamiento: Gran Evenia Bijao\nPlan todo incluido en comidas y bebidas\nHorario Check in: 03:00 PM / Check out: 12:00 PM", base:399.38, iva:0, tua:0, others:0, csb:18, currency:"USD" },
  { id:"cp2", concept:"HOTELES INTERNACIONALES", wholesalerId:"hyatt",      name:"Hyatt Ziva Cancún — All Inclusive",    description:"Alojamiento: Hyatt Ziva Cancún\nPlan todo incluido\n7 noches\nHorario Check in: 03:00 PM / Check out: 12:00 PM", base:1644.84, iva:0, tua:0, others:604.16, csb:26, currency:"USD" },
  { id:"cp3", concept:"HOTELES INTERNACIONALES", wholesalerId:"marriott",   name:"Marriott Punta Cana — AI 7 noches",   description:"Alojamiento: Marriott Punta Cana\nPlan todo incluido 7 noches", base:112.33, iva:0, tua:0, others:22.47, csb:20, currency:"USD" },
  { id:"cp4", concept:"VUELOS INTERNACIONALES",  wholesalerId:"airfrance",  name:"Air France — París CDG → Praga PRG",  description:"Vuelo Air France\nParis CDG → Praga PRG\nClase Economy | 1 maleta 23kg incluida\nSalida: 15:25 | Llegada: 17:05", base:220, iva:0, tua:0, others:0, csb:12, currency:"USD" },
  { id:"cp5", concept:"VUELOS INTERNACIONALES",  wholesalerId:"copa",       name:"Copa Airlines — PTY ↔ MIA",           description:"Vuelo Copa Airlines\nPanamá PTY → Miami MIA\nClase Economy", base:193.04, iva:0, tua:0, others:0, csb:16, currency:"USD" },
  { id:"cp6", concept:"VUELOS INTERNACIONALES",  wholesalerId:"wizz",       name:"Wizz Air — Budapest → Roma",          description:"Vuelo Wizz Air\nBudapest BUD → Roma FCO\nClase Economy | 1 maleta 20kg incluida\nSalida: 06:05 | Llegada: 07:55", base:85, iva:0, tua:0, others:0, csb:10, currency:"USD" },
  { id:"cp7", concept:"SEGUROS DE VIAJE",        wholesalerId:"assistcard", name:"Assist-Card — Europa 14 días",        description:"Seguro de asistencia al viajero\nCobertura Europa completa\nDuración: 14 días", base:45, iva:0, tua:0, others:0, csb:10, currency:"USD" },
  { id:"cp8", concept:"PAQUETES TURISTICOS",     wholesalerId:"other",      name:"Euro Trip 5 ciudades — 14 noches",    description:"Paquete turístico Europa\nParís · Praga · Viena · Budapest · Roma\n14 noches con desayuno incluido\nTours guiados en español en todas las ciudades", base:2600, iva:0, tua:0, others:504, csb:18, currency:"USD" },
  { id:"cp9", concept:"TOURS Y EXCURSIONES",     wholesalerId:"other",      name:"Tour Privado París — 4 horas a pie", description:"Tour privado por París a pie\n4 horas con guía en español\nÓpera Garnier, Louvre, Notre Dame, Torre Eiffel, Pont Neuf\nPunto de encuentro: hotel", base:65, iva:0, tua:0, others:0, csb:20, currency:"USD" },
  { id:"cp10",concept:"TRASLADOS",               wholesalerId:"other",      name:"Traslado privado Aeropuerto ↔ Hotel", description:"Traslado privado en vehículo ejecutivo\nAeropuerto → Hotel (ida y vuelta)\nCapacidad: hasta 8 pasajeros", base:45, iva:0, tua:0, others:0, csb:15, currency:"USD" },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const uid   = () => Date.now().toString(36) + Math.random().toString(36).slice(2,5);
const today = () => new Date().toISOString().slice(0,10);
const fmt   = n  => Number(n||0).toLocaleString("en",{minimumFractionDigits:2,maximumFractionDigits:2});

// ── VIASUITE LOGO COMPONENT ───────────────────────────────────
const VSLogo = ({ size="md", variant="dark", showTagline=false }) => {
  const sizes = { xs:16, sm:22, md:32, lg:44, xl:56 };
  const s = sizes[size] || sizes.md;
  const half = s/2;
  // Colors based on variant
  const outerColor  = variant==="dark" ? "#0D47A1" : "#1565C0";
  const innerColor  = "#F59E0B";
  const checkColor  = "white";
  const textGold    = "#F59E0B";
  const textMain    = variant==="dark" ? "#0D47A1" : "#FFFFFF";
  const fontSize    = s * 1.1;
  const gap         = s * 0.35;

  return (
    <div style={{ display:"flex", alignItems:"center", gap: gap }}>
      {/* Diamond symbol */}
      <svg width={s} height={s} viewBox="0 0 64 64" style={{ flexShrink:0 }}>
        {/* Outer diamond */}
        <polygon points="32,2 62,26 32,50 2,26" fill={outerColor}/>
        {/* Inner gold diamond */}
        <polygon points="32,14 52,26 32,38 12,26" fill={innerColor}/>
        {/* White V checkmark */}
        <path d="M22 22 L32 35 L42 22" fill="none" stroke={checkColor} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {/* Wordmark */}
      <div style={{ display:"flex", flexDirection:"column", lineHeight:1 }}>
        <span style={{ fontFamily:"Arial,sans-serif", fontSize, fontWeight:900, letterSpacing:-0.5, lineHeight:1 }}>
          <span style={{ color:textGold }}>Vía</span>
          <span style={{ color:textMain }}>Suite</span>
        </span>
        {showTagline && (
          <span style={{ fontFamily:"Arial,sans-serif", fontSize:fontSize*0.3, fontWeight:700, color: variant==="dark" ? "#94A3B8" : "rgba(255,255,255,.55)", letterSpacing:2, textTransform:"uppercase", marginTop:3 }}>
            Travel Management
          </span>
        )}
      </div>
    </div>
  );
};
const fmtS  = n  => Number(n||0).toLocaleString("en",{minimumFractionDigits:0,maximumFractionDigits:0});

// Add days to a date string
const addDays = (dateStr, days) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
};

// Auto-generate alarms from expedition data
const autoAlarms = (exp, client) => {
  const alarms = [];
  const add = (type, date, note="", source="auto") => {
    if (!date) return;
    alarms.push({ id:uid(), type, date, note, status:"pending", source, createdAt:today() });
  };
  // Birthday
  if (client?.birthdate) {
    const bd = client.birthdate.slice(5); // MM-DD
    const year = new Date().getFullYear();
    add("birthday", `${year}-${bd}`, `Cumpleaños de ${client.firstName||exp.clientName}`);
  }
  // Trip dates
  if (exp.trip?.dateFrom) {
    add("trip_start",   exp.trip.dateFrom,              "Inicio de viaje");
    add("pre_trip",     addDays(exp.trip.dateFrom,-2),  "Pre-viaje: contactar 48h antes de salida");
  }
  if (exp.trip?.dateTo) {
    add("trip_end",     exp.trip.dateTo,                "Fin de viaje / Regreso");
    add("post_trip",    addDays(exp.trip.dateTo, 3),    "Post-viaje: llamar al cliente 3 días después");
  }
  // Supplier payment limit dates
  exp.items.forEach(it => {
    if (it.dateTo) add("pay_supplier", addDays(it.dateTo,-5), `Pagar a ${WHOLESALERS.find(w=>w.id===it.wholesalerId)?.name||"mayorista"} (límite: ${it.dateTo})`);
  });
  // Client payments due
  return alarms;
};

const mkItem   = () => ({ id:uid(), concept:"HOTELES NACIONALES", wholesalerId:"bbr", dateFrom:"", dateTo:"", boleto:"", reserva:"", description:"", base:0, iva:0, tua:0, others:0, csb:18, currency:"USD", docs:[] });
const mkPay    = () => ({ id:uid(), date:today(), agentId:"1", account:"BG corriente 69-1", method:"Transferencia", reference:"", amount:0, confirmed:true, receipt:String(Math.floor(10000+Math.random()*90000)), note:"" });
const mkMPay   = () => ({ id:uid(), date:today(), agentId:"1", account:"", method:"Transferencia", reference:"", amount:0, confirmed:true, receipt:String(Math.floor(500000+Math.random()*100000)), note:"" });
const mkAlarm  = (type="manual") => ({ id:uid(), type, date:today(), note:"", status:"pending", source:"manual", createdAt:today() });
// Número de cliente autogenerado desde 1000
let _clientCounter = 1000;
const nextClientNo = (existingClients=[]) => {
  const nums = existingClients.map(c=>parseInt(c.clientNo)||0).filter(Boolean);
  const max = nums.length ? Math.max(...nums) : 999;
  return String(max + 1).padStart(4,"0");
};
const mkClient = (existingClients=[]) => ({
  id:uid(), created:today(), clientNo: nextClientNo(existingClients),
  tipo:"persona", // "persona" | "empresa"
  cat:"GENERAL", status:"activo", advisorId:"1",
  // Persona natural
  firstName:"", lastNameP:"", lastNameM:"", birthdate:"",
  // Empresa
  razonSocial:"", ruc:"", representante:"",
  // Común
  alta:today(), mobile:"", phone:"", officePhone:"", email:"", email2:"",
  address:"", colonia:"", city:"", cp:"00000", state:"", country:"Panama",
  nationality:"Panama - PA", contact:"", recommended:"", howKnow:"", notes:"",
  // Pasaporte y documentos
  passport:{ numero:"", vencimiento:"", foto:null },
  visas:[],
  // Relaciones familiares/amigos
  relaciones:[],
  // Fiscal
  taxId:"", taxName:"", taxAddress:"",
  docs:[],
});
const mkExp    = () => ({ id:uid(), no:Math.floor(7000+Math.random()*500), ventaNo:Math.floor(6500+Math.random()*500), created:today(), status:"nuevo", advisorId:"1", medium:"WHATSAPP", clientId:"", clientName:"", trip:{ title:"", destination:"", dateFrom:"", dateTo:"", paxAdult:2, paxChild:0, category:"" }, items:[], payments:[], majorPayments:[], alarms:[], contract:null, notes:"" });

// ─── UI ───────────────────────────────────────────────────────────────────────
const SI = { border:"1px solid #CFD8DC", borderRadius:4, padding:"5px 9px", fontSize:11, color:"#263238", background:"#fff", outline:"none", fontFamily:"inherit", width:"100%", boxSizing:"border-box" };
const LB = { fontSize:9, fontWeight:700, color:"#546E7A", letterSpacing:.8, textTransform:"uppercase", display:"block", marginBottom:2 };

function FI({ label, value, onChange, type="text", placeholder="", style={}, sm=false, readOnly=false }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", ...style }}>
      {label && <label style={LB}>{label}</label>}
      <input type={type} value={value||""} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} readOnly={readOnly}
        style={{ ...SI, padding: sm?"3px 7px":"5px 9px", fontSize: sm?10:11, background: readOnly?"#F5F5F5":"#fff" }}
        onFocus={e => !readOnly && (e.target.style.borderColor = B.blue)}
        onBlur={e  => (e.target.style.borderColor = "#CFD8DC")} />
    </div>
  );
}

function FS({ label, value, onChange, options, style={}, sm=false }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", ...style }}>
      {label && <label style={LB}>{label}</label>}
      <select value={value||""} onChange={e => onChange(e.target.value)}
        style={{ ...SI, padding: sm?"3px 7px":"5px 9px", fontSize: sm?10:11, cursor:"pointer" }}>
        {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
    </div>
  );
}

function FTA({ label, value, onChange, rows=3, placeholder="", style={} }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", ...style }}>
      {label && <label style={LB}>{label}</label>}
      <textarea value={value||""} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        style={{ ...SI, resize:"vertical" }}
        onFocus={e => (e.target.style.borderColor = B.blue)}
        onBlur={e  => (e.target.style.borderColor = "#CFD8DC")} />
    </div>
  );
}

function Btn({ children, onClick, v="primary", sz="md", style={}, disabled=false, full=false }) {
  const SZ = { sm:{ padding:"3px 9px", fontSize:10 }, md:{ padding:"5px 12px", fontSize:11 }, lg:{ padding:"8px 16px", fontSize:12 } };
  const VR = {
    primary:   { background:B.blue,  color:"#fff", border:"none" },
    dark:      { background:B.dark,  color:"#fff", border:"none" },
    secondary: { background:"#ECEFF1",color:"#37474F",border:"none" },
    teal:      { background:B.teal,  color:"#fff", border:"none" },
    danger:    { background:"#FFEBEE",color:B.red, border:"none" },
    success:   { background:"#E8F5E9",color:B.green,border:"none" },
    outline:   { background:"transparent",color:B.blue,border:`1.5px solid ${B.blue}` },
    gold:      { background:B.gold,  color:"#fff", border:"none" },
    ghost:     { background:"transparent",color:"#546E7A",border:"1px dashed #B0BEC5" },
  };
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      style={{ borderRadius:4, cursor:disabled?"not-allowed":"pointer", fontFamily:"inherit", fontWeight:700,
        display:"inline-flex", alignItems:"center", gap:4, opacity:disabled ? 0.5 : 1,
        width:full?"100%":"auto", justifyContent:full?"center":"flex-start",
        ...SZ[sz], ...VR[v], ...style }}>
      {children}
    </button>
  );
}

function Badge({ status }) {
  const s = EXP_STATUS[status] || EXP_STATUS.nuevo;
  return <span style={{ background:s.bg, color:s.c, padding:"2px 7px", borderRadius:8, fontSize:9, fontWeight:700, letterSpacing:.4, textTransform:"uppercase", whiteSpace:"nowrap" }}>{s.label}</span>;
}

function Tabs({ tabs, active, onSelect }) {
  return (
    <div style={{ borderBottom:"2px solid #ECEFF1", display:"flex", marginBottom:12, overflowX:"auto", background:"#fff" }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onSelect(t.id)}
          style={{ padding:"7px 14px", fontSize:11, fontWeight:active===t.id?700:500, border:"none", background:"transparent",
            cursor:"pointer", whiteSpace:"nowrap", fontFamily:"inherit",
            borderBottom:`2px solid ${active===t.id?B.blue:"transparent"}`,
            color:active===t.id?B.blue:"#546E7A", marginBottom:-2 }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Toast({ msg, type="success" }) {
  if (!msg) return null;
  const bg = type==="success" ? B.green : B.red;
  return (
    <div style={{ position:"fixed", top:55, right:16, zIndex:9999, background:bg, color:"#fff",
      borderRadius:6, padding:"8px 14px", fontSize:11, fontWeight:700, boxShadow:"0 4px 16px rgba(0,0,0,.25)" }}>
      {type==="success" ? "✅" : "❌"} {msg}
    </div>
  );
}

// ─── FILE UPLOADER (base64 in memory) ────────────────────────────────────────
function FileUploader({ docs=[], onChange, label="Adjuntar documento", accept="*" }) {
  const ref = React.useRef();
  const addFile = e => {
    [...e.target.files].forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => onChange([...docs, { id:uid(), name:f.name, size:f.size, type:f.type, data:ev.target.result, date:today() }]);
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  };
  const remove = id => onChange(docs.filter(d => d.id!==id));
  const fmt_size = b => b>1048576 ? `${(b/1048576).toFixed(1)} MB` : `${(b/1024).toFixed(0)} KB`;

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:6 }}>
        <label style={LB}>{label}</label>
        <button onClick={() => ref.current.click()}
          style={{ background:"#E3F2FD", border:"1px dashed #90CAF9", borderRadius:4, padding:"2px 9px", cursor:"pointer", fontSize:10, color:B.blue, fontWeight:700, fontFamily:"inherit" }}>
          📎 Subir archivo
        </button>
        <input ref={ref} type="file" accept={accept} multiple style={{ display:"none" }} onChange={addFile}/>
      </div>
      {docs.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          {docs.map(d => (
            <div key={d.id} style={{ display:"flex", alignItems:"center", gap:7, background:"#F5F7FA", border:"1px solid #E0E0E0", borderRadius:4, padding:"4px 9px", fontSize:10 }}>
              <span style={{ fontSize:14 }}>{d.type?.includes("pdf")?"📄":d.type?.includes("image")?"[imagen]":"📎"}</span>
              <a href={d.data} download={d.name} style={{ color:B.blue, fontWeight:600, textDecoration:"none", flex:1 }}>{d.name}</a>
              <span style={{ color:"#90A4AE" }}>{fmt_size(d.size)}</span>
              <span style={{ color:"#90A4AE" }}>{d.date}</span>
              <button onClick={() => remove(d.id)} style={{ background:"#FFEBEE", border:"none", borderRadius:3, padding:"1px 5px", cursor:"pointer", color:B.red, fontSize:9 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CATALOG PICKER MODAL ─────────────────────────────────────────────────────
function CatalogPicker({ onSelect, onClose }) {
  const [q, setQ]   = useState("");
  const [cat, setCat] = useState("all");
  const cats = ["all", ...new Set(CATALOG_PRODUCTS.map(p => p.concept))];
  const filtered = CATALOG_PRODUCTS.filter(p =>
    (cat==="all" || p.concept===cat) &&
    (!q || p.name.toLowerCase().includes(q.toLowerCase()) || p.concept.toLowerCase().includes(q.toLowerCase()))
  );
  const wh = id => WHOLESALERS.find(w => w.id===id)||WHOLESALERS[0];
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:4000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:8, width:"min(760px,96vw)", maxHeight:"85vh", display:"flex", flexDirection:"column", boxShadow:"0 8px 32px rgba(0,0,0,.25)" }}>
        <div style={{ background:B.dark, color:"#fff", padding:"11px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", borderRadius:"8px 8px 0 0" }}>
          <span style={{ fontWeight:700, fontSize:13 }}>? Seleccionar del Catálogo de Servicios</span>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.15)", border:"none", color:"#fff", borderRadius:4, padding:"2px 8px", cursor:"pointer", fontSize:13 }}>✕</button>
        </div>
        <div style={{ padding:"10px 14px", borderBottom:"1px solid #E0E0E0", display:"flex", gap:8 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Buscar servicio..."
            style={{ ...SI, flex:1, padding:"5px 9px", fontSize:11 }}/>
          <select value={cat} onChange={e => setCat(e.target.value)} style={{ ...SI, width:180, padding:"5px 9px", fontSize:11 }}>
            {cats.map(c => <option key={c} value={c}>{c==="all"?"Todas las categorías":c}</option>)}
          </select>
        </div>
        <div style={{ overflowY:"auto", flex:1 }}>
          {filtered.map(p => {
            const pub = (parseFloat(p.base)||0)+(parseFloat(p.iva)||0)+(parseFloat(p.tua)||0)+(parseFloat(p.others)||0);
            return (
              <div key={p.id} onClick={() => onSelect(p)}
                style={{ padding:"10px 14px", borderBottom:"1px solid #F5F5F5", cursor:"pointer", display:"flex", gap:10, alignItems:"flex-start" }}
                onMouseEnter={e => e.currentTarget.style.background="#E3F2FD"}
                onMouseLeave={e => e.currentTarget.style.background="#fff"}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:11, color:"#263238", marginBottom:3 }}>{p.name}</div>
                  <div style={{ fontSize:9, color:"#546E7A", marginBottom:3 }}>{p.concept} · {wh(p.wholesalerId).name} · {p.currency}</div>
                  <div style={{ fontSize:9, color:"#90A4AE", whiteSpace:"pre-line" }}>{p.description.slice(0,100)}{p.description.length>100?"…":""}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:14, fontWeight:900, color:B.blue }}>${fmt(pub)}</div>
                  <div style={{ fontSize:9, color:B.teal }}>Neta: ${fmt(pub*(1-p.csb/100))}</div>
                  <div style={{ fontSize:9, color:B.gold }}>CSB: {p.csb}%</div>
                </div>
              </div>
            );
          })}
          {filtered.length===0 && <div style={{ textAlign:"center", padding:30, color:"#B0BEC5", fontSize:11 }}>Sin resultados.</div>}
        </div>
      </div>
    </div>
  );
}

// ─── ITEM EDITOR ──────────────────────────────────────────────────────────────
function ItemEditor({ item, onChange, onDelete, canDelete }) {
  const [showCatalog, setShowCatalog] = useState(false);
  const [showDocs,    setShowDocs]    = useState(false);
  const pub  = (parseFloat(item.base)||0) + (parseFloat(item.iva)||0) + (parseFloat(item.tua)||0) + (parseFloat(item.others)||0);
  const neta = pub * (1 - (parseFloat(item.csb)||0)/100);
  const csb$ = pub - neta;
  const upd  = (f,v) => onChange({ ...item, [f]: v });

  const applyFromCatalog = p => {
    onChange({ ...item, concept:p.concept, wholesalerId:p.wholesalerId, description:p.description, base:p.base, iva:p.iva, tua:p.tua, others:p.others, csb:p.csb, currency:p.currency });
    setShowCatalog(false);
  };

  return (
    <div style={{ border:"1px solid #E0E0E0", borderRadius:6, overflow:"hidden", marginBottom:8 }}>
      {showCatalog && <CatalogPicker onSelect={applyFromCatalog} onClose={() => setShowCatalog(false)}/>}

      {/* Header row */}
      <div style={{ background: item._hbStatus ? "#E8F5E9" : "#F5F7FA", padding:"7px 11px", display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
        {/* Hotelbeds badge */}
        {item._hbStatus && (
          <div style={{ display:"flex", alignItems:"center", gap:5, background:"#fff", border:"1px solid #A5D6A7", borderRadius:4, padding:"2px 8px" }}>
            <span style={{ fontSize:10 }}>🏨</span>
            <span style={{ fontSize:9, fontWeight:800, color:B.green }}>HOTELBEDS</span>
            <span style={{ fontSize:9, color:"#546E7A" }}>·</span>
            <span style={{ fontSize:9, fontWeight:700, color: item._hbStatus==="confirmado" ? B.green : B.gold }}>
              {item._hbStatus==="confirmado" ? "✓ CONFIRMADO" : "⏳ COTIZACION"}
            </span>
            {item._hbStatus==="cotizacion" && (
              <button onClick={async () => {
                if (!item._hbRateKey) { alert("No hay rate key para confirmar. Busca el hotel nuevamente."); return; }
                // Check rate first
                try {
                  const check = await hbSearch({ action:"check_rate", rooms:[{ rateKey: item._hbRateKey }] });
                  const confirmedRate = check?.hotel?.rooms?.[0]?.rates?.[0];
                  if (confirmedRate) {
                    const newNet = parseFloat(confirmedRate.net || item.base);
                    upd("reserva", `HB-PENDIENTE-${Date.now()}`);
                    upd("_hbStatus", "listo_confirmar");
                    upd("base", newNet * (1 + (parseFloat(item.csb)||18)/100));
                    alert("Tarifa verificada. Precio actualizado. Ahora guarda el expediente para confirmar con Hotelbeds.");
                  }
                } catch(e) {
                  alert("Error verificando tarifa: " + e.message);
                }
              }}
                style={{ background:B.gold, color:"#fff", border:"none", borderRadius:3, padding:"2px 7px", cursor:"pointer", fontSize:9, fontWeight:700, fontFamily:"inherit" }}>
                Verificar tarifa
              </button>
            )}
          </div>
        )}
        <FS value={item.concept} onChange={v => upd("concept",v)} sm
          options={CONCEPTS.map(c => ({ value:c, label:c }))} style={{ width:185 }}/>
        <FS value={item.wholesalerId} onChange={v => upd("wholesalerId",v)} sm
          options={WHOLESALERS.map(w => ({ value:w.id, label:`${w.name} => ${w.code}` }))} style={{ flex:1, minWidth:155 }}/>
        <FS value={item.currency} onChange={v => upd("currency",v)} sm
          options={CURRENCIES.map(c => ({ value:c, label:c }))} style={{ width:65 }}/>
        {/* Catalog button */}
        <button onClick={() => setShowCatalog(true)}
          style={{ background:"#E8F5E9", border:"1px solid #A5D6A7", borderRadius:4, padding:"3px 8px", cursor:"pointer", fontSize:10, color:B.green, fontWeight:700, fontFamily:"inherit", whiteSpace:"nowrap" }}>
          ? Del catálogo
        </button>
        {/* Docs toggle */}
        <button onClick={() => setShowDocs(p => !p)}
          style={{ background: (item.docs||[]).length>0 ? "#E3F2FD" : "#F5F7FA", border:`1px solid ${(item.docs||[]).length>0?B.blue:"#CFD8DC"}`, borderRadius:4, padding:"3px 8px", cursor:"pointer", fontSize:10, color:(item.docs||[]).length>0?B.blue:"#546E7A", fontWeight:700, fontFamily:"inherit", whiteSpace:"nowrap" }}>
          📎 Docs {(item.docs||[]).length > 0 ? `(${item.docs.length})` : ""}
        </button>
        {canDelete && <button onClick={onDelete} style={{ background:"#FFEBEE", border:"none", borderRadius:4, padding:"2px 7px", cursor:"pointer", color:B.red, fontSize:10 }}>✕</button>}
      </div>

      <div style={{ padding:"9px 11px" }}>
        {/* Dates + refs */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 90px 90px", gap:7, marginBottom:7 }}>
          <FI label="Fecha inicio"  value={item.dateFrom} onChange={v => upd("dateFrom",v)} type="date" sm/>
          <FI label="Fecha fin"     value={item.dateTo}   onChange={v => upd("dateTo",v)}   type="date" sm/>
          <FI label="Num. Boleto"   value={item.boleto}   onChange={v => upd("boleto",v)}   sm/>
          <FI label="Reserva/Loc."  value={item.reserva}  onChange={v => upd("reserva",v)}  sm/>
        </div>

        {/* Description */}
        <FTA label="Descripción del servicio" value={item.description} onChange={v => upd("description",v)} rows={3}
          placeholder="Detalle del servicio, localizador, condiciones, política de cancelación... (o usa 'Del catálogo' para autocompletar)"/>

        {/* Pricing */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:7, marginTop:7 }}>
          <FI label="Base"   value={String(item.base)}   onChange={v => upd("base",   parseFloat(v)||0)} type="number" sm/>
          <FI label="IVA $"  value={String(item.iva)}    onChange={v => upd("iva",    parseFloat(v)||0)} type="number" sm/>
          <FI label="TUA"    value={String(item.tua)}    onChange={v => upd("tua",    parseFloat(v)||0)} type="number" sm/>
          <FI label="Otros"  value={String(item.others)} onChange={v => upd("others", parseFloat(v)||0)} type="number" sm/>
          <FI label="CSB %"  value={String(item.csb)}    onChange={v => upd("csb",    parseFloat(v)||0)} type="number" sm/>
          <div style={{ display:"flex", flexDirection:"column" }}>
            <label style={LB}>Pública</label>
            <div style={{ ...SI, background:"#E3F2FD", fontWeight:800, color:B.blue, padding:"3px 7px", fontSize:11 }}>${fmt(pub)}</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:12, marginTop:5, fontSize:10, color:"#546E7A" }}>
          <span>Neta: <b style={{ color:B.teal }}>${fmt(neta)}</b></span>
          <span>Comisión (CSB): <b style={{ color:B.gold }}>${fmt(csb$)} ({item.csb||0}%)</b></span>
        </div>

        {/* Documents section */}
        {showDocs && (
          <div style={{ marginTop:10, padding:"10px 11px", background:"#F8FBFF", border:"1px solid #BBDEFB", borderRadius:5 }}>
            <FileUploader
              docs={item.docs||[]}
              onChange={v => upd("docs",v)}
              label="Documentos de viaje de esta partida (vouchers, confirmaciones, boletos, etc.)"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"/>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PAY ROW ──────────────────────────────────────────────────────────────────
function PayRow({ pay, onChange, onDelete, isMajor=false }) {
  const upd = (f,v) => onChange({ ...pay, [f]: v });
  return (
    <tr style={{ background: isMajor ? "#FFFDE7" : "#fff", borderBottom:"1px solid #F5F5F5" }}>
      <td style={{ padding:"3px 6px" }}><span style={{ color:B.blue, fontSize:10, fontWeight:700 }}>{pay.receipt}</span></td>
      <td style={{ padding:"3px 6px" }}><input type="date" value={pay.date} onChange={e => upd("date",e.target.value)} style={{ ...SI, width:108, padding:"2px 5px", fontSize:10 }}/></td>
      <td style={{ padding:"3px 6px" }}>
        <select value={pay.agentId} onChange={e => upd("agentId",e.target.value)} style={{ ...SI, width:80, padding:"2px 5px", fontSize:10 }}>
          {ADVISORS.map(a => <option key={a.id} value={a.id}>{a.name.split(" ")[0]}</option>)}
        </select>
      </td>
      <td style={{ padding:"3px 6px" }}><input value={pay.account} onChange={e => upd("account",e.target.value)} style={{ ...SI, width:130, padding:"2px 5px", fontSize:10 }}/></td>
      <td style={{ padding:"3px 6px" }}>
        <select value={pay.method} onChange={e => upd("method",e.target.value)} style={{ ...SI, width:110, padding:"2px 5px", fontSize:10 }}>
          {PAY_METHODS.map(m => <option key={m}>{m}</option>)}
        </select>
      </td>
      <td style={{ padding:"3px 6px" }}><input value={pay.reference} onChange={e => upd("reference",e.target.value)} placeholder="Ref." style={{ ...SI, width:85, padding:"2px 5px", fontSize:10 }}/></td>
      <td style={{ padding:"3px 6px" }}><input type="number" value={pay.amount} onChange={e => upd("amount",parseFloat(e.target.value)||0)} style={{ ...SI, width:78, padding:"2px 5px", fontSize:10, fontWeight:700 }}/></td>
      <td style={{ padding:"3px 6px", textAlign:"center" }}><input type="checkbox" checked={pay.confirmed} onChange={e => upd("confirmed",e.target.checked)} style={{ accentColor: B.green }}/></td>
      <td style={{ padding:"3px 6px" }}><button onClick={onDelete} style={{ background:"#FFEBEE", border:"none", borderRadius:3, padding:"2px 6px", cursor:"pointer", color:B.red, fontSize:9 }}>✕</button></td>
    </tr>
  );
}

// ─── BALANCE VIEW ─────────────────────────────────────────────────────────────
function BalanceView({ exp }) {
  const totalPub   = exp.items.reduce((s,it) => { const p=(parseFloat(it.base)||0)+(parseFloat(it.iva)||0)+(parseFloat(it.tua)||0)+(parseFloat(it.others)||0); return s+p; }, 0);
  const totalCli   = exp.payments.filter(p => p.confirmed).reduce((s,p) => s+(parseFloat(p.amount)||0), 0);
  const totalMaj   = exp.majorPayments.filter(p => p.confirmed).reduce((s,p) => s+(parseFloat(p.amount)||0), 0);
  const available  = totalCli - totalMaj;
  const totalNeta  = exp.items.reduce((s,it) => { const p=(parseFloat(it.base)||0)+(parseFloat(it.iva)||0)+(parseFloat(it.tua)||0)+(parseFloat(it.others)||0); return s + p*(1-(parseFloat(it.csb)||0)/100); }, 0);
  const totalProd  = totalPub - totalNeta;

  return (
    <div>
      {/* Flujo disponible */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:10, fontWeight:700, color:"#546E7A", marginBottom:7, textTransform:"uppercase", letterSpacing:.8 }}>Flujo disponible</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {[
            { label:"Venta total",    value:`$${fmt(totalPub)}`, color:B.blue },
            { label:"Pagos cliente",  value:`$${fmt(totalCli)}`, color:B.teal },
            { label:"Pagos mayoristas", value:`$${fmt(totalMaj)}`, color:B.gold },
            { label:"Disponible",     value:`$${fmt(available)}`, color:available>=0?B.green:B.red },
          ].map(s => (
            <div key={s.label} style={{ background:"#F8F9FA", border:"1px solid #E0E0E0", borderRadius:6, padding:"10px 12px", textAlign:"center" }}>
              <div style={{ fontSize:9, color:"#546E7A", marginBottom:3 }}>{s.label}</div>
              <div style={{ fontSize:16, fontWeight:900, color:s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cuentas por pagar mayoristas */}
      {exp.items.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#546E7A", marginBottom:7, textTransform:"uppercase", letterSpacing:.8 }}>Cuentas por pagar a mayoristas</div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
              <thead>
                <tr style={{ background:"#F5F7FA" }}>
                  {["Mayorista","Concepto","Descripción","Pública","Neta","Comisión","%","Pagos","Límite",""].map(h => (
                    <th key={h} style={{ padding:"5px 7px", textAlign:"left", fontSize:9, fontWeight:700, color:"#546E7A", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exp.items.map(it => {
                  const pub  = (parseFloat(it.base)||0)+(parseFloat(it.iva)||0)+(parseFloat(it.tua)||0)+(parseFloat(it.others)||0);
                  const neta = pub*(1-(parseFloat(it.csb)||0)/100);
                  const csb  = pub - neta;
                  const wh   = WHOLESALERS.find(w => w.id===it.wholesalerId) || WHOLESALERS[0];
                  const paid = exp.majorPayments.filter(p => p.confirmed).reduce((s,p) => s+(parseFloat(p.amount)||0), 0);
                  return (
                    <tr key={it.id} style={{ borderBottom:"1px solid #F5F5F5" }}>
                      <td style={{ padding:"5px 7px", fontWeight:600 }}>{wh.name}</td>
                      <td style={{ padding:"5px 7px" }}>{it.concept}</td>
                      <td style={{ padding:"5px 7px", color:"#546E7A", maxWidth:250, fontSize:9 }}>{(it.description||"").slice(0,70)}{it.description?.length>70?"…":""}</td>
                      <td style={{ padding:"5px 7px", fontWeight:700, color:B.blue }}>${fmt(pub)}</td>
                      <td style={{ padding:"5px 7px", color:B.teal }}>${fmt(neta)}</td>
                      <td style={{ padding:"5px 7px", color:B.gold, fontWeight:700 }}>${fmt(csb)}</td>
                      <td style={{ padding:"5px 7px" }}>{it.csb||0}%</td>
                      <td style={{ padding:"5px 7px", color:B.green }}>${fmt(paid)}</td>
                      <td style={{ padding:"5px 7px", color:"#546E7A" }}>{it.dateTo||"–"}</td>
                      <td style={{ padding:"5px 7px" }}><Btn v="teal" sz="sm">Pagar</Btn></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Productividad */}
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:"#546E7A", marginBottom:7, textTransform:"uppercase", letterSpacing:.8 }}>Productividad</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
          {[
            { label:"Venta",          value:`$${fmt(totalPub)}` },
            { label:"Productividad",  value:`$${fmt(totalProd)}` },
            { label:"% Productividad", value:totalPub>0 ? `${((totalProd/totalPub)*100).toFixed(2)}%` : "0.00%" },
          ].map(s => (
            <div key={s.label} style={{ background:"#F8F9FA", border:"1px solid #E0E0E0", borderRadius:6, padding:"10px 12px", textAlign:"center" }}>
              <div style={{ fontSize:9, color:"#546E7A", marginBottom:3 }}>{s.label}</div>
              <div style={{ fontSize:14, fontWeight:800, color:B.blue }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:7, fontSize:9, color:B.red }}>
          Estatus expediente: {EXP_STATUS[exp.status]?.label||exp.status}. Sin comisiones generadas por cobrar.
        </div>
      </div>
    </div>
  );
}

// ─── ALARM PANEL ─────────────────────────────────────────────────────────────
function AlarmPanel({ alarms=[], onChange, exp, client }) {
  const [showForm, setShowForm] = useState(false);
  const [newAlarm, setNewAlarm] = useState(mkAlarm);
  const [filter,   setFilter]   = useState("all"); // all | pending | done

  const upd     = (id,f,v) => onChange(alarms.map(a => a.id===id ? {...a,[f]:v} : a));
  const remove  = id => onChange(alarms.filter(a => a.id!==id));
  const addManual = () => { onChange([...alarms, {...newAlarm, id:uid(), source:"manual"}]); setNewAlarm(mkAlarm()); setShowForm(false); };
  const regen   = () => onChange([...alarms.filter(a => a.source==="manual"), ...autoAlarms(exp, client)]);

  const filtered  = alarms.filter(a => filter==="all" || a.status===filter).sort((a,b) => a.date.localeCompare(b.date));
  const pending   = alarms.filter(a => a.status==="pending").length;
  const today_str = today();

  const daysDiff = d => {
    const diff = Math.ceil((new Date(d) - new Date()) / (1000*60*60*24));
    return diff;
  };

  const urgencyLabel = d => {
    const diff = daysDiff(d);
    if (diff < 0)  return { label:`hace ${Math.abs(diff)} día${Math.abs(diff)!==1?"s":""}`, color:B.red, bg:"#FFEBEE" };
    if (diff === 0) return { label:"HOY",             color:"#5D4037", bg:"#FFF3E0" };
    if (diff <= 3)  return { label:`en ${diff} día${diff!==1?"s":""}`, color:"#E65100", bg:"#FBE9E7" };
    if (diff <= 7)  return { label:`en ${diff} días`, color:B.gold,   bg:"#FFF8E1" };
    return { label:d, color:"#546E7A", bg:"#F5F5F5" };
  };

  return (
    <div>
      {/* Top controls */}
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:12, flexWrap:"wrap" }}>
        <div style={{ flex:1, display:"flex", gap:6 }}>
          {["all","pending","done","dismissed"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding:"3px 10px", borderRadius:4, border:`1.5px solid ${filter===f?B.blue:"#CFD8DC"}`, background:filter===f?B.blue:"#fff", color:filter===f?"#fff":"#546E7A", cursor:"pointer", fontSize:10, fontWeight:700, fontFamily:"inherit" }}>
              {f==="all"?"Todas":f==="pending"?"Pendientes":f==="done"?"Completadas":"Ignoradas"}
              {f==="pending"&&pending>0?` (${pending})`:""}
            </button>
          ))}
        </div>
        <Btn v="secondary" sz="sm" onClick={regen}>[actualizar] Regenerar automáticas</Btn>
        <Btn v="primary"   sz="sm" onClick={() => setShowForm(p => !p)}>+ Agregar alarma</Btn>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ background:"#F0F9FF", border:"1.5px solid #90CAF9", borderRadius:7, padding:13, marginBottom:12 }}>
          <div style={{ fontSize:11, fontWeight:700, color:B.blue, marginBottom:9 }}>📌 Nueva alarma manual</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 130px", gap:8, marginBottom:8 }}>
            <FS label="Tipo de alarma" value={newAlarm.type}
              onChange={v => setNewAlarm(p => ({...p, type:v}))}
              options={ALARM_TYPES.map(t => ({ value:t.id, label:`${t.icon} ${t.label}` }))}/>
            <FI label="Fecha" value={newAlarm.date} onChange={v => setNewAlarm(p => ({...p, date:v}))} type="date"/>
            <FS label="Estado" value={newAlarm.status}
              onChange={v => setNewAlarm(p => ({...p, status:v}))}
              options={Object.entries(ALARM_STATUS).map(([k,s]) => ({ value:k, label:s.label }))}/>
          </div>
          <FI label="Nota / descripción" value={newAlarm.note} onChange={v => setNewAlarm(p => ({...p, note:v}))} placeholder="Descripción de la alarma..." style={{ marginBottom:8 }}/>
          <div style={{ display:"flex", gap:7 }}>
            <Btn v="primary" sz="sm" onClick={addManual}>💾 Guardar alarma</Btn>
            <Btn v="secondary" sz="sm" onClick={() => setShowForm(false)}>Cancelar</Btn>
          </div>
        </div>
      )}

      {/* Alarm list */}
      <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
        {filtered.length===0 && (
          <div style={{ textAlign:"center", padding:30, color:"#B0BEC5", fontSize:11 }}>
            <div style={{ fontSize:28, marginBottom:8 }}>🔔</div>
            Sin alarmas. Usa "Regenerar automáticas" para crear alarmas según las fechas del expediente.
          </div>
        )}
        {filtered.map(a => {
          const atype = ALARM_TYPES.find(t => t.id===a.type) || { icon:"📌", label:a.type, color:"#546E7A" };
          const urg   = urgencyLabel(a.date);
          const isDone = a.status==="done";
          return (
            <div key={a.id} style={{ background:isDone?"#F8F9FA":"#fff", borderRadius:7,
              border: `1.5px solid ${isDone?"#E0E0E0": a.status==="dismissed"?"#E0E0E0": daysDiff(a.date)<0?"#FFCDD2": daysDiff(a.date)<=3?"#FFE0B2":"#E0E0E0"}`,
              padding:"9px 12px", opacity:(isDone||a.status==="dismissed") ? 0.65 : 1 }}>
              <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                {/* Icon + type */}
                <div style={{ width:34, height:34, borderRadius:"50%", background:atype.color+"22", color:atype.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
                  {atype.icon}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:2, flexWrap:"wrap" }}>
                    <span style={{ fontWeight:700, fontSize:11, color:"#263238", textDecoration:isDone?"line-through":"none" }}>{atype.label}</span>
                    <span style={{ fontSize:9, background:urg.bg, color:urg.color, padding:"2px 7px", borderRadius:8, fontWeight:700 }}>{urg.label}</span>
                    {a.source==="auto" && <span style={{ fontSize:8, background:"#E8F5E9", color:B.green, padding:"1px 5px", borderRadius:4, fontWeight:700 }}>AUTO</span>}
                  </div>
                  {a.note && <div style={{ fontSize:10, color:"#546E7A", marginBottom:2 }}>{a.note}</div>}
                  <div style={{ fontSize:9, color:"#90A4AE" }}>Creada: {a.createdAt}</div>
                </div>
                {/* Actions */}
                <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                  {a.status==="pending" && (
                    <>
                      <button onClick={() => upd(a.id,"status","done")}
                        style={{ background:"#E8F5E9", border:"none", borderRadius:4, padding:"3px 8px", cursor:"pointer", color:B.green, fontSize:10, fontWeight:700, fontFamily:"inherit" }}>✓ Completar</button>
                      <button onClick={() => upd(a.id,"status","dismissed")}
                        style={{ background:"#F5F5F5", border:"none", borderRadius:4, padding:"3px 8px", cursor:"pointer", color:"#546E7A", fontSize:10, fontFamily:"inherit" }}>Ignorar</button>
                    </>
                  )}
                  {a.status!=="pending" && (
                    <button onClick={() => upd(a.id,"status","pending")}
                      style={{ background:"#FFF8E1", border:"none", borderRadius:4, padding:"3px 8px", cursor:"pointer", color:B.gold, fontSize:10, fontFamily:"inherit" }}>↺ Reabrir</button>
                  )}
                  <button onClick={() => remove(a.id)}
                    style={{ background:"#FFEBEE", border:"none", borderRadius:4, padding:"3px 7px", cursor:"pointer", color:B.red, fontSize:10 }}>✕</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stats footer */}
      {alarms.length > 0 && (
        <div style={{ display:"flex", gap:10, marginTop:12, fontSize:10, color:"#546E7A", padding:"8px 0", borderTop:"1px solid #E0E0E0" }}>
          <span>Total: <b>{alarms.length}</b></span>
          <span>Pendientes: <b style={{ color:B.red }}>{alarms.filter(a=>a.status==="pending").length}</b></span>
          <span>Completadas: <b style={{ color:B.green }}>{alarms.filter(a=>a.status==="done").length}</b></span>
          <span>Ignoradas: <b>{alarms.filter(a=>a.status==="dismissed").length}</b></span>
        </div>
      )}
    </div>
  );
}

// ─── EXPEDIENTE DETAIL ────────────────────────────────────────────────────────
function ExpDetail({ exp, onSave, onBack, clients }) {
  const [e, setE]   = useState(() => JSON.parse(JSON.stringify(exp)));
  const [tab, setTab] = useState("venta");
  const [showHotelSearch, setShowHotelSearch] = useState(false);
  const upd    = (f,v) => setE(p => ({ ...p, [f]: v }));
  const updTrip = (f,v) => setE(p => ({ ...p, trip: { ...p.trip, [f]: v } }));

  const adv    = ADVISORS.find(a => a.id===e.advisorId) || ADVISORS[0];
  const client = clients.find(c => c.id===e.clientId);

  const totalPub  = e.items.reduce((s,it) => { const p=(parseFloat(it.base)||0)+(parseFloat(it.iva)||0)+(parseFloat(it.tua)||0)+(parseFloat(it.others)||0); return s+p; }, 0);
  const totalPaid = e.payments.filter(p => p.confirmed).reduce((s,p) => s+(parseFloat(p.amount)||0), 0);
  const saldo     = totalPub - totalPaid;
  const pendAlarms = (e.alarms||[]).filter(a => a.status==="pending").length;

  const addItem   = () => setE(p => ({ ...p, items:[...p.items, mkItem()] }));
  const updItem   = (id,val) => setE(p => ({ ...p, items: p.items.map(it => it.id===id ? val : it) }));
  const remItem   = id => setE(p => ({ ...p, items: p.items.filter(it => it.id!==id) }));
  const addPay    = () => setE(p => ({ ...p, payments:[...p.payments, mkPay()] }));
  const updPay    = (id,val) => setE(p => ({ ...p, payments: p.payments.map(py => py.id===id ? val : py) }));
  const remPay    = id => setE(p => ({ ...p, payments: p.payments.filter(py => py.id!==id) }));
  const addMPay   = () => setE(p => ({ ...p, majorPayments:[...p.majorPayments, mkMPay()] }));
  const updMPay   = (id,val) => setE(p => ({ ...p, majorPayments: p.majorPayments.map(py => py.id===id ? val : py) }));

  // Add hotel from Hotelbeds as a sale item
  const addItemFromHotelbeds = (sel) => {
    const wh = WHOLESALERS.find(w => w.id==="bbr") ? "bbr" : "other";
    const boardName = sel.rate?.boardName || sel.rate?.boardCode || "Room Only";
    const roomName  = sel.room?.name || sel.room?.code || "Habitacion";
    const desc = [
      `Hotel: ${sel.hotel.name}`,
      `Habitacion: ${roomName}`,
      `Plan: ${boardName}`,
      `Localizador Hotelbeds: (pendiente de confirmacion)`,
      `Check-in: ${sel.checkIn}`,
      `Check-out: ${sel.checkOut}`,
      `${sel.nights} noches · ${sel.rooms} habitacion(es) · ${sel.adults} adultos${sel.children>0?" · "+sel.children+" ninos":""}`,
      `Tarifa neta/noche: $${sel.netPerNight.toFixed(2)}`,
      `Precio publico/noche: $${sel.pubPerNight.toFixed(2)}`,
      sel.rate?.cancellationPolicies?.[0] ? `Cancelacion: ${sel.rate.cancellationPolicies[0].amount?" Sin reembolso a partir del "+sel.rate.cancellationPolicies[0].from:"Ver politica"}` : "",
    ].filter(Boolean).join("\n");

    const newItem = {
      id: uid(),
      concept: "HOTELES INTERNACIONALES",
      wholesalerId: wh,
      dateFrom: sel.checkIn,
      dateTo:   sel.checkOut,
      boleto:   "",
      reserva:  "",
      description: desc,
      base:   sel.pubTotal,
      iva:    0,
      tua:    0,
      others: 0,
      csb:    sel.margin,
      currency: "USD",
      docs:   [],
      // Extra metadata
      _hbHotelCode: sel.hotel.code,
      _hbHotelName: sel.hotel.name,
      _hbRateKey:   sel.rate?.rateKey || "",
      _hbStatus:    "cotizacion", // cotizacion → confirmado
      _hbNetTotal:  sel.netTotal,
      _hbPubTotal:  sel.pubTotal,
    };

    setE(p => ({ ...p, items:[...p.items, newItem] }));
    setShowHotelSearch(false);
    setTab("venta");
  };
  const remMPay   = id => setE(p => ({ ...p, majorPayments: p.majorPayments.filter(py => py.id!==id) }));

  const TABS = [
    { id:"cotizaciones", label:"Cotizaciones" },
    { id:"pasajeros",    label:"Pasajeros" },
    { id:"venta",        label:"Venta" },
    { id:"balance",      label:"Balance / Desglose" },
    { id:"documentos",   label:"📎 Documentos" + ((e.contract||(e.items||[]).some(it=>(it.docs||[]).length>0)) ? " ✅" : "") },
    { id:"alarmas",      label:"🔔 Alarmas" + (pendAlarms>0 ? " ("+pendAlarms+")" : "") },
    { id:"historial",    label:"Historial" },
  ];

  const thStyle = { padding:"5px 7px", textAlign:"left", fontSize:9, fontWeight:700, color:"#546E7A", whiteSpace:"nowrap" };

  return (
    <div style={{ padding:18, maxWidth:1100, margin:"0 auto" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10, flexWrap:"wrap", gap:7 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:3 }}>
            <h2 style={{ margin:0, fontSize:17, color:B.dark, fontWeight:900 }}>Expediente No.- {e.no}</h2>
            <Badge status={e.status}/>
          </div>
          <div style={{ fontSize:10, color:"#546E7A" }}>Venta No.- {e.ventaNo} · {e.created} · {adv.name}</div>
        </div>
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          <Btn v="primary" sz="sm" onClick={() => onSave(e)}>💾 Guardar</Btn>
          <Btn v="secondary" sz="sm" onClick={onBack}>&larr; Atrás</Btn>
        </div>
      </div>

      {/* Client row */}
      <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:6, padding:"9px 12px", marginBottom:11, overflowX:"auto" }}>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ fontSize:11, color:B.blue, fontWeight:700, minWidth:70 }}>{adv.name.split(" ")[0].toUpperCase()}</div>
          <FS value={e.medium} onChange={v => upd("medium",v)} sm
            options={["WHATSAPP","TELEFONO","EMAIL","PRESENCIAL","INSTAGRAM","FACEBOOK"].map(x => ({ value:x, label:x }))}
            style={{ width:120 }}/>
          <FS value={e.status} onChange={v => upd("status",v)} sm
            options={Object.entries(EXP_STATUS).map(([k,c]) => ({ value:k, label:c.label }))}
            style={{ width:110 }}/>
          <div style={{ fontSize:11, color:B.blue, fontWeight:600, flex:1, minWidth:120 }}>{e.clientName || (client ? `${client.firstName} ${client.lastNameP}` : "– Sin cliente –")}</div>
          <div style={{ fontSize:10, color:"#546E7A" }}>{client?.email||"–"}</div>
          <div style={{ fontSize:10, color:"#546E7A" }}>{client?.mobile||"–"}</div>
          <div style={{ fontSize:10, color:"#546E7A" }}>{e.trip.dateFrom||"–"} → {e.trip.dateTo||"–"}</div>
          <div style={{ fontSize:11, fontWeight:600, color:B.blue }}>{e.trip.destination||"–"}</div>
        </div>
        {e.notes && <div style={{ marginTop:5, fontSize:9, color:"#546E7A", background:"#F5F7FA", padding:"3px 7px", borderRadius:3 }}>Notas: {e.notes}</div>}
      </div>

      <Tabs tabs={TABS} active={tab} onSelect={setTab}/>

      {/* VENTA */}
      {tab==="venta" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:9 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#37474F" }}>Venta No.- {e.ventaNo} &nbsp;·&nbsp; Fecha: <span style={{ color:B.blue }}>{e.created}</span></div>
          </div>

          {e.items.map(it => (
            <ItemEditor key={it.id} item={it} onChange={val => updItem(it.id,val)}
              onDelete={() => remItem(it.id)} canDelete={true}/>
          ))}
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <Btn v="ghost" sz="sm" onClick={addItem}>+ Agregar partida manual</Btn>
            <Btn v="teal"  sz="sm" onClick={() => setShowHotelSearch(true)}>🏨 Buscar hotel en Hotelbeds</Btn>
          </div>

          {/* Hotelbeds search modal */}
          {showHotelSearch && (
            <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:3000, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"20px 12px", overflowY:"auto" }}>
              <div style={{ background:"#fff", borderRadius:10, width:"min(1100px,96vw)", boxShadow:"0 8px 40px rgba(0,0,0,.3)" }}>
                <div style={{ background:B.dark, color:"#fff", padding:"12px 18px", borderRadius:"10px 10px 0 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ fontWeight:800, fontSize:14 }}>🏨 Buscar hotel en Hotelbeds — agregar a expediente {e.no}</div>
                  <button onClick={() => setShowHotelSearch(false)}
                    style={{ background:"rgba(255,255,255,.15)", border:"none", color:"#fff", borderRadius:5, padding:"3px 10px", cursor:"pointer", fontSize:13 }}>✕</button>
                </div>
                <HotelBuscador onSelectHotel={sel => { addItemFromHotelbeds(sel); }}/>
              </div>
            </div>
          )}

          {/* Total */}
          <div style={{ textAlign:"right", marginTop:9, paddingTop:9, borderTop:"2px solid #E0E0E0" }}>
            <span style={{ fontSize:12, fontWeight:700, color:"#546E7A", marginRight:10 }}>Total. -</span>
            <span style={{ fontSize:17, fontWeight:900, color:B.dark }}>${fmt(totalPub)} {e.items[0]?.currency||"USD"}</span>
          </div>

          <div style={{ display:"flex", gap:7, marginTop:9 }}>
            <Btn v="secondary" sz="sm" onClick={() => setTab("balance")}>☰ Balance</Btn>
            <Btn v="secondary" sz="sm" onClick={() => setTab("balance")}>☰ Desglose</Btn>
            <div style={{ flex:1 }}/>
            <Btn v="danger" sz="sm">CANCELAR VENTA</Btn>
            <Btn v="teal"   sz="sm">ABRIR VENTA</Btn>
          </div>

          {/* Pagos cliente */}
          <div style={{ marginTop:14 }}>
            <div style={{ background:B.dark, color:"#fff", padding:"6px 11px", borderRadius:"5px 5px 0 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontWeight:700, fontSize:11 }}>Pagos cliente</span>
              <div style={{ display:"flex", gap:5 }}>
                <Btn v="gold" sz="sm" onClick={addPay}>+ Agregar pago</Btn>
                <Btn v="secondary" sz="sm">Fecha Próximo Pago</Btn>
              </div>
            </div>
            <div style={{ border:"1px solid #E0E0E0", borderTop:"none", borderRadius:"0 0 5px 5px", overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
                <thead><tr style={{ background:"#F5F7FA" }}>
                  {["Recibo","Fecha","Agente","Cuenta","Forma Pago","Referencia","Pago","✓",""].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {e.payments.map(p => <PayRow key={p.id} pay={p} onChange={val => updPay(p.id,val)} onDelete={() => remPay(p.id)}/>)}
                </tbody>
              </table>
              {e.payments.length===0 && <div style={{ textAlign:"center", padding:14, color:"#B0BEC5", fontSize:10 }}>Sin pagos registrados.</div>}
            </div>
            {e.payments.length > 0 && (
              <div style={{ display:"flex", gap:14, marginTop:6, fontSize:10, justifyContent:"flex-end", color:"#546E7A" }}>
                <span>Pagado: <b style={{ color:B.green }}>${fmt(totalPaid)}</b></span>
                <span>Saldo: <b style={{ color:saldo>0?B.red:B.green }}>${fmt(saldo)}</b></span>
              </div>
            )}
          </div>

          {/* Pagos mayorista */}
          <div style={{ marginTop:12 }}>
            <div style={{ background:"#455A64", color:"#fff", padding:"6px 11px", borderRadius:"5px 5px 0 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontWeight:700, fontSize:11 }}>Pagos a mayorista</span>
              <Btn v="gold" sz="sm" onClick={addMPay}>+ Agregar pago</Btn>
            </div>
            <div style={{ border:"1px solid #E0E0E0", borderTop:"none", borderRadius:"0 0 5px 5px", overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
                <thead><tr style={{ background:"#F5F7FA" }}>
                  {["Folio","Fecha","Agente","May.","Cuenta","Forma Pago","Pagos","✓",""].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {e.majorPayments.map(p => <PayRow key={p.id} pay={p} onChange={val => updMPay(p.id,val)} onDelete={() => remMPay(p.id)} isMajor/>)}
                </tbody>
              </table>
              {e.majorPayments.length===0 && <div style={{ textAlign:"center", padding:14, color:"#B0BEC5", fontSize:10 }}>Sin pagos a mayoristas.</div>}
              {e.majorPayments.length > 0 && (
                <div style={{ padding:"5px 11px", textAlign:"right", fontSize:10, color:"#546E7A" }}>
                  Total: <b style={{ color:B.teal }}>${fmt(e.majorPayments.filter(p=>p.confirmed).reduce((s,p)=>s+(parseFloat(p.amount)||0),0))}</b>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab==="balance" && <BalanceView exp={e}/>}

      {/* DOCUMENTOS */}
      {tab==="documentos" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {/* Contract */}
          <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:7, padding:16 }}>
            <div style={{ fontSize:11, fontWeight:800, color:B.dark, marginBottom:11, textTransform:"uppercase", letterSpacing:.7 }}>
              📝 Contrato firmado del cliente
            </div>
            {e.contract ? (
              <div style={{ display:"flex", alignItems:"center", gap:10, background:"#E8F5E9", border:"1px solid #A5D6A7", borderRadius:6, padding:"10px 14px" }}>
                <span style={{ fontSize:24 }}>📄</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:12, color:"#263238" }}>{e.contract.name}</div>
                  <div style={{ fontSize:10, color:"#546E7A" }}>
                    {(e.contract.size/1024).toFixed(0)} KB · Subido el {e.contract.date}
                  </div>
                </div>
                <a href={e.contract.data} download={e.contract.name}>
                  <Btn v="success" sz="sm">⬇ Descargar</Btn>
                </a>
                <Btn v="danger" sz="sm" onClick={() => upd("contract", null)}>✕ Quitar</Btn>
              </div>
            ) : (
              <div>
                <p style={{ fontSize:11, color:"#546E7A", marginTop:0 }}>
                  Sube aquí el contrato firmado por el cliente. Formatos aceptados: PDF, JPG, PNG, DOC.
                </p>
                <FileUploader
                  docs={e.contract ? [e.contract] : []}
                  onChange={files => upd("contract", files[files.length-1]||null)}
                  label=""
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"/>
              </div>
            )}
          </div>

          {/* Documents per item */}
          <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:7, padding:16 }}>
            <div style={{ fontSize:11, fontWeight:800, color:B.dark, marginBottom:11, textTransform:"uppercase", letterSpacing:.7 }}>
              📎 Documentos de viaje por partida
            </div>
            {e.items.length===0 && (
              <div style={{ textAlign:"center", padding:20, color:"#B0BEC5", fontSize:11 }}>
                Agrega partidas en la pestaña "Venta" para poder adjuntar documentos por servicio.
              </div>
            )}
            {e.items.map((it,idx) => {
              const wh = WHOLESALERS.find(w => w.id===it.wholesalerId)||WHOLESALERS[0];
              return (
                <div key={it.id} style={{ marginBottom:12, padding:"11px 13px", background:"#F8FBFF", border:"1px solid #BBDEFB", borderRadius:6 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                    <span style={{ background:"#1565C0", color:"#fff", borderRadius:4, padding:"1px 7px", fontSize:9, fontWeight:800 }}>Partida {idx+1}</span>
                    <span style={{ fontWeight:700, fontSize:11, color:"#263238" }}>{it.concept}</span>
                    <span style={{ fontSize:10, color:"#546E7A" }}>· {wh.name}</span>
                    {it.reserva && <span style={{ fontSize:10, color:B.blue, fontWeight:600 }}>· Res: {it.reserva}</span>}
                    {(it.docs||[]).length > 0 && <span style={{ fontSize:9, background:"#E8F5E9", color:B.green, padding:"1px 6px", borderRadius:8, fontWeight:700 }}>✓ {it.docs.length} doc{it.docs.length!==1?"s":""}</span>}
                  </div>
                  <FileUploader
                    docs={it.docs||[]}
                    onChange={v => updItem(it.id, {...it, docs:v})}
                    label="Vouchers, confirmaciones, boletos, itinerarios..."
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"/>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ALARMAS */}
      {tab==="alarmas" && (
        <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:7, padding:16 }}>
          <AlarmPanel
            alarms={e.alarms||[]}
            onChange={v => upd("alarms", v)}
            exp={e}
            client={client}/>
        </div>
      )}

      {tab==="pasajeros" && (
        <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:6, padding:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 60px", gap:9, marginBottom:10 }}>
            <FI label="Destino/Etiquetas" value={e.trip.destination} onChange={v => updTrip("destination",v)} placeholder="Gran Evenia Bijao, RESORTS..."/>
            <FI label="Salida"  value={e.trip.dateFrom} onChange={v => updTrip("dateFrom",v)} type="date"/>
            <FI label="Regreso" value={e.trip.dateTo}   onChange={v => updTrip("dateTo",v)}   type="date"/>
            <FS label="Categoría" value={e.trip.category} onChange={v => updTrip("category",v)}
              options={["","RESORTS","AEREO","PAQUETES","TOURS","CRUCEROS","SEGUROS"].map(x => ({ value:x, label:x }))}/>
            <FI label="Adultos" value={String(e.trip.paxAdult)} onChange={v => updTrip("paxAdult",parseInt(v)||0)} type="number"/>
          </div>
          <FTA label="Notas del expediente" value={e.notes} onChange={v => upd("notes",v)} rows={4}
            placeholder="Observaciones, requerimientos especiales, condiciones especiales..."/>
          <FI label="Nombre cliente (si no está en el sistema)" value={e.clientName} onChange={v => upd("clientName",v)} style={{ marginTop:9 }}/>
        </div>
      )}

      {tab==="cotizaciones" && (
        <CotizacionModule exp={e} onUpdate={updatedExp => setE(updatedExp)}/>
      )}

      {tab==="historial" && (
        <div style={{ textAlign:"center", padding:30, color:"#B0BEC5", fontSize:11 }}>
          <div style={{ fontSize:28, marginBottom:8 }}>📅</div>
          Historial de cambios. Creado el {e.created}.
        </div>
      )}
    </div>
  );
}

// ─── EXPEDIENTES LIST ─────────────────────────────────────────────────────────
function ExpList({ expedientes, onSelect, onNew, clients }) {
  const [search, setSearch] = useState("");
  const [fAdv, setFAdv]     = useState("all");
  const [fSt,  setFSt]      = useState("all");

  const filtered = expedientes
    .filter(e => {
      const s = search.toLowerCase();
      const ms = !s || String(e.no).includes(s) || (e.clientName||"").toLowerCase().includes(s) || (e.trip?.destination||"").toLowerCase().includes(s);
      return ms && (fAdv==="all"||e.advisorId===fAdv) && (fSt==="all"||e.status===fSt);
    })
    .sort((a,b) => b.no - a.no);

  return (
    <div style={{ padding:18, maxWidth:1200, margin:"0 auto" }}>
      {/* Filters */}
      <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:6, padding:"11px 13px", marginBottom:12 }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:7, marginBottom:8 }}>
          <FI placeholder="Buscar por nombre, no., destino..." value={search} onChange={setSearch} sm/>
          <FI placeholder="Por reserva"     value="" onChange={() => {}} sm/>
          <FS value="" onChange={() => {}} sm options={[{value:"",label:"Por mes"},{value:"2026-05",label:"May 2026"},{value:"2026-04",label:"Abr 2026"}]}/>
          <FI placeholder="No. expediente"  value="" onChange={() => {}} sm/>
          <FI placeholder="No. de venta"    value="" onChange={() => {}} sm/>
          <FS value="" onChange={() => {}} sm options={[{value:"",label:"Por grupo"},{value:"META",label:"META"}]}/>
          <FI placeholder="Destino/etiqueta" value="" onChange={() => {}} sm/>
          <FS value={fSt} onChange={setFSt} sm options={[{value:"all",label:"Por estatus"},...Object.entries(EXP_STATUS).map(([k,c]) => ({value:k,label:c.label}))]}/>
          <FI placeholder="Móvil"           value="" onChange={() => {}} sm/>
        </div>
        <div style={{ display:"flex", gap:7, alignItems:"center", flexWrap:"wrap" }}>
          <Btn v="primary" sz="sm">Aplicar filtros</Btn>
          <Btn v="secondary" sz="sm">Borrar filtros</Btn>
          <div style={{ flex:1 }}/>
          <FS value={fAdv} onChange={setFAdv} sm style={{ width:155 }}
            options={[{value:"all",label:"Todos los asesores"},...ADVISORS.map(a => ({value:a.id,label:a.name}))]}/>
          <input placeholder="Crear expediente - buscar cliente..." style={{ ...SI, width:250, padding:"3px 8px", fontSize:10 }}/>
          <Btn v="teal" sz="sm" onClick={onNew}>+ Cliente nuevo</Btn>
        </div>
      </div>

      {/* Table */}
      <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:6, overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
          <thead>
            <tr style={{ background:B.dark, color:"#fff" }}>
              {["","Estatus","No.Exp","Nombre grupo","↕","Divisa","Cliente","Hab.","Disp.","Inicio","Fin"].map(h => (
                <th key={h} style={{ padding:"7px 9px", textAlign:"left", fontSize:9, fontWeight:700, whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((e,i) => {
              const adv = ADVISORS.find(a => a.id===e.advisorId);
              return (
                <tr key={e.id}
                  style={{ background:i%2===0?"#fff":"#FAFAFA", borderBottom:"1px solid #F0F0F0", cursor:"pointer" }}
                  onMouseEnter={el => el.currentTarget.style.background="#E3F2FD"}
                  onMouseLeave={el => el.currentTarget.style.background=i%2===0?"#fff":"#FAFAFA"}
                  onClick={() => onSelect(e)}>
                  <td style={{ padding:"5px 7px" }}>
                    <div style={{ display:"flex", gap:2 }}>
                      {["C","M","E","P","R"].map(l => (
                        <span key={l} style={{ background:"#E0E0E0", borderRadius:3, padding:"1px 4px", fontSize:8, fontWeight:700 }}>{l}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding:"5px 7px" }}><Badge status={e.status}/></td>
                  <td style={{ padding:"5px 7px", color:B.blue, fontWeight:700 }}>{e.no}</td>
                  <td style={{ padding:"5px 7px", fontWeight:600 }}>{e.trip.title||e.trip.destination||"–"}</td>
                  <td style={{ padding:"5px 7px", color:"#546E7A" }}>{adv?.name.split(" ")[0]}</td>
                  <td style={{ padding:"5px 7px" }}>{e.items[0]?.currency||"USD"}</td>
                  <td style={{ padding:"5px 7px", fontWeight:600, color:B.blue }}>{e.clientName||"–"}</td>
                  <td style={{ padding:"5px 7px" }}>{e.trip.paxAdult||0}</td>
                  <td style={{ padding:"5px 7px" }}>{e.payments.filter(p=>p.confirmed).length>0?e.trip.paxAdult||0:0}</td>
                  <td style={{ padding:"5px 7px" }}>{e.trip.dateFrom||"–"}</td>
                  <td style={{ padding:"5px 7px" }}>{e.trip.dateTo||"–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length===0 && (
          <div style={{ textAlign:"center", padding:36, color:"#B0BEC5", fontSize:11 }}>
            <div style={{ fontSize:28, marginBottom:8 }}>📋</div>
            Sin expedientes.<br/>
            <Btn v="outline" style={{ marginTop:10 }} onClick={onNew}>Crear primer expediente</Btn>
          </div>
        )}
      </div>
      <div style={{ display:"flex", justifyContent:"flex-end", gap:7, marginTop:9 }}>
        <Btn v="secondary" sz="sm">Registros por página</Btn>
        <Btn v="secondary" sz="sm">Columnas Visibles</Btn>
        <Btn v="success"   sz="sm">📊 Exportar a Excel</Btn>
      </div>
    </div>
  );
}

// ─── CLIENT FORM ──────────────────────────────────────────────────────────────
function CliForm({ client, onSave, onBack }) {
  const [c, setC]  = useState(() => JSON.parse(JSON.stringify(client)));
  const [tab, setTab] = useState("personales");
  const upd = (f,v) => setC(p => ({ ...p, [f]: v }));
  const isEmpresa = c.tipo === "empresa";
  const name = isEmpresa ? (c.razonSocial||"Nueva empresa") : [c.firstName, c.lastNameP, c.lastNameM].filter(Boolean).join(" ");

  // Alarma de vencimiento de pasaporte (6 meses)
  const passportAlert = () => {
    if(!c.passport?.vencimiento) return null;
    const venc = new Date(c.passport.vencimiento);
    const sixMonths = new Date(); sixMonths.setMonth(sixMonths.getMonth()+6);
    if(venc < new Date()) return { level:"danger", msg:"⚠️ Pasaporte VENCIDO" };
    if(venc < sixMonths) return { level:"warning", msg:"🔔 Pasaporte vence en menos de 6 meses" };
    return null;
  };
  const passAlert = passportAlert();

  const TABS = [
    { id:"personales", label: isEmpresa ? "Empresa" : "Personales" },
    { id:"documentos", label:"Documentos" },
    { id:"fiscales",   label:"Fiscal" },
    { id:"relaciones", label:"Relaciones" },
    { id:"historial",  label:"Historial" },
  ];

  const RELACION_TIPOS = ["Cónyuge/Pareja","Hijo/a","Padre/Madre","Hermano/a","Amigo/a","Familiar","Colega","Otro"];

  return (
    <div style={{ padding:18, maxWidth:980, margin:"0 auto" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:7 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <h2 style={{ margin:0, fontSize:16, color:B.dark, fontWeight:800 }}>
              {isEmpresa ? "🏢" : "👤"} {name||"Nuevo cliente"}
            </h2>
            {c.clientNo && (
              <span style={{ background:"#EDE7F6", color:"#512DA8", padding:"2px 8px", borderRadius:5, fontSize:11, fontWeight:700 }}>
                #{c.clientNo}
              </span>
            )}
            {c.tipo==="persona" && c.cat==="VIP" && <span style={{ background:"#FFF8E1", color:"#F9A825", padding:"2px 8px", borderRadius:5, fontSize:10, fontWeight:700 }}>⭐ VIP</span>}
          </div>
          {passAlert && (
            <div style={{ marginTop:6, padding:"4px 10px", borderRadius:5, background: passAlert.level==="danger"?"#FFEBEE":"#FFF8E1", color: passAlert.level==="danger"?"#C62828":"#F9A825", fontSize:11, fontWeight:700 }}>
              {passAlert.msg}
            </div>
          )}
        </div>
        <div style={{ display:"flex", gap:5, alignItems:"center" }}>
          {/* Selector tipo */}
          <div style={{ display:"flex", background:"#F1F5F9", borderRadius:7, padding:3, gap:2 }}>
            {["persona","empresa"].map(t=>(
              <button key={t} onClick={()=>upd("tipo",t)}
                style={{ padding:"4px 12px", borderRadius:5, border:"none", background:c.tipo===t?"#fff":"transparent", color:c.tipo===t?B.dark:"#546E7A", fontWeight:c.tipo===t?700:400, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
                {t==="persona"?"👤 Persona":"🏢 Empresa"}
              </button>
            ))}
          </div>
          <Btn v="primary" sz="sm" onClick={() => onSave(c)}>Guardar</Btn>
          <Btn v="secondary" sz="sm" onClick={onBack}>&larr; Atrás</Btn>
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onSelect={setTab}/>

      {/* ── TAB PERSONALES / EMPRESA ── */}
      {tab==="personales" && (
        <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:6, padding:16 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:9, marginBottom:9 }}>
            <FS label="Categoría" value={c.cat} onChange={v => upd("cat",v)} options={CLI_CATS.map(x => ({value:x,label:x}))}/>
            <FS label="Estatus" value={c.status} onChange={v => upd("status",v)} options={[{value:"activo",label:"Activo"},{value:"inactivo",label:"Inactivo"}]}/>
            <FS label="Agente" value={c.advisorId} onChange={v => upd("advisorId",v)} options={ADVISORS.map(a => ({value:a.id,label:a.name}))}/>
          </div>

          {/* PERSONA NATURAL */}
          {!isEmpresa && (<>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:9, marginBottom:9 }}>
              <FI label="Nombre(s)*"        value={c.firstName} onChange={v => upd("firstName",v)}/>
              <FI label="Apellido Paterno*" value={c.lastNameP} onChange={v => upd("lastNameP",v)}/>
              <FI label="Apellido Materno"  value={c.lastNameM} onChange={v => upd("lastNameM",v)}/>
              <FI label="Fecha Nacimiento"  value={c.birthdate} onChange={v => upd("birthdate",v)} type="date"/>
              <FI label="Fecha Alta"        value={c.alta}      onChange={v => upd("alta",v)}      type="date"/>
            </div>
          </>)}

          {/* EMPRESA */}
          {isEmpresa && (<>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:9, marginBottom:9 }}>
              <FI label="Razón Social *"     value={c.razonSocial||""} onChange={v => upd("razonSocial",v)} placeholder="Nombre legal de la empresa"/>
              <FI label="RUC / NIT"           value={c.ruc||""}         onChange={v => upd("ruc",v)}         placeholder="RUC o NIT..."/>
              <FI label="Representante legal" value={c.representante||""} onChange={v => upd("representante",v)} placeholder="Nombre del representante"/>
            </div>
          </>)}

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:9, marginBottom:9 }}>
            <FI label="Móvil / WhatsApp"   value={c.mobile}          onChange={v => upd("mobile",v)}      placeholder="+507 6000-0000"/>
            <FI label="Teléfono casa"      value={c.phone}           onChange={v => upd("phone",v)}/>
            <FI label="Teléfono oficina"   value={c.officePhone||""} onChange={v => upd("officePhone",v)}/>
            <FI label="Email *"            value={c.email}           onChange={v => upd("email",v)}       placeholder="correo@email.com"/>
            <FI label="Email 2"            value={c.email2}          onChange={v => upd("email2",v)}/>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:9, marginBottom:9 }}>
            <FI label="Dirección" value={c.address}    onChange={v => upd("address",v)}/>
            <FI label="Colonia"   value={c.colonia||""} onChange={v => upd("colonia",v)}/>
            <FI label="Ciudad"    value={c.city}        onChange={v => upd("city",v)}/>
            <FI label="C.P."      value={c.cp||""}      onChange={v => upd("cp",v)}/>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr 1fr", gap:9, marginBottom:9 }}>
            <FI label="Estado/Provincia" value={c.state||""}       onChange={v => upd("state",v)}/>
            <FI label="País"             value={c.country}         onChange={v => upd("country",v)}/>
            <FS label="Nacionalidad"     value={c.nationality}     onChange={v => upd("nationality",v)}
              options={["Panama - PA","Mexico - MX","Colombia - CO","Venezuela - VE","USA - US","España - ES","Argentina - AR","Chile - CL","Otro"].map(x => ({value:x,label:x}))}/>
            <FI label="Contacto"    value={c.contact||""}     onChange={v => upd("contact",v)}/>
            <FI label="Recomendó"   value={c.recommended||""} onChange={v => upd("recommended",v)}/>
            <FI label="Cómo supo"   value={c.howKnow||""}    onChange={v => upd("howKnow",v)}/>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
            <FTA label="Notas internas" value={c.notes} onChange={v => upd("notes",v)} rows={2}/>
          </div>
          <div style={{ marginTop:14, textAlign:"right" }}>
            <Btn v="teal" sz="lg" onClick={() => onSave(c)}>Guardar cliente</Btn>
          </div>
        </div>
      )}

      {/* ── TAB DOCUMENTOS ── */}
      {tab==="documentos" && (
        <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:6, padding:16 }}>

          {/* Pasaporte */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:B.dark, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
              🛂 Pasaporte
              {passAlert && (
                <span style={{ padding:"2px 9px", borderRadius:5, fontSize:10, fontWeight:700, background: passAlert.level==="danger"?"#FFEBEE":"#FFF8E1", color: passAlert.level==="danger"?"#C62828":"#F9A825" }}>
                  {passAlert.msg}
                </span>
              )}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
              <FI label="Número de pasaporte" value={c.passport?.numero||""} onChange={v=>upd("passport",{...c.passport,numero:v})} placeholder="AB123456"/>
              <FI label="Fecha de vencimiento" value={c.passport?.vencimiento||""} onChange={v=>upd("passport",{...c.passport,vencimiento:v})} type="date"/>
              <div>
                <div style={{ fontSize:10, fontWeight:700, color:"#546E7A", marginBottom:6 }}>FOTO DEL PASAPORTE</div>
                <label style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", border:"1px dashed #BBDEFB", borderRadius:6, cursor:"pointer", fontSize:11, color:B.blue }}>
                  <span>📎</span>
                  {c.passport?.foto ? "✓ Foto cargada — clic para cambiar" : "Cargar foto del pasaporte"}
                  <input type="file" accept="image/*,.pdf" style={{ display:"none" }}
                    onChange={e=>{
                      const file = e.target.files[0];
                      if(!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => upd("passport",{...c.passport,foto:ev.target.result,fotoName:file.name});
                      reader.readAsDataURL(file);
                    }}/>
                </label>
                {c.passport?.foto && (
                  <div style={{ marginTop:6, display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:10, color:"#546E7A" }}>📄 {c.passport.fotoName||"Foto cargada"}</span>
                    <button onClick={()=>upd("passport",{...c.passport,foto:null,fotoName:""})} style={{ background:"none",border:"none",cursor:"pointer",color:"#EF5350",fontSize:11 }}>✕ Eliminar</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Visas */}
          <div style={{ borderTop:"1px solid #F0F0F0", paddingTop:16 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:B.dark }}>🪪 Visas</div>
              <button onClick={()=>upd("visas",[...(c.visas||[]),{id:uid(),pais:"",tipo:"",numero:"",vencimiento:"",foto:null}])}
                style={{ background:B.blue, color:"#fff", border:"none", borderRadius:6, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                + Agregar visa
              </button>
            </div>
            {(c.visas||[]).length===0 && <div style={{ color:"#B0BEC5", fontSize:11, textAlign:"center", padding:16 }}>No hay visas registradas</div>}
            {(c.visas||[]).map((v,i)=>{
              const vencDate = v.vencimiento ? new Date(v.vencimiento) : null;
              const sixMo = new Date(); sixMo.setMonth(sixMo.getMonth()+6);
              const visaAlert = vencDate && vencDate < new Date() ? "VENCIDA" : vencDate && vencDate < sixMo ? "POR VENCER" : null;
              return (
                <div key={v.id} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr auto", gap:9, marginBottom:8, padding:"10px 12px", background:"#F8FAFC", borderRadius:8, border:"1px solid #E0E0E0" }}>
                  <FI label="País" value={v.pais} onChange={val=>upd("visas",(c.visas||[]).map((x,j)=>j===i?{...x,pais:val}:x))} placeholder="USA, Schengen..."/>
                  <FI label="Tipo" value={v.tipo} onChange={val=>upd("visas",(c.visas||[]).map((x,j)=>j===i?{...x,tipo:val}:x))} placeholder="Turista, Trabajo..."/>
                  <FI label="Número" value={v.numero||""} onChange={val=>upd("visas",(c.visas||[]).map((x,j)=>j===i?{...x,numero:val}:x))} placeholder="V123456"/>
                  <div>
                    <FI label="Vencimiento" value={v.vencimiento} onChange={val=>upd("visas",(c.visas||[]).map((x,j)=>j===i?{...x,vencimiento:val}:x))} type="date"/>
                    {visaAlert && <div style={{ fontSize:9, fontWeight:700, color: visaAlert==="VENCIDA"?"#C62828":"#F9A825", marginTop:2 }}>⚠️ {visaAlert}</div>}
                  </div>
                  <button onClick={()=>upd("visas",(c.visas||[]).filter((_,j)=>j!==i))}
                    style={{ background:"none", border:"none", cursor:"pointer", color:"#EF5350", fontSize:18, alignSelf:"center", marginTop:12 }}>✕</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB FISCAL ── */}
      {tab==="fiscales" && (
        <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:6, padding:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:B.dark, marginBottom:16 }}>🧾 Datos fiscales del cliente</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <FI label="RUC / NIT / RFC" value={c.taxId||""} onChange={v=>upd("taxId",v)} placeholder="Número de contribuyente"/>
            <FI label="Razón social / Nombre fiscal" value={c.taxName||""} onChange={v=>upd("taxName",v)} placeholder="Nombre para facturación"/>
            <div style={{ gridColumn:"1/-1" }}>
              <FI label="Dirección fiscal" value={c.taxAddress||""} onChange={v=>upd("taxAddress",v)} placeholder="Dirección para facturación..."/>
            </div>
          </div>
          <div style={{ marginTop:16, textAlign:"right" }}>
            <Btn v="teal" sz="sm" onClick={() => onSave(c)}>Guardar datos fiscales</Btn>
          </div>
        </div>
      )}

      {/* ── TAB RELACIONES ── */}
      {tab==="relaciones" && (
        <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:6, padding:16 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:B.dark }}>👨‍👩‍👧 Viajeros asociados</div>
              <div style={{ fontSize:11, color:"#546E7A", marginTop:2 }}>Registra los datos de cónyuge, hijos, padres u otros viajeros frecuentes de este cliente.</div>
            </div>
            <button onClick={()=>upd("relaciones",[...(c.relaciones||[]),{id:uid(),tipo:"Cónyuge/Pareja",firstName:"",lastNameP:"",birthdate:"",passport:{numero:"",vencimiento:"",foto:null},visas:[]}])}
              style={{ background:B.blue, color:"#fff", border:"none", borderRadius:6, padding:"6px 14px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              + Agregar viajero
            </button>
          </div>

          {(c.relaciones||[]).length===0 && (
            <div style={{ textAlign:"center", padding:32, color:"#B0BEC5", fontSize:11 }}>
              <div style={{ fontSize:28, marginBottom:8 }}>👨‍👩‍👧</div>
              No hay viajeros asociados a este cliente.<br/>Agrega cónyuge, hijos o familiares que viajan frecuentemente.
            </div>
          )}

          {(c.relaciones||[]).map((rel,i)=>{
            const relPassAlert = () => {
              if(!rel.passport?.vencimiento) return null;
              const venc = new Date(rel.passport.vencimiento);
              const sixMo = new Date(); sixMo.setMonth(sixMo.getMonth()+6);
              if(venc < new Date()) return "VENCIDO";
              if(venc < sixMo) return "POR VENCER";
              return null;
            };
            const rpa = relPassAlert();
            const updRel = (f,v) => upd("relaciones",(c.relaciones||[]).map((x,j)=>j===i?{...x,[f]:v}:x));
            return (
              <div key={rel.id} style={{ border:"1px solid #E0E0E0", borderRadius:10, padding:16, marginBottom:12, background:"#FAFAFA" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:20 }}>👤</span>
                    <div style={{ fontWeight:700, fontSize:13 }}>{[rel.firstName,rel.lastNameP].filter(Boolean).join(" ")||"Nuevo viajero"}</div>
                    <span style={{ background:"#EDE7F6", color:"#512DA8", padding:"2px 8px", borderRadius:5, fontSize:10, fontWeight:700 }}>{rel.tipo}</span>
                    {rpa && <span style={{ background: rpa==="VENCIDO"?"#FFEBEE":"#FFF8E1", color: rpa==="VENCIDO"?"#C62828":"#F9A825", padding:"2px 8px", borderRadius:5, fontSize:10, fontWeight:700 }}>⚠️ Pasaporte {rpa}</span>}
                  </div>
                  <button onClick={()=>upd("relaciones",(c.relaciones||[]).filter((_,j)=>j!==i))}
                    style={{ background:"none", border:"none", cursor:"pointer", color:"#EF5350", fontSize:16 }}>✕ Eliminar</button>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:9 }}>
                  <FS label="Relación" value={rel.tipo} onChange={v=>updRel("tipo",v)} options={RELACION_TIPOS.map(t=>({value:t,label:t}))}/>
                  <FI label="Nombre(s)" value={rel.firstName||""} onChange={v=>updRel("firstName",v)}/>
                  <FI label="Apellido" value={rel.lastNameP||""} onChange={v=>updRel("lastNameP",v)}/>
                  <FI label="Fecha nacimiento" value={rel.birthdate||""} onChange={v=>updRel("birthdate",v)} type="date"/>
                  <FI label="Pasaporte #" value={rel.passport?.numero||""} onChange={v=>updRel("passport",{...rel.passport,numero:v})}/>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:9, marginTop:9 }}>
                  <FI label="Venc. pasaporte" value={rel.passport?.vencimiento||""} onChange={v=>updRel("passport",{...rel.passport,vencimiento:v})} type="date"/>
                  <FI label="Móvil" value={rel.mobile||""} onChange={v=>updRel("mobile",v)} placeholder="+507 6000-0000"/>
                  <FI label="Email" value={rel.email||""} onChange={v=>updRel("email",v)} placeholder="email@correo.com"/>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB HISTORIAL ── */}
      {tab==="historial" && (
        <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:6, padding:16 }}>
          <div style={{ textAlign:"center", padding:32, color:"#B0BEC5", fontSize:11 }}>
            <div style={{ fontSize:28, marginBottom:8 }}>📋</div>
            El historial de expedientes y monto total comprado se mostrará aquí.<br/>
            <span style={{ fontSize:10 }}>Se conecta automáticamente con los expedientes asociados a este cliente.</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CLIENTS LIST ─────────────────────────────────────────────────────────────
function CliList({ clients, onSelect, onNew }) {
  const [search, setSearch]   = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos"); // todos, persona, empresa

  const personas  = clients.filter(c => c.tipo !== "empresa");
  const empresas  = clients.filter(c => c.tipo === "empresa");

  const filtered = clients.filter(c => {
    const s = search.toLowerCase();
    const isEmp = c.tipo === "empresa";
    const n = isEmp ? (c.razonSocial||"").toLowerCase() : `${c.firstName} ${c.lastNameP} ${c.lastNameM}`.toLowerCase();
    const matchSearch = !s || n.includes(s) || (c.email||"").toLowerCase().includes(s) || (c.mobile||"").includes(s) || (c.clientNo||"").includes(s);
    const matchTipo   = filtroTipo === "todos" || c.tipo === filtroTipo || (filtroTipo==="persona" && c.tipo !== "empresa");
    return matchSearch && matchTipo;
  });

  return (
    <div style={{ padding:18, maxWidth:1100, margin:"0 auto" }}>
      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:14 }}>
        {[
          { label:"Total clientes", val:clients.length, icon:"👥", color:B.blue },
          { label:"Personas naturales", val:personas.length, icon:"👤", color:B.teal },
          { label:"Empresas", val:empresas.length, icon:"🏢", color:B.gold },
        ].map(s=>(
          <div key={s.label} style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:8, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ fontSize:20 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:s.color }}>{s.val}</div>
              <div style={{ fontSize:10, color:"#546E7A" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Barra de búsqueda y filtros */}
      <div style={{ display:"flex", gap:7, marginBottom:12, alignItems:"center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar por nombre, email, móvil o # cliente..." style={{ ...SI, flex:1, padding:"6px 11px", fontSize:11 }}/>
        {/* Filtro tipo */}
        <div style={{ display:"flex", background:"#F1F5F9", borderRadius:7, padding:3, gap:2 }}>
          {[{v:"todos",l:"Todos"},{v:"persona",l:"👤 Personas"},{v:"empresa",l:"🏢 Empresas"}].map(t=>(
            <button key={t.v} onClick={()=>setFiltroTipo(t.v)}
              style={{ padding:"4px 10px", borderRadius:5, border:"none", background:filtroTipo===t.v?"#fff":"transparent", color:filtroTipo===t.v?B.dark:"#546E7A", fontWeight:filtroTipo===t.v?700:400, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
              {t.l}
            </button>
          ))}
        </div>
        <Btn v="teal" onClick={onNew}>+ Nuevo Cliente</Btn>
      </div>

      <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:6, overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
          <thead>
            <tr style={{ background:B.dark, color:"#fff" }}>
              {["#","Tipo","Nombre / Razón Social","Email","Móvil","Categoría","Agente","Ciudad",""].map(h => (
                <th key={h} style={{ padding:"7px 9px", textAlign:"left", fontSize:9, fontWeight:700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c,i) => {
              const adv     = ADVISORS.find(a => a.id===c.advisorId);
              const isEmp   = c.tipo === "empresa";
              const name    = isEmp ? (c.razonSocial||"Sin nombre") : `${c.firstName} ${c.lastNameP}${c.lastNameM?" "+c.lastNameM:""}`.trim();
              // Alertas de documentos
              const hasPassAlert = c.passport?.vencimiento && (() => {
                const v = new Date(c.passport.vencimiento);
                const s = new Date(); s.setMonth(s.getMonth()+6);
                return v < s;
              })();
              return (
                <tr key={c.id}
                  style={{ background:i%2===0?"#fff":"#FAFAFA", borderBottom:"1px solid #F0F0F0", cursor:"pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background="#E3F2FD"}
                  onMouseLeave={e => e.currentTarget.style.background=i%2===0?"#fff":"#FAFAFA"}
                  onClick={() => onSelect(c)}>
                  <td style={{ padding:"7px 9px", fontWeight:700, color:"#7C3AED", fontSize:10 }}>
                    {c.clientNo ? `#${c.clientNo}` : "–"}
                  </td>
                  <td style={{ padding:"7px 9px" }}>
                    <span style={{ fontSize:14 }}>{isEmp?"🏢":"👤"}</span>
                  </td>
                  <td style={{ padding:"7px 9px", fontWeight:600, color:B.blue }}>
                    {name||"–"}
                    {hasPassAlert && <span style={{ marginLeft:5, fontSize:9, background:"#FFF8E1", color:"#F9A825", padding:"1px 5px", borderRadius:3, fontWeight:700 }}>🔔 Docs</span>}
                  </td>
                  <td style={{ padding:"7px 9px", color:"#546E7A" }}>{c.email||"–"}</td>
                  <td style={{ padding:"7px 9px" }}>{c.mobile||"–"}</td>
                  <td style={{ padding:"7px 9px" }}>
                    <span style={{ background:"#E3F2FD", color:B.blue, padding:"2px 6px", borderRadius:7, fontSize:9, fontWeight:700 }}>{c.cat}</span>
                  </td>
                  <td style={{ padding:"7px 9px", color:"#546E7A" }}>{adv?.name||"–"}</td>
                  <td style={{ padding:"7px 9px", color:"#546E7A" }}>{c.city||"–"}</td>
                  <td style={{ padding:"7px 9px" }}><Btn v="secondary" sz="sm" onClick={ev => { ev.stopPropagation(); onSelect(c); }}>Ver</Btn></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length===0 && (
          <div style={{ textAlign:"center", padding:36, color:"#B0BEC5", fontSize:11 }}>
            <div style={{ fontSize:28, marginBottom:8 }}>👤</div>
            Sin clientes.<br/>
            <Btn v="outline" style={{ marginTop:10 }} onClick={onNew}>Registrar primer cliente</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SALES REPORT ─────────────────────────────────────────────────────────────
function SalesReport({ expedientes }) {
  const [month, setMonth] = useState("2026-05");

  const months = [
    { value:"2026-05", label:"May-2026" },
    { value:"2026-04", label:"Apr-2026" },
    { value:"2026-03", label:"Mar-2026" },
  ];

  const filtered = expedientes.filter(e => (e.created||"").startsWith(month));

  const totalPub  = filtered.reduce((s,e) => s + e.items.reduce((ss,it) => { const p=(parseFloat(it.base)||0)+(parseFloat(it.iva)||0)+(parseFloat(it.tua)||0)+(parseFloat(it.others)||0); return ss+p; }, 0), 0);
  const totalNeta = filtered.reduce((s,e) => s + e.items.reduce((ss,it) => { const p=(parseFloat(it.base)||0)+(parseFloat(it.iva)||0)+(parseFloat(it.tua)||0)+(parseFloat(it.others)||0); return ss + p*(1-(parseFloat(it.csb)||0)/100); }, 0), 0);
  const totalProd = totalPub - totalNeta;
  const globalMeta = 160000;
  const globalPct  = Math.min(100, Math.round((totalPub/globalMeta)*100));

  const byAdv = ADVISORS.slice(0,4).map(adv => {
    const rows = filtered.filter(e => e.advisorId===adv.id);
    const ventas = rows.reduce((s,e) => s + e.items.reduce((ss,it) => { const p=(parseFloat(it.base)||0)+(parseFloat(it.iva)||0)+(parseFloat(it.tua)||0)+(parseFloat(it.others)||0); return ss+p; }, 0), 0);
    const metas  = {"1":90000,"2":0,"3":50000,"4":20000};
    return { adv, ventas, meta: metas[adv.id]||0 };
  });

  const thStyle = { padding:"6px 8px", textAlign:"left", fontSize:9, fontWeight:700, color:"#546E7A", whiteSpace:"nowrap" };

  return (
    <div style={{ padding:18, maxWidth:1200, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", gap:11, marginBottom:14, flexWrap:"wrap" }}>
        <span style={{ fontSize:12, fontWeight:700, color:"#546E7A" }}>Ventas de:</span>
        <select value={month} onChange={e => setMonth(e.target.value)} style={{ ...SI, width:130, padding:"5px 9px", fontSize:11 }}>
          {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <span style={{ fontSize:9, color:"#90A4AE" }}>Nota.- Las metas y el cumplimiento se calculan sobre la tarifa base (antes de IVA y otros impuestos).</span>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:11, marginBottom:14 }}>
        {[
          { label:"TOTAL VENTAS",       value:`$${fmt(totalPub)}`,        icon:"💰" },
          { label:"TOTAL IMPUESTOS",    value:"$0.00",                     icon:"⚖️" },
          { label:"TOTAL TARIFA BASE",  value:`$${fmt(totalPub)}`,        icon:"📊" },
        ].map(s => (
          <div key={s.label} style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:7, padding:16, textAlign:"center", position:"relative" }}>
            <div style={{ fontSize:26, fontWeight:900, color:B.dark }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#546E7A", marginTop:3 }}>{s.label}</div>
            <div style={{ position:"absolute", top:10, right:12, fontSize:22, opacity:.12 }}>{s.icon}</div>
          </div>
        ))}
        {/* Meta global */}
        <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:7, padding:14, minWidth:190 }}>
          <div style={{ fontSize:24, fontWeight:900, color:B.blue, marginBottom:2 }}>${fmtS(globalMeta)}</div>
          <div style={{ fontSize:9, color:"#546E7A", marginBottom:7, textTransform:"uppercase", fontWeight:700 }}>Meta de ventas global</div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#546E7A", marginBottom:3 }}>
            <span>PROGRESO</span><span>{globalPct}%</span>
          </div>
          <div style={{ height:5, background:"#E0E0E0", borderRadius:3, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${globalPct}%`, background:B.blue, borderRadius:3 }}/>
          </div>
        </div>
      </div>

      {/* By advisor */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:11, marginBottom:14 }}>
        {byAdv.map(({ adv, ventas, meta }) => {
          const p = meta>0 ? Math.min(100,Math.round((ventas/meta)*100)) : 0;
          return (
            <div key={adv.id} style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:7, padding:13 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:7 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:12 }}>{adv.name.split(" ")[0]}</div>
                  <div style={{ fontSize:15, fontWeight:900, color:B.dark, marginTop:2 }}>${fmt(ventas)}</div>
                </div>
                <div style={{ width:32, height:32, borderRadius:"50%", background:B.blue, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:13 }}>
                  {adv.name.charAt(0)}
                </div>
              </div>
              {meta>0 ? (
                <>
                  <div style={{ fontSize:10, color:B.blue, fontWeight:700, marginBottom:3 }}>${fmtS(meta)}</div>
                  <div style={{ fontSize:8, color:"#90A4AE", marginBottom:4, textTransform:"uppercase" }}>EDITAR META DE VENTAS</div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:8, color:"#546E7A", marginBottom:2 }}>
                    <span>PROGRESO</span><span>{p}%</span>
                  </div>
                  <div style={{ height:4, background:"#E0E0E0", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${p}%`, background:B.teal, borderRadius:3 }}/>
                  </div>
                </>
              ) : (
                <div style={{ fontSize:10, color:B.red, fontWeight:700, cursor:"pointer" }}>PONER META DE VENTAS</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ display:"flex", gap:7, marginBottom:9 }}>
        <input placeholder="Buscar:" style={{ ...SI, width:160, padding:"4px 8px", fontSize:10 }}/>
        <div style={{ flex:1 }}/>
        <Btn v="secondary" sz="sm">Registros por página</Btn>
        <Btn v="secondary" sz="sm">Columnas Visibles</Btn>
        <Btn v="success"   sz="sm">📊 Exportar a Excel</Btn>
      </div>

      <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:6, overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
          <thead>
            <tr style={{ background:"#F5F7FA" }}>
              {["No.Exp.","Venta","Fecha","Estatus","Agente","Cliente","Pública","Neta","Productividad sin IVA","Productividad con IVA",""].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.sort((a,b) => b.no-a.no).map((e,i) => {
              const pub  = e.items.reduce((s,it) => { const p=(parseFloat(it.base)||0)+(parseFloat(it.iva)||0)+(parseFloat(it.tua)||0)+(parseFloat(it.others)||0); return s+p; }, 0);
              const neta = e.items.reduce((s,it) => { const p=(parseFloat(it.base)||0)+(parseFloat(it.iva)||0)+(parseFloat(it.tua)||0)+(parseFloat(it.others)||0); return s+p*(1-(parseFloat(it.csb)||0)/100); }, 0);
              const prod = pub - neta;
              const adv  = ADVISORS.find(a => a.id===e.advisorId);
              const st   = EXP_STATUS[e.status] || EXP_STATUS.nuevo;
              return (
                <tr key={e.id} style={{ background:i%2===0?"#fff":"#FAFAFA", borderBottom:"1px solid #F0F0F0" }}>
                  <td style={{ padding:"5px 8px", color:B.blue, fontWeight:700, cursor:"pointer" }}>{e.no}</td>
                  <td style={{ padding:"5px 8px" }}>{e.ventaNo}</td>
                  <td style={{ padding:"5px 8px", color:"#546E7A" }}>{e.created}</td>
                  <td style={{ padding:"5px 8px" }}>
                    <span style={{ background:st.bg, color:st.c, padding:"2px 7px", borderRadius:7, fontSize:9, fontWeight:700 }}>{st.label}</span>
                  </td>
                  <td style={{ padding:"5px 8px", color:"#546E7A" }}>{adv?.name.split(" ")[0]||"–"}</td>
                  <td style={{ padding:"5px 8px", fontWeight:600 }}>{e.clientName||"–"}</td>
                  <td style={{ padding:"5px 8px", fontWeight:700, color:B.dark }}>{pub.toFixed(2)}</td>
                  <td style={{ padding:"5px 8px", color:"#546E7A" }}>{neta.toFixed(2)}</td>
                  <td style={{ padding:"5px 8px", color:B.teal, fontWeight:700 }}>{prod.toFixed(2)}</td>
                  <td style={{ padding:"5px 8px", color:B.teal, fontWeight:700 }}>{prod.toFixed(2)}</td>
                  <td style={{ padding:"5px 8px" }}><span style={{ cursor:"pointer", color:"#B0BEC5", fontSize:13 }}>?</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length===0 && (
          <div style={{ textAlign:"center", padding:28, color:"#B0BEC5", fontSize:11 }}>Sin ventas en este período.</div>
        )}
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
const NAV = [
  { id:"expedientes",   label:"Inicio/Expedientes", section:"INICIO",       icon:"🏠" },
  { id:"cotizaciones",  label:"Cotizaciones",        section:"INICIO",       icon:"📋" },
  { id:"ventas",        label:"Ventas",              section:"INICIO",       icon:"💼" },
  { id:"comisiones",    label:"Comisiones generadas",section:"INICIO",       icon:"💰" },
  { id:"clientes",      label:"Clientes",            section:"CATALOGOS",    icon:"👥" },
  { id:"hotelbeds",    label:"Hoteles Hotelbeds",   section:"CATALOGOS",    icon:"🏨" },
  { id:"cuentas",       label:"Ver Cuentas",          section:"CATALOGOS",    icon:"🏦" },
  { id:"gastos",        label:"Gastos",               section:"CATALOGOS",    icon:"📉" },
  { id:"cxc-cli",       label:"Clientes (CxC)",       section:"CUENTAS X COBRAR", icon:"💳" },
  { id:"cxc-com",       label:"Comisiones (CxC)",     section:"CUENTAS X COBRAR", icon:"📈" },
  { id:"cxp-may",       label:"Mayoristas (CxP)",     section:"CUENTAS X PAGAR",  icon:"💸" },
  { id:"cxp-gas",       label:"Gastos (CxP)",         section:"CUENTAS X PAGAR",  icon:"📤" },
  { id:"pagos-cli",     label:"Pagos de clientes",    section:"ADMIN",        icon:"💳" },
  { id:"pagos-cred",    label:"Pagos a créditos",     section:"ADMIN",        icon:"💳" },
  { id:"pagos-may",     label:"Pagos a mayoristas",   section:"ADMIN",        icon:"💸" },
  { id:"reembolsos",    label:"Reembolsos a cliente", section:"ADMIN",        icon:"↺️" },
  { id:"pagos-gas",     label:"Pagos a gastos",       section:"ADMIN",        icon:"📉" },
  { id:"reporte-ventas",label:"Reporte ventas",        section:"ADMIN",        icon:"📊" },
  { id:"reporte-com",   label:"Reporte comisiones",   section:"ADMIN",        icon:"📊" },
  { id:"reporte-prod",  label:"Reporte productividad",section:"ADMIN",        icon:"📊" },
  { id:"bancos",        label:"Bancos",               section:"ADMIN",        icon:"🏛" },
  { id:"creditos",      label:"Créditos",             section:"ADMIN",        icon:"💳" },
  { id:"cfg-agencia",   label:"Agencia",              section:"CONFIGURACIÓN",icon:"⚙️" },
  { id:"cfg-agentes",   label:"Agentes",              section:"CONFIGURACIÓN",icon:"👤" },
  { id:"cfg-param",     label:"Parámetros",           section:"CONFIGURACIÓN",icon:"⚙️" },
  { id:"grp-camps",     label:"Campañas",             section:"GRUPOS",       icon:"🎯" },
  { id:"grp-create",    label:"Crear grupo",          section:"GRUPOS",       icon:"➕" },
  { id:"grp-cxp",       label:"Cuentas por pagar",    section:"GRUPOS",       icon:"💸" },
  { id:"grp-may",       label:"Mayoristas",           section:"GRUPOS",       icon:"🏢" },
  { id:"grp-cxc",       label:"Cuentas por cobrar",   section:"GRUPOS",       icon:"💳" },
  { id:"grp-com",       label:"Comisiones",           section:"GRUPOS",       icon:"💰" },
];

const SECTIONS = ["INICIO","CATALOGOS","CUENTAS X COBRAR","CUENTAS X PAGAR","ADMIN","CONFIGURACIÓN","GRUPOS"];

function Sidebar({ page, onNav, collapsed }) {
  const [openSec, setOpenSec] = useState("INICIO");

  return (
    <div style={{ width:collapsed?50:218, background:B.dark, minHeight:"calc(100vh - 50px)", transition:"width .2s", flexShrink:0, overflowY:"auto", overflowX:"hidden" }}>
      {!collapsed && (
        <div style={{ padding:"9px 12px 5px", borderBottom:"1px solid rgba(255,255,255,.1)" }}>
          <input placeholder="Buscar mayorista"
            style={{ ...SI, fontSize:10, padding:"4px 8px", background:"rgba(255,255,255,.1)", border:"1px solid rgba(255,255,255,.2)", color:"#fff", borderRadius:3 }}/>
        </div>
      )}
      {SECTIONS.map(sec => {
        const items = NAV.filter(n => n.section===sec);
        if (!items.length) return null;
        return (
          <div key={sec}>
            {!collapsed && (
              <div onClick={() => setOpenSec(openSec===sec ? null : sec)}
                style={{ padding:"7px 12px", fontSize:8, fontWeight:800, color:"rgba(255,255,255,.45)", letterSpacing:1, textTransform:"uppercase", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                {sec}<span>{openSec===sec?"▲":"▼"}</span>
              </div>
            )}
            {(collapsed || openSec===sec) && items.map(it => (
              <div key={it.id} onClick={() => onNav(it.id)}
                style={{ padding:collapsed?"9px 0":"6px 12px", display:"flex", alignItems:"center", gap:7, cursor:"pointer", fontSize:10, color:"#fff",
                  background:page===it.id?"rgba(255,255,255,.14)":"transparent",
                  justifyContent:collapsed?"center":"flex-start",
                  borderLeft:page===it.id?`3px solid ${B.gold}`:"3px solid transparent" }}
                onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,.09)"}
                onMouseLeave={e => e.currentTarget.style.background=page===it.id?"rgba(255,255,255,.14)":"transparent"}>
                <span style={{ fontSize:collapsed?15:12 }}>{it.icon}</span>
                {!collapsed && <span>{it.label}</span>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── FASE 2: GRUPOS ──────────────────────────────────────────────────────────
const CAMPAIGNS = [
  { id:"META",   label:"META" },
  { id:"FAMILIA",label:"FAMILIA" },
  { id:"CORP",   label:"CORPORATIVO" },
];

const GROUP_STATUS = {
  nuevo:     { label:"Nuevo",     c:"#1565C0", bg:"#E3F2FD" },
  activo:    { label:"Activo",    c:"#2E7D32", bg:"#E8F5E9" },
  cerrado:   { label:"Cerrado",   c:"#546E7A", bg:"#ECEFF1" },
  cancelado: { label:"Cancelado", c:"#C62828", bg:"#FFEBEE" },
};

const mkGroup = () => ({
  id: uid(), no: Math.floor(10+Math.random()*90), created: today(),
  name:"", campaign:"META", status:"nuevo", currency:"USD",
  dateFrom:"", dateTo:"", nights:0, rooms:20, paxs:20,
  wholesalerId:"bbr", advisorId:"1",
  expedientes:[], roomingList:[], notes:"",
  masterItems:[], masterPayments:[],
});

const mkRoomRow = () => ({
  id:uid(), expNo:"", clientName:"", roomType:"Doble", roomNo:"",
  paxAdult:2, paxChild:0, checkIn:"", checkOut:"", nights:0,
  publica:0, saldo:0, comision:0, notes:"",
});

// ─── GRUPO DETAIL ─────────────────────────────────────────────────────────────
function GrupoDetail({ grupo, expedientes, onSave, onBack }) {
  const [g, setG] = useState(() => JSON.parse(JSON.stringify(grupo)));
  const [tab, setTab] = useState("hospedaje");
  const upd = (f,v) => setG(p => ({ ...p, [f]:v }));

  const linkedExps = expedientes.filter(e => g.expedientes.includes(e.id));
  const wh = WHOLESALERS.find(w => w.id===g.wholesalerId)||WHOLESALERS[0];
  const adv = ADVISORS.find(a => a.id===g.advisorId)||ADVISORS[0];

  // Totals from linked expedientes
  const totalPub = linkedExps.reduce((s,e) => s + e.items.reduce((ss,it) => {
    const p=(parseFloat(it.base)||0)+(parseFloat(it.iva)||0)+(parseFloat(it.tua)||0)+(parseFloat(it.others)||0); return ss+p;
  },0),0);
  const totalNeta = linkedExps.reduce((s,e) => s + e.items.reduce((ss,it) => {
    const p=(parseFloat(it.base)||0)+(parseFloat(it.iva)||0)+(parseFloat(it.tua)||0)+(parseFloat(it.others)||0);
    return ss+p*(1-(parseFloat(it.csb)||0)/100);
  },0),0);
  const totalCom = totalPub - totalNeta;
  const pctCom = totalPub>0 ? ((totalCom/totalPub)*100).toFixed(2) : "0.00";

  const addRooming = () => setG(p => ({ ...p, roomingList:[...p.roomingList, mkRoomRow()] }));
  const updRoom = (id,val) => setG(p => ({ ...p, roomingList: p.roomingList.map(r => r.id===id?val:r) }));
  const remRoom = id => setG(p => ({ ...p, roomingList: p.roomingList.filter(r => r.id!==id) }));

  const TABS = [
    { id:"hospedaje",   label:"Hospedaje" },
    { id:"habitaciones",label:"Habitaciones" },
    { id:"venta",       label:"Venta maestra" },
    { id:"expedientes", label:`Expedientes (${linkedExps.length})` },
    { id:"pagos",       label:"Pagos clientes" },
    { id:"rooming",     label:"Rooming" },
  ];

  const thS = { padding:"5px 8px", fontSize:9, fontWeight:700, color:"#546E7A", textAlign:"left", whiteSpace:"nowrap" };
  const tdS = { padding:"5px 8px", fontSize:10, borderBottom:"1px solid #F0F0F0" };

  return (
    <div style={{ padding:18, maxWidth:1100, margin:"0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:11, color:"#546E7A", marginBottom:3 }}>Expediente No.- {g.no} &nbsp;·&nbsp; Campaña: {g.campaign}</div>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <h2 style={{ margin:0, fontSize:17, color:B.dark, fontWeight:900 }}>{g.name||"Nuevo grupo"}</h2>
          <span style={{ fontSize:11, color:B.blue, cursor:"pointer" }}>{"< Ir a todos los grupos >"}</span>
        </div>
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:11, flexWrap:"wrap", gap:7 }}>
        <Tabs tabs={TABS} active={tab} onSelect={setTab}/>
        <div style={{ display:"flex", gap:5 }}>
          <Btn v="primary" sz="sm" onClick={() => onSave(g)}>💾 Guardar</Btn>
          <Btn v="secondary" sz="sm" onClick={onBack}>&larr; Atrás</Btn>
        </div>
      </div>

      {/* HOSPEDAJE */}
      {tab==="hospedaje" && (
        <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:7, padding:16 }}>
          <div style={{ fontSize:11, fontWeight:800, color:B.dark, marginBottom:12 }}>Fechas de grupo</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:10, marginBottom:14 }}>
            <FI label="Nombre del grupo"  value={g.name}       onChange={v=>upd("name",v)}       placeholder="Mercadillos Navideños..."/>
            <FS label="Campaña"           value={g.campaign}   onChange={v=>upd("campaign",v)}   options={CAMPAIGNS.map(c=>({value:c.id,label:c.label}))}/>
            <FS label="Estatus"           value={g.status}     onChange={v=>upd("status",v)}     options={Object.entries(GROUP_STATUS).map(([k,s])=>({value:k,label:s.label}))}/>
            <FS label="Divisa"            value={g.currency}   onChange={v=>upd("currency",v)}   options={CURRENCIES.map(c=>({value:c,label:c}))}/>
            <FI label="Entrada"           value={g.dateFrom}   onChange={v=>upd("dateFrom",v)}   type="date"/>
            <FI label="Salida"            value={g.dateTo}     onChange={v=>upd("dateTo",v)}     type="date"/>
            <FI label="Noches"            value={String(g.nights)} onChange={v=>upd("nights",parseInt(v)||0)} type="number"/>
            <FI label="Habitaciones"      value={String(g.rooms)}  onChange={v=>upd("rooms",parseInt(v)||0)}  type="number"/>
            <FI label="Paxs"             value={String(g.paxs)}   onChange={v=>upd("paxs",parseInt(v)||0)}   type="number"/>
            <FS label="Mayorista"         value={g.wholesalerId}   onChange={v=>upd("wholesalerId",v)} options={WHOLESALERS.map(w=>({value:w.id,label:w.name}))}/>
            <FS label="Agente"            value={g.advisorId}      onChange={v=>upd("advisorId",v)} options={ADVISORS.map(a=>({value:a.id,label:a.name}))}/>
          </div>

          {/* Summary cards */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:10, marginBottom:14 }}>
            {[
              { label:"Pública",  value:`$${fmt(totalPub)} ${g.currency}`, color:B.blue  },
              { label:"Neta",     value:`$${fmt(totalNeta)} ${g.currency}`, color:B.teal  },
              { label:"Comisión", value:`$${fmt(totalCom)} ${g.currency}`, color:B.gold  },
              { label:"%",        value:`${pctCom}%`,                       color:"#546E7A" },
            ].map(s=>(
              <div key={s.label} style={{ background:"#F8F9FA", border:"1px solid #E0E0E0", borderRadius:6, padding:"12px 16px", textAlign:"center" }}>
                <div style={{ fontSize:9, color:"#546E7A", marginBottom:4 }}>{s.label}</div>
                <div style={{ fontSize:17, fontWeight:900, color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <FTA label="Notas del grupo" value={g.notes} onChange={v=>upd("notes",v)} rows={3}/>
        </div>
      )}

      {/* HABITACIONES */}
      {tab==="habitaciones" && (
        <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:7, padding:16 }}>
          <div style={{ fontSize:11, fontWeight:800, color:B.dark, marginBottom:10 }}>Distribución de habitaciones</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:14 }}>
            {[
              { label:"Total habitaciones", value:g.rooms },
              { label:"Disponibles",        value:g.rooms - g.roomingList.length },
              { label:"Ocupadas",           value:g.roomingList.length },
              { label:"Total noches",       value:g.nights * g.rooms },
            ].map(s=>(
              <div key={s.label} style={{ background:"#F0F4FF", border:"1px solid #C5CAE9", borderRadius:6, padding:"10px 14px", textAlign:"center" }}>
                <div style={{ fontSize:9, color:"#546E7A", marginBottom:3 }}>{s.label}</div>
                <div style={{ fontSize:18, fontWeight:900, color:B.dark }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
            {["Doble","Sencilla","Triple","Suite","Familiar","Interconnected"].map(t=>(
              <div key={t} style={{ background:"#F8F9FA", border:"1px solid #E0E0E0", borderRadius:5, padding:"8px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:11, fontWeight:600 }}>{t}</span>
                <span style={{ fontSize:12, fontWeight:800, color:B.blue }}>
                  {g.roomingList.filter(r=>r.roomType===t).length}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VENTA MAESTRA */}
      {tab==="venta" && (
        <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:7, padding:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:11, fontWeight:800, color:B.dark }}>Venta maestra del grupo</div>
          </div>
          {g.masterItems.map((it,i) => (
            <ItemEditor key={it.id} item={it}
              onChange={val=>setG(p=>({...p,masterItems:p.masterItems.map(x=>x.id===it.id?val:x)}))}
              onDelete={()=>setG(p=>({...p,masterItems:p.masterItems.filter(x=>x.id!==it.id)}))}
              canDelete={true}/>
          ))}
          <Btn v="ghost" sz="sm" onClick={()=>setG(p=>({...p,masterItems:[...p.masterItems,mkItem()]}))}>+ Agregar partida maestra</Btn>
          {g.masterItems.length>0&&(
            <div style={{ textAlign:"right", marginTop:10, paddingTop:10, borderTop:"2px solid #E0E0E0" }}>
              <span style={{ fontSize:12, fontWeight:700, color:"#546E7A", marginRight:10 }}>Total maestro:</span>
              <span style={{ fontSize:16, fontWeight:900, color:B.dark }}>
                ${fmt(g.masterItems.reduce((s,it)=>{const p=(parseFloat(it.base)||0)+(parseFloat(it.iva)||0)+(parseFloat(it.tua)||0)+(parseFloat(it.others)||0);return s+p;},0))} {g.currency}
              </span>
            </div>
          )}
        </div>
      )}

      {/* EXPEDIENTES DEL GRUPO */}
      {tab==="expedientes" && (
        <div>
          {/* Filters */}
          <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:6, padding:"10px 13px", marginBottom:10 }}>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
              <FS value="" onChange={()=>{}} sm options={[{value:"",label:"- Todos los mayoristas -"},...WHOLESALERS.map(w=>({value:w.id,label:w.name}))]} style={{width:180}}/>
              <FS value="" onChange={()=>{}} sm options={[{value:"",label:"- Todos los conceptos -"},...CONCEPTS.map(c=>({value:c,label:c}))]} style={{width:170}}/>
              <FS value="" onChange={()=>{}} sm options={[{value:"",label:"- Todos los agentes -"},...ADVISORS.map(a=>({value:a.id,label:a.name}))]} style={{width:150}}/>
              <div style={{ fontSize:9, fontWeight:700, color:"#546E7A", marginLeft:8 }}>Estatus:</div>
              {Object.entries(EXP_STATUS).slice(0,5).map(([k,s])=>(
                <label key={k} style={{ display:"flex", alignItems:"center", gap:3, fontSize:9, cursor:"pointer" }}>
                  <input type="checkbox" defaultChecked style={{ accentColor:s.c }}/> {s.label}
                </label>
              ))}
              <Btn v="primary" sz="sm">Buscar</Btn>
              <Btn v="secondary" sz="sm">Borrar filtros</Btn>
              <div style={{ flex:1 }}/>
              <Btn v="secondary" sz="sm">Registros por página</Btn>
              <Btn v="secondary" sz="sm">Columnas Visibles</Btn>
              <Btn v="success" sz="sm">📊 Exportar a Excel</Btn>
            </div>
          </div>

          <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:6, overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
              <thead><tr style={{ background:B.dark, color:"#fff" }}>
                {["?","No.Exp.","Fecha venta","Cliente","Estatus","No.Paxs","Paxs","CheckIn","CheckOut","Noches","Pública","Saldo","Comisión"].map(h=>(
                  <th key={h} style={{ ...thS, color:"#fff", padding:"7px 8px" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {linkedExps.length===0 && (
                  <tr><td colSpan={13} style={{ textAlign:"center", padding:30, color:"#B0BEC5", fontSize:11 }}>
                    Sin expedientes vinculados a este grupo.
                  </td></tr>
                )}
                {linkedExps.map((e,i)=>{
                  const pub = e.items.reduce((s,it)=>{const p=(parseFloat(it.base)||0)+(parseFloat(it.iva)||0)+(parseFloat(it.tua)||0)+(parseFloat(it.others)||0);return s+p;},0);
                  const paid = e.payments.filter(p=>p.confirmed).reduce((s,p)=>s+(parseFloat(p.amount)||0),0);
                  const neta = e.items.reduce((s,it)=>{const p=(parseFloat(it.base)||0)+(parseFloat(it.iva)||0)+(parseFloat(it.tua)||0)+(parseFloat(it.others)||0);return s+p*(1-(parseFloat(it.csb)||0)/100);},0);
                  const st = EXP_STATUS[e.status]||EXP_STATUS.nuevo;
                  return (
                    <tr key={e.id} style={{ background:i%2===0?"#fff":"#FAFAFA", borderBottom:"1px solid #F0F0F0" }}>
                      <td style={tdS}><span style={{ cursor:"pointer", color:B.blue }}>?</span></td>
                      <td style={{ ...tdS, color:B.blue, fontWeight:700 }}>{e.no}</td>
                      <td style={tdS}>{e.created}</td>
                      <td style={{ ...tdS, fontWeight:600 }}>{e.clientName||"–"}</td>
                      <td style={tdS}><span style={{ background:st.bg, color:st.c, padding:"2px 7px", borderRadius:7, fontSize:9, fontWeight:700 }}>{st.label}</span></td>
                      <td style={tdS}>{e.trip.paxAdult||0}</td>
                      <td style={tdS}>{e.trip.paxAdult||0}</td>
                      <td style={tdS}>{e.trip.dateFrom||g.dateFrom||"–"}</td>
                      <td style={tdS}>{e.trip.dateTo||g.dateTo||"–"}</td>
                      <td style={tdS}>{g.nights||0}</td>
                      <td style={{ ...tdS, fontWeight:700, color:B.blue }}>${fmt(pub)}</td>
                      <td style={{ ...tdS, color:pub-paid>0?B.red:B.green }}>${fmt(pub-paid)}</td>
                      <td style={{ ...tdS, color:B.gold }}>${fmt(pub-neta)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {linkedExps.length>0&&(
                <tfoot><tr style={{ background:"#F5F7FA", fontWeight:700 }}>
                  <td colSpan={10} style={{ padding:"7px 8px", fontSize:10, textAlign:"right", color:"#546E7A" }}>TOTALES:</td>
                  <td style={{ padding:"7px 8px", fontSize:10, color:B.blue }}>${fmt(linkedExps.reduce((s,e)=>s+e.items.reduce((ss,it)=>{const p=(parseFloat(it.base)||0)+(parseFloat(it.iva)||0)+(parseFloat(it.tua)||0)+(parseFloat(it.others)||0);return ss+p;},0),0))}</td>
                  <td style={{ padding:"7px 8px", fontSize:10 }}>–</td>
                  <td style={{ padding:"7px 8px", fontSize:10, color:B.gold }}>${fmt(totalCom)}</td>
                </tr></tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* PAGOS CLIENTES */}
      {tab==="pagos" && (
        <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:7, padding:16 }}>
          <div style={{ fontSize:11, fontWeight:800, color:B.dark, marginBottom:10 }}>Pagos de clientes del grupo</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:14 }}>
            {[
              { label:"Total venta grupo",   value:`$${fmt(totalPub)}`,   color:B.blue  },
              { label:"Total cobrado",       value:`$${fmt(linkedExps.reduce((s,e)=>s+e.payments.filter(p=>p.confirmed).reduce((ss,p)=>ss+(parseFloat(p.amount)||0),0),0))}`, color:B.green },
              { label:"Saldo pendiente",     value:`$${fmt(totalPub - linkedExps.reduce((s,e)=>s+e.payments.filter(p=>p.confirmed).reduce((ss,p)=>ss+(parseFloat(p.amount)||0),0),0))}`, color:B.red },
            ].map(s=>(
              <div key={s.label} style={{ background:"#F8F9FA", border:"1px solid #E0E0E0", borderRadius:6, padding:"12px 16px", textAlign:"center" }}>
                <div style={{ fontSize:9, color:"#546E7A", marginBottom:4 }}>{s.label}</div>
                <div style={{ fontSize:16, fontWeight:900, color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
              <thead><tr style={{ background:"#F5F7FA" }}>
                {["Expediente","Cliente","Recibo","Fecha","Forma Pago","Referencia","Monto","✓"].map(h=>(
                  <th key={h} style={thS}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {linkedExps.flatMap(e=>e.payments.map(p=>({...p, expNo:e.no, clientName:e.clientName}))).map((p,i)=>(
                  <tr key={p.id} style={{ background:i%2===0?"#fff":"#FAFAFA", borderBottom:"1px solid #F0F0F0" }}>
                    <td style={{ ...tdS, color:B.blue, fontWeight:700 }}>{p.expNo}</td>
                    <td style={{ ...tdS, fontWeight:600 }}>{p.clientName||"–"}</td>
                    <td style={{ ...tdS, color:B.blue }}>{p.receipt}</td>
                    <td style={tdS}>{p.date}</td>
                    <td style={tdS}>{p.method}</td>
                    <td style={tdS}>{p.reference||"–"}</td>
                    <td style={{ ...tdS, fontWeight:700, color:B.green }}>${fmt(p.amount)}</td>
                    <td style={{ ...tdS, textAlign:"center" }}>{p.confirmed?"✅":"⬜"}</td>
                  </tr>
                ))}
                {linkedExps.flatMap(e=>e.payments).length===0&&(
                  <tr><td colSpan={8} style={{ textAlign:"center", padding:24, color:"#B0BEC5", fontSize:11 }}>Sin pagos registrados en los expedientes del grupo.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ROOMING */}
      {tab==="rooming" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:11, fontWeight:800, color:B.dark }}>Rooming List — {g.name}</div>
            <div style={{ display:"flex", gap:6 }}>
              <Btn v="success" sz="sm">📊 Exportar Excel</Btn>
              <Btn v="primary" sz="sm" onClick={addRooming}>+ Agregar habitación</Btn>
            </div>
          </div>
          <div style={{ background:"#E3F2FD", border:"1px solid #90CAF9", borderRadius:6, padding:"8px 12px", marginBottom:10, fontSize:10, color:B.dark }}>
            <b>Grupo:</b> {g.name} &nbsp;·&nbsp; <b>Mayorista:</b> {wh.name} &nbsp;·&nbsp;
            <b>Entrada:</b> {g.dateFrom||"–"} &nbsp;·&nbsp; <b>Salida:</b> {g.dateTo||"–"} &nbsp;·&nbsp;
            <b>Noches:</b> {g.nights} &nbsp;·&nbsp; <b>Total hab.:</b> {g.rooms} &nbsp;·&nbsp; <b>Total pax:</b> {g.paxs}
          </div>
          <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:7, overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
              <thead><tr style={{ background:B.dark, color:"#fff" }}>
                {["No.Exp.","Pasajero","Tipo hab.","No. hab.","Adultos","Niños","CheckIn","CheckOut","Noches","Pública","Saldo","Comisión","Notas",""].map(h=>(
                  <th key={h} style={{ padding:"6px 8px", textAlign:"left", fontSize:9, fontWeight:700, whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {g.roomingList.map((r,i)=>(
                  <tr key={r.id} style={{ background:i%2===0?"#fff":"#FFFDE7", borderBottom:"1px solid #F0F0F0" }}>
                    <td style={tdS}><input value={r.expNo} onChange={e=>updRoom(r.id,{...r,expNo:e.target.value})} style={{ ...SI, width:60, padding:"2px 5px", fontSize:9 }}/></td>
                    <td style={tdS}><input value={r.clientName} onChange={e=>updRoom(r.id,{...r,clientName:e.target.value})} style={{ ...SI, width:130, padding:"2px 5px", fontSize:9 }}/></td>
                    <td style={tdS}>
                      <select value={r.roomType} onChange={e=>updRoom(r.id,{...r,roomType:e.target.value})} style={{ ...SI, width:85, padding:"2px 5px", fontSize:9 }}>
                        {["Doble","Sencilla","Triple","Suite","Familiar"].map(t=><option key={t}>{t}</option>)}
                      </select>
                    </td>
                    <td style={tdS}><input value={r.roomNo} onChange={e=>updRoom(r.id,{...r,roomNo:e.target.value})} style={{ ...SI, width:55, padding:"2px 5px", fontSize:9 }}/></td>
                    <td style={tdS}><input type="number" value={r.paxAdult} onChange={e=>updRoom(r.id,{...r,paxAdult:parseInt(e.target.value)||0})} style={{ ...SI, width:40, padding:"2px 5px", fontSize:9 }}/></td>
                    <td style={tdS}><input type="number" value={r.paxChild} onChange={e=>updRoom(r.id,{...r,paxChild:parseInt(e.target.value)||0})} style={{ ...SI, width:40, padding:"2px 5px", fontSize:9 }}/></td>
                    <td style={tdS}><input type="date" value={r.checkIn||g.dateFrom} onChange={e=>updRoom(r.id,{...r,checkIn:e.target.value})} style={{ ...SI, width:105, padding:"2px 5px", fontSize:9 }}/></td>
                    <td style={tdS}><input type="date" value={r.checkOut||g.dateTo} onChange={e=>updRoom(r.id,{...r,checkOut:e.target.value})} style={{ ...SI, width:105, padding:"2px 5px", fontSize:9 }}/></td>
                    <td style={tdS}><input type="number" value={r.nights||g.nights} onChange={e=>updRoom(r.id,{...r,nights:parseInt(e.target.value)||0})} style={{ ...SI, width:40, padding:"2px 5px", fontSize:9 }}/></td>
                    <td style={tdS}><input type="number" value={r.publica} onChange={e=>updRoom(r.id,{...r,publica:parseFloat(e.target.value)||0})} style={{ ...SI, width:75, padding:"2px 5px", fontSize:9, fontWeight:700 }}/></td>
                    <td style={tdS}><input type="number" value={r.saldo} onChange={e=>updRoom(r.id,{...r,saldo:parseFloat(e.target.value)||0})} style={{ ...SI, width:75, padding:"2px 5px", fontSize:9 }}/></td>
                    <td style={tdS}><input type="number" value={r.comision} onChange={e=>updRoom(r.id,{...r,comision:parseFloat(e.target.value)||0})} style={{ ...SI, width:75, padding:"2px 5px", fontSize:9 }}/></td>
                    <td style={tdS}><input value={r.notes} onChange={e=>updRoom(r.id,{...r,notes:e.target.value})} style={{ ...SI, width:110, padding:"2px 5px", fontSize:9 }}/></td>
                    <td style={tdS}><button onClick={()=>remRoom(r.id)} style={{ background:"#FFEBEE", border:"none", borderRadius:3, padding:"2px 6px", cursor:"pointer", color:B.red, fontSize:9 }}>✕</button></td>
                  </tr>
                ))}
                {g.roomingList.length===0&&(
                  <tr><td colSpan={14} style={{ textAlign:"center", padding:24, color:"#B0BEC5", fontSize:11 }}>
                    Sin pasajeros en el rooming list. Haz clic en "+ Agregar habitación".
                  </td></tr>
                )}
              </tbody>
              {g.roomingList.length>0&&(
                <tfoot><tr style={{ background:"#F5F7FA", fontWeight:700 }}>
                  <td colSpan={9} style={{ padding:"6px 8px", fontSize:10, textAlign:"right", color:"#546E7A" }}>TOTALES:</td>
                  <td style={{ padding:"6px 8px", fontSize:10, color:B.blue }}>${fmt(g.roomingList.reduce((s,r)=>s+(parseFloat(r.publica)||0),0))}</td>
                  <td style={{ padding:"6px 8px", fontSize:10 }}>${fmt(g.roomingList.reduce((s,r)=>s+(parseFloat(r.saldo)||0),0))}</td>
                  <td style={{ padding:"6px 8px", fontSize:10, color:B.gold }}>${fmt(g.roomingList.reduce((s,r)=>s+(parseFloat(r.comision)||0),0))}</td>
                  <td colSpan={2}/>
                </tr></tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GRUPOS LIST ──────────────────────────────────────────────────────────────
function GruposList({ grupos, expedientes, onSelect, onNew }) {
  const [search, setSearch] = useState("");
  const [fCamp,  setFCamp]  = useState("");
  const [fSt,    setFSt]    = useState("");

  const filtered = grupos.filter(g => {
    const s = search.toLowerCase();
    return (!s || g.name.toLowerCase().includes(s) || String(g.no).includes(s)) &&
           (!fCamp || g.campaign===fCamp) && (!fSt || g.status===fSt);
  });

  const thS = { padding:"7px 9px", fontSize:9, fontWeight:700, color:"#fff", textAlign:"left", whiteSpace:"nowrap" };
  const tdS = { padding:"6px 9px", fontSize:10, borderBottom:"1px solid #F0F0F0" };

  return (
    <div style={{ padding:18, maxWidth:1200, margin:"0 auto" }}>
      <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:6, padding:"11px 13px", marginBottom:12 }}>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <FS value={fCamp} onChange={setFCamp} sm style={{ width:160 }}
            options={[{value:"",label:"< Todas las campañas >"},...CAMPAIGNS.map(c=>({value:c.id,label:c.label}))]}/>
          <FS value={fSt} onChange={setFSt} sm style={{ width:130 }}
            options={[{value:"",label:"Seleccione"},...Object.entries(GROUP_STATUS).map(([k,s])=>({value:k,label:s.label}))]}/>
          <div style={{ flex:1 }}/>
          <Btn v="teal" onClick={onNew}>+ Crear grupo</Btn>
        </div>
        <div style={{ display:"flex", gap:8, marginTop:9, alignItems:"center" }}>
          <label style={{ fontSize:10, color:"#546E7A" }}>Buscar:</label>
          <input value={search} onChange={e=>setSearch(e.target.value)} style={{ ...SI, width:200, padding:"4px 8px", fontSize:10 }}/>
          <div style={{ flex:1 }}/>
          <Btn v="secondary" sz="sm">Registros por página</Btn>
          <Btn v="secondary" sz="sm">Columnas Visibles</Btn>
          <Btn v="success" sz="sm">📊 Exportar a Excel</Btn>
        </div>
      </div>

      <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:6, overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
          <thead><tr style={{ background:B.dark }}>
            {["","Estatus","No.Exp.","Nombre grupo","↕","Divisa","Cliente","Hab.","Disp.","Inicio","Fin"].map(h=>(
              <th key={h} style={thS}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map((g,i)=>{
              const st = GROUP_STATUS[g.status]||GROUP_STATUS.nuevo;
              const adv = ADVISORS.find(a=>a.id===g.advisorId);
              const linked = expedientes.filter(e=>g.expedientes.includes(e.id));
              return (
                <tr key={g.id} style={{ background:i%2===0?"#fff":"#FAFAFA", cursor:"pointer" }}
                  onMouseEnter={e=>e.currentTarget.style.background="#E3F2FD"}
                  onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":"#FAFAFA"}
                  onClick={()=>onSelect(g)}>
                  <td style={tdS}>
                    <div style={{ display:"flex", gap:2 }}>
                      {["C","M","E","P","R"].map(l=>(
                        <span key={l} style={{ background:"#E0E0E0", borderRadius:3, padding:"1px 4px", fontSize:8, fontWeight:700 }}>{l}</span>
                      ))}
                    </div>
                  </td>
                  <td style={tdS}><span style={{ background:st.bg, color:st.c, padding:"2px 7px", borderRadius:7, fontSize:9, fontWeight:700 }}>{st.label}</span></td>
                  <td style={{ ...tdS, color:B.blue, fontWeight:700 }}>{g.no}</td>
                  <td style={{ ...tdS, fontWeight:600 }}>{g.name||"–"}</td>
                  <td style={{ ...tdS, color:"#546E7A" }}>{adv?.name.split(" ")[0]||"–"}</td>
                  <td style={tdS}>{g.currency}</td>
                  <td style={tdS}>{linked.length>0?linked[0].clientName||"–":"–"}</td>
                  <td style={tdS}>{g.rooms}</td>
                  <td style={tdS}>{g.rooms - g.roomingList.length}</td>
                  <td style={tdS}>{g.dateFrom||"–"}</td>
                  <td style={tdS}>{g.dateTo||"–"}</td>
                </tr>
              );
            })}
            {filtered.length===0&&(
              <tr><td colSpan={11} style={{ textAlign:"center", padding:36, color:"#B0BEC5", fontSize:11 }}>
                <div style={{ fontSize:28, marginBottom:8 }}>👥</div>
                Sin grupos. <Btn v="outline" style={{ marginTop:8 }} onClick={onNew}>Crear primer grupo</Btn>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── FASE 2: CUENTAS X COBRAR ─────────────────────────────────────────────────
function CuentasXCobrar({ expedientes, clients }) {
  const [tab, setTab] = useState("clientes");
  const TABS = [{ id:"clientes", label:"Clientes" }, { id:"comisiones", label:"Comisiones" }];

  // pending balances per expediente
  const rows = expedientes.map(e => {
    const pub  = e.items.reduce((s,it)=>{const p=(parseFloat(it.base)||0)+(parseFloat(it.iva)||0)+(parseFloat(it.tua)||0)+(parseFloat(it.others)||0);return s+p;},0);
    const paid = e.payments.filter(p=>p.confirmed).reduce((s,p)=>s+(parseFloat(p.amount)||0),0);
    const saldo = pub - paid;
    const neta  = e.items.reduce((s,it)=>{const p=(parseFloat(it.base)||0)+(parseFloat(it.iva)||0)+(parseFloat(it.tua)||0)+(parseFloat(it.others)||0);return s+p*(1-(parseFloat(it.csb)||0)/100);},0);
    const com   = pub - neta;
    const adv   = ADVISORS.find(a=>a.id===e.advisorId);
    return { ...e, pub, paid, saldo, neta, com, adv };
  }).filter(r => r.saldo > 0).sort((a,b) => b.saldo - a.saldo);

  const totalSaldo = rows.reduce((s,r) => s+r.saldo, 0);
  const totalPub   = rows.reduce((s,r) => s+r.pub,   0);

  // commissions: items with csb > 0 not yet paid by major
  const comRows = expedientes.flatMap(e =>
    e.items.filter(it=>(parseFloat(it.csb)||0)>0).map(it=>{
      const pub=(parseFloat(it.base)||0)+(parseFloat(it.iva)||0)+(parseFloat(it.tua)||0)+(parseFloat(it.others)||0);
      const neta=pub*(1-(parseFloat(it.csb)||0)/100);
      const com=pub-neta;
      const wh=WHOLESALERS.find(w=>w.id===it.wholesalerId)||WHOLESALERS[0];
      const adv=ADVISORS.find(a=>a.id===e.advisorId);
      const majPaid=e.majorPayments.filter(p=>p.confirmed).reduce((s,p)=>s+(parseFloat(p.amount)||0),0);
      return { id:it.id, expNo:e.no, clientName:e.clientName, concept:it.concept, wh:wh.name, pub, neta, com, pct:it.csb, adv, majPaid, status:e.status };
    })
  ).filter(r=>r.com>0);
  const totalCom = comRows.reduce((s,r) => s+r.com, 0);

  const thS = { padding:"6px 8px", fontSize:9, fontWeight:700, color:"#546E7A", textAlign:"left", whiteSpace:"nowrap" };
  const tdS = { padding:"6px 8px", fontSize:10, borderBottom:"1px solid #F0F0F0" };

  return (
    <div style={{ padding:18, maxWidth:1100, margin:"0 auto" }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
        {[
          { label:"Saldo total por cobrar", value:`$${fmt(totalSaldo)}`, color:B.red,   icon:"💳" },
          { label:"Venta total implicada",  value:`$${fmt(totalPub)}`,   color:B.blue,  icon:"💰" },
          { label:"Comisiones por cobrar",  value:`$${fmt(totalCom)}`,   color:B.gold,  icon:"📈" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:7, padding:14, display:"flex", gap:10, alignItems:"center" }}>
            <div style={{ fontSize:28 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize:9, color:"#546E7A" }}>{s.label}</div>
              <div style={{ fontSize:20, fontWeight:900, color:s.color }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <Tabs tabs={TABS} active={tab} onSelect={setTab}/>

      {tab==="clientes" && (
        <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:6, overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
            <thead><tr style={{ background:"#F5F7FA" }}>
              {["No.Exp.","Cliente","Agente","Destino","Estatus","Venta","Cobrado","Saldo","Próximo pago",""].map(h=>(
                <th key={h} style={thS}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map((r,i)=>{
                const st=EXP_STATUS[r.status]||EXP_STATUS.nuevo;
                const nextPay=r.payments.filter(p=>!p.confirmed)[0];
                return (
                  <tr key={r.id} style={{ background:i%2===0?"#fff":"#FAFAFA" }}>
                    <td style={{ ...tdS, color:B.blue, fontWeight:700 }}>{r.no}</td>
                    <td style={{ ...tdS, fontWeight:600 }}>{r.clientName||"–"}</td>
                    <td style={tdS}>{r.adv?.name.split(" ")[0]||"–"}</td>
                    <td style={tdS}>{r.trip?.destination||"–"}</td>
                    <td style={tdS}><span style={{ background:st.bg, color:st.c, padding:"2px 6px", borderRadius:6, fontSize:9, fontWeight:700 }}>{st.label}</span></td>
                    <td style={{ ...tdS, color:B.blue, fontWeight:700 }}>${fmt(r.pub)}</td>
                    <td style={{ ...tdS, color:B.green }}>${fmt(r.paid)}</td>
                    <td style={{ ...tdS, color:B.red, fontWeight:700 }}>${fmt(r.saldo)}</td>
                    <td style={tdS}>{nextPay ? nextPay.date : "–"}</td>
                    <td style={tdS}><Btn v="primary" sz="sm">💳 Cobrar</Btn></td>
                  </tr>
                );
              })}
              {rows.length===0&&(
                <tr><td colSpan={10} style={{ textAlign:"center", padding:30, color:"#B0BEC5", fontSize:11 }}>✅ Sin saldos pendientes por cobrar.</td></tr>
              )}
            </tbody>
            {rows.length>0&&(
              <tfoot><tr style={{ background:"#F5F7FA", fontWeight:700 }}>
                <td colSpan={5} style={{ padding:"6px 8px", fontSize:10, textAlign:"right", color:"#546E7A" }}>TOTALES:</td>
                <td style={{ padding:"6px 8px", color:B.blue }}>${fmt(totalPub)}</td>
                <td style={{ padding:"6px 8px", color:B.green }}>${fmt(rows.reduce((s,r)=>s+r.paid,0))}</td>
                <td style={{ padding:"6px 8px", color:B.red, fontWeight:900 }}>${fmt(totalSaldo)}</td>
                <td colSpan={2}/>
              </tr></tfoot>
            )}
          </table>
        </div>
      )}

      {tab==="comisiones" && (
        <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:6, overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
            <thead><tr style={{ background:"#F5F7FA" }}>
              {["No.Exp.","Cliente","Concepto","Mayorista","Agente","Pública","Neta","Comisión","%","Pagado May.","Estado"].map(h=>(
                <th key={h} style={thS}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {comRows.map((r,i)=>(
                <tr key={r.id} style={{ background:i%2===0?"#fff":"#FAFAFA" }}>
                  <td style={{ ...tdS, color:B.blue, fontWeight:700 }}>{r.expNo}</td>
                  <td style={{ ...tdS, fontWeight:600 }}>{r.clientName||"–"}</td>
                  <td style={tdS}>{r.concept}</td>
                  <td style={tdS}>{r.wh}</td>
                  <td style={tdS}>{r.adv?.name.split(" ")[0]||"–"}</td>
                  <td style={{ ...tdS, color:B.blue, fontWeight:700 }}>${fmt(r.pub)}</td>
                  <td style={{ ...tdS, color:B.teal }}>${fmt(r.neta)}</td>
                  <td style={{ ...tdS, color:B.gold, fontWeight:700 }}>${fmt(r.com)}</td>
                  <td style={tdS}>{r.pct}%</td>
                  <td style={{ ...tdS, color:B.green }}>${fmt(r.majPaid)}</td>
                  <td style={tdS}><span style={{ background:"#FFF8E1", color:B.gold, padding:"2px 6px", borderRadius:6, fontSize:9, fontWeight:700 }}>Pendiente</span></td>
                </tr>
              ))}
              {comRows.length===0&&(
                <tr><td colSpan={11} style={{ textAlign:"center", padding:30, color:"#B0BEC5", fontSize:11 }}>Sin comisiones pendientes.</td></tr>
              )}
            </tbody>
            {comRows.length>0&&(
              <tfoot><tr style={{ background:"#F5F7FA", fontWeight:700 }}>
                <td colSpan={7} style={{ padding:"6px 8px", fontSize:10, textAlign:"right", color:"#546E7A" }}>TOTAL COMISIONES:</td>
                <td style={{ padding:"6px 8px", color:B.gold, fontSize:12 }}>${fmt(totalCom)}</td>
                <td colSpan={3}/>
              </tr></tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

// ─── FASE 2: CUENTAS X PAGAR ──────────────────────────────────────────────────
function CuentasXPagar({ expedientes }) {
  const [tab, setTab] = useState("mayoristas");
  const TABS = [{ id:"mayoristas", label:"Mayoristas" }, { id:"gastos", label:"Gastos" }];

  const rows = expedientes.flatMap(e =>
    e.items.map(it => {
      const pub  = (parseFloat(it.base)||0)+(parseFloat(it.iva)||0)+(parseFloat(it.tua)||0)+(parseFloat(it.others)||0);
      const neta = pub*(1-(parseFloat(it.csb)||0)/100);
      const com  = pub-neta;
      const paid = e.majorPayments.filter(p=>p.confirmed).reduce((s,p)=>s+(parseFloat(p.amount)||0),0);
      const pending = neta - paid;
      const wh   = WHOLESALERS.find(w=>w.id===it.wholesalerId)||WHOLESALERS[0];
      const adv  = ADVISORS.find(a=>a.id===e.advisorId);
      return { id:it.id, expNo:e.no, clientName:e.clientName, concept:it.concept, wh, adv, pub, neta, com, paid, pending, limit:it.dateTo, status:e.status };
    })
  ).filter(r => r.pending > 0).sort((a,b) => (a.limit||"9999").localeCompare(b.limit||"9999"));

  const totalNeta    = rows.reduce((s,r) => s+r.neta, 0);
  const totalPending = rows.reduce((s,r) => s+r.pending, 0);
  const totalPaid    = rows.reduce((s,r) => s+r.paid, 0);

  const thS = { padding:"6px 8px", fontSize:9, fontWeight:700, color:"#546E7A", textAlign:"left", whiteSpace:"nowrap" };
  const tdS = { padding:"6px 8px", fontSize:10, borderBottom:"1px solid #F0F0F0" };

  return (
    <div style={{ padding:18, maxWidth:1100, margin:"0 auto" }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
        {[
          { label:"Total por pagar (neto)",   value:`$${fmt(totalNeta)}`,    color:B.red,  icon:"💸" },
          { label:"Ya pagado a mayoristas",   value:`$${fmt(totalPaid)}`,    color:B.green,icon:"✅" },
          { label:"Pendiente de pago",        value:`$${fmt(totalPending)}`, color:B.gold, icon:"⏳" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:7, padding:14, display:"flex", gap:10, alignItems:"center" }}>
            <div style={{ fontSize:28 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize:9, color:"#546E7A" }}>{s.label}</div>
              <div style={{ fontSize:20, fontWeight:900, color:s.color }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <Tabs tabs={TABS} active={tab} onSelect={setTab}/>

      {tab==="mayoristas" && (
        <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:6, overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
            <thead><tr style={{ background:"#F5F7FA" }}>
              {["No.Exp.","Cliente","Concepto","Mayorista","Agente","Pública","Neta","Comisión","Pagado","Pendiente","Límite",""].map(h=>(
                <th key={h} style={thS}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map((r,i)=>{
                const isUrgent = r.limit && new Date(r.limit) <= new Date(Date.now()+5*86400000);
                return (
                  <tr key={r.id} style={{ background: isUrgent?"#FFFDE7":i%2===0?"#fff":"#FAFAFA" }}>
                    <td style={{ ...tdS, color:B.blue, fontWeight:700 }}>{r.expNo}</td>
                    <td style={{ ...tdS, fontWeight:600 }}>{r.clientName||"–"}</td>
                    <td style={tdS}>{r.concept}</td>
                    <td style={{ ...tdS, fontWeight:600 }}>{r.wh.name}</td>
                    <td style={tdS}>{r.adv?.name.split(" ")[0]||"–"}</td>
                    <td style={{ ...tdS, color:B.blue }}>${fmt(r.pub)}</td>
                    <td style={{ ...tdS, color:B.teal, fontWeight:700 }}>${fmt(r.neta)}</td>
                    <td style={{ ...tdS, color:B.gold }}>${fmt(r.com)}</td>
                    <td style={{ ...tdS, color:B.green }}>${fmt(r.paid)}</td>
                    <td style={{ ...tdS, color:B.red, fontWeight:700 }}>${fmt(r.pending)}</td>
                    <td style={{ ...tdS, color:isUrgent?B.red:"#546E7A", fontWeight:isUrgent?700:400 }}>{r.limit||"–"}</td>
                    <td style={tdS}><Btn v="gold" sz="sm">💸 Pagar</Btn></td>
                  </tr>
                );
              })}
              {rows.length===0&&(
                <tr><td colSpan={12} style={{ textAlign:"center", padding:30, color:"#B0BEC5", fontSize:11 }}>✅ Sin pagos pendientes a mayoristas.</td></tr>
              )}
            </tbody>
            {rows.length>0&&(
              <tfoot><tr style={{ background:"#F5F7FA", fontWeight:700 }}>
                <td colSpan={5} style={{ padding:"6px 8px", fontSize:10, textAlign:"right", color:"#546E7A" }}>TOTALES:</td>
                <td style={{ padding:"6px 8px", color:B.blue }}>${fmt(rows.reduce((s,r)=>s+r.pub,0))}</td>
                <td style={{ padding:"6px 8px", color:B.teal }}>${fmt(totalNeta)}</td>
                <td style={{ padding:"6px 8px", color:B.gold }}>${fmt(rows.reduce((s,r)=>s+r.com,0))}</td>
                <td style={{ padding:"6px 8px", color:B.green }}>${fmt(totalPaid)}</td>
                <td style={{ padding:"6px 8px", color:B.red, fontSize:12 }}>${fmt(totalPending)}</td>
                <td colSpan={2}/>
              </tr></tfoot>
            )}
          </table>
        </div>
      )}

      {tab==="gastos" && (
        <div style={{ textAlign:"center", padding:40, color:"#B0BEC5", fontSize:11 }}>
          <div style={{ fontSize:32, marginBottom:10 }}>📉</div>
          Módulo de gastos operativos — disponible próximamente.
        </div>
      )}
    </div>
  );
}

// ─── FASE 2: REPORTE DE COMISIONES ───────────────────────────────────────────
function ReporteComisiones({ expedientes }) {
  const [month, setMonth] = useState("2026-05");
  const [fAdv,  setFAdv]  = useState("all");

  const months = [
    { value:"2026-05", label:"May-2026" },
    { value:"2026-04", label:"Apr-2026" },
    { value:"2026-03", label:"Mar-2026" },
  ];

  const allRows = expedientes.flatMap(e =>
    e.items.filter(it=>(parseFloat(it.csb)||0)>0).map(it=>{
      const pub=(parseFloat(it.base)||0)+(parseFloat(it.iva)||0)+(parseFloat(it.tua)||0)+(parseFloat(it.others)||0);
      const neta=pub*(1-(parseFloat(it.csb)||0)/100);
      const com=pub-neta;
      const wh=WHOLESALERS.find(w=>w.id===it.wholesalerId)||WHOLESALERS[0];
      const adv=ADVISORS.find(a=>a.id===e.advisorId);
      return { id:it.id, expNo:e.no, created:e.created, clientName:e.clientName, concept:it.concept, wh:wh.name, adv, pub, neta, com, pct:it.csb, status:e.status };
    })
  );

  const filtered = allRows.filter(r =>
    (r.created||"").startsWith(month) &&
    (fAdv==="all" || r.adv?.id===fAdv)
  );

  const totalCom = filtered.reduce((s,r) => s+r.com, 0);
  const totalPub = filtered.reduce((s,r) => s+r.pub, 0);

  const byAdv = ADVISORS.map(adv => ({
    adv,
    rows: filtered.filter(r => r.adv?.id===adv.id),
    total: filtered.filter(r=>r.adv?.id===adv.id).reduce((s,r)=>s+r.com,0),
  })).filter(x => x.rows.length>0);

  const thS = { padding:"6px 8px", fontSize:9, fontWeight:700, color:"#546E7A", textAlign:"left", whiteSpace:"nowrap" };
  const tdS = { padding:"6px 8px", fontSize:10, borderBottom:"1px solid #F0F0F0" };

  return (
    <div style={{ padding:18, maxWidth:1100, margin:"0 auto" }}>
      <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:14, flexWrap:"wrap" }}>
        <span style={{ fontSize:12, fontWeight:700, color:"#546E7A" }}>Comisiones de:</span>
        <select value={month} onChange={e=>setMonth(e.target.value)} style={{ ...SI, width:130, padding:"5px 9px", fontSize:11 }}>
          {months.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <FS value={fAdv} onChange={setFAdv} sm style={{ width:160 }}
          options={[{value:"all",label:"Todos los asesores"},...ADVISORS.map(a=>({value:a.id,label:a.name}))]}/>
        <div style={{ flex:1 }}/>
        <Btn v="success" sz="sm">📊 Exportar Excel</Btn>
      </div>

      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10, marginBottom:14 }}>
        {[
          { label:"Total comisiones",  value:`$${fmt(totalCom)}`, color:B.gold  },
          { label:"Total venta base",  value:`$${fmt(totalPub)}`, color:B.blue  },
          { label:"% promedio",        value:totalPub>0?`${((totalCom/totalPub)*100).toFixed(2)}%`:"0%", color:B.teal },
          { label:"Partidas",          value:String(filtered.length), color:"#546E7A" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:7, padding:14, textAlign:"center" }}>
            <div style={{ fontSize:9, color:"#546E7A", marginBottom:3 }}>{s.label}</div>
            <div style={{ fontSize:18, fontWeight:900, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* By advisor summary */}
      {byAdv.length>0&&(
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:10, marginBottom:14 }}>
          {byAdv.map(({adv,rows,total})=>(
            <div key={adv.id} style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:7, padding:13 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
                <div style={{ fontWeight:700, fontSize:12 }}>{adv.name.split(" ")[0]}</div>
                <div style={{ width:28, height:28, borderRadius:"50%", background:B.gold, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:12 }}>{adv.name.charAt(0)}</div>
              </div>
              <div style={{ fontSize:16, fontWeight:900, color:B.gold }}>${fmt(total)}</div>
              <div style={{ fontSize:9, color:"#546E7A", marginTop:2 }}>{rows.length} partida{rows.length!==1?"s":""}</div>
            </div>
          ))}
        </div>
      )}

      {/* Detail table */}
      <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:6, overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
          <thead><tr style={{ background:"#F5F7FA" }}>
            {["No.Exp.","Fecha","Cliente","Concepto","Mayorista","Agente","Pública","Neta","Comisión","%","Estatus"].map(h=>(
              <th key={h} style={thS}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map((r,i)=>{
              const st=EXP_STATUS[r.status]||EXP_STATUS.nuevo;
              return (
                <tr key={r.id} style={{ background:i%2===0?"#fff":"#FAFAFA" }}>
                  <td style={{ ...tdS, color:B.blue, fontWeight:700 }}>{r.expNo}</td>
                  <td style={tdS}>{r.created}</td>
                  <td style={{ ...tdS, fontWeight:600 }}>{r.clientName||"–"}</td>
                  <td style={tdS}>{r.concept}</td>
                  <td style={tdS}>{r.wh}</td>
                  <td style={tdS}>{r.adv?.name.split(" ")[0]||"–"}</td>
                  <td style={{ ...tdS, color:B.blue }}>${fmt(r.pub)}</td>
                  <td style={{ ...tdS, color:B.teal }}>${fmt(r.neta)}</td>
                  <td style={{ ...tdS, color:B.gold, fontWeight:700 }}>${fmt(r.com)}</td>
                  <td style={tdS}>{r.pct}%</td>
                  <td style={tdS}><span style={{ background:st.bg, color:st.c, padding:"2px 6px", borderRadius:6, fontSize:9, fontWeight:700 }}>{st.label}</span></td>
                </tr>
              );
            })}
            {filtered.length===0&&(
              <tr><td colSpan={11} style={{ textAlign:"center", padding:30, color:"#B0BEC5", fontSize:11 }}>Sin comisiones en este período.</td></tr>
            )}
          </tbody>
          {filtered.length>0&&(
            <tfoot><tr style={{ background:"#F5F7FA", fontWeight:700 }}>
              <td colSpan={6} style={{ padding:"6px 8px", fontSize:10, textAlign:"right", color:"#546E7A" }}>TOTALES:</td>
              <td style={{ padding:"6px 8px", color:B.blue }}>${fmt(totalPub)}</td>
              <td style={{ padding:"6px 8px", color:B.teal }}>${fmt(filtered.reduce((s,r)=>s+r.neta,0))}</td>
              <td style={{ padding:"6px 8px", color:B.gold, fontSize:12 }}>${fmt(totalCom)}</td>
              <td colSpan={2}/>
            </tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ─── FASE 2: CATÁLOGO BACK OFFICE ─────────────────────────────────────────────
function CatalogoBackOffice() {
  const [tab, setTab] = useState("mayoristas");
  const [proveedores, setProveedores] = useState(WHOLESALERS_SEED.map(p=>({...p})));
  const [products,  setProducts]  = useState(CATALOG_PRODUCTS.map(p=>({...p})));
  const [editProv,  setEditProv]  = useState(null);
  const [editProd,  setEditProd]  = useState(null);
  const [search,    setSearch]    = useState("");
  const [toast,     setToast]     = useState("");

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(""),2500); };

  const TABS = [
    { id:"mayoristas", label:"🏢 Mayoristas",  count: proveedores.filter(p=>p.tipo==="mayorista").length },
    { id:"aerolineas", label:"✈️ Aerolíneas",  count: proveedores.filter(p=>p.tipo==="aerolinea").length },
    { id:"hoteles",    label:"🏨 Hoteles",      count: proveedores.filter(p=>p.tipo==="hotel").length },
    { id:"productos",  label:"📦 Productos",    count: products.length },
  ];

  const PROV_EMPTY = (tipo) => ({
    id:uid(), name:"", code:"", tipo, pais:"", contacto:"",
    email:"", phone:"", web:"", notas:"",
  });

  const saveProv = p => {
    setProveedores(prev => prev.find(x=>x.id===p.id) ? prev.map(x=>x.id===p.id?p:x) : [...prev,p]);
    setEditProv(null); showToast("Guardado correctamente");
  };
  const delProv = id => { setProveedores(p=>p.filter(x=>x.id!==id)); showToast("Eliminado"); };

  const saveProd = p => {
    setProducts(prev=>{ const i=prev.findIndex(x=>x.id===p.id); if(i>=0){const n=[...prev];n[i]=p;return n;} return[p,...prev]; });
    setEditProd(null); showToast("Producto guardado");
  };
  const delProd = id => { setProducts(p=>p.filter(x=>x.id!==id)); showToast("Producto eliminado"); };

  const tipoMap = { mayoristas:"mayorista", aerolineas:"aerolinea", hoteles:"hotel" };
  const filtProv = proveedores.filter(p =>
    p.tipo === tipoMap[tab] &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.code||"").toLowerCase().includes(search.toLowerCase()))
  );
  const filtProd = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.concept.toLowerCase().includes(search.toLowerCase())
  );

  // ── FORM PROVEEDOR ──
  if(editProv) {
    const upd = (f,v) => setEditProv(p=>({...p,[f]:v}));
    const tipoLabel = editProv.tipo==="aerolinea"?"Aerolínea":editProv.tipo==="hotel"?"Hotel":"Mayorista";
    return (
      <div style={{ padding:18, maxWidth:700, margin:"0 auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <h2 style={{ margin:0, fontSize:16, fontWeight:800, color:B.dark }}>
            {editProv.name || `Nuevo ${tipoLabel}`}
          </h2>
          <div style={{ display:"flex", gap:6 }}>
            <Btn v="primary" sz="sm" onClick={()=>saveProv(editProv)}>💾 Guardar</Btn>
            <Btn v="secondary" sz="sm" onClick={()=>setEditProv(null)}>← Cancelar</Btn>
          </div>
        </div>
        <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:8, padding:20 }}>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:12, marginBottom:12 }}>
            <FI label={`Nombre del ${tipoLabel} *`} value={editProv.name} onChange={v=>upd("name",v)} placeholder={`Nombre completo...`}/>
            <FI label="Código / IATA" value={editProv.code||""} onChange={v=>upd("code",v.toUpperCase())} placeholder="BBR, AF, HG..."/>
            <FI label="País" value={editProv.pais||""} onChange={v=>upd("pais",v)} placeholder="Panama, USA..."/>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <FI label="Email de contacto" value={editProv.email||""} onChange={v=>upd("email",v)} placeholder="contacto@proveedor.com"/>
            <FI label="Teléfono" value={editProv.phone||""} onChange={v=>upd("phone",v)} placeholder="+1 800-000-0000"/>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <FI label="Persona de contacto" value={editProv.contacto||""} onChange={v=>upd("contacto",v)} placeholder="Nombre del ejecutivo de cuenta"/>
            <FI label="Sitio web" value={editProv.web||""} onChange={v=>upd("web",v)} placeholder="www.proveedor.com"/>
          </div>
          <FTA label="Notas internas" value={editProv.notas||""} onChange={v=>upd("notas",v)} rows={3}
            placeholder="Condiciones especiales, comisiones acordadas, notas del contrato..."/>
        </div>
      </div>
    );
  }

  // ── FORM PRODUCTO ──
  if(editProd) {
    const pub=(parseFloat(editProd.base)||0)+(parseFloat(editProd.iva)||0)+(parseFloat(editProd.tua)||0)+(parseFloat(editProd.others)||0);
    const neta=pub*(1-(parseFloat(editProd.csb)||0)/100);
    const upd=(f,v)=>setEditProd(p=>({...p,[f]:v}));
    return (
      <div style={{ padding:18, maxWidth:900, margin:"0 auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h2 style={{ margin:0, fontSize:16, color:B.dark, fontWeight:800 }}>{editProd.name||"Nuevo producto/servicio"}</h2>
          <div style={{ display:"flex", gap:6 }}>
            <Btn v="primary" sz="sm" onClick={()=>saveProd(editProd)}>💾 Guardar</Btn>
            <Btn v="secondary" sz="sm" onClick={()=>setEditProd(null)}>← Cancelar</Btn>
          </div>
        </div>
        <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:7, padding:16 }}>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:10, marginBottom:10 }}>
            <FI label="Nombre del producto/servicio *" value={editProd.name} onChange={v=>upd("name",v)} placeholder="Gran Evenia Bijao — Todo Incluido"/>
            <FS label="Concepto *" value={editProd.concept} onChange={v=>upd("concept",v)} options={CONCEPTS.map(c=>({value:c,label:c}))}/>
            <FS label="Proveedor *" value={editProd.wholesalerId} onChange={v=>upd("wholesalerId",v)} options={proveedores.map(w=>({value:w.id,label:w.name}))}/>
          </div>
          <FTA label="Descripción" value={editProd.description} onChange={v=>upd("description",v)} rows={5}
            placeholder="Descripción detallada del servicio..."/>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:9, marginTop:10 }}>
            <FI label="Base"   value={String(editProd.base)}   onChange={v=>upd("base",  parseFloat(v)||0)} type="number"/>
            <FI label="IVA $"  value={String(editProd.iva)}    onChange={v=>upd("iva",   parseFloat(v)||0)} type="number"/>
            <FI label="TUA"    value={String(editProd.tua)}    onChange={v=>upd("tua",   parseFloat(v)||0)} type="number"/>
            <FI label="Otros"  value={String(editProd.others)} onChange={v=>upd("others",parseFloat(v)||0)} type="number"/>
            <FI label="CSB %"  value={String(editProd.csb)}    onChange={v=>upd("csb",   parseFloat(v)||0)} type="number"/>
            <FS label="Divisa" value={editProd.currency}       onChange={v=>upd("currency",v)} options={CURRENCIES.map(c=>({value:c,label:c}))}/>
          </div>
          <div style={{ display:"flex", gap:14, marginTop:9, padding:"9px 12px", background:"#F0F4FF", borderRadius:6, fontSize:11 }}>
            <span>Precio público: <b style={{ color:B.blue, fontSize:14 }}>${fmt(pub)}</b></span>
            <span>Precio neto: <b style={{ color:B.teal }}>${fmt(neta)}</b></span>
            <span>Comisión CSB: <b style={{ color:B.gold }}>${fmt(pub-neta)} ({editProd.csb||0}%)</b></span>
          </div>
        </div>
      </div>
    );
  }

  // ── LISTA PRINCIPAL ──
  const tipoLabel = tab==="mayoristas"?"Mayorista":tab==="aerolineas"?"Aerolínea":"Hotel";
  const tipoIcon  = tab==="mayoristas"?"🏢":tab==="aerolineas"?"✈️":"🏨";

  return (
    <div style={{ padding:18, maxWidth:1100, margin:"0 auto" }}>
      {toast&&<div style={{ position:"fixed", top:55, right:16, zIndex:9999, background:B.green, color:"#fff", borderRadius:6, padding:"8px 14px", fontSize:11, fontWeight:700 }}>✅ {toast}</div>}

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:16, background:"#F1F5F9", padding:4, borderRadius:10, width:"fit-content" }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>{ setTab(t.id); setSearch(""); }}
            style={{ padding:"7px 16px", borderRadius:7, border:"none", background:tab===t.id?"#fff":"transparent", color:tab===t.id?B.dark:"#546E7A", fontWeight:tab===t.id?700:500, fontSize:12, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6, boxShadow:tab===t.id?"0 1px 4px rgba(0,0,0,.08)":"none" }}>
            {t.label}
            <span style={{ background:tab===t.id?B.blue:"#E0E0E0", color:tab===t.id?"#fff":"#546E7A", fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:10 }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Barra de búsqueda + botón nuevo */}
      <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder={`🔍 Buscar ${tab==="productos"?"producto o servicio":tipoLabel.toLowerCase()}...`}
          style={{ ...SI, flex:1, padding:"6px 11px", fontSize:11 }}/>
        {tab !== "productos" ? (
          <Btn v="teal" onClick={()=>setEditProv(PROV_EMPTY(tipoMap[tab]))}>+ Nuevo {tipoLabel}</Btn>
        ) : (
          <Btn v="teal" onClick={()=>setEditProd({ id:uid(), concept:"HOTELES NACIONALES", wholesalerId:proveedores[0]?.id||"other", name:"", description:"", base:0, iva:0, tua:0, others:0, csb:18, currency:"USD" })}>+ Nuevo producto</Btn>
        )}
      </div>

      {/* ── TABLA PROVEEDORES (mayoristas / aerolíneas / hoteles) ── */}
      {tab !== "productos" && (
        <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:8, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
            <thead>
              <tr style={{ background:B.dark, color:"#fff" }}>
                {[tipoIcon+" Nombre","Código","País","Email","Teléfono","Contacto","Web",""].map(h=>(
                  <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:9, fontWeight:700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtProv.length===0&&(
                <tr><td colSpan={8} style={{ textAlign:"center", padding:32, color:"#B0BEC5", fontSize:11 }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>{tipoIcon}</div>
                  Sin {tab}. <button onClick={()=>setEditProv(PROV_EMPTY(tipoMap[tab]))} style={{ background:"none", border:"none", color:B.blue, cursor:"pointer", fontSize:11, textDecoration:"underline", fontFamily:"inherit" }}>Agregar {tipoLabel.toLowerCase()}</button>
                </td></tr>
              )}
              {filtProv.map((p,i)=>(
                <tr key={p.id} style={{ background:i%2===0?"#fff":"#FAFAFA", borderBottom:"1px solid #F0F0F0", cursor:"pointer" }}
                  onMouseEnter={e=>e.currentTarget.style.background="#E3F2FD"}
                  onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":"#FAFAFA"}>
                  <td style={{ padding:"9px 10px", fontWeight:700, color:B.blue }} onClick={()=>setEditProv({...p})}>{p.name}</td>
                  <td style={{ padding:"9px 10px" }}>
                    {p.code&&<span style={{ background:"#EDE7F6", color:"#512DA8", padding:"2px 7px", borderRadius:4, fontSize:10, fontWeight:700 }}>{p.code}</span>}
                  </td>
                  <td style={{ padding:"9px 10px", color:"#546E7A" }}>{p.pais||"—"}</td>
                  <td style={{ padding:"9px 10px", color:"#546E7A", fontSize:10 }}>{p.email||"—"}</td>
                  <td style={{ padding:"9px 10px", color:"#546E7A" }}>{p.phone||"—"}</td>
                  <td style={{ padding:"9px 10px", color:"#546E7A" }}>{p.contacto||"—"}</td>
                  <td style={{ padding:"9px 10px" }}>
                    {p.web ? <a href={`https://${p.web.replace(/^https?:\/\//,"")}`} target="_blank" rel="noopener noreferrer" style={{ color:B.blue, fontSize:10, textDecoration:"none" }}>{p.web}</a> : "—"}
                  </td>
                  <td style={{ padding:"9px 10px", textAlign:"center" }}>
                    <button onClick={()=>setEditProv({...p})} style={{ background:B.blue, border:"none", color:"#fff", borderRadius:4, padding:"3px 8px", cursor:"pointer", fontSize:10, marginRight:4 }}>✏️</button>
                    <button onClick={()=>delProv(p.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#B0BEC5", fontSize:14 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── GRID PRODUCTOS ── */}
      {tab === "productos" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:12 }}>
          {filtProd.map(p=>{
            const pub=(parseFloat(p.base)||0)+(parseFloat(p.iva)||0)+(parseFloat(p.tua)||0)+(parseFloat(p.others)||0);
            const neta=pub*(1-(parseFloat(p.csb)||0)/100);
            const wh=proveedores.find(w=>w.id===p.wholesalerId)||{name:"Otro"};
            return (
              <div key={p.id} style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:8, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
                <div style={{ background:B.dark, color:"#fff", padding:"8px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:9, fontWeight:700, letterSpacing:.6, textTransform:"uppercase", opacity:.8 }}>{p.concept}</span>
                  <div style={{ display:"flex", gap:5 }}>
                    <button onClick={()=>setEditProd({...p})} style={{ background:"rgba(255,255,255,.2)", border:"none", borderRadius:3, padding:"2px 7px", cursor:"pointer", color:"#fff", fontSize:9, fontFamily:"inherit" }}>✏️ Editar</button>
                    <button onClick={()=>delProd(p.id)} style={{ background:"rgba(198,40,40,.4)", border:"none", borderRadius:3, padding:"2px 7px", cursor:"pointer", color:"#fff", fontSize:9, fontFamily:"inherit" }}>✕</button>
                  </div>
                </div>
                <div style={{ padding:"11px 13px" }}>
                  <div style={{ fontWeight:700, fontSize:12, color:"#263238", marginBottom:4 }}>{p.name}</div>
                  <div style={{ fontSize:9, color:"#546E7A", marginBottom:6 }}>{wh.name} · {p.currency}</div>
                  <div style={{ fontSize:9, color:"#90A4AE", whiteSpace:"pre-line", marginBottom:8, lineHeight:1.5 }}>
                    {p.description.slice(0,120)}{p.description.length>120?"…":""}
                  </div>
                  <div style={{ display:"flex", gap:10, paddingTop:8, borderTop:"1px solid #F0F0F0" }}>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:8, color:"#546E7A" }}>PÚBLICA</div>
                      <div style={{ fontSize:14, fontWeight:900, color:B.blue }}>${fmt(pub)}</div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:8, color:"#546E7A" }}>NETA</div>
                      <div style={{ fontSize:13, fontWeight:700, color:B.teal }}>${fmt(neta)}</div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:8, color:"#546E7A" }}>CSB</div>
                      <div style={{ fontSize:13, fontWeight:700, color:B.gold }}>{p.csb}%</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filtProd.length===0&&(
            <div style={{ gridColumn:"1/-1", textAlign:"center", padding:40, color:"#B0BEC5", fontSize:11 }}>
              <div style={{ fontSize:32, marginBottom:8 }}>📦</div>
              Sin productos.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SEED DATA ────────────────────────────────────────────────────────────────
const SEED_CLIENTS = [
  { id:"cl1", created:"2026-05-11", cat:"GENERAL", status:"activo", advisorId:"1", firstName:"Georgina",  lastNameP:"Olivardia", lastNameM:"",            birthdate:"", alta:"2026-05-11", mobile:"+507 6423-4415", phone:"", email:"georginaolivardia46@gmail.com", email2:"", address:"", city:"", country:"Panama", nationality:"Panama - PA", notes:"", docs:[] },
  { id:"cl2", created:"2026-05-15", cat:"GENERAL", status:"activo", advisorId:"4", firstName:"Maritza",   lastNameP:"De Jesus",  lastNameM:"Ortega Serrano",birthdate:"", alta:"2026-05-15", mobile:"+507 6555-1234", phone:"", email:"maritza@email.com",               email2:"", address:"", city:"", country:"Panama", nationality:"Panama - PA", notes:"", docs:[] },
  { id:"cl3", created:"2026-05-18", cat:"VIP",     status:"activo", advisorId:"3", firstName:"Héctor",    lastNameP:"Rentería",  lastNameM:"",            birthdate:"", alta:"2026-05-18", mobile:"+507 6333-5678", phone:"", email:"hector@email.com",                email2:"", address:"", city:"", country:"Panama", nationality:"Panama - PA", notes:"", docs:[] },
];

const SEED_EXP = [
  { id:"e1", no:6986, ventaNo:6616, created:"2026-05-18", status:"cerrado", advisorId:"1", medium:"WHATSAPP", clientId:"cl1", clientName:"Rubiela Yaneth González Cubilla",
    trip:{ title:"Gran Evenia Bijao", destination:"GRAN EVENIA BIJAO", dateFrom:"2026-05-06", dateTo:"2026-07-06", paxAdult:2, paxChild:0, category:"RESORTS" },
    contract:null,
    alarms:[
      { id:"a1", type:"trip_start",   date:"2026-05-06", note:"Inicio de viaje Gran Evenia Bijao",              status:"done",    source:"auto", createdAt:"2026-05-11" },
      { id:"a2", type:"pay_supplier", date:"2026-05-01", note:"Pagar a Bijao Beach Resort",                     status:"done",    source:"auto", createdAt:"2026-05-11" },
      { id:"a3", type:"post_trip",    date:"2026-07-09", note:"Post-viaje: llamar al cliente 3 días después",   status:"pending", source:"auto", createdAt:"2026-05-11" },
    ],
    items:[{ id:"it1", concept:"HOTELES NACIONALES", wholesalerId:"bbr", dateFrom:"2026-05-06", dateTo:"2026-07-06", boleto:"", reserva:"X8L3KQ",
      description:"Localizador: X8L3KQ\nCliente: Aristides Amaya & Georgina Olivadia\nTU RESERVA\nAlojamiento: Gran Evenia Bijao\nDel 05/06/2026 al 07/06/2026\n2 Adultos + 0 Niños\nPlan todo incluido.\nFecha límite de pago: 21 de mayo de 2026.",
      base:399.38, iva:0, tua:0, others:0, csb:18, currency:"USD", docs:[] }],
    payments:[{ id:"p1", date:"2026-05-11", agentId:"1", account:"BG corriente 69-1", method:"Transferencia", reference:"1290252009", amount:40, confirmed:true, receipt:"18379", note:"" }],
    majorPayments:[{ id:"mp1", date:"2026-05-11", agentId:"1", account:"HOTELLANDIA S DE LA R 72-0", method:"TPV/Tarjeta Credito", reference:"", amount:32.75, confirmed:true, receipt:"597856", note:"" }],
    notes:"" },
  { id:"e2", no:6984, ventaNo:6614, created:"2026-05-18", status:"saldo", advisorId:"3", medium:"WHATSAPP", clientId:"cl3", clientName:"Anadira Valderrama",
    trip:{ title:"", destination:"", dateFrom:"", dateTo:"", paxAdult:1, paxChild:0, category:"" },
    contract:null, alarms:[{ id:"a4", type:"pay_client", date:"2026-05-25", note:"Recordar pago pendiente", status:"pending", source:"manual", createdAt:"2026-05-18" }],
    items:[{ id:"it2", concept:"VUELOS INTERNACIONALES", wholesalerId:"copa", dateFrom:"2026-06-01", dateTo:"2026-06-15", boleto:"", reserva:"", description:"Vuelo Copa Airlines", base:193.04, iva:0, tua:0, others:0, csb:16, currency:"USD", docs:[] }],
    payments:[], majorPayments:[], notes:"" },
  { id:"e3", no:6983, ventaNo:6613, created:"2026-05-17", status:"pagado", advisorId:"1", medium:"WHATSAPP", clientId:"", clientName:"Melissa Haylen Martínez Fonseca",
    trip:{ title:"", destination:"Cancún", dateFrom:"2026-07-10", dateTo:"2026-07-17", paxAdult:2, paxChild:2, category:"RESORTS" },
    contract:null,
    alarms:[
      { id:"a5", type:"pre_trip",   date:"2026-07-08", note:"Pre-viaje: contactar 48h antes de salida", status:"pending", source:"auto", createdAt:"2026-05-17" },
      { id:"a6", type:"trip_start", date:"2026-07-10", note:"Inicio de viaje Cancún",                   status:"pending", source:"auto", createdAt:"2026-05-17" },
      { id:"a7", type:"trip_end",   date:"2026-07-17", note:"Fin de viaje / Regreso",                   status:"pending", source:"auto", createdAt:"2026-05-17" },
      { id:"a8", type:"post_trip",  date:"2026-07-20", note:"Post-viaje: llamar al cliente",            status:"pending", source:"auto", createdAt:"2026-05-17" },
    ],
    items:[{ id:"it3", concept:"PAQUETES TURISTICOS", wholesalerId:"hyatt", dateFrom:"2026-07-10", dateTo:"2026-07-17", boleto:"", reserva:"", description:"Hyatt Ziva Cancún 7 noches AI", base:1644.84, iva:0, tua:0, others:604.16, csb:26, currency:"USD", docs:[] }],
    payments:[{ id:"p3", date:"2026-05-17", agentId:"1", account:"BG corriente 69-1", method:"Transferencia", reference:"TRF-009", amount:2249, confirmed:true, receipt:"18500", note:"" }],
    majorPayments:[], notes:"" },
  { id:"e4", no:6982, ventaNo:6612, created:"2026-05-15", status:"saldo", advisorId:"4", medium:"INSTAGRAM", clientId:"cl2", clientName:"Maritza De Jesús Ortega Serrano",
    trip:{ title:"", destination:"Europa", dateFrom:"2027-01-16", dateTo:"2027-01-30", paxAdult:2, paxChild:0, category:"" },
    contract:null, alarms:[],
    items:[{ id:"it4", concept:"PAQUETES TURISTICOS", wholesalerId:"airfrance", dateFrom:"2027-01-16", dateTo:"2027-01-30", boleto:"", reserva:"", description:"Euro Trip 14 noches 5 ciudades", base:2600, iva:0, tua:0, others:504, csb:18, currency:"USD", docs:[] }],
    payments:[], majorPayments:[], notes:"" },
  { id:"e5", no:6979, ventaNo:6609, created:"2026-05-15", status:"cerrado", advisorId:"3", medium:"WHATSAPP", clientId:"cl3", clientName:"Héctor Rentería",
    trip:{ title:"", destination:"Punta Cana", dateFrom:"2026-08-01", dateTo:"2026-08-07", paxAdult:2, paxChild:0, category:"RESORTS" },
    contract:null, alarms:[],
    items:[{ id:"it5", concept:"HOTELES INTERNACIONALES", wholesalerId:"marriott", dateFrom:"2026-08-01", dateTo:"2026-08-07", boleto:"", reserva:"", description:"Marriott Punta Cana 7 noches AI", base:112.33, iva:0, tua:0, others:22.47, csb:20, currency:"USD", docs:[] }],
    payments:[{ id:"p5", date:"2026-05-15", agentId:"3", account:"BG corriente 69-1", method:"Transferencia", reference:"", amount:164, confirmed:true, receipt:"18450", note:"" }],
    majorPayments:[], notes:"" },
  { id:"e6", no:6975, ventaNo:6605, created:"2026-05-13", status:"saldo", advisorId:"3", medium:"WHATSAPP", clientId:"", clientName:"Elizabeth Duarte",
    trip:{ title:"", destination:"", dateFrom:"", dateTo:"", paxAdult:1, paxChild:0, category:"" },
    contract:null, alarms:[],
    items:[{ id:"it6", concept:"VUELOS INTERNACIONALES", wholesalerId:"copa", dateFrom:"", dateTo:"", boleto:"", reserva:"", description:"Vuelo internacional Copa", base:325.04, iva:0, tua:0, others:62.96, csb:16, currency:"USD", docs:[] }],
    payments:[], majorPayments:[], notes:"" },
];

const SEED_GROUPS = [
  { id:"g1", no:17, created:"2026-04-21", name:"Mercadillos Navideños 14 diciembre 2026", campaign:"META", status:"nuevo", currency:"USD",
    dateFrom:"2026-12-14", dateTo:"2026-12-23", nights:9, rooms:20, paxs:20, wholesalerId:"marriott", advisorId:"1",
    expedientes:["e4","e5"], roomingList:[
      { id:"rr1", expNo:"6963", clientName:"Ana Marie Atencio Castillo", roomType:"Doble", roomNo:"101", paxAdult:2, paxChild:0, checkIn:"2026-12-14", checkOut:"2026-12-23", nights:9, publica:1185, saldo:2619, comision:0, notes:"" },
      { id:"rr2", expNo:"6969", clientName:"Carlos Efrain Chong Pinto",  roomType:"Doble", roomNo:"102", paxAdult:2, paxChild:0, checkIn:"2026-12-14", checkOut:"2026-12-23", nights:9, publica:1849.60, saldo:2959, comision:369.92, notes:"" },
    ], notes:"", masterItems:[], masterPayments:[] },
  { id:"g2", no:18, created:"2026-04-22", name:"Europa Primavera 2026", campaign:"META", status:"nuevo", currency:"USD",
    dateFrom:"2026-04-22", dateTo:"2026-04-29", nights:7, rooms:10, paxs:20, wholesalerId:"airfrance", advisorId:"1",
    expedientes:[], roomingList:[], notes:"", masterItems:[], masterPayments:[] },
  { id:"g3", no:16, created:"2026-03-10", name:"Alemania Bella Julio 2026", campaign:"FAMILIA", status:"activo", currency:"USD",
    dateFrom:"2026-07-22", dateTo:"2026-07-26", nights:4, rooms:10, paxs:20, wholesalerId:"airfrance", advisorId:"3",
    expedientes:[], roomingList:[], notes:"", masterItems:[], masterPayments:[] },
];

// ─── COTIZACION MODULE ────────────────────────────────────────────────────────
function CotizacionModule({ exp, onUpdate }) {
  const [cotizaciones, setCotizaciones] = useState(exp.cotizaciones || []);
  const [editing,  setEditing]  = useState(null);
  const [preview,  setPreview]  = useState(null);
  const [toast,    setToast]    = useState("");

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(""),2500); };

  const mkCot = () => ({
    id: uid(),
    created: today(),
    no: Math.floor(10000 + Math.random()*90000),
    status: "borrador", // borrador, enviada, aceptada, rechazada
    title: "",
    validDays: 7,
    currency: "USD",
    notes: "",
    incluye: [],
    noIncluye: ["Vuelos internacionales", "Gastos personales", "Propinas"],
    items: exp.items.map(it => ({
      id: it.id,
      concept: it.concept,
      description: it.description,
      base: (parseFloat(it.base)||0)+(parseFloat(it.iva)||0)+(parseFloat(it.tua)||0)+(parseFloat(it.others)||0),
      qty: 1,
      unit: "por persona",
    })),
    paxAdult: exp.trip?.paxAdult || 2,
    destination: exp.trip?.destination || "",
    dateFrom: exp.trip?.dateFrom || "",
    dateTo: exp.trip?.dateTo || "",
  });

  const saveCot = cot => {
    const updated = cotizaciones.find(c=>c.id===cot.id)
      ? cotizaciones.map(c=>c.id===cot.id?cot:c)
      : [...cotizaciones, cot];
    setCotizaciones(updated);
    onUpdate({ ...exp, cotizaciones: updated });
    setEditing(null);
    showToast("Cotización guardada");
  };

  const deleteCot = id => {
    const updated = cotizaciones.filter(c=>c.id!==id);
    setCotizaciones(updated);
    onUpdate({ ...exp, cotizaciones: updated });
    showToast("Cotización eliminada");
  };

  const STATUS = {
    borrador:  { label:"Borrador",  c:"#546E7A", bg:"#ECEFF1" },
    enviada:   { label:"Enviada",   c:"#1565C0", bg:"#E3F2FD" },
    aceptada:  { label:"Aceptada",  c:"#2E7D32", bg:"#E8F5E9" },
    rechazada: { label:"Rechazada", c:"#C62828", bg:"#FFEBEE" },
  };

  // PDF Generator
  const generatePDF = (cot) => {
    const adv = ADVISORS.find(a=>a.id===exp.advisorId)||ADVISORS[0];
    const total = cot.items.reduce((s,it)=>s+(parseFloat(it.base)||0)*(parseFloat(it.qty)||1),0);
    const totalPP = total / (cot.paxAdult||1);

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; color: #1a1a1a; font-size: 12px; }
  .page { max-width: 800px; margin: 0 auto; padding: 0; }

  /* HEADER */
  .header { background: #0D47A1; color: white; padding: 28px 36px; display: flex; justify-content: space-between; align-items: center; }
  .header-logo { font-size: 26px; font-weight: 900; letter-spacing: -0.5px; }
  .header-logo span { color: #F59E0B; }
  .header-info { text-align: right; font-size: 11px; opacity: 0.85; line-height: 1.8; }
  .header-ref { background: rgba(255,255,255,0.15); padding: 6px 14px; border-radius: 6px; font-size: 11px; margin-top: 8px; display: inline-block; }

  /* HERO BAND */
  .hero-band { background: #1565C0; color: white; padding: 20px 36px; display: flex; justify-content: space-between; align-items: center; }
  .hero-title { font-size: 18px; font-weight: 700; }
  .hero-sub { font-size: 11px; opacity: 0.8; margin-top: 3px; }
  .hero-price { text-align: right; }
  .hero-price .price-label { font-size: 10px; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px; }
  .hero-price .price-val { font-size: 28px; font-weight: 900; color: #F59E0B; }
  .hero-price .price-sub { font-size: 10px; opacity: 0.8; }

  /* BODY */
  .body { padding: 28px 36px; }

  /* CLIENT INFO */
  .client-box { background: #F8FAFF; border: 1px solid #DBEAFE; border-radius: 8px; padding: 16px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .info-row { display: flex; gap: 6px; align-items: baseline; }
  .info-label { font-size: 9px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; min-width: 70px; }
  .info-val { font-size: 12px; font-weight: 600; color: #0F172A; }

  /* SECTION TITLE */
  .section-title { font-size: 11px; font-weight: 700; color: #1565C0; text-transform: uppercase; letter-spacing: 1px; margin: 20px 0 10px; padding-bottom: 5px; border-bottom: 2px solid #DBEAFE; }

  /* ITEMS TABLE */
  .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  .items-table th { background: #0D47A1; color: white; padding: 8px 12px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .items-table td { padding: 10px 12px; border-bottom: 1px solid #F1F5F9; font-size: 11px; vertical-align: top; }
  .items-table tr:nth-child(even) td { background: #F8FAFF; }
  .items-table .td-right { text-align: right; white-space: nowrap; }
  .items-table .td-bold { font-weight: 700; color: #1565C0; }
  .item-desc { font-size: 10px; color: #64748B; margin-top: 3px; line-height: 1.4; }

  /* TOTALS */
  .totals-box { background: #0D47A1; color: white; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
  .totals-item { text-align: center; }
  .totals-item .t-label { font-size: 9px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .totals-item .t-val { font-size: 20px; font-weight: 900; }
  .totals-item .t-sub { font-size: 9px; opacity: 0.7; }
  .totals-divider { width: 1px; background: rgba(255,255,255,0.2); height: 40px; }

  /* INCLUDES */
  .includes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .includes-box { border-radius: 8px; padding: 14px; }
  .includes-box.green { background: #F0FDF4; border: 1px solid #BBF7D0; }
  .includes-box.red   { background: #FEF2F2; border: 1px solid #FECACA; }
  .includes-box h4 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .includes-box.green h4 { color: #15803D; }
  .includes-box.red   h4 { color: #DC2626; }
  .includes-box ul { list-style: none; }
  .includes-box ul li { font-size: 10px; padding: 3px 0; display: flex; gap: 6px; align-items: flex-start; }
  .includes-box.green ul li::before { content: "✓"; color: #15803D; font-weight: 700; flex-shrink: 0; }
  .includes-box.red   ul li::before { content: "✗"; color: #DC2626; font-weight: 700; flex-shrink: 0; }

  /* NOTES */
  .notes-box { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 14px; margin-bottom: 20px; font-size: 11px; line-height: 1.6; color: #78350F; }

  /* VALIDITY */
  .validity-box { text-align: center; font-size: 10px; color: #64748B; margin-bottom: 20px; padding: 10px; background: #F8FAFF; border-radius: 6px; }

  /* FOOTER */
  .footer { background: #0D47A1; color: white; padding: 16px 36px; display: flex; justify-content: space-between; align-items: center; }
  .footer-logo { font-size: 14px; font-weight: 900; }
  .footer-logo span { color: #F59E0B; }
  .footer-info { font-size: 9px; opacity: 0.7; text-align: center; }
  .footer-agent { font-size: 10px; text-align: right; opacity: 0.85; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div>
      <div class="header-logo"><span>Vía</span>Suite</div>
      <div style="font-size:10px;opacity:0.7;margin-top:4px;">Sistema de Gestión para Agencias de Viajes</div>
    </div>
    <div class="header-info">
      <div><strong>COTIZACIÓN DE VIAJE</strong></div>
      <div>Ref: ${cot.no}</div>
      <div>Fecha: ${cot.created}</div>
      <div class="header-ref">Válida por ${cot.validDays} días</div>
    </div>
  </div>

  <!-- HERO -->
  <div class="hero-band">
    <div>
      <div class="hero-title">${cot.title || cot.destination || "Cotización de Viaje"}</div>
      <div class="hero-sub">${cot.destination}${cot.dateFrom?" · "+cot.dateFrom+" al "+cot.dateTo:""} · ${cot.paxAdult} pasajero${cot.paxAdult!==1?"s":""}</div>
    </div>
    <div class="hero-price">
      <div class="price-label">Precio por persona</div>
      <div class="price-val">${cot.currency} $${fmt(totalPP)}</div>
      <div class="price-sub">Total ${cot.paxAdult} pax: $${fmt(total)}</div>
    </div>
  </div>

  <!-- BODY -->
  <div class="body">

    <!-- CLIENT -->
    <div class="client-box">
      <div class="info-row"><span class="info-label">Cliente:</span><span class="info-val">${exp.clientName||"—"}</span></div>
      <div class="info-row"><span class="info-label">Destino:</span><span class="info-val">${cot.destination||"—"}</span></div>
      <div class="info-row"><span class="info-label">Check-in:</span><span class="info-val">${cot.dateFrom||"—"}</span></div>
      <div class="info-row"><span class="info-label">Check-out:</span><span class="info-val">${cot.dateTo||"—"}</span></div>
      <div class="info-row"><span class="info-label">Pasajeros:</span><span class="info-val">${cot.paxAdult} adulto${cot.paxAdult!==1?"s":""}</span></div>
      <div class="info-row"><span class="info-label">No. Exp.:</span><span class="info-val">${exp.no}</span></div>
    </div>

    <!-- ITEMS -->
    <div class="section-title">Detalle de servicios</div>
    <table class="items-table">
      <thead>
        <tr><th>Servicio</th><th>Cant.</th><th class="td-right">Precio</th><th class="td-right">Total</th></tr>
      </thead>
      <tbody>
        ${cot.items.map(it => `
          <tr>
            <td>
              <div style="font-weight:600">${it.concept}</div>
              ${it.description ? `<div class="item-desc">${it.description.slice(0,120)}${it.description.length>120?"...":""}</div>` : ""}
            </td>
            <td>${it.qty||1} ${it.unit||"ud."}</td>
            <td class="td-right">$${fmt(it.base)}</td>
            <td class="td-right td-bold">$${fmt((parseFloat(it.base)||0)*(parseFloat(it.qty)||1))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <!-- TOTALS -->
    <div class="totals-box">
      <div class="totals-item">
        <div class="t-label">Total general</div>
        <div class="t-val">${cot.currency} $${fmt(total)}</div>
        <div class="t-sub">${cot.paxAdult} pasajero${cot.paxAdult!==1?"s":""}</div>
      </div>
      <div class="totals-divider"></div>
      <div class="totals-item">
        <div class="t-label">Por persona</div>
        <div class="t-val" style="color:#F59E0B">$${fmt(totalPP)}</div>
        <div class="t-sub">${cot.currency}</div>
      </div>
      <div class="totals-divider"></div>
      <div class="totals-item">
        <div class="t-label">Servicios</div>
        <div class="t-val">${cot.items.length}</div>
        <div class="t-sub">incluidos</div>
      </div>
    </div>

    <!-- INCLUDES -->
    ${(cot.incluye.length > 0 || cot.noIncluye.length > 0) ? `
    <div class="section-title">¿Qué incluye tu paquete?</div>
    <div class="includes-grid">
      <div class="includes-box green">
        <h4>✓ Incluye</h4>
        <ul>${cot.incluye.map(i=>`<li>${i}</li>`).join("")}</ul>
      </div>
      <div class="includes-box red">
        <h4>✗ No incluye</h4>
        <ul>${cot.noIncluye.map(i=>`<li>${i}</li>`).join("")}</ul>
      </div>
    </div>` : ""}

    <!-- NOTES -->
    ${cot.notes ? `
    <div class="section-title">Notas importantes</div>
    <div class="notes-box">${cot.notes}</div>` : ""}

    <!-- VALIDITY -->
    <div class="validity-box">
      ⚠️ Esta cotización es válida por <strong>${cot.validDays} días</strong> a partir del ${cot.created}.
      Los precios están sujetos a disponibilidad al momento del pago.
    </div>

  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-logo"><span>Vía</span>Suite</div>
    <div class="footer-info">
      viasuite.app · El sistema de gestión para agencias de viajes
    </div>
    <div class="footer-agent">
      <div><strong>${adv.name}</strong></div>
      <div>WhatsApp: ${adv.wp}</div>
    </div>
  </div>

</div>
</body>
</html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  // Editor
  if (editing) {
    const cot = editing;
    const upd = (f,v) => setEditing(p=>({...p,[f]:v}));
    const total = cot.items.reduce((s,it)=>s+(parseFloat(it.base)||0)*(parseFloat(it.qty)||1),0);
    const totalPP = cot.paxAdult > 0 ? total/cot.paxAdult : total;

    const addIncluye    = () => upd("incluye",    [...cot.incluye, ""]);
    const addNoIncluye  = () => upd("noIncluye",  [...cot.noIncluye, ""]);
    const updIncluye    = (i,v) => { const a=[...cot.incluye];    a[i]=v; upd("incluye",a); };
    const updNoIncluye  = (i,v) => { const a=[...cot.noIncluye];  a[i]=v; upd("noIncluye",a); };
    const remIncluye    = i => upd("incluye",    cot.incluye.filter((_,x)=>x!==i));
    const remNoIncluye  = i => upd("noIncluye",  cot.noIncluye.filter((_,x)=>x!==i));

    return (
      <div style={{padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
          <div style={{fontSize:13,fontWeight:800,color:B.dark}}>
            Cotización #{cot.no}
          </div>
          <div style={{display:"flex",gap:6}}>
            <Btn v="teal" sz="sm" onClick={()=>generatePDF(cot)}>Previsualizar PDF</Btn>
            <Btn v="primary" sz="sm" onClick={()=>saveCot(cot)}>Guardar</Btn>
            <Btn v="secondary" sz="sm" onClick={()=>setEditing(null)}>Cancelar</Btn>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          {/* Left col */}
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:"#fff",border:"1px solid #E0E0E0",borderRadius:8,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,color:B.dark,marginBottom:10}}>Información general</div>
              <div style={{display:"flex",flexDirection:"column",gap:9}}>
                <FI label="Título de la cotización" value={cot.title} onChange={v=>upd("title",v)} placeholder="Ej: Paquete Cancún 7 noches"/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                  <FI label="Destino"       value={cot.destination} onChange={v=>upd("destination",v)}/>
                  <FI label="Pasajeros"     value={String(cot.paxAdult)} onChange={v=>upd("paxAdult",parseInt(v)||1)} type="number" sm/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                  <FI label="Fecha desde"   value={cot.dateFrom} onChange={v=>upd("dateFrom",v)} type="date"/>
                  <FI label="Fecha hasta"   value={cot.dateTo}   onChange={v=>upd("dateTo",v)}   type="date"/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                  <FI label="Válida (días)" value={String(cot.validDays)} onChange={v=>upd("validDays",parseInt(v)||7)} type="number" sm/>
                  <FS label="Divisa"        value={cot.currency} onChange={v=>upd("currency",v)} options={CURRENCIES.map(c=>({value:c,label:c}))} sm/>
                </div>
              </div>
            </div>

            {/* Totals summary */}
            <div style={{background:B.dark,borderRadius:8,padding:14,color:"#fff"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,textAlign:"center"}}>
                {[
                  {label:"Total general",  val:`$${fmt(total)}`},
                  {label:"Por persona",    val:`$${fmt(totalPP)}`, gold:true},
                  {label:"Servicios",      val:String(cot.items.length)},
                ].map(s=>(
                  <div key={s.label}>
                    <div style={{fontSize:8,opacity:.7,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>{s.label}</div>
                    <div style={{fontSize:18,fontWeight:900,color:s.gold?"#F59E0B":"#fff"}}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div style={{background:"#fff",border:"1px solid #E0E0E0",borderRadius:8,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,color:B.dark,marginBottom:8}}>Notas importantes</div>
              <FTA value={cot.notes} onChange={v=>upd("notes",v)} rows={3} placeholder="Los precios se garantizan solo al momento del pago..."/>
            </div>

            {/* Incluye / No incluye */}
            <div style={{background:"#fff",border:"1px solid #E0E0E0",borderRadius:8,padding:14}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:B.green,marginBottom:8}}>Incluye</div>
                  {cot.incluye.map((item,i)=>(
                    <div key={i} style={{display:"flex",gap:5,marginBottom:5}}>
                      <input value={item} onChange={e=>updIncluye(i,e.target.value)}
                        style={{...SI,flex:1,padding:"4px 7px",fontSize:10}}/>
                      <button onClick={()=>remIncluye(i)} style={{background:"#FFEBEE",border:"none",borderRadius:3,padding:"2px 6px",cursor:"pointer",color:B.red,fontSize:9}}>✕</button>
                    </div>
                  ))}
                  <Btn v="ghost" sz="sm" onClick={addIncluye}>+ Agregar</Btn>
                </div>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:B.red,marginBottom:8}}>No incluye</div>
                  {cot.noIncluye.map((item,i)=>(
                    <div key={i} style={{display:"flex",gap:5,marginBottom:5}}>
                      <input value={item} onChange={e=>updNoIncluye(i,e.target.value)}
                        style={{...SI,flex:1,padding:"4px 7px",fontSize:10}}/>
                      <button onClick={()=>remNoIncluye(i)} style={{background:"#FFEBEE",border:"none",borderRadius:3,padding:"2px 6px",cursor:"pointer",color:B.red,fontSize:9}}>✕</button>
                    </div>
                  ))}
                  <Btn v="ghost" sz="sm" onClick={addNoIncluye}>+ Agregar</Btn>
                </div>
              </div>
            </div>
          </div>

          {/* Right col - items */}
          <div>
            <div style={{background:"#fff",border:"1px solid #E0E0E0",borderRadius:8,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,color:B.dark,marginBottom:10}}>Servicios incluidos en la cotización</div>
              {cot.items.map((it,i)=>(
                <div key={it.id} style={{background:"#F8F9FA",borderRadius:6,padding:10,marginBottom:8,border:"1px solid #E0E0E0"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:10,fontWeight:700,color:B.blue}}>{it.concept}</span>
                    <button onClick={()=>upd("items",cot.items.filter((_,x)=>x!==i))}
                      style={{background:"#FFEBEE",border:"none",borderRadius:3,padding:"2px 6px",cursor:"pointer",color:B.red,fontSize:9}}>✕</button>
                  </div>
                  <input value={it.description} onChange={e=>{const a=[...cot.items];a[i]={...a[i],description:e.target.value};upd("items",a);}}
                    placeholder="Descripción del servicio..." style={{...SI,width:"100%",padding:"4px 7px",fontSize:10,marginBottom:5}}/>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                    <div>
                      <div style={{fontSize:8,color:"#546E7A",marginBottom:2}}>PRECIO</div>
                      <input type="number" value={it.base} onChange={e=>{const a=[...cot.items];a[i]={...a[i],base:parseFloat(e.target.value)||0};upd("items",a);}}
                        style={{...SI,width:"100%",padding:"4px 7px",fontSize:10,fontWeight:700}}/>
                    </div>
                    <div>
                      <div style={{fontSize:8,color:"#546E7A",marginBottom:2}}>CANT.</div>
                      <input type="number" value={it.qty} onChange={e=>{const a=[...cot.items];a[i]={...a[i],qty:parseFloat(e.target.value)||1};upd("items",a);}}
                        style={{...SI,width:"100%",padding:"4px 7px",fontSize:10}}/>
                    </div>
                    <div>
                      <div style={{fontSize:8,color:"#546E7A",marginBottom:2}}>TOTAL</div>
                      <div style={{padding:"4px 7px",fontSize:10,fontWeight:800,color:B.blue}}>${fmt((it.base||0)*(it.qty||1))}</div>
                    </div>
                  </div>
                </div>
              ))}
              <Btn v="ghost" sz="sm" onClick={()=>upd("items",[...cot.items,{id:uid(),concept:"Servicio",description:"",base:0,qty:1,unit:"ud."}])}>
                + Agregar servicio
              </Btn>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div style={{padding:16}}>
      {toast&&<div style={{position:"fixed",top:55,right:16,zIndex:9999,background:B.green,color:"#fff",borderRadius:6,padding:"8px 14px",fontSize:11,fontWeight:700}}>✓ {toast}</div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:12,color:"#546E7A"}}>{cotizaciones.length} cotización{cotizaciones.length!==1?"es":""} para este expediente</div>
        <Btn v="primary" sz="sm" onClick={()=>setEditing(mkCot())}>+ Nueva cotización</Btn>
      </div>

      {cotizaciones.length===0 && (
        <div style={{textAlign:"center",padding:40,color:"#B0BEC5"}}>
          <div style={{fontSize:36,marginBottom:12}}>📋</div>
          <div style={{fontSize:13,marginBottom:16}}>Sin cotizaciones aún.<br/>Crea una para enviar al cliente.</div>
          <Btn v="primary" onClick={()=>setEditing(mkCot())}>Crear primera cotización</Btn>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {cotizaciones.map(cot=>{
          const st=STATUS[cot.status]||STATUS.borrador;
          const total=cot.items.reduce((s,it)=>s+(parseFloat(it.base)||0)*(parseFloat(it.qty)||1),0);
          const totalPP=cot.paxAdult>0?total/cot.paxAdult:total;
          return (
            <div key={cot.id} style={{background:"#fff",border:"1px solid #E0E0E0",borderRadius:8,overflow:"hidden"}}>
              <div style={{background:B.dark,color:"#fff",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:800}}>{cot.title||cot.destination||"Cotización de viaje"}</div>
                  <div style={{fontSize:10,opacity:.7}}>#{cot.no} · {cot.created} · {cot.paxAdult} pax · válida {cot.validDays} días</div>
                </div>
                <span style={{background:st.bg,color:st.c,padding:"3px 10px",borderRadius:8,fontSize:9,fontWeight:800}}>{st.label}</span>
              </div>
              <div style={{padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
                <div style={{display:"flex",gap:16}}>
                  <div>
                    <div style={{fontSize:8,color:"#546E7A"}}>TOTAL</div>
                    <div style={{fontSize:16,fontWeight:900,color:B.blue}}>${fmt(total)}</div>
                  </div>
                  <div>
                    <div style={{fontSize:8,color:"#546E7A"}}>POR PERSONA</div>
                    <div style={{fontSize:16,fontWeight:900,color:B.gold}}>${fmt(totalPP)}</div>
                  </div>
                  <div>
                    <div style={{fontSize:8,color:"#546E7A"}}>SERVICIOS</div>
                    <div style={{fontSize:16,fontWeight:900}}>{cot.items.length}</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <select value={cot.status} onChange={e=>saveCot({...cot,status:e.target.value})}
                    style={{...SI,padding:"5px 8px",fontSize:10,width:110}}>
                    {Object.entries(STATUS).map(([k,s])=><option key={k} value={k}>{s.label}</option>)}
                  </select>
                  <Btn v="teal" sz="sm" onClick={()=>generatePDF(cot)}>PDF</Btn>
                  <Btn v="secondary" sz="sm" onClick={()=>setEditing({...cot})}>Editar</Btn>
                  <Btn v="ghost" sz="sm" onClick={()=>setEditing({...mkCot(),title:cot.title+" (copia)",items:[...cot.items]})}>Duplicar</Btn>
                  <button onClick={()=>deleteCot(cot.id)} style={{background:"#FFEBEE",border:"none",borderRadius:5,padding:"5px 9px",cursor:"pointer",color:B.red,fontSize:10}}>✕</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {preview && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:10,width:"min(900px,96vw)",maxHeight:"90vh",overflow:"auto"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #E0E0E0",display:"flex",justifyContent:"space-between"}}>
              <div style={{fontWeight:700}}>Preview PDF</div>
              <button onClick={()=>setPreview(null)} style={{border:"none",background:"#ECEFF1",borderRadius:4,padding:"4px 10px",cursor:"pointer"}}>✕</button>
            </div>
            <div style={{padding:16}} dangerouslySetInnerHTML={{__html:preview}}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GASTOS MODULE ────────────────────────────────────────────────────────────
function GastosModule() {
  const TIPOS = ["Gasto Fijo","Gasto Variable","Servicios","Gasto Operación","Impuestos","Otros"];

  // Proveedores
  const PROV_EMPTY = () => ({
    id:uid(), name:"", rfc:"", ruc:"", email:"", phone:"", contacto:"", website:"",
    formasPago:[], cuentasBancarias:[], notas:"",
  });
  const [proveedores, setProveedores] = useState([
    {id:"p1", name:"Adobe Suscripciones", rfc:"", ruc:"", email:"billing@adobe.com", phone:"", contacto:"", website:"adobe.com", formasPago:["Tarjeta"], cuentasBancarias:[], notas:""},
    {id:"p2", name:"Alcaldía de Panamá", rfc:"", ruc:"1234567-1-123456", email:"", phone:"507-512-9000", contacto:"", website:"panama.gob.pa", formasPago:["Transferencia"], cuentasBancarias:[], notas:""},
    {id:"p3", name:"T&B Accountant", rfc:"", ruc:"", email:"tb@accountant.com", phone:"507-6000-0001", contacto:"Lic. Torres", website:"", formasPago:["Transferencia","Cheque"], cuentasBancarias:[], notas:""},
    {id:"p4", name:"Aseguradora Ancón", rfc:"", ruc:"", email:"info@ancon.com", phone:"507-223-0000", contacto:"María López", website:"aseguradoraancon.com", formasPago:["ACH"], cuentasBancarias:[], notas:""},
  ]);
  const [provSearch, setProvSearch] = useState("");
  const [provForm, setProvForm]     = useState(null);
  const [provDetalle, setProvDetalle] = useState(null);
  const FORMAS_PAGO_OPTS = ["Tarjeta","Transferencia","ACH","Cheque","Efectivo","PayPal","Yappy"];

  // Conceptos
  const [conceptos, setConceptos] = useState([
    {id:"c1", name:"Alquiler de Inmuebles y Locales", tipo:"Gasto Fijo", proveedorId:""},
    {id:"c2", name:"Agua", tipo:"Gasto Fijo", proveedorId:""},
    {id:"c3", name:"Alarma", tipo:"Gasto Fijo", proveedorId:""},
    {id:"c4", name:"Asesoría Fiscal y Contable", tipo:"Servicios", proveedorId:"p3"},
    {id:"c5", name:"Combustible", tipo:"Gasto Variable", proveedorId:""},
  ]);
  const [concSearch, setConcSearch] = useState("");
  const [concForm, setConcForm]     = useState(null);

  // Pagination
  const [provPage, setProvPage] = useState(1);
  const [concPage, setConcPage] = useState(1);
  const PER_PAGE = 10;

  const filtProv = proveedores.filter(p=>p.name.toLowerCase().includes(provSearch.toLowerCase()));
  const filtConc = conceptos.filter(c=>c.name.toLowerCase().includes(concSearch.toLowerCase()));

  const provPages = Math.ceil(filtProv.length/PER_PAGE);
  const concPages = Math.ceil(filtConc.length/PER_PAGE);

  const provSlice = filtProv.slice((provPage-1)*PER_PAGE, provPage*PER_PAGE);
  const concSlice = filtConc.slice((concPage-1)*PER_PAGE, concPage*PER_PAGE);

  const saveProv = p => {
    const full = {
      id:p.id, name:p.name||"", rfc:p.rfc||"", ruc:p.ruc||"",
      email:p.email||"", phone:p.phone||"", contacto:p.contacto||"",
      website:p.website||"", formasPago:p.formasPago||[],
      cuentasBancarias:p.cuentasBancarias||[], notas:p.notas||"",
    };
    setProveedores(prev => prev.find(x=>x.id===full.id) ? prev.map(x=>x.id===full.id?full:x) : [...prev,full]);
    setProvForm(null);
  };
  const delProv = id => setProveedores(p=>p.filter(x=>x.id!==id));

  const saveConc = c => {
    setConceptos(prev => prev.find(x=>x.id===c.id) ? prev.map(x=>x.id===c.id?c:x) : [...prev,c]);
    setConcForm(null);
  };
  const delConc = id => setConceptos(p=>p.filter(x=>x.id!==id));

  const Pagination = ({page, pages, onChange}) => pages<=1 ? null : (
    <div style={{display:"flex",gap:3,justifyContent:"flex-end",padding:"8px 12px",borderTop:"1px solid #F0F0F0"}}>
      <button onClick={()=>onChange(p=>Math.max(1,p-1))} disabled={page===1}
        style={{padding:"3px 9px",border:"1px solid #E0E0E0",borderRadius:4,background:"#fff",cursor:page===1?"default":"pointer",fontSize:11,opacity:page===1?.4:1}}>‹</button>
      {Array.from({length:pages},(_,i)=>i+1).map(n=>(
        <button key={n} onClick={()=>onChange(n)}
          style={{padding:"3px 9px",border:"1px solid #E0E0E0",borderRadius:4,background:page===n?B.blue:"#fff",color:page===n?"#fff":"#333",cursor:"pointer",fontSize:11,fontWeight:page===n?700:400}}>{n}</button>
      ))}
      <button onClick={()=>onChange(p=>Math.min(pages,p+1))} disabled={page===pages}
        style={{padding:"3px 9px",border:"1px solid #E0E0E0",borderRadius:4,background:"#fff",cursor:page===pages?"default":"pointer",fontSize:11,opacity:page===pages?.4:1}}>›</button>
    </div>
  );

  return (
    <div style={{padding:20}}>
      <div style={{fontSize:14,fontWeight:800,color:B.dark,marginBottom:16}}>Catálogo de Gastos</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>

        {/* ── PROVEEDORES ── */}
        <div style={{background:"#fff",border:"1px solid #E0E0E0",borderRadius:10,overflow:"hidden"}}>
          <div style={{background:B.gold,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:12,fontWeight:800,color:"#fff"}}>📦 PROVEEDORES GASTOS</div>
            <button onClick={()=>setProvForm(PROV_EMPTY())}
              style={{background:"rgba(255,255,255,.25)",border:"none",color:"#fff",padding:"3px 10px",borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              + ALTA
            </button>
          </div>

          {provForm && (
            <div style={{padding:"14px 16px",background:"#FFF8E1",borderBottom:"1px solid #FFE082"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                <FI label="Nombre del proveedor *" value={provForm.name} onChange={v=>setProvForm(p=>({...p,name:v}))} placeholder="Nombre..."/>
                <FI label="RFC" value={provForm.rfc||""} onChange={v=>setProvForm(p=>({...p,rfc:v}))} placeholder="RFC..."/>
                <FI label="RUC / NIT" value={provForm.ruc||""} onChange={v=>setProvForm(p=>({...p,ruc:v}))} placeholder="RUC o NIT..."/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                <FI label="Email" value={provForm.email||""} onChange={v=>setProvForm(p=>({...p,email:v}))} placeholder="email@proveedor.com"/>
                <FI label="Teléfono" value={provForm.phone||""} onChange={v=>setProvForm(p=>({...p,phone:v}))} placeholder="+507 0000-0000"/>
                <FI label="Persona de contacto" value={provForm.contacto||""} onChange={v=>setProvForm(p=>({...p,contacto:v}))} placeholder="Nombre del contacto..."/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                <FI label="Sitio web" value={provForm.website||""} onChange={v=>setProvForm(p=>({...p,website:v}))} placeholder="www.proveedor.com"/>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#546E7A",marginBottom:4}}>FORMAS DE PAGO</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {["Tarjeta","Transferencia","ACH","Cheque","Efectivo","PayPal","Yappy"].map(f=>(
                      <label key={f} style={{display:"flex",alignItems:"center",gap:3,fontSize:11,cursor:"pointer"}}>
                        <input type="checkbox" checked={(provForm.formasPago||[]).includes(f)}
                          onChange={e=>setProvForm(p=>({...p,formasPago:e.target.checked?[...(p.formasPago||[]),f]:(p.formasPago||[]).filter(x=>x!==f)}))}/>
                        {f}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{marginBottom:8}}>
                <div style={{fontSize:10,fontWeight:700,color:"#546E7A",marginBottom:6}}>CUENTAS BANCARIAS</div>
                {(provForm.cuentasBancarias||[]).map((cb,i)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr auto",gap:6,marginBottom:6,background:"#fff",padding:"6px 8px",borderRadius:6,border:"1px solid #FFE082"}}>
                    <FI label="Banco" value={cb.banco||""} onChange={v=>setProvForm(p=>({...p,cuentasBancarias:p.cuentasBancarias.map((x,j)=>j===i?{...x,banco:v}:x)}))} placeholder="Nombre del banco"/>
                    <FI label="N° de cuenta" value={cb.numero||""} onChange={v=>setProvForm(p=>({...p,cuentasBancarias:p.cuentasBancarias.map((x,j)=>j===i?{...x,numero:v}:x)}))} placeholder="0000-0000-00"/>
                    <FS label="Tipo" value={cb.tipo||"corriente"} onChange={v=>setProvForm(p=>({...p,cuentasBancarias:p.cuentasBancarias.map((x,j)=>j===i?{...x,tipo:v}:x)}))}
                      options={["corriente","ahorro","tarjeta_credito","paypal"].map(t=>({value:t,label:t.replace("_"," ")}))}/>
                    <FS label="Moneda" value={cb.moneda||"USD"} onChange={v=>setProvForm(p=>({...p,cuentasBancarias:p.cuentasBancarias.map((x,j)=>j===i?{...x,moneda:v}:x)}))}
                      options={["USD","PAB","EUR","COP","MXN"].map(c=>({value:c,label:c}))}/>
                    <button onClick={()=>setProvForm(p=>({...p,cuentasBancarias:p.cuentasBancarias.filter((_,j)=>j!==i)}))}
                      style={{background:"none",border:"none",cursor:"pointer",color:"#EF5350",fontSize:16,alignSelf:"flex-end",paddingBottom:4}}>✕</button>
                  </div>
                ))}
                <button onClick={()=>setProvForm(p=>({...p,cuentasBancarias:[...(p.cuentasBancarias||[]),{banco:"",numero:"",tipo:"corriente",moneda:"USD"}]}))}
                  style={{background:"none",border:"1px dashed #FFD54F",borderRadius:5,padding:"4px 12px",fontSize:11,color:"#F9A825",cursor:"pointer",fontFamily:"inherit"}}>
                  + Agregar cuenta bancaria
                </button>
              </div>
              <div style={{marginBottom:10}}>
                <FI label="Notas internas" value={provForm.notas||""} onChange={v=>setProvForm(p=>({...p,notas:v}))} placeholder="Observaciones sobre este proveedor..."/>
              </div>
              <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                <Btn v="primary" sz="sm" onClick={()=>provForm.name.trim()&&saveProv(provForm)}>Guardar proveedor</Btn>
                <Btn v="secondary" sz="sm" onClick={()=>setProvForm(null)}>Cancelar</Btn>
              </div>
            </div>
          )}

          <div style={{padding:"8px 12px",borderBottom:"1px solid #F0F0F0",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:11,color:"#546E7A"}}>{filtProv.length} records</span>
            <span style={{fontSize:11,color:"#546E7A",marginLeft:"auto"}}>Search:</span>
            <input value={provSearch} onChange={e=>{setProvSearch(e.target.value);setProvPage(1);}}
              style={{...SI,width:120,padding:"3px 7px",fontSize:11}}/>
          </div>

          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{background:"#F5F7FA"}}>
              <th style={{padding:"7px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:"#546E7A"}}>Proveedor</th>
              <th style={{padding:"7px 8px",fontSize:10,fontWeight:700,color:"#546E7A"}}>RUC / RFC</th>
              <th style={{padding:"7px 8px",fontSize:10,fontWeight:700,color:"#546E7A"}}>Contacto</th>
              <th style={{padding:"7px 8px",fontSize:10,fontWeight:700,color:"#546E7A"}}>Teléfono</th>
              <th style={{padding:"7px 8px",fontSize:10,fontWeight:700,color:"#546E7A"}}>Pago</th>
              <th style={{width:70}}></th>
            </tr></thead>
            <tbody>
              {provSlice.length===0 && (
                <tr><td colSpan={6} style={{padding:"20px",textAlign:"center",color:"#B0BEC5",fontSize:11}}>Sin proveedores</td></tr>
              )}
              {provSlice.map(p=>(
                <tr key={p.id} style={{borderTop:"1px solid #F5F5F5"}}>
                  <td style={{padding:"8px 12px"}}>
                    <div style={{fontWeight:600,color:B.dark}}>{p.name}</div>
                    {p.email && <div style={{fontSize:10,color:"#90A4AE"}}>{p.email}</div>}
                  </td>
                  <td style={{padding:"8px 8px",fontSize:11,color:"#546E7A"}}>
                    {p.ruc||p.rfc ? <span style={{background:"#EDE7F6",color:"#512DA8",padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:600}}>{p.ruc||p.rfc}</span> : <span style={{color:"#CFD8DC"}}>—</span>}
                  </td>
                  <td style={{padding:"8px 8px",fontSize:11,color:"#546E7A"}}>{p.contacto||"—"}</td>
                  <td style={{padding:"8px 8px",fontSize:11,color:"#546E7A"}}>{p.phone||"—"}</td>
                  <td style={{padding:"8px 8px"}}>
                    <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                      {(p.formasPago||[]).slice(0,2).map(f=>(
                        <span key={f} style={{background:"#E8F5E9",color:"#2E7D32",padding:"1px 5px",borderRadius:3,fontSize:9,fontWeight:600}}>{f}</span>
                      ))}
                      {(p.formasPago||[]).length>2 && <span style={{fontSize:9,color:"#90A4AE"}}>+{(p.formasPago||[]).length-2}</span>}
                    </div>
                  </td>
                  <td style={{padding:"4px 8px",textAlign:"center"}}>
                    <button onClick={()=>setProvForm({...p})}
                      style={{background:B.blue,border:"none",color:"#fff",borderRadius:4,padding:"3px 8px",cursor:"pointer",fontSize:10,marginRight:4}}>✏️</button>
                    <button onClick={()=>delProv(p.id)}
                      style={{background:"none",border:"none",cursor:"pointer",color:"#B0BEC5",fontSize:14}} title="Eliminar">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={provPage} pages={provPages} onChange={setProvPage}/>
        </div>

        {/* ── CONCEPTOS ── */}
        <div style={{background:"#fff",border:"1px solid #E0E0E0",borderRadius:10,overflow:"hidden"}}>
          <div style={{background:B.gold,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:12,fontWeight:800,color:"#fff"}}>📋 CONCEPTOS GASTOS Y SERVICIOS</div>
            <button onClick={()=>setConcForm({id:uid(),name:"",tipo:"Servicios",proveedorId:""})}
              style={{background:"rgba(255,255,255,.25)",border:"none",color:"#fff",padding:"3px 10px",borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              + ALTA
            </button>
          </div>

          {concForm && (
            <div style={{padding:"10px 14px",background:"#FFF8E1",borderBottom:"1px solid #FFE082"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                <FI label="Concepto" value={concForm.name} onChange={v=>setConcForm(p=>({...p,name:v}))} placeholder="Nombre del concepto..."/>
                <FS label="Tipo de gasto" value={concForm.tipo} onChange={v=>setConcForm(p=>({...p,tipo:v}))} options={TIPOS.map(t=>({value:t,label:t}))}/>
                <FS label="Proveedor" value={concForm.proveedorId} onChange={v=>setConcForm(p=>({...p,proveedorId:v}))}
                  options={[{value:"",label:"- Sin proveedor -"},...proveedores.map(p=>({value:p.id,label:p.name}))]}/>
              </div>
              <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                <Btn v="primary" sz="sm" onClick={()=>concForm.name.trim()&&saveConc(concForm)}>Guardar</Btn>
                <Btn v="secondary" sz="sm" onClick={()=>setConcForm(null)}>Cancelar</Btn>
              </div>
            </div>
          )}

          <div style={{padding:"8px 12px",borderBottom:"1px solid #F0F0F0",display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:11,color:"#546E7A"}}>{filtConc.length} records</span>
            <span style={{fontSize:11,color:"#546E7A",marginLeft:"auto"}}>Search:</span>
            <input value={concSearch} onChange={e=>{setConcSearch(e.target.value);setConcPage(1);}}
              style={{...SI,width:120,padding:"3px 7px",fontSize:11}}/>
          </div>

          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{background:"#F5F7FA"}}>
              <th style={{padding:"7px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:"#546E7A"}}>Concepto</th>
              <th style={{padding:"7px 8px",fontSize:10,fontWeight:700,color:"#546E7A"}}>Tipo de Gasto</th>
              <th style={{padding:"7px 8px",fontSize:10,fontWeight:700,color:"#546E7A"}}>Proveedor</th>
              <th style={{width:30}}></th>
            </tr></thead>
            <tbody>
              {concSlice.length===0 && (
                <tr><td colSpan={4} style={{padding:"20px",textAlign:"center",color:"#B0BEC5",fontSize:11}}>Sin conceptos</td></tr>
              )}
              {concSlice.map(c=>{
                const prov = proveedores.find(p=>p.id===c.proveedorId);
                return (
                  <tr key={c.id} style={{borderTop:"1px solid #F5F5F5"}}>
                    <td style={{padding:"8px 12px"}}>
                      <span style={{color:B.blue,cursor:"pointer",fontWeight:500}} onClick={()=>setConcForm({...c})}>{c.name}</span>
                    </td>
                    <td style={{padding:"8px 8px",fontSize:11,color:"#546E7A"}}>{c.tipo}</td>
                    <td style={{padding:"8px 8px",fontSize:11,color:"#546E7A"}}>{prov?`- ${prov.name}`:""}</td>
                    <td style={{padding:"4px 8px",textAlign:"center"}}>
                      <button onClick={()=>delConc(c.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#B0BEC5",fontSize:14}}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination page={concPage} pages={concPages} onChange={setConcPage}/>
        </div>

      </div>
    </div>
  );
}

// ─── BANCOS MODULE ────────────────────────────────────────────────────────────
function BancosModule() {
  const [cuentas, setCuentas] = useState([
    { id:"b1", bank:"Banco General", name:"Cuenta Corriente Principal", number:"••••-1234", currency:"USD", balance:15420.50, type:"corriente", color:"#1565C0" },
    { id:"b2", bank:"BAC Credomatic", name:"Caja Chica", number:"••••-5678", currency:"USD", balance:850.00, type:"ahorro", color:"#2E7D32" },
  ]);
  const [movs, setMovs]     = useState([]);
  const [selCta, setSelCta] = useState(null);
  const [form, setForm]     = useState(null);
  const [movForm, setMovForm] = useState(null);

  const totalUSD = cuentas.filter(c=>c.currency==="USD").reduce((s,c)=>s+(parseFloat(c.balance)||0),0);

  const mkMov = () => ({ id:uid(), date:today(), type:"egreso", description:"", amount:0, reference:"", cuentaId:selCta?.id||cuentas[0]?.id||"" });

  const saveMov = m => {
    setMovs(p=>[m,...p]);
    // Update balance
    setCuentas(p=>p.map(c=>{
      if (c.id!==m.cuentaId) return c;
      const delta = m.type==="ingreso" ? parseFloat(m.amount)||0 : -(parseFloat(m.amount)||0);
      return {...c, balance:(parseFloat(c.balance)||0)+delta};
    }));
    setMovForm(null);
  };

  const ctaMov = selCta ? movs.filter(m=>m.cuentaId===selCta.id) : movs;

  return (
    <div style={{padding:20}}>
      {/* Summary */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:20}}>
        <div style={{background:B.dark,borderRadius:10,padding:18,color:"#fff"}}>
          <div style={{fontSize:10,opacity:.7,marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Saldo total USD</div>
          <div style={{fontSize:28,fontWeight:900}}>${fmt(totalUSD)}</div>
          <div style={{fontSize:10,opacity:.6,marginTop:4}}>{cuentas.length} cuenta{cuentas.length!==1?"s":""} activas</div>
        </div>
        {cuentas.map(c=>(
          <div key={c.id} onClick={()=>setSelCta(selCta?.id===c.id?null:c)}
            style={{background:"#fff",border:`2px solid ${selCta?.id===c.id?c.color:"#E0E0E0"}`,borderRadius:10,padding:16,cursor:"pointer",transition:"all .15s"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{fontSize:10,color:"#546E7A"}}>{c.bank}</div>
                <div style={{fontSize:12,fontWeight:700,color:B.dark}}>{c.name}</div>
              </div>
              <span style={{fontSize:9,background:`${c.color}22`,color:c.color,padding:"2px 7px",borderRadius:6,fontWeight:700}}>{c.type}</span>
            </div>
            <div style={{fontSize:20,fontWeight:900,color:c.color}}>${fmt(c.balance)}</div>
            <div style={{fontSize:10,color:"#90A4AE",marginTop:2}}>{c.number} · {c.currency}</div>
          </div>
        ))}
        <div onClick={()=>setForm({id:uid(),bank:"",name:"",number:"",currency:"USD",balance:0,type:"corriente",color:"#1565C0"})}
          style={{background:"#F8F9FA",border:"2px dashed #E0E0E0",borderRadius:10,padding:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#90A4AE",fontSize:12,fontWeight:600,gap:6}}>
          + Agregar cuenta
        </div>
      </div>

      {/* Account form modal */}
      {form && (
        <div style={{background:"#fff",border:"1px solid #E0E0E0",borderRadius:10,padding:20,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:800}}>Nueva cuenta bancaria</div>
            <div style={{display:"flex",gap:8}}>
              <Btn v="primary" sz="sm" onClick={()=>{setCuentas(p=>[...p,form]);setForm(null);}}>Guardar</Btn>
              <Btn v="secondary" sz="sm" onClick={()=>setForm(null)}>Cancelar</Btn>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            <FI label="Banco"   value={form.bank}   onChange={v=>setForm(p=>({...p,bank:v}))}   placeholder="Banco General"/>
            <FI label="Nombre de la cuenta" value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} placeholder="Cuenta Corriente"/>
            <FI label="Número" value={form.number} onChange={v=>setForm(p=>({...p,number:v}))} placeholder="••••-1234"/>
            <FI label="Saldo inicial" value={String(form.balance)} onChange={v=>setForm(p=>({...p,balance:parseFloat(v)||0}))} type="number"/>
            <FS label="Divisa" value={form.currency} onChange={v=>setForm(p=>({...p,currency:v}))} options={CURRENCIES.map(c=>({value:c,label:c}))}/>
            <FS label="Tipo" value={form.type} onChange={v=>setForm(p=>({...p,type:v}))} options={[{value:"corriente",label:"Corriente"},{value:"ahorro",label:"Ahorro"},{value:"caja-chica",label:"Caja Chica"}]}/>
          </div>
        </div>
      )}

      {/* Movements */}
      <div style={{background:"#fff",border:"1px solid #E0E0E0",borderRadius:10,overflow:"hidden"}}>
        <div style={{padding:"12px 16px",borderBottom:"1px solid #F0F0F0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:13,fontWeight:800,color:B.dark}}>
            Movimientos {selCta?`— ${selCta.name}`:"— Todas las cuentas"}
          </div>
          <div style={{display:"flex",gap:8}}>
            {selCta&&<Btn v="ghost" sz="sm" onClick={()=>setSelCta(null)}>Ver todas</Btn>}
            <Btn v="primary" sz="sm" onClick={()=>setMovForm(mkMov())}>+ Movimiento</Btn>
          </div>
        </div>

        {movForm && (
          <div style={{padding:16,background:"#F8FAFF",borderBottom:"1px solid #E0E0E0"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:10}}>
              <FI label="Fecha" value={movForm.date} onChange={v=>setMovForm(p=>({...p,date:v}))} type="date"/>
              <FS label="Tipo" value={movForm.type} onChange={v=>setMovForm(p=>({...p,type:v}))} options={[{value:"ingreso",label:"Ingreso"},{value:"egreso",label:"Egreso"}]}/>
              <FI label="Monto" value={String(movForm.amount)} onChange={v=>setMovForm(p=>({...p,amount:parseFloat(v)||0}))} type="number"/>
              <FI label="Referencia" value={movForm.reference} onChange={v=>setMovForm(p=>({...p,reference:v}))}/>
              <FS label="Cuenta" value={movForm.cuentaId} onChange={v=>setMovForm(p=>({...p,cuentaId:v}))} options={cuentas.map(c=>({value:c.id,label:c.name}))}/>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <div style={{flex:1}}><FI label="Descripción" value={movForm.description} onChange={v=>setMovForm(p=>({...p,description:v}))} placeholder="Concepto del movimiento..."/></div>
              <div style={{display:"flex",gap:6,marginTop:16}}>
                <Btn v="primary" sz="sm" onClick={()=>saveMov(movForm)}>Guardar</Btn>
                <Btn v="secondary" sz="sm" onClick={()=>setMovForm(null)}>Cancelar</Btn>
              </div>
            </div>
          </div>
        )}

        {ctaMov.length===0 ? (
          <div style={{textAlign:"center",padding:40,color:"#B0BEC5"}}>
            <div style={{fontSize:32,marginBottom:10}}>🏛</div>
            <div style={{fontSize:12}}>Sin movimientos registrados.</div>
          </div>
        ) : (
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{background:"#F5F7FA"}}>
                {["Fecha","Cuenta","Descripción","Tipo","Monto","Ref."].map(h=>(
                  <th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:"#546E7A"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ctaMov.map(m=>{
                const cta = cuentas.find(c=>c.id===m.cuentaId);
                return (
                  <tr key={m.id} style={{borderTop:"1px solid #F0F0F0"}}>
                    <td style={{padding:"9px 12px",color:"#546E7A"}}>{m.date}</td>
                    <td style={{padding:"9px 12px",fontSize:11}}>{cta?.name||"—"}</td>
                    <td style={{padding:"9px 12px"}}>{m.description||"—"}</td>
                    <td style={{padding:"9px 12px"}}>
                      <span style={{background:m.type==="ingreso"?"#E8F5E9":"#FFEBEE",color:m.type==="ingreso"?B.green:B.red,padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:700}}>
                        {m.type==="ingreso"?"▲ Ingreso":"▼ Egreso"}
                      </span>
                    </td>
                    <td style={{padding:"9px 12px",fontWeight:800,color:m.type==="ingreso"?B.green:B.red}}>
                      {m.type==="ingreso"?"+":"-"}${fmt(m.amount)}
                    </td>
                    <td style={{padding:"9px 12px",color:"#546E7A",fontSize:11}}>{m.reference||"—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── AGENCIA CONFIG ───────────────────────────────────────────────────────────
function AgenciaConfig({ agency: initialAgency, onSave }) {
  const [ag, setAg]   = useState(initialAgency || {});
  const [tab, setTab] = useState("general");
  const [saved, setSaved] = useState(false);

  const upd = (f,v) => setAg(p=>({...p,[f]:v}));
  const save = () => {
    const fullAg = {
      ...ag,
      divisasActivas, divisaPrincipal,
      conceptosPersonalizados, tiposPersonalizados,
    };
    onSave && onSave(fullAg);
    setSaved(true);
    setTimeout(()=>setSaved(false),2500);
  };

  const TABS = [
    {id:"general",   label:"General",    icon:"🏢"},
    {id:"contacto",  label:"Contacto",   icon:"📞"},
    {id:"marca",     label:"Marca",      icon:"🎨"},
    {id:"factura",   label:"Facturación",icon:"📄"},
    {id:"divisas",   label:"Divisas",    icon:"💱"},
    {id:"conceptos", label:"Conceptos",  icon:"📋"},
  ];

  // Estado para divisas y conceptos personalizados
  const ALL_CURRENCIES = [
    {code:"USD", name:"Dólar Estadounidense",  symbol:"$",  flag:"🇺🇸"},
    {code:"EUR", name:"Euro",                   symbol:"€",  flag:"🇪🇺"},
    {code:"MXN", name:"Peso Mexicano",           symbol:"$",  flag:"🇲🇽"},
    {code:"COP", name:"Peso Colombiano",         symbol:"$",  flag:"🇨🇴"},
    {code:"PEN", name:"Sol Peruano",             symbol:"S/", flag:"🇵🇪"},
    {code:"ARS", name:"Peso Argentino",          symbol:"$",  flag:"🇦🇷"},
    {code:"CLP", name:"Peso Chileno",            symbol:"$",  flag:"🇨🇱"},
    {code:"BRL", name:"Real Brasileño",          symbol:"R$", flag:"🇧🇷"},
    {code:"GBP", name:"Libra Esterlina",         symbol:"£",  flag:"🇬🇧"},
    {code:"CAD", name:"Dólar Canadiense",        symbol:"$",  flag:"🇨🇦"},
    {code:"JPY", name:"Yen Japonés",             symbol:"¥",  flag:"🇯🇵"},
    {code:"AED", name:"Dírham Emiratos",         symbol:"د.إ",flag:"🇦🇪"},
    {code:"PAB", name:"Balboa Panameño",         symbol:"B/.",flag:"🇵🇦"},
    {code:"GTQ", name:"Quetzal Guatemalteco",    symbol:"Q",  flag:"🇬🇹"},
    {code:"CRC", name:"Colón Costarricense",     symbol:"₡",  flag:"🇨🇷"},
    {code:"DOP", name:"Peso Dominicano",         symbol:"RD$",flag:"🇩🇴"},
  ];
  const [divisasActivas, setDivisasActivas] = useState(
    ag.divisasActivas || ["USD","EUR","MXN","COP","PEN"]
  );
  const [divisaPrincipal, setDivisaPrincipal] = useState(
    ag.divisaPrincipal || "USD"
  );

  // Conceptos personalizados
  const CONCEPTOS_DEFAULT = ["HOTELES NACIONALES","HOTELES INTERNACIONALES","VUELOS NACIONALES","VUELOS INTERNACIONALES","TOURS Y EXCURSIONES","TRASLADOS","SEGUROS DE VIAJE","CRUCEROS","PAQUETES TURISTICOS","OTROS SERVICIOS"];
  const [conceptosPersonalizados, setConceptosPersonalizados] = useState(
    ag.conceptosPersonalizados || []
  );
  const [newConcepto, setNewConcepto] = useState("");
  const addConcepto = () => {
    const val = newConcepto.trim().toUpperCase();
    if(!val || conceptosPersonalizados.includes(val) || CONCEPTOS_DEFAULT.includes(val)) return;
    setConceptosPersonalizados(p=>[...p,val]);
    setNewConcepto("");
  };
  const delConcepto = c => setConceptosPersonalizados(p=>p.filter(x=>x!==c));

  // Tipos de gasto personalizados
  const TIPOS_DEFAULT = ["Gasto Fijo","Gasto Variable","Servicios","Gasto Operación","Impuestos","Otros"];
  const [tiposPersonalizados, setTiposPersonalizados] = useState(
    ag.tiposPersonalizados || []
  );
  const [newTipo, setNewTipo] = useState("");
  const addTipo = () => {
    const val = newTipo.trim();
    if(!val || tiposPersonalizados.includes(val) || TIPOS_DEFAULT.includes(val)) return;
    setTiposPersonalizados(p=>[...p,val]);
    setNewTipo("");
  };
  const delTipo = t => setTiposPersonalizados(p=>p.filter(x=>x!==t));

  return (
    <div style={{padding:20,maxWidth:800}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:B.dark}}>Configuración de Agencia</div>
          <div style={{fontSize:11,color:"#546E7A",marginTop:2}}>Personaliza los datos de tu agencia en VíaSuite</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {saved&&<span style={{fontSize:11,color:B.green,fontWeight:700}}>✓ Guardado</span>}
          <Btn v="primary" onClick={save}>Guardar cambios</Btn>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:20,background:"#F1F5F9",padding:4,borderRadius:10,width:"fit-content"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:"7px 16px",borderRadius:7,border:"none",background:tab===t.id?"#fff":"transparent",color:tab===t.id?B.dark:"#546E7A",fontWeight:tab===t.id?700:500,fontSize:12,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5,boxShadow:tab===t.id?"0 1px 4px rgba(0,0,0,.08)":"none"}}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{background:"#fff",border:"1px solid #E0E0E0",borderRadius:10,padding:24}}>
        {tab==="general" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div style={{gridColumn:"1/-1"}}>
              <FI label="Nombre de la agencia" value={ag.name||""} onChange={v=>upd("name",v)} placeholder="Travel Advisors Panama"/>
            </div>
            <FI label="País"      value={ag.country||""} onChange={v=>upd("country",v)} placeholder="Panama"/>
            <FI label="Ciudad"    value={ag.city||""}    onChange={v=>upd("city",v)}    placeholder="Ciudad de Panama"/>
            <div style={{gridColumn:"1/-1"}}>
              <FI label="Dirección" value={ag.address||""} onChange={v=>upd("address",v)} placeholder="Calle, edificio, piso..."/>
            </div>
            <FI label="Sitio web" value={ag.website||""} onChange={v=>upd("website",v)} placeholder="www.tuagencia.com"/>
            <FS label="Zona horaria" value={ag.timezone||"America/Panama"} onChange={v=>upd("timezone",v)}
              options={[{value:"America/Panama",label:"Panama (UTC-5)"},{value:"America/Bogota",label:"Colombia (UTC-5)"},{value:"America/Mexico_City",label:"Mexico (UTC-6)"},{value:"America/Lima",label:"Peru (UTC-5)"}]}/>
          </div>
        )}

        {tab==="contacto" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <FI label="Email principal"    value={ag.email||""}   onChange={v=>upd("email",v)}   placeholder="info@tuagencia.com"/>
            <FI label="Teléfono"           value={ag.phone||""}   onChange={v=>upd("phone",v)}   placeholder="+507 000-0000"/>
            <FI label="WhatsApp"           value={ag.whatsapp||""} onChange={v=>upd("whatsapp",v)} placeholder="+507 6000-0000"/>
            <FI label="Email de soporte"   value={ag.emailSupport||""} onChange={v=>upd("emailSupport",v)} placeholder="soporte@tuagencia.com"/>
            <FI label="Instagram"          value={ag.instagram||""} onChange={v=>upd("instagram",v)} placeholder="@tuagencia"/>
            <FI label="Facebook"           value={ag.facebook||""} onChange={v=>upd("facebook",v)} placeholder="facebook.com/tuagencia"/>
          </div>
        )}

        {tab==="marca" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:"#546E7A",marginBottom:6}}>COLOR PRINCIPAL</label>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <input type="color" value={ag.primaryColor||"#1565C0"} onChange={e=>upd("primaryColor",e.target.value)}
                  style={{width:48,height:36,border:"1px solid #E0E0E0",borderRadius:6,cursor:"pointer"}}/>
                <input value={ag.primaryColor||"#1565C0"} onChange={e=>upd("primaryColor",e.target.value)}
                  style={{...SI,flex:1,fontSize:12}}/>
              </div>
            </div>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:"#546E7A",marginBottom:6}}>COLOR SECUNDARIO</label>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <input type="color" value={ag.secondaryColor||"#F59E0B"} onChange={e=>upd("secondaryColor",e.target.value)}
                  style={{width:48,height:36,border:"1px solid #E0E0E0",borderRadius:6,cursor:"pointer"}}/>
                <input value={ag.secondaryColor||"#F59E0B"} onChange={e=>upd("secondaryColor",e.target.value)}
                  style={{...SI,flex:1,fontSize:12}}/>
              </div>
            </div>
            {/* Preview */}
            <div style={{gridColumn:"1/-1",marginTop:8}}>
              <div style={{fontSize:11,fontWeight:700,color:"#546E7A",marginBottom:10}}>VISTA PREVIA</div>
              <div style={{background:ag.primaryColor||"#1565C0",borderRadius:8,padding:"12px 16px",display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:32,height:32,borderRadius:6,background:"rgba(255,255,255,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:900,color:ag.secondaryColor||"#F59E0B"}}>VS</div>
                <div>
                  <div style={{fontSize:14,fontWeight:800,color:"#fff"}}>{ag.name||"Tu Agencia"}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.6)"}}>Sistema de Gestión</div>
                </div>
                <div style={{marginLeft:"auto",background:ag.secondaryColor||"#F59E0B",color:"#fff",padding:"4px 12px",borderRadius:6,fontSize:11,fontWeight:700}}>Botón</div>
              </div>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:"#546E7A",marginBottom:6}}>URL DEL LOGO</label>
              <FI value={ag.logoUrl||""} onChange={v=>upd("logoUrl",v)} placeholder="https://tuagencia.com/logo.png"/>
              {ag.logoUrl&&<img src={ag.logoUrl} alt="logo" style={{height:48,marginTop:8,borderRadius:4,border:"1px solid #E0E0E0",padding:4}}/>}
            </div>
          </div>
        )}

        {tab==="factura" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <FI label="RUC / NIT / RFC"     value={ag.taxId||""}       onChange={v=>upd("taxId",v)}       placeholder="Número de contribuyente"/>
            <FI label="Razón social"         value={ag.legalName||""}   onChange={v=>upd("legalName",v)}   placeholder="Nombre legal de la empresa"/>
            <FI label="Banco principal"      value={ag.bankName||""}    onChange={v=>upd("bankName",v)}    placeholder="Banco General"/>
            <FI label="No. cuenta"           value={ag.bankAccount||""} onChange={v=>upd("bankAccount",v)} placeholder="0000-0000-00"/>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:"#546E7A",marginBottom:6}}>CONDICIONES DE PAGO (texto para cotizaciones)</label>
              <FTA value={ag.paymentTerms||"Los precios se garantizan solo al momento del pago. Se requiere un depósito del 50% para reservar."} onChange={v=>upd("paymentTerms",v)} rows={3}/>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:"#546E7A",marginBottom:6}}>NOTAS EN COTIZACIONES</label>
              <FTA value={ag.quoteNotes||""} onChange={v=>upd("quoteNotes",v)} rows={2} placeholder="Texto que aparece al pie de tus cotizaciones..."/>
            </div>
          </div>
        )}

        {/* ── TAB DIVISAS ── */}
        {tab==="divisas" && (
          <div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,fontWeight:700,color:B.dark,marginBottom:4}}>💱 Divisa principal</div>
              <div style={{fontSize:11,color:"#546E7A",marginBottom:12}}>La divisa principal se usa por defecto en cotizaciones, expedientes y reportes.</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {ALL_CURRENCIES.filter(c=>divisasActivas.includes(c.code)).map(c=>(
                  <button key={c.code} onClick={()=>setDivisaPrincipal(c.code)}
                    style={{padding:"8px 14px",borderRadius:8,border:`2px solid ${divisaPrincipal===c.code?B.blue:"#E0E0E0"}`,background:divisaPrincipal===c.code?"#EFF6FF":"#fff",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:divisaPrincipal===c.code?700:400,color:divisaPrincipal===c.code?B.blue:"#333"}}>
                    {c.flag} {c.code} <span style={{color:"#90A4AE",fontSize:10}}>{c.symbol}</span>
                    {divisaPrincipal===c.code&&<span style={{fontSize:9,background:B.blue,color:"#fff",padding:"1px 5px",borderRadius:3,marginLeft:2}}>PRINCIPAL</span>}
                  </button>
                ))}
              </div>
            </div>

            <div style={{borderTop:"1px solid #F0F0F0",paddingTop:20}}>
              <div style={{fontSize:12,fontWeight:700,color:B.dark,marginBottom:4}}>🌍 Divisas activas en el sistema</div>
              <div style={{fontSize:11,color:"#546E7A",marginBottom:16}}>Activa las divisas que tu agencia maneja. Solo las activas aparecerán en cotizaciones, expedientes y reportes.</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8}}>
                {ALL_CURRENCIES.map(c=>{
                  const active = divisasActivas.includes(c.code);
                  const isPrincipal = divisaPrincipal===c.code;
                  return (
                    <label key={c.code} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:8,border:`1px solid ${active?"#BBDEFB":"#E0E0E0"}`,background:active?"#EFF6FF":"#fff",cursor:isPrincipal?"default":"pointer",opacity:isPrincipal?1:1}}>
                      <input type="checkbox" checked={active} disabled={isPrincipal}
                        onChange={e=>{
                          if(isPrincipal) return;
                          setDivisasActivas(p=>e.target.checked?[...p,c.code]:p.filter(x=>x!==c.code));
                        }}/>
                      <span style={{fontSize:18}}>{c.flag}</span>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:active?B.blue:"#333"}}>{c.code} <span style={{fontWeight:400,color:"#90A4AE"}}>{c.symbol}</span></div>
                        <div style={{fontSize:10,color:"#90A4AE"}}>{c.name}</div>
                      </div>
                      {isPrincipal&&<span style={{marginLeft:"auto",fontSize:9,background:B.blue,color:"#fff",padding:"2px 6px",borderRadius:3}}>PRINCIPAL</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB CONCEPTOS ── */}
        {tab==="conceptos" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>

            {/* Conceptos de venta */}
            <div>
              <div style={{fontSize:12,fontWeight:700,color:B.dark,marginBottom:4}}>📦 Conceptos de venta / expediente</div>
              <div style={{fontSize:11,color:"#546E7A",marginBottom:12}}>Aparecen en el selector de conceptos al crear items en expedientes y cotizaciones.</div>

              {/* Predefinidos */}
              <div style={{fontSize:10,fontWeight:700,color:"#90A4AE",marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Predefinidos (no editables)</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:16}}>
                {CONCEPTOS_DEFAULT.map(c=>(
                  <span key={c} style={{background:"#F5F7FA",border:"1px solid #E0E0E0",borderRadius:5,padding:"3px 9px",fontSize:11,color:"#546E7A"}}>{c}</span>
                ))}
              </div>

              {/* Personalizados */}
              <div style={{fontSize:10,fontWeight:700,color:B.blue,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Personalizados de tu agencia</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>
                {conceptosPersonalizados.length===0&&<span style={{fontSize:11,color:"#B0BEC5"}}>Aún no has agregado conceptos personalizados</span>}
                {conceptosPersonalizados.map(c=>(
                  <span key={c} style={{background:"#EFF6FF",border:"1px solid #BBDEFB",borderRadius:5,padding:"3px 9px",fontSize:11,color:B.blue,display:"flex",alignItems:"center",gap:5}}>
                    {c}
                    <button onClick={()=>delConcepto(c)} style={{background:"none",border:"none",cursor:"pointer",color:"#EF5350",fontSize:12,padding:0,lineHeight:1}}>✕</button>
                  </span>
                ))}
              </div>
              <div style={{display:"flex",gap:6}}>
                <input value={newConcepto} onChange={e=>setNewConcepto(e.target.value.toUpperCase())}
                  onKeyDown={e=>e.key==="Enter"&&addConcepto()}
                  placeholder="NUEVO CONCEPTO..." style={{...SI,flex:1,fontSize:11}}/>
                <button onClick={addConcepto}
                  style={{background:B.blue,color:"#fff",border:"none",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"}}>+ Agregar</button>
              </div>
            </div>

            {/* Tipos de gasto */}
            <div>
              <div style={{fontSize:12,fontWeight:700,color:B.dark,marginBottom:4}}>💸 Tipos de gasto</div>
              <div style={{fontSize:11,color:"#546E7A",marginBottom:12}}>Aparecen en el módulo de Gastos al clasificar conceptos de gasto.</div>

              {/* Predefinidos */}
              <div style={{fontSize:10,fontWeight:700,color:"#90A4AE",marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Predefinidos (no editables)</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:16}}>
                {TIPOS_DEFAULT.map(t=>(
                  <span key={t} style={{background:"#F5F7FA",border:"1px solid #E0E0E0",borderRadius:5,padding:"3px 9px",fontSize:11,color:"#546E7A"}}>{t}</span>
                ))}
              </div>

              {/* Personalizados */}
              <div style={{fontSize:10,fontWeight:700,color:B.gold,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Personalizados de tu agencia</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>
                {tiposPersonalizados.length===0&&<span style={{fontSize:11,color:"#B0BEC5"}}>Aún no has agregado tipos personalizados</span>}
                {tiposPersonalizados.map(t=>(
                  <span key={t} style={{background:"#FFF8E1",border:"1px solid #FFE082",borderRadius:5,padding:"3px 9px",fontSize:11,color:"#F9A825",display:"flex",alignItems:"center",gap:5}}>
                    {t}
                    <button onClick={()=>delTipo(t)} style={{background:"none",border:"none",cursor:"pointer",color:"#EF5350",fontSize:12,padding:0,lineHeight:1}}>✕</button>
                  </span>
                ))}
              </div>
              <div style={{display:"flex",gap:6}}>
                <input value={newTipo} onChange={e=>setNewTipo(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&addTipo()}
                  placeholder="Nuevo tipo de gasto..." style={{...SI,flex:1,fontSize:11}}/>
                <button onClick={addTipo}
                  style={{background:B.gold,color:"#fff",border:"none",borderRadius:6,padding:"6px 14px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"}}>+ Agregar</button>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

// ─── VENTAS MODULE ────────────────────────────────────────────────────────────
function VentasModule({ expedientes, advisors, user }) {
  const [period, setPeriod]   = useState("mes");
  const [selAdv, setSelAdv]   = useState("todos");
  const [view,   setView]     = useState("resumen"); // resumen, pipeline, detalle

  const now    = new Date();
  const mesKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const anoKey = String(now.getFullYear());

  const filterExp = exp => {
    const d = exp.trip?.dateFrom || exp.createdAt || "";
    const key = period==="mes" ? d.slice(0,7) : d.slice(0,4);
    const inPeriod = period==="mes" ? key===mesKey : key===anoKey;
    const inAdv    = selAdv==="todos" || exp.advisorId===selAdv;
    return inPeriod && inAdv;
  };

  const filtered = expedientes.filter(filterExp);

  // Calculate totals from items
  const calcVenta = exp => {
    const items = exp.items || [];
    return items.reduce((s,it) => s + (parseFloat(it.base)||0) + (parseFloat(it.iva)||0) + (parseFloat(it.tua)||0) + (parseFloat(it.others)||0), 0);
  };

  const totalVenta   = filtered.reduce((s,e) => s + calcVenta(e), 0);
  const totalExps    = filtered.length;
  const cerrados     = filtered.filter(e=>e.status==="cerrado").length;
  const activos      = filtered.filter(e=>e.status==="activo").length;
  const nuevos       = filtered.filter(e=>e.status==="nuevo").length;
  const ticketProm   = totalExps > 0 ? totalVenta / totalExps : 0;
  const conversion   = totalExps > 0 ? Math.round((cerrados/totalExps)*100) : 0;

  // By advisor
  const byAdvisor = advisors.map(adv => {
    const advExps = filtered.filter(e => e.advisorId === adv.id);
    const advVenta = advExps.reduce((s,e) => s + calcVenta(e), 0);
    const meta = 15000; // default meta mensual
    return {
      ...adv,
      exps:    advExps.length,
      venta:   advVenta,
      cerrados: advExps.filter(e=>e.status==="cerrado").length,
      meta,
      pct:     Math.min(100, Math.round((advVenta/meta)*100)),
    };
  }).sort((a,b) => b.venta - a.venta);

  // Pipeline by status
  const pipeline = [
    { status:"nuevo",   label:"Nuevos",   color:"#1565C0", bg:"#E3F2FD", exps: filtered.filter(e=>e.status==="nuevo") },
    { status:"activo",  label:"En proceso",color:"#F57F17", bg:"#FFF8E1", exps: filtered.filter(e=>e.status==="activo") },
    { status:"cerrado", label:"Cerrados",  color:"#2E7D32", bg:"#E8F5E9", exps: filtered.filter(e=>e.status==="cerrado") },
    { status:"anulado", label:"Anulados",  color:"#546E7A", bg:"#ECEFF1", exps: filtered.filter(e=>e.status==="anulado") },
  ];

  return (
    <div style={{padding:20}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:B.dark}}>Módulo de Ventas</div>
          <div style={{fontSize:11,color:"#546E7A",marginTop:2}}>Control de expedientes y rendimiento comercial</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {/* Period selector */}
          <div style={{display:"flex",gap:3,background:"#F1F5F9",padding:3,borderRadius:8}}>
            {[{id:"mes",label:"Este mes"},{id:"ano",label:"Este año"}].map(p=>(
              <button key={p.id} onClick={()=>setPeriod(p.id)}
                style={{padding:"6px 14px",borderRadius:6,border:"none",background:period===p.id?"#fff":"transparent",color:period===p.id?B.dark:"#546E7A",fontWeight:period===p.id?700:500,fontSize:12,cursor:"pointer",fontFamily:"inherit",boxShadow:period===p.id?"0 1px 4px rgba(0,0,0,.08)":"none"}}>
                {p.label}
              </button>
            ))}
          </div>
          {/* Advisor selector */}
          <select value={selAdv} onChange={e=>setSelAdv(e.target.value)}
            style={{...SI,padding:"6px 12px",fontSize:12,width:160}}>
            <option value="todos">Todos los asesores</option>
            {advisors.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {/* View selector */}
          <div style={{display:"flex",gap:3,background:"#F1F5F9",padding:3,borderRadius:8}}>
            {[{id:"resumen",label:"📊 Resumen"},{id:"pipeline",label:"🔄 Pipeline"},{id:"detalle",label:"📋 Detalle"}].map(v=>(
              <button key={v.id} onClick={()=>setView(v.id)}
                style={{padding:"6px 12px",borderRadius:6,border:"none",background:view===v.id?"#fff":"transparent",color:view===v.id?B.dark:"#546E7A",fontWeight:view===v.id?700:500,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14,marginBottom:20}}>
        {[
          {label:"Venta total",     val:`$${fmt(totalVenta)}`, c:B.blue,  icon:"💰"},
          {label:"Expedientes",     val:String(totalExps),     c:B.dark,  icon:"📁"},
          {label:"Ticket promedio", val:`$${fmt(ticketProm)}`, c:B.teal,  icon:"🎯"},
          {label:"Cerrados",        val:`${cerrados} (${conversion}%)`, c:B.green, icon:"✅"},
          {label:"En proceso",      val:String(activos),       c:B.gold,  icon:"⏳"},
          {label:"Nuevos",          val:String(nuevos),        c:"#7C3AED",icon:"🆕"},
        ].map(k=>(
          <div key={k.label} style={{background:"#fff",border:"1px solid #E0E0E0",borderRadius:10,padding:16}}>
            <div style={{fontSize:20,marginBottom:6}}>{k.icon}</div>
            <div style={{fontSize:11,color:"#546E7A",marginBottom:4}}>{k.label}</div>
            <div style={{fontSize:20,fontWeight:900,color:k.c}}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* RESUMEN VIEW */}
      {view==="resumen" && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          {/* By advisor */}
          <div style={{background:"#fff",border:"1px solid #E0E0E0",borderRadius:10,overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #F0F0F0",fontSize:13,fontWeight:800,color:B.dark}}>
              Rendimiento por asesor
            </div>
            <div style={{padding:16,display:"flex",flexDirection:"column",gap:14}}>
              {byAdvisor.map(adv=>(
                <div key={adv.id}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:32,height:32,borderRadius:"50%",background:B.blue,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800}}>{adv.avatar}</div>
                      <div>
                        <div style={{fontSize:12,fontWeight:700}}>{adv.name.split(" ")[0]}</div>
                        <div style={{fontSize:10,color:"#546E7A"}}>{adv.exps} exp · {adv.cerrados} cerrados</div>
                      </div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:14,fontWeight:900,color:B.blue}}>${fmt(adv.venta)}</div>
                      <div style={{fontSize:10,color:"#546E7A"}}>{adv.pct}% de meta</div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{background:"#F1F5F9",borderRadius:4,height:6,overflow:"hidden"}}>
                    <div style={{width:`${adv.pct}%`,height:"100%",background:adv.pct>=100?B.green:adv.pct>=70?B.gold:B.blue,borderRadius:4,transition:"width .5s"}}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#90A4AE",marginTop:3}}>
                    <span>$0</span>
                    <span>Meta: ${fmt(adv.meta)}</span>
                  </div>
                </div>
              ))}
              {byAdvisor.length===0&&<div style={{textAlign:"center",color:"#B0BEC5",fontSize:12,padding:20}}>Sin datos en este período</div>}
            </div>
          </div>

          {/* By destination */}
          <div style={{background:"#fff",border:"1px solid #E0E0E0",borderRadius:10,overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #F0F0F0",fontSize:13,fontWeight:800,color:B.dark}}>
              Top destinos
            </div>
            <div style={{padding:16}}>
              {(() => {
                const destMap = {};
                filtered.forEach(e => {
                  const dest = e.trip?.destination || "Sin destino";
                  if (!destMap[dest]) destMap[dest] = { count:0, venta:0 };
                  destMap[dest].count++;
                  destMap[dest].venta += calcVenta(e);
                });
                const dests = Object.entries(destMap).sort((a,b)=>b[1].venta-a[1].venta).slice(0,8);
                const maxV = dests[0]?.[1]?.venta || 1;
                return dests.length===0
                  ? <div style={{textAlign:"center",color:"#B0BEC5",fontSize:12,padding:20}}>Sin datos</div>
                  : dests.map(([dest,d],i)=>(
                    <div key={dest} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                        <span style={{fontWeight:600}}>{dest}</span>
                        <span style={{color:B.blue,fontWeight:700}}>${fmt(d.venta)} <span style={{color:"#546E7A",fontWeight:400}}>({d.count} exp)</span></span>
                      </div>
                      <div style={{background:"#F1F5F9",borderRadius:4,height:5,overflow:"hidden"}}>
                        <div style={{width:`${(d.venta/maxV)*100}%`,height:"100%",background:B.blue,borderRadius:4}}/>
                      </div>
                    </div>
                  ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* PIPELINE VIEW */}
      {view==="pipeline" && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
          {pipeline.map(col=>(
            <div key={col.status} style={{background:"#fff",border:`2px solid ${col.color}22`,borderRadius:10,overflow:"hidden"}}>
              <div style={{background:col.bg,padding:"10px 14px",borderBottom:`2px solid ${col.color}33`}}>
                <div style={{fontSize:12,fontWeight:800,color:col.color}}>{col.label}</div>
                <div style={{fontSize:11,color:col.color,opacity:.8,marginTop:2}}>
                  {col.exps.length} exp · ${fmt(col.exps.reduce((s,e)=>s+calcVenta(e),0))}
                </div>
              </div>
              <div style={{padding:10,display:"flex",flexDirection:"column",gap:8,maxHeight:500,overflowY:"auto"}}>
                {col.exps.length===0&&<div style={{textAlign:"center",color:"#B0BEC5",fontSize:11,padding:16}}>Sin expedientes</div>}
                {col.exps.map(e=>{
                  const adv = advisors.find(a=>a.id===e.advisorId);
                  const venta = calcVenta(e);
                  return (
                    <div key={e.id} style={{background:"#F8FAFF",border:"1px solid #E8EDF5",borderRadius:7,padding:10}}>
                      <div style={{fontSize:11,fontWeight:700,color:B.dark,marginBottom:3}}>{e.clientName||"Sin cliente"}</div>
                      <div style={{fontSize:10,color:"#546E7A",marginBottom:5}}>{e.trip?.destination||"Sin destino"}</div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:9,background:col.bg,color:col.color,padding:"1px 6px",borderRadius:4,fontWeight:700}}>{adv?.name?.split(" ")[0]||"—"}</span>
                        <span style={{fontSize:11,fontWeight:800,color:B.blue}}>${fmt(venta)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DETALLE VIEW */}
      {view==="detalle" && (
        <div style={{background:"#fff",border:"1px solid #E0E0E0",borderRadius:10,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{background:"#F5F7FA"}}>
                {["No.","Cliente","Destino","Asesor","Fecha","Venta","Estado"].map(h=>(
                  <th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:"#546E7A"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0&&(
                <tr><td colSpan={7} style={{padding:40,textAlign:"center",color:"#B0BEC5"}}>Sin expedientes en este período</td></tr>
              )}
              {filtered.map(e=>{
                const adv   = advisors.find(a=>a.id===e.advisorId);
                const venta = calcVenta(e);
                const ST    = {nuevo:{c:"#1565C0",bg:"#E3F2FD"},activo:{c:"#F57F17",bg:"#FFF8E1"},cerrado:{c:"#2E7D32",bg:"#E8F5E9"},anulado:{c:"#546E7A",bg:"#ECEFF1"}};
                const st    = ST[e.status]||ST.nuevo;
                return (
                  <tr key={e.id} style={{borderTop:"1px solid #F0F0F0"}}>
                    <td style={{padding:"9px 12px",fontWeight:700,color:B.blue}}>#{e.no}</td>
                    <td style={{padding:"9px 12px",fontWeight:600}}>{e.clientName||"—"}</td>
                    <td style={{padding:"9px 12px",color:"#546E7A"}}>{e.trip?.destination||"—"}</td>
                    <td style={{padding:"9px 12px",fontSize:11}}>{adv?.name?.split(" ")[0]||"—"}</td>
                    <td style={{padding:"9px 12px",color:"#546E7A",fontSize:11}}>{e.trip?.dateFrom||"—"}</td>
                    <td style={{padding:"9px 12px",fontWeight:800,color:B.blue}}>${fmt(venta)}</td>
                    <td style={{padding:"9px 12px"}}>
                      <span style={{background:st.bg,color:st.c,padding:"2px 8px",borderRadius:8,fontSize:10,fontWeight:700}}>{e.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── COMISIONES MODULE ────────────────────────────────────────────────────────
function ComisionesModule({ expedientes, advisors, user }) {
  const [period,  setPeriod]  = useState("mes");
  const [selAdv,  setSelAdv]  = useState("todos");
  const COM_PCT = 0.08; // 8% comisión estándar

  const now    = new Date();
  const mesKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  const filterExp = exp => {
    const d   = exp.trip?.dateFrom || "";
    const key = period==="mes" ? d.slice(0,7) : d.slice(0,4);
    const inPeriod = period==="mes" ? key===mesKey : d.slice(0,4)===String(now.getFullYear());
    const inAdv    = selAdv==="todos" || exp.advisorId===selAdv;
    return inPeriod && inAdv && exp.status==="cerrado";
  };

  const filtered = expedientes.filter(filterExp);

  const calcVenta  = exp => (exp.items||[]).reduce((s,it)=>s+(parseFloat(it.base)||0)+(parseFloat(it.iva)||0)+(parseFloat(it.tua)||0)+(parseFloat(it.others)||0),0);
  const calcComision = exp => calcVenta(exp) * COM_PCT;

  const totalVenta    = filtered.reduce((s,e)=>s+calcVenta(e),0);
  const totalComision = filtered.reduce((s,e)=>s+calcComision(e),0);

  const byAdvisor = advisors.map(adv => {
    const advExps = filtered.filter(e=>e.advisorId===adv.id);
    const venta   = advExps.reduce((s,e)=>s+calcVenta(e),0);
    const com     = advExps.reduce((s,e)=>s+calcComision(e),0);
    return { ...adv, exps:advExps.length, venta, com, items:advExps };
  }).filter(a=>a.exps>0).sort((a,b)=>b.com-a.com);

  return (
    <div style={{padding:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:B.dark}}>Comisiones Generadas</div>
          <div style={{fontSize:11,color:"#546E7A",marginTop:2}}>Solo expedientes cerrados · Comisión {COM_PCT*100}%</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <div style={{display:"flex",gap:3,background:"#F1F5F9",padding:3,borderRadius:8}}>
            {[{id:"mes",label:"Este mes"},{id:"ano",label:"Este año"}].map(p=>(
              <button key={p.id} onClick={()=>setPeriod(p.id)}
                style={{padding:"6px 14px",borderRadius:6,border:"none",background:period===p.id?"#fff":"transparent",color:period===p.id?B.dark:"#546E7A",fontWeight:period===p.id?700:500,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                {p.label}
              </button>
            ))}
          </div>
          <select value={selAdv} onChange={e=>setSelAdv(e.target.value)}
            style={{...SI,padding:"6px 12px",fontSize:12,width:160}}>
            <option value="todos">Todos los asesores</option>
            {advisors.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
        {[
          {label:"Venta total cerrada", val:`$${fmt(totalVenta)}`,    c:B.blue,  icon:"💰"},
          {label:"Comisión total",      val:`$${fmt(totalComision)}`, c:B.gold,  icon:"⭐"},
          {label:"Expedientes cerrados",val:String(filtered.length),  c:B.green, icon:"✅"},
        ].map(k=>(
          <div key={k.label} style={{background:"#fff",border:"1px solid #E0E0E0",borderRadius:10,padding:20,display:"flex",alignItems:"center",gap:14}}>
            <div style={{fontSize:32}}>{k.icon}</div>
            <div>
              <div style={{fontSize:11,color:"#546E7A"}}>{k.label}</div>
              <div style={{fontSize:24,fontWeight:900,color:k.c}}>{k.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* By advisor table */}
      <div style={{background:"#fff",border:"1px solid #E0E0E0",borderRadius:10,overflow:"hidden",marginBottom:16}}>
        <div style={{padding:"12px 16px",borderBottom:"1px solid #F0F0F0",fontSize:13,fontWeight:800,color:B.dark}}>
          Comisiones por asesor
        </div>
        {byAdvisor.length===0 ? (
          <div style={{textAlign:"center",padding:40,color:"#B0BEC5",fontSize:12}}>Sin expedientes cerrados en este período</div>
        ) : (
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{background:"#F5F7FA"}}>
                {["Asesor","Exp. cerrados","Venta total",`Comisión (${COM_PCT*100}%)`,"%"].map(h=>(
                  <th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:"#546E7A"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byAdvisor.map(adv=>(
                <tr key={adv.id} style={{borderTop:"1px solid #F0F0F0"}}>
                  <td style={{padding:"10px 12px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:28,height:28,borderRadius:"50%",background:B.blue,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800}}>{adv.avatar}</div>
                      <span style={{fontWeight:600}}>{adv.name}</span>
                    </div>
                  </td>
                  <td style={{padding:"10px 12px"}}>{adv.exps}</td>
                  <td style={{padding:"10px 12px",fontWeight:700,color:B.blue}}>${fmt(adv.venta)}</td>
                  <td style={{padding:"10px 12px",fontWeight:900,color:B.gold,fontSize:14}}>${fmt(adv.com)}</td>
                  <td style={{padding:"10px 12px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{background:"#F1F5F9",borderRadius:4,height:6,width:80,overflow:"hidden"}}>
                        <div style={{width:`${totalComision>0?(adv.com/totalComision)*100:0}%`,height:"100%",background:B.gold,borderRadius:4}}/>
                      </div>
                      <span style={{fontSize:11,color:"#546E7A"}}>{totalComision>0?Math.round((adv.com/totalComision)*100):0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail per advisor */}
      {selAdv!=="todos" && (
        <div style={{background:"#fff",border:"1px solid #E0E0E0",borderRadius:10,overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:"1px solid #F0F0F0",fontSize:13,fontWeight:800,color:B.dark}}>
            Detalle de expedientes
          </div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{background:"#F5F7FA"}}>
                {["No.","Cliente","Destino","Venta","Comisión"].map(h=>(
                  <th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:"#546E7A"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.filter(e=>e.advisorId===selAdv).map(e=>(
                <tr key={e.id} style={{borderTop:"1px solid #F0F0F0"}}>
                  <td style={{padding:"8px 12px",fontWeight:700,color:B.blue}}>#{e.no}</td>
                  <td style={{padding:"8px 12px"}}>{e.clientName||"—"}</td>
                  <td style={{padding:"8px 12px",color:"#546E7A"}}>{e.trip?.destination||"—"}</td>
                  <td style={{padding:"8px 12px",fontWeight:700,color:B.blue}}>${fmt(calcVenta(e))}</td>
                  <td style={{padding:"8px 12px",fontWeight:800,color:B.gold}}>${fmt(calcComision(e))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
// ─── USERS & ROLES ───────────────────────────────────────────────────────────
const ROLES = {
  asesor:     { label:"Asesor",      color:"#1565C0", bg:"#E3F2FD", icon:"👤" },
  supervisor: { label:"Supervisor",  color:"#2E7D32", bg:"#E8F5E9", icon:"👁️" },
  admin:      { label:"Administrador",color:"#F57F17", bg:"#FFF8E1", icon:"⚙️" },
  superadmin: { label:"Super Admin", color:"#7B1FA2", bg:"#F3E5F5", icon:"🔑" },
};

// Permissions per role: which NAV ids are accessible
const ROLE_PERMS = {
  asesor: {
    nav:    ["expedientes","cotizaciones","clientes"],
    canSeeOwnOnly: true,   // only own expedientes
    canEditPrices: false,
    canSeeReports: false,
    canManageUsers: false,
    canDeleteRecords: false,
    canSeeCxC: false,
    canSeeCxP: false,
    canSeeGroups: false,
  },
  supervisor: {
    nav:    ["expedientes","cotizaciones","ventas","clientes","grp-create","cxc-cli"],
    canSeeOwnOnly: false,
    canEditPrices: true,
    canSeeReports: true,
    canManageUsers: false,
    canDeleteRecords: false,
    canSeeCxC: true,
    canSeeCxP: false,
    canSeeGroups: true,
  },
  admin: {
    nav:    ["expedientes","cotizaciones","ventas","comisiones","clientes","mayoristas","cuentas","gastos","cxc-cli","cxc-com","cxp-may","cxp-gas","pagos-cli","pagos-may","reporte-ventas","reporte-com","reporte-prod","bancos","grp-create","grp-camps","grp-cxp","grp-may","grp-cxc","grp-com"],
    canSeeOwnOnly: false,
    canEditPrices: true,
    canSeeReports: true,
    canManageUsers: false,
    canDeleteRecords: true,
    canSeeCxC: true,
    canSeeCxP: true,
    canSeeGroups: true,
  },
  superadmin: {
    nav:    null, // all
    canSeeOwnOnly: false,
    canEditPrices: true,
    canSeeReports: true,
    canManageUsers: true,
    canDeleteRecords: true,
    canSeeCxC: true,
    canSeeCxP: true,
    canSeeGroups: true,
  },
};

const USERS = [
  { id:"1", advisorId:"1", name:"Zenen Duartes",  email:"zenen@traveladvisorspty.net",  role:"superadmin", password:"1234", avatar:"Z" },
  { id:"2", advisorId:"2", name:"Cristy López",   email:"cristy@traveladvisorspty.net", role:"asesor",     password:"1234", avatar:"C" },
  { id:"3", advisorId:"3", name:"Irvin Méndez",   email:"irvin@traveladvisorspty.net",  role:"asesor",     password:"1234", avatar:"I" },
  { id:"4", advisorId:"4", name:"Leidis García",  email:"leidis@traveladvisorspty.net", role:"supervisor", password:"1234", avatar:"L" },
  { id:"5", advisorId:"5", name:"Admin Sistema",  email:"admin@traveladvisorspty.net",  role:"admin",      password:"admin", avatar:"A" },
];

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const attempt = async () => {
    setError(""); setLoading(true);
    const user = await onLogin(email, password);
    if (!user) { setError("Correo o contrasena incorrectos."); }
    setLoading(false);
  };

  const handleKey = e => { if (e.key==="Enter") attempt(); };

  return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(135deg, ${B.dark} 0%, #1A237E 50%, #283593 100%)`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      {/* Background pattern */}
      <div style={{ position:"absolute", inset:0, opacity:.05, backgroundImage:"repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)", backgroundSize:"20px 20px" }}/>

      <div style={{ position:"relative", width:"min(420px,92vw)" }}>
        {/* Logo card */}
        <div style={{ background:"rgba(255,255,255,.97)", borderRadius:16, boxShadow:"0 24px 64px rgba(0,0,0,.35)", overflow:"hidden" }}>
          {/* Header band */}
          <div style={{ background:`linear-gradient(135deg, ${B.blue}, ${B.dark})`, padding:"32px 32px 24px", textAlign:"center" }}>
            <div style={{ display:"flex", justifyContent:"center", marginBottom:10 }}>
              <VSLogo size="lg" variant="light" showTagline={true}/>
            </div>
          </div>

          {/* Form */}
          <div style={{ padding:"28px 32px 32px" }}>
            <div style={{ marginBottom:20, textAlign:"center" }}>
              <div style={{ fontSize:15, fontWeight:700, color:"#263238" }}>Iniciar sesión</div>
              <div style={{ fontSize:11, color:"#90A4AE", marginTop:3 }}>Ingresa tus credenciales para continuar</div>
            </div>

            {/* Email */}
            <div style={{ marginBottom:14 }}>
              <label style={{ ...LB, marginBottom:5 }}>Correo electrónico</label>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:14, color:"#90A4AE" }}>✉️</span>
                <input value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={handleKey}
                  placeholder="correo@tuagencia.com" type="email"
                  style={{ ...SI, paddingLeft:34, fontSize:12 }}
                  onFocus={e=>e.target.style.borderColor=B.blue} onBlur={e=>e.target.style.borderColor="#CFD8DC"}/>
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                <label style={LB}>Contraseña</label>
                <span style={{ fontSize:9, color:B.blue, cursor:"pointer" }}>¿Olvidaste tu contraseña?</span>
              </div>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:14, color:"#90A4AE" }}>🔒</span>
                <input value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={handleKey}
                  placeholder="••••••••" type={showPass?"text":"password"}
                  style={{ ...SI, paddingLeft:34, paddingRight:36, fontSize:12 }}
                  onFocus={e=>e.target.style.borderColor=B.blue} onBlur={e=>e.target.style.borderColor="#CFD8DC"}/>
                <button onClick={()=>setShowPass(p=>!p)}
                  style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:14, color:"#90A4AE" }}>
                  {showPass?"?":"👁️"}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background:"#FFEBEE", border:"1px solid #FFCDD2", borderRadius:6, padding:"8px 12px", marginBottom:14, fontSize:11, color:B.red, display:"flex", gap:7, alignItems:"center" }}>
                ❌ {error}
              </div>
            )}

            {/* Submit */}
            <button onClick={attempt} disabled={loading||!email||!password}
              style={{ width:"100%", padding:"11px 0", background:(loading||!email||!password) ? "#90CAF9" : ("linear-gradient(135deg,"+B.blue+","+B.dark+")"), color:"#fff", border:"none", borderRadius:7, fontWeight:800, fontSize:13, cursor:loading||!email||!password?"not-allowed":"pointer", fontFamily:"inherit", transition:"all .2s", letterSpacing:.3 }}>
              {loading ? "⏳ Verificando..." : "Ingresar →"}
            </button>
          </div>
        </div>

        <div style={{ textAlign:"center", marginTop:14, color:"rgba(255,255,255,.45)", fontSize:10 }}>
          VíaSuite · viasuite.app · El sistema para agencias de viajes
        </div>
      </div>
    </div>
  );
}

// ─── USER PANEL (avatar menu) ─────────────────────────────────────────────────
function UserMenu({ user, onLogout, onProfile }) {
  const [open, setOpen] = useState(false);
  const role = ROLES[user.role];
  return (
    <div style={{ position:"relative" }}>
      <div onClick={()=>setOpen(p=>!p)}
        style={{ display:"flex", alignItems:"center", gap:7, cursor:"pointer", padding:"4px 8px", borderRadius:6, background:open?"rgba(255,255,255,.15)":"transparent" }}>
        <div style={{ width:28, height:28, borderRadius:"50%", background:`linear-gradient(135deg,${role.color},${B.dark})`, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:12, flexShrink:0 }}>{user.avatar}</div>
        <div style={{ display:"flex", flexDirection:"column" }}>
          <span style={{ fontSize:11, fontWeight:700, color:"#fff", lineHeight:1.2 }}>{user.name.split(" ")[0]}</span>
          <span style={{ fontSize:8, color:"rgba(255,255,255,.6)", lineHeight:1 }}>{role.label}</span>
        </div>
        <span style={{ fontSize:9, color:"rgba(255,255,255,.5)" }}>▾</span>
      </div>
      {open && (
        <>
          <div onClick={()=>setOpen(false)} style={{ position:"fixed", inset:0, zIndex:998 }}/>
          <div style={{ position:"absolute", right:0, top:"calc(100% + 6px)", background:"#fff", borderRadius:8, boxShadow:"0 8px 24px rgba(0,0,0,.2)", minWidth:220, zIndex:999, overflow:"hidden" }}>
            {/* Profile header */}
            <div style={{ padding:"14px 16px", borderBottom:"1px solid #F0F0F0", background:`linear-gradient(135deg,${B.dark},${B.blue})`, color:"#fff" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:"50%", background:"rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:15 }}>{user.avatar}</div>
                <div>
                  <div style={{ fontWeight:700, fontSize:12 }}>{user.name}</div>
                  <div style={{ fontSize:9, opacity:.7 }}>{user.email}</div>
                  <span style={{ fontSize:8, background:"rgba(255,255,255,.2)", padding:"1px 7px", borderRadius:8, fontWeight:700, marginTop:2, display:"inline-block" }}>{role.icon} {role.label}</span>
                </div>
              </div>
            </div>
            {/* Menu items */}
            {[
              { icon:"👤", label:"Mi perfil",        action: onProfile },
              { icon:"🔐", label:"Cambiar contraseña", action: ()=>setOpen(false) },
              { icon:"⚙️", label:"Configuración",     action: ()=>setOpen(false) },
            ].map(item=>(
              <div key={item.label} onClick={()=>{item.action();setOpen(false);}}
                style={{ padding:"9px 16px", display:"flex", alignItems:"center", gap:9, cursor:"pointer", fontSize:11, color:"#263238" }}
                onMouseEnter={e=>e.currentTarget.style.background="#F5F5F5"}
                onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                <span>{item.icon}</span>{item.label}
              </div>
            ))}
            <div style={{ borderTop:"1px solid #F0F0F0" }}>
              <div onClick={()=>{onLogout();setOpen(false);}}
                style={{ padding:"9px 16px", display:"flex", alignItems:"center", gap:9, cursor:"pointer", fontSize:11, color:B.red }}
                onMouseEnter={e=>e.currentTarget.style.background="#FFEBEE"}
                onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                🚪 Cerrar sesión
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── USER MANAGEMENT (Super Admin only) ──────────────────────────────────────
function UserManagement({ currentUser }) {
  const [users, setUsers] = useState(USERS.map(u=>({...u})));
  const [editing, setEditing] = useState(null);
  const [toast, setToast]     = useState("");

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(""),2500); };
  const save = u => {
    setUsers(p=>{ const i=p.findIndex(x=>x.id===u.id); if(i>=0){const n=[...p];n[i]=u;return n;} return[u,...p]; });
    setEditing(null); showToast("Usuario guardado");
  };

  if (editing) {
    const upd = (f,v) => setEditing(p=>({...p,[f]:v}));
    return (
      <div style={{ padding:18, maxWidth:600, margin:"0 auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h2 style={{ margin:0, fontSize:16, color:B.dark, fontWeight:800 }}>{editing.name||"Nuevo usuario"}</h2>
          <div style={{ display:"flex", gap:6 }}>
            <Btn v="primary" sz="sm" onClick={()=>save(editing)}>💾 Guardar</Btn>
            <Btn v="secondary" sz="sm" onClick={()=>setEditing(null)}>&larr; Cancelar</Btn>
          </div>
        </div>
        <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:7, padding:16, display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <FI label="Nombre completo" value={editing.name}   onChange={v=>upd("name",v)}/>
            <FI label="Email *"         value={editing.email}  onChange={v=>upd("email",v)} type="email"/>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            <FS label="Rol *" value={editing.role} onChange={v=>upd("role",v)}
              options={Object.entries(ROLES).map(([k,r])=>({value:k,label:`${r.icon} ${r.label}`}))}/>
            <FS label="Asesor vinculado" value={editing.advisorId} onChange={v=>upd("advisorId",v)}
              options={ADVISORS.map(a=>({value:a.id,label:a.name}))}/>
            <FI label="Contraseña" value={editing.password} onChange={v=>upd("password",v)} type="password"/>
          </div>
          {/* Role preview */}
          {editing.role && (
            <div style={{ background:"#F0F4FF", border:"1px solid #C5CAE9", borderRadius:6, padding:"10px 14px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:B.dark, marginBottom:7 }}>
                {ROLES[editing.role].icon} Permisos del rol: {ROLES[editing.role].label}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5, fontSize:10 }}>
                {[
                  { label:"Ver solo sus expedientes",  val: ROLE_PERMS[editing.role]?.canSeeOwnOnly },
                  { label:"Editar precios",            val: ROLE_PERMS[editing.role]?.canEditPrices },
                  { label:"Ver reportes",              val: ROLE_PERMS[editing.role]?.canSeeReports },
                  { label:"Módulo Grupos",             val: ROLE_PERMS[editing.role]?.canSeeGroups },
                  { label:"Cuentas x Cobrar",         val: ROLE_PERMS[editing.role]?.canSeeCxC },
                  { label:"Cuentas x Pagar",          val: ROLE_PERMS[editing.role]?.canSeeCxP },
                  { label:"Eliminar registros",       val: ROLE_PERMS[editing.role]?.canDeleteRecords },
                  { label:"Gestionar usuarios",       val: ROLE_PERMS[editing.role]?.canManageUsers },
                ].map(p=>(
                  <div key={p.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <span style={{ fontSize:11 }}>{p.val?"✅":"❌"}</span>
                    <span style={{ color: p.val?B.green:"#90A4AE" }}>{p.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding:18, maxWidth:900, margin:"0 auto" }}>
      {toast&&<div style={{ position:"fixed", top:55, right:16, zIndex:9999, background:B.green, color:"#fff", borderRadius:6, padding:"8px 14px", fontSize:11, fontWeight:700 }}>✅ {toast}</div>}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <h2 style={{ margin:0, fontSize:16, color:B.dark, fontWeight:800 }}>⚙️ Gestión de Usuarios y Roles</h2>
        <Btn v="teal" onClick={()=>setEditing({ id:uid(), name:"", email:"", role:"asesor", advisorId:"1", password:"", avatar:"U" })}>+ Nuevo usuario</Btn>
      </div>

      {/* Role legend */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:14 }}>
        {Object.entries(ROLES).map(([k,r])=>(
          <div key={k} style={{ background:"#fff", border:`2px solid ${r.color}22`, borderRadius:7, padding:"10px 12px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:7 }}>
              <span style={{ fontSize:16 }}>{r.icon}</span>
              <span style={{ fontWeight:800, fontSize:11, color:r.color }}>{r.label}</span>
            </div>
            <div style={{ fontSize:9, color:"#546E7A", lineHeight:1.6 }}>
              {k==="asesor"&&"Solo ve sus propios expedientes. Sin acceso a reportes ni finanzas."}
              {k==="supervisor"&&"Ve todos los expedientes. Acceso a CxC y Grupos. Sin configuración."}
              {k==="admin"&&"Acceso completo excepto gestión de usuarios. Ve todos los módulos."}
              {k==="superadmin"&&"Acceso total al sistema. Gestiona usuarios y roles. Sin restricciones."}
            </div>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:7, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
          <thead><tr style={{ background:B.dark, color:"#fff" }}>
            {["","Usuario","Email","Rol","Asesor vinculado","Permisos clave",""].map(h=>(
              <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:10, fontWeight:700 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {users.map((u,i)=>{
              const role=ROLES[u.role];
              const perms=ROLE_PERMS[u.role];
              const adv=ADVISORS.find(a=>a.id===u.advisorId);
              const isMe=u.id===currentUser.id;
              return (
                <tr key={u.id} style={{ background:isMe?"#E3F2FD":i%2===0?"#fff":"#FAFAFA", borderBottom:"1px solid #F0F0F0" }}>
                  <td style={{ padding:"9px 12px" }}>
                    <div style={{ width:32, height:32, borderRadius:"50%", background:`linear-gradient(135deg,${role.color},${B.dark})`, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:13 }}>{u.avatar}</div>
                  </td>
                  <td style={{ padding:"9px 12px" }}>
                    <div style={{ fontWeight:700, color:"#263238" }}>{u.name}</div>
                    {isMe&&<span style={{ fontSize:8, background:"#E3F2FD", color:B.blue, padding:"1px 5px", borderRadius:4, fontWeight:700 }}>TÚ</span>}
                  </td>
                  <td style={{ padding:"9px 12px", color:"#546E7A", fontSize:10 }}>{u.email}</td>
                  <td style={{ padding:"9px 12px" }}>
                    <span style={{ background:role.bg, color:role.color, padding:"3px 9px", borderRadius:10, fontSize:9, fontWeight:700 }}>{role.icon} {role.label}</span>
                  </td>
                  <td style={{ padding:"9px 12px", color:"#546E7A", fontSize:10 }}>{adv?.name||"–"}</td>
                  <td style={{ padding:"9px 12px" }}>
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                      {perms?.canSeeReports&&<span style={{ fontSize:8, background:"#E8F5E9", color:B.green, padding:"1px 5px", borderRadius:4, fontWeight:700 }}>Reportes</span>}
                      {perms?.canSeeCxC&&<span style={{ fontSize:8, background:"#E3F2FD", color:B.blue, padding:"1px 5px", borderRadius:4, fontWeight:700 }}>CxC</span>}
                      {perms?.canSeeCxP&&<span style={{ fontSize:8, background:"#FFF8E1", color:B.gold, padding:"1px 5px", borderRadius:4, fontWeight:700 }}>CxP</span>}
                      {perms?.canManageUsers&&<span style={{ fontSize:8, background:"#F3E5F5", color:"#7B1FA2", padding:"1px 5px", borderRadius:4, fontWeight:700 }}>Usuarios</span>}
                      {perms?.canSeeOwnOnly&&<span style={{ fontSize:8, background:"#FFEBEE", color:B.red, padding:"1px 5px", borderRadius:4, fontWeight:700 }}>Solo propios</span>}
                    </div>
                  </td>
                  <td style={{ padding:"9px 12px" }}>
                    <Btn v="secondary" sz="sm" onClick={()=>setEditing({...u})}>✏️ Editar</Btn>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ACCESS DENIED ────────────────────────────────────────────────────────────
function AccessDenied({ pageName }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:60, color:"#90A4AE", textAlign:"center", minHeight:400 }}>
      <div style={{ fontSize:52, marginBottom:14 }}>🔒</div>
      <div style={{ fontSize:16, fontWeight:700, color:B.red, marginBottom:7 }}>Acceso restringido</div>
      <div style={{ fontSize:12, color:"#B0BEC5", maxWidth:320 }}>
        No tienes permisos para acceder a <b>{pageName}</b>.<br/>
        Contacta al administrador si necesitas acceso.
      </div>
    </div>
  );
}

// ─── HOTELBEDS - BUSCADOR DE HOTELES ─────────────────────────────────────────
const HB_PROXY  = "/.netlify/functions/hotelbeds";
const RH_PROXY  = "/.netlify/functions/ratehawk";   // ready when key arrives
const W2M_PROXY = "/.netlify/functions/w2m";         // ready when key arrives

// Consolidator config
const CONSOLIDATORS = [
  { id:"hb",  name:"Hotelbeds", color:"#1565C0", bg:"#E3F2FD", active:true  },
  { id:"rh",  name:"RateHawk",  color:"#2E7D32", bg:"#E8F5E9", active:false },
  { id:"w2m", name:"W2M",       color:"#E65100", bg:"#FBE9E7", active:false },
];

const POPULAR_DESTINATIONS = [
  { code:"PMR", name:"Panama City, Panama" },
  { code:"CUN", name:"Cancun, Mexico" },
  { code:"PUJ", name:"Punta Cana, Republica Dominicana" },
  { code:"MIA", name:"Miami, Florida, USA" },
  { code:"MCO", name:"Orlando, Florida, USA" },
  { code:"CDG", name:"Paris, Francia" },
  { code:"BCN", name:"Barcelona, Espana" },
  { code:"MAD", name:"Madrid, Espana" },
  { code:"FCO", name:"Roma, Italia" },
  { code:"LGW", name:"Londres, Reino Unido" },
  { code:"BOG", name:"Bogota, Colombia" },
  { code:"LIM", name:"Lima, Peru" },
  { code:"GRU", name:"Sao Paulo, Brasil" },
  { code:"EZE", name:"Buenos Aires, Argentina" },
];

async function hbSearch(params) {
  const res = await fetch(HB_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Error " + res.status);
  return res.json();
}

// Search all active consolidators and merge results by hotel name
async function searchAllConsolidators(params) {
  const results = { hb:[], rh:[], w2m:[] };

  // Hotelbeds (always active)
  try {
    const data = await hbSearch({ action:"search", ...params });
    results.hb = (data?.hotels?.hotels || []).map(h => ({
      id:        h.code,
      name:      h.name,
      category:  parseInt(h.categoryCode) || 3,
      zone:      h.zoneName || "",
      minRate:   parseFloat(h.minRate) || 0,
      currency:  "USD",
      rooms:     h.rooms || [],
      raw:       h,
      source:    "hb",
    }));
  } catch(e) { console.warn("HB error:", e.message); }

  // RateHawk (stub - activates when key is configured)
  if (false) { // change to: if (RH_KEY_CONFIGURED)
    try {
      const res = await fetch(RH_PROXY, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(params) });
      const data = await res.json();
      results.rh = (data?.data?.hotels || []).map(h => ({
        id:       h.id,
        name:     h.name,
        category: h.star_rating || 3,
        zone:     h.region?.name || "",
        minRate:  parseFloat(h.rates?.[0]?.daily_prices?.[0]) || 0,
        currency: "USD",
        rooms:    h.rates || [],
        raw:      h,
        source:   "rh",
      }));
    } catch(e) { console.warn("RH error:", e.message); }
  }

  // W2M (stub - activates when key is configured)
  if (false) { // change to: if (W2M_KEY_CONFIGURED)
    try {
      const res = await fetch(W2M_PROXY, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(params) });
      const data = await res.json();
      results.w2m = (data?.hotels || []).map(h => ({
        id:       h.hotelCode,
        name:     h.hotelName,
        category: h.categoryCode || 3,
        zone:     h.zoneName || "",
        minRate:  parseFloat(h.minRate) || 0,
        currency: "USD",
        rooms:    h.rooms || [],
        raw:      h,
        source:   "w2m",
      }));
    } catch(e) { console.warn("W2M error:", e.message); }
  }

  // Merge: group by normalized hotel name
  const allHotels = [...results.hb, ...results.rh, ...results.w2m];
  const merged = {};

  allHotels.forEach(h => {
    // Normalize name for grouping
    const key = h.name.toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,20);
    if (!merged[key]) {
      merged[key] = {
        name:     h.name,
        category: h.category,
        zone:     h.zone,
        prices:   {},
        cheapest: null,
      };
    }
    merged[key].prices[h.source] = h;
    // Track cheapest
    if (!merged[key].cheapest || h.minRate < merged[key].prices[merged[key].cheapest]?.minRate) {
      merged[key].cheapest = h.source;
    }
  });

  return Object.values(merged).sort((a,b) => {
    const aMin = Math.min(...Object.values(a.prices).map(p => p.minRate).filter(Boolean));
    const bMin = Math.min(...Object.values(b.prices).map(p => p.minRate).filter(Boolean));
    return aMin - bMin;
  });
}

function HotelBuscador({ onSelectHotel }) {
  const [destCode,   setDestCode]   = useState("");
  const [destName,   setDestName]   = useState("");
  const [destQuery,  setDestQuery]  = useState("");
  const [destSuggs,  setDestSuggs]  = useState([]);
  const [destLoading,setDestLoading]= useState(false);
  const [showSuggs,  setShowSuggs]  = useState(false);
  const [checkIn,    setCheckIn]    = useState("");
  const [checkOut,   setCheckOut]   = useState("");
  const [rooms,      setRooms]      = useState(1);
  const [adults,     setAdults]     = useState(2);
  const [children,   setChildren]   = useState(0);
  const [minCat,     setMinCat]     = useState(3);
  const [results,    setResults]    = useState([]); // merged multi-consolidator
  const [loading,    setLoading]    = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error,      setError]      = useState("");
  const [searched,   setSearched]   = useState(false);
  const [selected,   setSelected]   = useState(null); // { hotel, source }
  const [margin,     setMargin]     = useState(18);

  const nights = checkIn && checkOut
    ? Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000) : 0;

  const getPub = net => +(net * (1 + margin / 100)).toFixed(2);
  const stars  = n   => "★".repeat(parseInt(n)||3) + "☆".repeat(5-(parseInt(n)||3));

  // Search destinations
  const searchDest = async (q) => {
    setDestQuery(q); setDestCode("");
    if (q.length < 2) { setDestSuggs([]); setShowSuggs(false); return; }
    setDestLoading(true);
    try {
      const data = await hbSearch({ action:"destinations", query:q });
      const items = data?.destinations?.destinations || data?.data || [];
      setDestSuggs(items.slice(0,12));
      setShowSuggs(true);
    } catch(e) {
      const filtered = POPULAR_DESTINATIONS.filter(d => d.name.toLowerCase().includes(q.toLowerCase()))
        .map(d => ({ code:d.code, name:{ content:d.name }, countryCode:"" }));
      setDestSuggs(filtered);
      setShowSuggs(filtered.length > 0);
    }
    setDestLoading(false);
  };

  const selectDest = (d) => {
    const name = d.name?.content || d.name || d.code;
    setDestCode(d.code); setDestName(name); setDestQuery(name);
    setShowSuggs(false); setDestSuggs([]);
  };

  const search = async () => {
    if (!destCode) { setError("Escribe y selecciona un destino"); return; }
    if (!checkIn || !checkOut) { setError("Ingresa las fechas"); return; }
    if (nights <= 0) { setError("Fecha de salida debe ser posterior al check-in"); return; }
    setError(""); setLoading(true); setResults([]); setSearched(false); setSelected(null);
    setLoadingMsg("Consultando Hotelbeds...");
    try {
      const merged = await searchAllConsolidators({
        destinationCode: destCode, checkIn, checkOut,
        rooms, adults, children, minCategory: minCat, maxHotels: 30,
      });
      setResults(merged);
      setSearched(true);
      if (merged.length === 0) setError("Sin disponibilidad para estas fechas.");
    } catch(e) {
      setError("Error al buscar: " + e.message);
    }
    setLoading(false); setLoadingMsg("");
  };

  // Detail view for a specific hotel+source
  if (selected) {
    const h       = selected.prices[selected.source];
    const net     = h?.minRate || 0;
    const pub     = getPub(net);
    const netTot  = +(net * nights * rooms).toFixed(2);
    const pubTot  = +(pub * nights * rooms).toFixed(2);
    const com     = +(pubTot - netTot).toFixed(2);
    const src     = CONSOLIDATORS.find(c => c.id===selected.source) || CONSOLIDATORS[0];

    return (
      <div style={{ padding:16 }}>
        <button onClick={() => setSelected(null)}
          style={{ background:"#ECEFF1", border:"none", borderRadius:5, padding:"5px 12px", cursor:"pointer", fontSize:11, marginBottom:14, fontFamily:"inherit" }}>
          &larr; Volver a resultados
        </button>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:14 }}>
          <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:8, overflow:"hidden" }}>
            <div style={{ background:B.dark, color:"#fff", padding:"12px 16px" }}>
              <div style={{ fontSize:15, fontWeight:800 }}>{selected.name}</div>
              <div style={{ fontSize:11, opacity:.8, marginTop:2 }}>
                {stars(selected.category)} &middot; {selected.zone||destName}
                &nbsp;&nbsp;
                <span style={{ background:src.color, padding:"1px 8px", borderRadius:8, fontSize:9, fontWeight:800 }}>{src.name}</span>
              </div>
            </div>

            {/* Prices from all consolidators */}
            <div style={{ padding:"12px 16px", borderBottom:"1px solid #F0F0F0" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#546E7A", marginBottom:8, textTransform:"uppercase" }}>Comparativa de precios</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                {CONSOLIDATORS.map(con => {
                  const p = selected.prices[con.id];
                  const isSelected = con.id === selected.source;
                  const isCheapest = con.id === selected.cheapest;
                  return (
                    <div key={con.id} onClick={() => p && setSelected({...selected, source:con.id})}
                      style={{ border:`2px solid ${isSelected?con.color:"#E0E0E0"}`, borderRadius:7, padding:"10px 12px", textAlign:"center",
                        background: isSelected ? con.bg : "#F8F9FA", cursor: p ? "pointer" : "default",
                        opacity: p ? 1 : 0.5 }}>
                      <div style={{ fontSize:9, fontWeight:800, color:con.color, marginBottom:4 }}>{con.name}</div>
                      {p ? (
                        <>
                          <div style={{ fontSize:16, fontWeight:900, color:con.color }}>${getPub(p.minRate).toFixed(2)}</div>
                          <div style={{ fontSize:8, color:"#546E7A" }}>por noche</div>
                          {isCheapest && <div style={{ fontSize:8, background:B.green, color:"#fff", borderRadius:8, padding:"1px 6px", marginTop:4, fontWeight:800 }}>MAS BARATO</div>}
                          {!con.active && <div style={{ fontSize:8, color:"#90A4AE", marginTop:2 }}>Simulado</div>}
                        </>
                      ) : (
                        <div style={{ fontSize:10, color:"#B0BEC5" }}>{con.active ? "No disp." : "Próximamente"}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rate details */}
            <div style={{ padding:"12px 16px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#546E7A", marginBottom:8, textTransform:"uppercase" }}>Tarifas disponibles — {src.name}</div>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
                <thead><tr style={{ background:"#F5F7FA" }}>
                  {["Habitacion","Plan","Neta/noche","Publica/noche","Total neto","Total publico",""].map(hd=>(
                    <th key={hd} style={{ padding:"5px 7px", textAlign:"left", fontSize:9, fontWeight:700, color:"#546E7A" }}>{hd}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {(h?.raw?.rooms||h?.raw?.rates||[]).slice(0,6).flatMap((r,ri) => {
                    const rates = r.rates || [r];
                    return rates.slice(0,2).map((rate,i) => {
                      const rNet = parseFloat(rate.net || rate.price || h.minRate || 0);
                      const rPub = getPub(rNet);
                      return (
                        <tr key={ri+"-"+i} style={{ borderBottom:"1px solid #F0F0F0" }}>
                          <td style={{ padding:"5px 7px", fontWeight:600 }}>{r.name||r.code||"Habitacion"}</td>
                          <td style={{ padding:"5px 7px", color:"#546E7A" }}>{rate.boardName||rate.boardCode||"Room Only"}</td>
                          <td style={{ padding:"5px 7px", color:B.teal, fontWeight:700 }}>${rNet.toFixed(2)}</td>
                          <td style={{ padding:"5px 7px", color:B.blue, fontWeight:700 }}>${rPub.toFixed(2)}</td>
                          <td style={{ padding:"5px 7px" }}>${(rNet*nights*rooms).toFixed(2)}</td>
                          <td style={{ padding:"5px 7px", fontWeight:700 }}>${(rPub*nights*rooms).toFixed(2)}</td>
                          <td style={{ padding:"5px 7px" }}>
                            <button onClick={() => onSelectHotel && onSelectHotel({
                              hotel:h.raw, rate, room:r,
                              checkIn, checkOut, nights, rooms, adults, children,
                              netPerNight:rNet, pubPerNight:rPub,
                              netTotal:+(rNet*nights*rooms).toFixed(2),
                              pubTotal:+(rPub*nights*rooms).toFixed(2),
                              commission:+((rPub-rNet)*nights*rooms).toFixed(2),
                              margin, source: selected.source,
                            })}
                              style={{ background:B.teal, color:"#fff", border:"none", borderRadius:4, padding:"3px 9px", cursor:"pointer", fontSize:9, fontWeight:700, fontFamily:"inherit" }}>
                              Seleccionar
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Price summary */}
          <div>
            <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:8, padding:14, marginBottom:10 }}>
              <div style={{ fontSize:11, fontWeight:800, color:B.dark, marginBottom:10 }}>Resumen — {src.name}</div>
              {[
                {l:"Neta/noche",    v:`$${net.toFixed(2)}`,    c:B.teal},
                {l:"Publica/noche", v:`$${pub.toFixed(2)}`,    c:B.blue},
                {l:"Noches",        v:String(nights),           c:"#263238"},
                {l:"Habitaciones",  v:String(rooms),            c:"#263238"},
                {l:"Total neto",    v:`$${netTot.toFixed(2)}`,  c:B.teal},
                {l:"Total publico", v:`$${pubTot.toFixed(2)}`,  c:B.blue},
                {l:"Su comision",   v:`$${com.toFixed(2)}`,     c:B.gold},
              ].map(f=>(
                <div key={f.l} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #F5F5F5" }}>
                  <span style={{ fontSize:10, color:"#546E7A" }}>{f.l}</span>
                  <span style={{ fontSize:12, fontWeight:800, color:f.c }}>{f.v}</span>
                </div>
              ))}
            </div>
            <div style={{ background:"#FFF8E1", border:"1px solid #FFE082", borderRadius:7, padding:12, marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:B.gold, marginBottom:7 }}>Margen de ganancia</div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <input type="range" min={5} max={50} value={margin} onChange={e=>setMargin(parseInt(e.target.value))} style={{ flex:1, accentColor:B.gold }}/>
                <span style={{ fontSize:16, fontWeight:900, color:B.gold }}>{margin}%</span>
              </div>
            </div>
            <button onClick={() => onSelectHotel && onSelectHotel({
              hotel:h?.raw, rate:h?.raw?.rooms?.[0]?.rates?.[0]||h?.raw?.rates?.[0],
              room:h?.raw?.rooms?.[0], checkIn, checkOut, nights, rooms, adults, children,
              netPerNight:net, pubPerNight:pub, netTotal:netTot, pubTotal:pubTot, commission:com, margin, source:selected.source,
            })}
              style={{ width:"100%", padding:"10px 0", background:`linear-gradient(135deg,${B.teal},${B.dark})`, color:"#fff", border:"none", borderRadius:7, fontWeight:800, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
              Usar en cotizacion
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding:16 }}>
      {/* Search form */}
      <div style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:8, padding:16, marginBottom:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:800, color:B.dark }}>Buscar hoteles disponibles</div>
          {/* Consolidator status */}
          <div style={{ display:"flex", gap:6 }}>
            {CONSOLIDATORS.map(c => (
              <span key={c.id} style={{ fontSize:9, background:c.active?c.bg:"#F5F5F5", color:c.active?c.color:"#B0BEC5", border:`1px solid ${c.active?c.color:"#E0E0E0"}`, padding:"2px 8px", borderRadius:8, fontWeight:700 }}>
                {c.name} {c.active ? "✓" : "próximo"}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:10, marginBottom:10 }}>
          <div style={{ position:"relative" }}>
            <label style={LB}>Destino</label>
            <input value={destQuery} onChange={e=>searchDest(e.target.value)}
              placeholder="Escribe una ciudad, pais o destino..."
              style={{...SI, fontSize:11}}
              onFocus={()=>destSuggs.length>0&&setShowSuggs(true)}
              onBlur={()=>setTimeout(()=>setShowSuggs(false),200)}/>
            {destLoading && <div style={{position:"absolute",right:8,top:24,fontSize:10,color:"#90A4AE"}}>Buscando...</div>}
            {destCode && <div style={{position:"absolute",right:8,top:24,fontSize:10,color:B.green,fontWeight:700}}>✓</div>}
            {showSuggs && destSuggs.length>0 && (
              <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#fff",border:"1px solid #E0E0E0",borderRadius:"0 0 6px 6px",boxShadow:"0 4px 12px rgba(0,0,0,.12)",zIndex:100,maxHeight:220,overflowY:"auto"}}>
                {destSuggs.map((d,i)=>{
                  const name=d.name?.content||d.name||d.code;
                  return (
                    <div key={d.code+i} onMouseDown={()=>selectDest(d)}
                      style={{padding:"8px 12px",cursor:"pointer",fontSize:11,borderBottom:"1px solid #F5F5F5",display:"flex",justifyContent:"space-between"}}
                      onMouseEnter={e=>e.currentTarget.style.background="#E3F2FD"}
                      onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                      <span><b>{name}</b> {d.countryCode&&<span style={{color:"#90A4AE"}}>· {d.countryCode}</span>}</span>
                      <span style={{fontSize:9,color:"#90A4AE",fontFamily:"monospace"}}>{d.code}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {destCode && <div style={{marginTop:3,fontSize:9,color:B.teal}}>Codigo: <b>{destCode}</b></div>}
          </div>
          <FI label="Check-in"  value={checkIn}  onChange={setCheckIn}  type="date"/>
          <FI label="Check-out" value={checkOut} onChange={setCheckOut} type="date"/>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:10 }}>
          <FI label="Habitaciones" value={String(rooms)}    onChange={v=>setRooms(parseInt(v)||1)}    type="number" sm/>
          <FI label="Adultos"      value={String(adults)}   onChange={v=>setAdults(parseInt(v)||1)}   type="number" sm/>
          <FI label="Ninos"        value={String(children)} onChange={v=>setChildren(parseInt(v)||0)} type="number" sm/>
          <FS label="Cat. minima"  value={String(minCat)}   onChange={v=>setMinCat(parseInt(v))} sm
            options={[{value:"1",label:"1 estrella"},{value:"2",label:"2 estrellas"},{value:"3",label:"3 estrellas"},{value:"4",label:"4 estrellas"},{value:"5",label:"5 estrellas"}]}/>
        </div>
        {nights>0 && <div style={{fontSize:10,color:"#546E7A",marginBottom:10}}>Duracion: <b style={{color:B.blue}}>{nights} noche{nights!==1?"s":""}</b></div>}
        {error && <div style={{background:"#FFEBEE",color:B.red,padding:"7px 10px",borderRadius:5,fontSize:10,marginBottom:10}}>{error}</div>}
        <Btn v="teal" sz="lg" onClick={search} disabled={loading}>{loading ? loadingMsg||"Buscando..." : "Buscar en todos los consolidadores"}</Btn>
      </div>

      {/* Results - View A: grouped by hotel with price comparison */}
      {searched && results.length > 0 && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, flexWrap:"wrap", gap:8 }}>
            <div style={{ fontSize:11, color:"#546E7A" }}>
              <b style={{color:B.dark}}>{results.length} hoteles</b> en <b>{destName}</b>
              {nights>0 && <span> &middot; {nights} noches &middot; {rooms} hab. &middot; {adults} adultos</span>}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, background:"#FFF8E1", border:"1px solid #FFE082", borderRadius:6, padding:"6px 12px" }}>
              <span style={{ fontSize:10, color:B.gold, fontWeight:700 }}>Margen:</span>
              <input type="range" min={5} max={50} value={margin} onChange={e=>setMargin(parseInt(e.target.value))} style={{ width:80, accentColor:B.gold }}/>
              <span style={{ fontSize:13, fontWeight:900, color:B.gold }}>{margin}%</span>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))", gap:14 }}>
            {results.map((hotel,idx) => {
              const cheapSrc = hotel.cheapest;
              const cheapPrice = hotel.prices[cheapSrc]?.minRate || 0;

              return (
                <div key={idx} style={{ background:"#fff", border:"1px solid #E0E0E0", borderRadius:8, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
                  {/* Hotel header */}
                  <div style={{ background:`linear-gradient(135deg,${B.dark},${B.blue})`, padding:"10px 13px", color:"#fff" }}>
                    <div style={{ fontSize:12, fontWeight:800, marginBottom:2 }}>{hotel.name}</div>
                    <div style={{ fontSize:10, opacity:.8 }}>{"★".repeat(hotel.category)+"☆".repeat(5-hotel.category)} &middot; {hotel.zone||destName}</div>
                  </div>

                  {/* Price comparison table */}
                  <div style={{ padding:"10px 13px" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginBottom:10 }}>
                      {CONSOLIDATORS.map(con => {
                        const p = hotel.prices[con.id];
                        const net = p?.minRate || 0;
                        const pub = getPub(net);
                        const isCheapest = con.id === cheapSrc && p;
                        return (
                          <div key={con.id}
                            style={{ border:`2px solid ${isCheapest?con.color:p?"#E0E0E0":"#F5F5F5"}`, borderRadius:6, padding:"8px 10px", textAlign:"center",
                              background: isCheapest ? con.bg : p ? "#FAFAFA" : "#F8F8F8",
                              cursor: p ? "pointer" : "default" }}
                            onClick={() => p && setSelected({...hotel, source:con.id})}>
                            <div style={{ fontSize:8, fontWeight:800, color:con.color, marginBottom:3 }}>{con.name}</div>
                            {p ? (
                              <>
                                <div style={{ fontSize:15, fontWeight:900, color: isCheapest ? con.color : "#263238" }}>${pub.toFixed(2)}</div>
                                <div style={{ fontSize:8, color:"#546E7A" }}>por noche</div>
                                {isCheapest && (
                                  <div style={{ fontSize:7, background:B.green, color:"#fff", borderRadius:6, padding:"1px 5px", marginTop:3, fontWeight:800 }}>
                                    MAS BARATO
                                  </div>
                                )}
                                {!con.active && <div style={{ fontSize:7, color:"#B0BEC5" }}>Simulado</div>}
                              </>
                            ) : (
                              <div style={{ fontSize:9, color:"#B0BEC5", marginTop:4 }}>
                                {con.active ? "No disp." : "Próximo"}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Total and action */}
                    {nights > 0 && (
                      <div style={{ background:"#F0F4FF", borderRadius:5, padding:"6px 9px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div>
                          <div style={{ fontSize:9, color:"#546E7A" }}>Mejor precio — {nights}n &times; {rooms}hab</div>
                          <div style={{ fontSize:14, fontWeight:900, color:B.blue }}>${(getPub(cheapPrice)*nights*rooms).toFixed(2)}</div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:9, color:"#546E7A" }}>Tu comision ({margin}%)</div>
                          <div style={{ fontSize:12, fontWeight:700, color:B.gold }}>${((getPub(cheapPrice)-cheapPrice)*nights*rooms).toFixed(2)}</div>
                        </div>
                      </div>
                    )}

                    <button onClick={() => setSelected({...hotel, source:cheapSrc})}
                      style={{ width:"100%", padding:"7px 0", background:`linear-gradient(135deg,${B.teal},${B.dark})`, color:"#fff", border:"none", borderRadius:5, fontWeight:800, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
                      Ver tarifas detalladas
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
    setDestLoading(false);
  };

  const selectDest = (d) => {
    const name = d.name?.content || d.name || d.code;
    setDestCode(d.code);
    setDestName(name);
    setDestQuery(name);
    setShowSuggs(false);
    setDestSuggs([]);
  };

  const search = async () => {
    if (!destCode) { setError("Escribe y selecciona un destino de la lista"); return; }
    if (!checkIn || !checkOut) { setError("Ingresa las fechas"); return; }
    if (nights <= 0) { setError("La fecha de salida debe ser posterior al check-in"); return; }
    setError(""); setLoading(true); setResults([]); setSearched(false); setSelected(null);
    try {
      const data = await hbSearch({ action:"search", destinationCode:destCode, checkIn, checkOut, rooms, adults, children, minCategory:minCat, maxCategory:5, maxHotels:30 });
      const hotels = data?.hotels?.hotels || [];
      setResults(hotels);
      setSearched(true);
      if (hotels.length === 0) setError("Sin disponibilidad para estas fechas y destino.");
    } catch(e) {
      setError("Error al conectar con Hotelbeds: " + e.message);
    }
    setLoading(false);
  };
export default function App() {
  const [user,     setUser]    = useState(null);
  const [page,     setPage]    = useState("expedientes");
  const [clients,  setClients] = useState([]);
  const [exps,     setExps]    = useState([]);
  const [grupos,   setGrupos]  = useState(SEED_GROUPS);
  const [editExp,  setEditExp] = useState(null);
  const [editCli,  setEditCli] = useState(null);
  const [editGrp,  setEditGrp] = useState(null);
  const [sideCol,  setSideCol] = useState(false);
  const [toast,    setToast]   = useState({ msg:"", type:"success" });
  const [loading,  setLoading] = useState(false);
  const [dbOnline, setDbOnline]= useState(false);

  const showToast = (msg, type="success") => { setToast({ msg, type }); setTimeout(() => setToast({ msg:"", type:"success" }), 3000); };

  const loadClients = async () => {
    try {
      const rows = await supa.get("clients", "?order=created_at.desc");
      setClients(rows.map(dbToClient)); setDbOnline(true);
    } catch(e) { setClients(SEED_CLIENTS); setDbOnline(false); }
  };

  const loadExps = async () => {
    try {
      const rows  = await supa.get("expedientes", "?order=no.desc");
      const items = await supa.get("exp_items", "?order=sort_order.asc");
      const pays  = await supa.get("payments", "");
      const mpays = await supa.get("major_payments", "");
      const alrms = await supa.get("alarms", "");
      setExps(rows.map(r => dbToExp(r,
        items.filter(i=>i.expediente_id===r.id),
        pays.filter(p=>p.expediente_id===r.id),
        mpays.filter(p=>p.expediente_id===r.id),
        alrms.filter(a=>a.expediente_id===r.id),
      ))); setDbOnline(true);
    } catch(e) { setExps(SEED_EXP); setDbOnline(false); }
  };

  const loginFromDB = async (email, password) => {
    try {
      const rows = await supa.get("users", `?email=eq.${encodeURIComponent(email)}&active=eq.true`);
      if (!rows.length) return null;
      const u = rows[0];
      if (u.password_hash !== password) return null;
      const loggedUser = { id:u.id, advisorId:u.advisor_id, name:u.name, email:u.email, role:u.role, avatar:u.avatar||u.name.charAt(0) };
      await loadClients(); await loadExps();
      return loggedUser;
    } catch(e) {
      const found = USERS.find(u => u.email.toLowerCase()===email.toLowerCase() && u.password===password);
      if (found) { setClients(SEED_CLIENTS); setExps(SEED_EXP); }
      return found || null;
    }
  };

  const saveExp = async e => {
    setLoading(true);
    try {
      if (dbOnline) {
        const expRow = { no:e.no, venta_no:e.ventaNo, status:e.status, advisor_id:e.advisorId, medium:e.medium, client_id:e.clientId||null, client_name:e.clientName, notes:e.notes, trip_title:e.trip.title, trip_destination:e.trip.destination, trip_date_from:e.trip.dateFrom||null, trip_date_to:e.trip.dateTo||null, trip_pax_adult:e.trip.paxAdult, trip_pax_child:e.trip.paxChild, trip_category:e.trip.category, contract_name:e.contract?.name||null, contract_size:e.contract?.size||null, contract_type:e.contract?.type||null, contract_data:e.contract?.data||null };
        const exists = await supa.get("expedientes", `?id=eq.${e.id}`);
        if (exists.length>0) { await supa.patch("expedientes",e.id,expRow); } else { await supa.post("expedientes",{...expRow,id:e.id}); }
        await fetch(`${SUPA_URL}/rest/v1/exp_items?expediente_id=eq.${e.id}`,{method:"DELETE",headers:supa.headers});
        if (e.items.length>0) await supa.post("exp_items",e.items.map((it,idx)=>({id:it.id,expediente_id:e.id,concept:it.concept,wholesaler_id:it.wholesalerId,date_from:it.dateFrom||null,date_to:it.dateTo||null,boleto:it.boleto,reserva:it.reserva,description:it.description,base:it.base,iva:it.iva,tua:it.tua,others:it.others,csb:it.csb,currency:it.currency,sort_order:idx})));
        await fetch(`${SUPA_URL}/rest/v1/payments?expediente_id=eq.${e.id}`,{method:"DELETE",headers:supa.headers});
        if (e.payments.length>0) await supa.post("payments",e.payments.map(p=>({id:p.id,expediente_id:e.id,receipt:p.receipt,date:p.date||null,agent_id:p.agentId,account:p.account,method:p.method,reference:p.reference,amount:p.amount,confirmed:p.confirmed,note:p.note})));
        await fetch(`${SUPA_URL}/rest/v1/major_payments?expediente_id=eq.${e.id}`,{method:"DELETE",headers:supa.headers});
        if (e.majorPayments.length>0) await supa.post("major_payments",e.majorPayments.map(p=>({id:p.id,expediente_id:e.id,receipt:p.receipt,date:p.date||null,agent_id:p.agentId,account:p.account,method:p.method,reference:p.reference,amount:p.amount,confirmed:p.confirmed,note:p.note})));
        await fetch(`${SUPA_URL}/rest/v1/alarms?expediente_id=eq.${e.id}`,{method:"DELETE",headers:supa.headers});
        if ((e.alarms||[]).length>0) await supa.post("alarms",(e.alarms||[]).map(a=>({id:a.id,expediente_id:e.id,type:a.type,date:a.date||null,note:a.note,status:a.status,auto:a.auto})));
        await loadExps(); showToast("Expediente guardado en la nube");
      } else {
        setExps(p=>{const i=p.findIndex(x=>x.id===e.id);if(i>=0){const n=[...p];n[i]=e;return n;}return[e,...p];});
        showToast("Guardado localmente (sin conexion)");
      }
    } catch(err) { showToast("Error: "+err.message,"error"); }
    setLoading(false); setEditExp(null); setPage("expedientes");
  };

  const saveCli = async c => {
    setLoading(true);
    try {
      if (dbOnline) {
        const exists = await supa.get("clients",`?id=eq.${c.id}`);
        if (exists.length>0) { await supa.patch("clients",c.id,clientToDB(c)); } else { await supa.post("clients",{...clientToDB(c),id:c.id}); }
        await loadClients(); showToast("Cliente guardado en la nube");
      } else {
        setClients(p=>{const i=p.findIndex(x=>x.id===c.id);if(i>=0){const n=[...p];n[i]=c;return n;}return[c,...p];});
        showToast("Guardado localmente");
      }
    } catch(err) { showToast("Error: "+err.message,"error"); }
    setLoading(false); setEditCli(null); setPage("clientes");
  };

  const saveGrp = g => {
    setGrupos(p=>{const i=p.findIndex(x=>x.id===g.id);if(i>=0){const n=[...p];n[i]=g;return n;}return[g,...p];});
    setEditGrp(null); setPage("grp-create"); showToast("Grupo guardado");
  };

  const logout = () => { setUser(null); setPage("expedientes"); setEditExp(null); setEditCli(null); setEditGrp(null); setExps([]); setClients([]); };
  const goTo   = id => { setPage(id); setEditExp(null); setEditCli(null); setEditGrp(null); };

  if (!user) return <LoginScreen onLogin={async (email, password) => {
    const u = await loginFromDB(email, password);
    if (u) { setUser(u); showToast("Bienvenido, " + u.name.split(" ")[0] + "!"); }
    return u;
  }}/>;

  const perms     = ROLE_PERMS[user.role] || ROLE_PERMS.asesor;
  const role      = ROLES[user.role];
  const canAccess = pageId => user.role==="superadmin" || (perms.nav||[]).includes(pageId);
  const visibleExps = perms.canSeeOwnOnly ? exps.filter(e=>e.advisorId===user.advisorId) : exps;

  const ACTIVE_PAGES = ["expedientes","exp-detail","clientes","cli-detail","reporte-ventas","reporte-com","grp-create","grp-detail","cxc-cli","cxp-may","mayoristas","cfg-agentes","hotelbeds","gastos","bancos","cfg-agencia","ventas","comisiones"];

  return (
    <div style={{ minHeight:"100vh", background:"#ECEFF1", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <Toast msg={toast.msg} type={toast.type}/>
      {loading && <div style={{ position:"fixed", top:0, left:0, right:0, height:3, background:B.gold, zIndex:9999, animation:"none" }}/>}

      {/* TOP BAR */}
      <div style={{ background:B.blue, color:"#fff", height:50, display:"flex", alignItems:"center", padding:"0 13px", gap:9, position:"sticky", top:0, zIndex:200, boxShadow:"0 2px 8px rgba(0,0,0,.25)" }}>
        <button onClick={() => setSideCol(p => !p)} style={{ background:"transparent", border:"none", color:"#fff", fontSize:18, cursor:"pointer", padding:"4px 5px" }}>&#9776;</button>
        <span style={{ fontSize:15, fontWeight:900, letterSpacing:-.3 }}>
          <VSLogo size="sm" variant="light"/>
        </span>
        <span style={{ fontSize:8, background:"rgba(255,255,255,.15)", color:"rgba(255,255,255,.85)", padding:"2px 8px", borderRadius:10, fontWeight:700, letterSpacing:.6 }}>
          {role.icon} {role.label.toUpperCase()}
        </span>
        {/* DB status indicator */}
        <span style={{ fontSize:8, background: dbOnline?"rgba(46,125,50,.4)":"rgba(198,40,40,.4)", color:"#fff", padding:"2px 7px", borderRadius:8, fontWeight:700 }}>
          {dbOnline ? "✅ EN LINEA" : "❌ LOCAL"}
        </span>
        <div style={{ flex:1 }}/>
        <input placeholder="Crear expediente - buscar cliente existente"
          style={{ ...SI, width:240, padding:"4px 9px", fontSize:10, background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.3)", color:"#fff", borderRadius:4 }}/>
        <Btn v="gold" sz="sm" onClick={() => { setEditCli(mkClient(clients)); setPage("cli-detail"); }}>+ Cliente nuevo</Btn>
        <UserMenu user={user} onLogout={logout} onProfile={()=>goTo("cfg-agentes")}/>
      </div>

      {/* BODY */}
      <div style={{ display:"flex", minHeight:"calc(100vh - 50px)" }}>
        <Sidebar page={page} onNav={goTo} collapsed={sideCol}/>

        <div style={{ flex:1, overflowX:"auto", minWidth:0 }}>

          {page==="expedientes" && !editExp && (
            <ExpList expedientes={visibleExps} clients={clients}
              onSelect={e => { setEditExp(JSON.parse(JSON.stringify(e))); setPage("exp-detail"); }}
              onNew={() => { setEditExp(mkExp()); setPage("exp-detail"); }}/>
          )}
          {page==="exp-detail" && editExp && (
            <ExpDetail exp={editExp} clients={clients}
              onSave={saveExp} onBack={() => { setEditExp(null); setPage("expedientes"); }}/>
          )}

          {page==="clientes" && !editCli && (
            canAccess("clientes")
              ? <CliList clients={clients} onSelect={c=>{setEditCli(JSON.parse(JSON.stringify(c)));setPage("cli-detail");}} onNew={()=>{setEditCli(mkClient(clients));setPage("cli-detail");}}/>
              : <AccessDenied pageName="Clientes"/>
          )}
          {page==="cli-detail" && editCli && (
            <CliForm client={editCli} onSave={saveCli} onBack={()=>{setEditCli(null);setPage("clientes");}}/>
          )}

          {page==="reporte-ventas" && (canAccess("reporte-ventas") ? <SalesReport expedientes={visibleExps}/> : <AccessDenied pageName="Reporte de Ventas"/>)}
          {page==="reporte-com"    && (canAccess("reporte-com")    ? <ReporteComisiones expedientes={visibleExps}/> : <AccessDenied pageName="Reporte de Comisiones"/>)}

          {page==="grp-create" && !editGrp && (
            canAccess("grp-create")
              ? <GruposList grupos={grupos} expedientes={exps} onSelect={g=>{setEditGrp(JSON.parse(JSON.stringify(g)));setPage("grp-detail");}} onNew={()=>{setEditGrp(mkGroup());setPage("grp-detail");}}/>
              : <AccessDenied pageName="Grupos"/>
          )}
          {page==="grp-detail" && editGrp && (
            <GrupoDetail grupo={editGrp} expedientes={exps} onSave={saveGrp} onBack={()=>{setEditGrp(null);setPage("grp-create");}}/>
          )}

          {page==="cxc-cli" && (canAccess("cxc-cli") ? <CuentasXCobrar expedientes={visibleExps} clients={clients}/> : <AccessDenied pageName="Cuentas x Cobrar"/>)}
          {page==="cxp-may" && (canAccess("cxp-may") ? <CuentasXPagar expedientes={exps}/> : <AccessDenied pageName="Cuentas x Pagar"/>)}
          {page==="mayoristas" && (canAccess("mayoristas") ? <CatalogoBackOffice/> : <AccessDenied pageName="Catalogo"/>)}
          {page==="hotelbeds" && <HotelBuscador onSelectHotel={sel => { showToast("Hotel seleccionado: " + sel.hotel.name); }} />}
          {page==="cfg-agentes" && (perms.canManageUsers ? <UserManagement currentUser={user}/> : <AccessDenied pageName="Gestion de Usuarios"/>)}
          {page==="gastos"     && (canAccess("gastos")     ? <GastosModule/>    : <AccessDenied pageName="Gastos"/>)}
          {page==="bancos"     && (canAccess("bancos")     ? <BancosModule/>    : <AccessDenied pageName="Bancos"/>)}
          {page==="cfg-agencia"&& (perms.canManageUsers    ? <AgenciaConfig agency={{ id:"00000000-0000-0000-0000-000000000001", name:"Travel Advisors Panama", email:"zenen@traveladvisorspty.net", phone:"+507 309-9360", address:"Obarrio, Calle 57 Este, P.H. Sortis Business Tower, Piso 20", city:"Panama City", country:"Panama", website:"www.traveladvisorspty.net", primaryColor:"#1565C0", secondaryColor:"#F59E0B" }} onSave={()=>showToast("Configuración guardada")}/> : <AccessDenied pageName="Configuración"/>)}
          {page==="ventas"     && (canAccess("ventas")     ? <VentasModule expedientes={visibleExps} advisors={ADVISORS} user={user}/> : <AccessDenied pageName="Ventas"/>)}
          {page==="comisiones" && (canAccess("comisiones") ? <ComisionesModule expedientes={visibleExps} advisors={ADVISORS} user={user}/> : <AccessDenied pageName="Comisiones"/>)}

          {!ACTIVE_PAGES.includes(page) && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:60, color:"#90A4AE", textAlign:"center" }}>
              <div style={{ fontSize:44, marginBottom:14 }}>🚧</div>
              <div style={{ fontSize:16, fontWeight:700, color:"#546E7A", marginBottom:7 }}>
                {NAV.find(n=>n.id===page)?.label || "Modulo"}
              </div>
              <div style={{ fontSize:12, color:"#B0BEC5", maxWidth:340 }}>Proximamente.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
