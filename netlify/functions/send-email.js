// netlify/functions/send-email.js
// VíaSuite - Email automation via Resend
// Handles: welcome, trial-warning, trial-expired

const RESEND_KEY = "re_i9FxwU6X_KKUaHipMCnUwq2TdEnhtoVJH";
const FROM_EMAIL = "hola@viasuite.app";
const FROM_NAME  = "VíaSuite";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── EMAIL TEMPLATES ───────────────────────────────────────────
function welcomeEmail(agency) {
  return {
    subject: `¡Bienvenido a VíaSuite, ${agency.name}! Tu prueba de 15 días comienza ahora`,
    html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

  <!-- HEADER -->
  <tr><td style="background:#0D47A1;padding:32px 40px;text-align:center;">
    <div style="font-size:28px;font-weight:900;letter-spacing:-0.5px;">
      <span style="color:#F59E0B;">Vía</span><span style="color:#fff;">Suite</span>
    </div>
    <div style="color:rgba(255,255,255,.7);font-size:12px;margin-top:6px;letter-spacing:1px;text-transform:uppercase;">
      Sistema de Gestión para Agencias de Viajes
    </div>
  </td></tr>

  <!-- HERO -->
  <tr><td style="background:#1565C0;padding:24px 40px;text-align:center;">
    <div style="font-size:40px;margin-bottom:8px;">🎉</div>
    <div style="color:#fff;font-size:22px;font-weight:700;">¡Bienvenido a VíaSuite!</div>
    <div style="color:rgba(255,255,255,.8);font-size:14px;margin-top:6px;">Tu prueba gratuita de 15 días ya comenzó</div>
  </td></tr>

  <!-- BODY -->
  <tr><td style="padding:36px 40px;">
    <p style="font-size:15px;color:#0F172A;margin:0 0 16px;">Hola <strong>${agency.adminName || agency.name}</strong>,</p>
    <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 24px;">
      Tu agencia <strong>${agency.name}</strong> ya está configurada en VíaSuite. 
      Tienes <strong>15 días gratis</strong> para explorar todas las funciones del sistema.
    </p>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:8px 0 24px;">
      <a href="https://app.viasuite.app" style="background:#1565C0;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:700;display:inline-block;">
        Ir al sistema →
      </a>
    </td></tr>
    </table>

    <!-- FEATURES -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFF;border-radius:10px;padding:20px;margin-bottom:24px;">
    <tr><td style="padding:16px 20px;">
      <div style="font-size:13px;font-weight:700;color:#1565C0;margin-bottom:14px;text-transform:uppercase;letter-spacing:0.5px;">
        Lo que puedes hacer en VíaSuite
      </div>
      ${[
        ["📁", "Expedientes completos", "Gestiona cada venta con partidas, pagos y documentos"],
        ["🏨", "Buscar hoteles", "Compara precios de Hotelbeds, RateHawk y W2M"],
        ["📋", "Cotizaciones PDF", "Genera documentos profesionales para tus clientes"],
        ["📊", "Reportes", "Ventas, comisiones y metas por asesor"],
        ["👥", "Grupos y Rooming", "Gestión completa de grupos con rooming list"],
      ].map(([icon, title, desc]) => `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
        <tr>
          <td width="32" style="font-size:20px;vertical-align:top;padding-top:2px;">${icon}</td>
          <td style="padding-left:10px;">
            <div style="font-size:13px;font-weight:700;color:#0F172A;">${title}</div>
            <div style="font-size:12px;color:#64748B;">${desc}</div>
          </td>
        </tr>
        </table>
      `).join("")}
    </td></tr>
    </table>

    <!-- CREDENTIALS -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;margin-bottom:24px;">
    <tr><td style="padding:16px 20px;">
      <div style="font-size:12px;font-weight:700;color:#92400E;margin-bottom:8px;">TUS DATOS DE ACCESO</div>
      <div style="font-size:13px;color:#78350F;">
        <strong>URL:</strong> <a href="https://app.viasuite.app" style="color:#1565C0;">app.viasuite.app</a><br/>
        <strong>Email:</strong> ${agency.email}<br/>
        <strong>Contraseña:</strong> La que registraste al crear tu cuenta
      </div>
    </td></tr>
    </table>

    <p style="font-size:13px;color:#64748B;line-height:1.6;margin:0 0 8px;">
      Si tienes preguntas o necesitas ayuda para configurar tu agencia, responde este email o escríbenos a 
      <a href="mailto:hola@viasuite.app" style="color:#1565C0;">hola@viasuite.app</a>.
    </p>
    <p style="font-size:13px;color:#64748B;margin:0;">
      ¡Bienvenido al futuro de la gestión de agencias de viajes!
    </p>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#0D47A1;padding:20px 40px;text-align:center;">
    <div style="font-size:16px;font-weight:900;margin-bottom:6px;">
      <span style="color:#F59E0B;">Vía</span><span style="color:#fff;">Suite</span>
    </div>
    <div style="font-size:11px;color:rgba(255,255,255,.6);">
      viasuite.app · hola@viasuite.app
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
  };
}

