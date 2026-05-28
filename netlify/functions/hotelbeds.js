// netlify/functions/hotelbeds.js
// Proxy para Hotelbeds API - evita problemas de CORS

const crypto = require('crypto');

const API_KEY    = "8cf6b5592f430a606a7ba04c64983fbe";
const API_SECRET = "06adfa0268";
const BASE_URL   = "https://api.test.hotelbeds.com"; // test environment

function getSignature() {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto.createHash('sha256')
    .update(API_KEY + API_SECRET + timestamp)
    .digest('hex');
  return signature;
}

function getHeaders() {
  return {
    'Api-key':       API_KEY,
    'X-Signature':   getSignature(),
    'Accept':        'application/json',
    'Accept-Encoding': 'gzip',
    'Content-Type':  'application/json',
  };
}

exports.handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const body    = JSON.parse(event.body || '{}');
    const action  = body.action || 'search';

    let url, method, payload;

    if (action === 'search') {
      // Search available hotels
      url    = `${BASE_URL}/hotel-api/1.0/hotels`;
      method = 'POST';
      payload = {
        stay: {
          checkIn:  body.checkIn,
          checkOut: body.checkOut,
        },
        occupancies: [{
          rooms:  body.rooms  || 1,
          adults: body.adults || 2,
          children: body.children || 0,
        }],
        destination: {
          code: body.destinationCode,
        },
        filter: {
          maxHotels: body.maxHotels || 20,
          minCategory: body.minCategory || 3,
          maxCategory: body.maxCategory || 5,
        },
        ...(body.keywords && {
          keywords: { keywords: body.keywords }
        }),
      };

    } else if (action === 'hotel_detail') {
      // Get hotel details
      url    = `${BASE_URL}/hotel-content-api/1.0/hotels/${body.hotelCode}/details`;
      method = 'GET';

    } else if (action === 'destinations') {
      // Search destinations/zones
      url    = `${BASE_URL}/hotel-content-api/1.0/locations/destinations?fields=all&language=ENG&from=1&to=100&useSecondaryLanguage=false`;
      if (body.query) {
        url += `&name=${encodeURIComponent(body.query)}`;
      }
      method = 'GET';

    } else if (action === 'check_rate') {
      // Check rate before booking
      url    = `${BASE_URL}/hotel-api/1.0/checkrates`;
      method = 'POST';
      payload = {
        rooms: body.rooms,
      };

    } else if (action === 'booking') {
      // Create booking
      url    = `${BASE_URL}/hotel-api/1.0/bookings`;
      method = 'POST';
      payload = {
        holder: {
          name:    body.holderName,
          surname: body.holderSurname,
        },
        rooms: body.rooms,
        clientReference: body.reference || `TA-${Date.now()}`,
        remark: body.remark || 'Booking via Travel Advisors Panama',
      };

    } else if (action === 'cancel') {
      // Cancel booking
      url    = `${BASE_URL}/hotel-api/1.0/bookings/${body.bookingRef}`;
      method = 'DELETE';

    } else {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unknown action: ' + action }),
      };
    }

    // Make request to Hotelbeds
    const fetchOptions = {
      method,
      headers: getHeaders(),
    };
    if (payload) {
      fetchOptions.body = JSON.stringify(payload);
    }

    const response = await fetch(url, fetchOptions);
    const data     = await response.json();

    return {
      statusCode: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };

  } catch (error) {
    console.error('Hotelbeds proxy error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