function trialWarningEmail(agency, daysLeft) {
  return {
    subject: `⚠️ Tu prueba de VíaSuite vence en ${daysLeft} día${daysLeft!==1?"s":""} — ¡No pierdas el acceso!`,
    html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

  <tr><td style="background:#0D47A1;padding:28px 40px;text-align:center;">
    <div style="font-size:26px;font-weight:900;">
      <span style="color:#F59E0B;">Vía</span><span style="color:#fff;">Suite</span>
    </div>
  </td></tr>

  <!-- URGENCY BAND -->
  <tr><td style="background:#DC2626;padding:20px 40px;text-align:center;">
    <div style="color:#fff;font-size:20px;font-weight:700;">⏰ Tu prueba vence en ${daysLeft} día${daysLeft!==1?"s":""}
    </div>
    <div style="color:rgba(255,255,255,.85);font-size:13px;margin-top:4px;">
      ${new Date(agency.trial_ends_at).toLocaleDateString("es", {weekday:"long",day:"numeric",month:"long",year:"numeric"})}
    </div>
  </td></tr>

  <tr><td style="padding:36px 40px;">
    <p style="font-size:15px;color:#0F172A;margin:0 0 16px;">Hola <strong>${agency.name}</strong>,</p>
    <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 24px;">
      Tu período de prueba gratuita en VíaSuite vence en <strong>${daysLeft} día${daysLeft!==1?"s":""}</strong>. 
      Después de esa fecha, el acceso al sistema quedará suspendido.
    </p>
    <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 28px;">
      Para continuar usando VíaSuite sin interrupciones, contáctanos hoy mismo. 
      Te explicamos los planes disponibles y te ayudamos a elegir el mejor para tu agencia.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:0 0 28px;">
      <a href="mailto:hola@viasuite.app?subject=Quiero continuar con VíaSuite - ${agency.name}" 
         style="background:#DC2626;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:700;display:inline-block;">
        Contactar ahora →
      </a>
    </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;margin-bottom:24px;">
    <tr><td style="padding:16px 20px;">
      <div style="font-size:13px;color:#991B1B;line-height:1.6;">
        <strong>¿Qué pasa cuando vence el trial?</strong><br/>
        Tu información y expedientes quedan guardados. Solo se suspende el acceso hasta que actives un plan.
      </div>
    </td></tr>
    </table>

    <p style="font-size:13px;color:#64748B;">
      Responde este email o escríbenos a 
      <a href="mailto:hola@viasuite.app" style="color:#1565C0;">hola@viasuite.app</a> — 
      estamos aquí para ayudarte.
    </p>
  </td></tr>

  <tr><td style="background:#0D47A1;padding:20px 40px;text-align:center;">
    <div style="font-size:16px;font-weight:900;margin-bottom:6px;">
      <span style="color:#F59E0B;">Vía</span><span style="color:#fff;">Suite</span>
    </div>
    <div style="font-size:11px;color:rgba(255,255,255,.6);">viasuite.app · hola@viasuite.app</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
  };
}

function trialExpiredEmail(agency) {
  return {
    subject: `Tu prueba de VíaSuite ha vencido — Reactiva tu cuenta`,
    html: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

  <tr><td style="background:#0D47A1;padding:28px 40px;text-align:center;">
    <div style="font-size:26px;font-weight:900;">
      <span style="color:#F59E0B;">Vía</span><span style="color:#fff;">Suite</span>
    </div>
  </td></tr>

  <tr><td style="background:#475569;padding:20px 40px;text-align:center;">
    <div style="color:#fff;font-size:18px;font-weight:700;">Tu período de prueba ha terminado</div>
    <div style="color:rgba(255,255,255,.7);font-size:13px;margin-top:4px;">Pero tus datos están seguros y esperándote</div>
  </td></tr>

  <tr><td style="padding:36px 40px;">
    <p style="font-size:15px;color:#0F172A;margin:0 0 16px;">Hola <strong>${agency.name}</strong>,</p>
    <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 24px;">
      Tu prueba gratuita de VíaSuite ha finalizado. El acceso al sistema está temporalmente suspendido, 
      pero toda tu información — expedientes, clientes y configuración — está guardada y lista para cuando reactives tu cuenta.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFF;border:1px solid #DBEAFE;border-radius:10px;margin-bottom:24px;">
    <tr><td style="padding:20px 24px;">
      <div style="font-size:13px;font-weight:700;color:#1E40AF;margin-bottom:12px;">PLANES DISPONIBLES</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;">
            <div style="font-size:14px;font-weight:700;color:#0F172A;">Básico — $49/mes</div>
            <div style="font-size:12px;color:#64748B;">Hasta 3 asesores · 500 expedientes</div>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;">
            <div style="font-size:14px;font-weight:700;color:#0F172A;">Pro — $99/mes ⭐</div>
            <div style="font-size:12px;color:#64748B;">Hasta 10 asesores · Ilimitado · Hotelbeds + RateHawk + W2M</div>
          </td>
        </tr>
      </table>
    </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:0 0 28px;">
      <a href="mailto:hola@viasuite.app?subject=Quiero reactivar VíaSuite - ${agency.name}"
         style="background:#1565C0;color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:700;display:inline-block;">
        Reactivar mi cuenta →
      </a>
    </td></tr>
    </table>

    <p style="font-size:13px;color:#64748B;line-height:1.6;">
      Responde este email o escríbenos a 
      <a href="mailto:hola@viasuite.app" style="color:#1565C0;">hola@viasuite.app</a>.
      Estamos disponibles para ayudarte a continuar.
    </p>
  </td></tr>

  <tr><td style="background:#0D47A1;padding:20px 40px;text-align:center;">
    <div style="font-size:16px;font-weight:900;margin-bottom:6px;">
      <span style="color:#F59E0B;">Vía</span><span style="color:#fff;">Suite</span>
    </div>
    <div style="font-size:11px;color:rgba(255,255,255,.6);">viasuite.app · hola@viasuite.app</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
  };
}

// ── SEND VIA RESEND ───────────────────────────────────────────
async function sendEmail(to, template) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: template.subject,
      html: template.html,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Resend error");
  return data;
}

// ── HANDLER ───────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  try {
    const body   = JSON.parse(event.body || "{}");
    const { type, agency } = body;

    if (!type || !agency?.email) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Missing type or agency.email" }) };
    }

    let template;
    if (type === "welcome") {
      template = welcomeEmail(agency);
    } else if (type === "trial-warning") {
      const days = Math.ceil((new Date(agency.trial_ends_at) - new Date()) / 86400000);
      template = trialWarningEmail(agency, days);
    } else if (type === "trial-expired") {
      template = trialExpiredEmail(agency);
    } else {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unknown email type" }) };
    }

    const result = await sendEmail(agency.email, template);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, id: result.id }),
    };

  } catch (error) {
    console.error("Email error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
