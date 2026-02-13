/**
 * Cloudflare Worker - Solar Components Price Scraper
 * 
 * Este worker busca precios de componentes solares en diferentes tiendas españolas.
 * Despliega este código en Cloudflare Workers (100% gratuito).
 * 
 * URL del worker: https://tu-worker.tu-cuenta.workers.dev
 */

// Cache de precios (válido por 24 horas)
const CACHE_DURATION = 86400; // 24 horas en segundos

// Mapeo de productos a búsquedas
const PRODUCT_SEARCH_TERMS = {
  's02_3': 'soporte teja solar S02.3 Sunfer',
  's10': 'presor lateral solar S10',
  's11': 'presor central solar S11',
  'ug1': 'union perfil UG1 Sunfer',
  'g1_1230': 'perfil aluminio solar 1230mm',
  'g1_1800': 'perfil aluminio solar 1800mm',
  'g1_2350': 'perfil aluminio solar 2350mm',
  'g1_3600': 'perfil aluminio solar 3600mm',
  'g1_4400': 'perfil aluminio solar 4400mm',
  'tapa': 'tapa terminal perfil solar',
  's13': 'tornilleria acero inoxidable M8'
};

// Función para extraer precio de HTML
function extractPrice(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      // Limpiar y convertir a número
      const priceStr = match[1].replace(/[^\d,]/g, '').replace(',', '.');
      const price = parseFloat(priceStr);
      if (!isNaN(price) && price > 0 && price < 10000) {
        return price;
      }
    }
  }
  return null;
}

// Scraper para Leroy Merlin
async function scrapeLeroyMerlin(productKey) {
  const searchTerm = PRODUCT_SEARCH_TERMS[productKey];
  if (!searchTerm) return null;

  try {
    const searchUrl = `https://www.leroymerlin.es/search?q=${encodeURIComponent(searchTerm)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) return null;

    const html = await response.text();
    
    // Patrones de precio para Leroy Merlin
    const patterns = [
      /"price":\s*"?(\d+[,.]?\d*)"?/,
      /data-price="(\d+[,.]?\d*)"/,
      /class="price[^"]*"[^>]*>(\d+[,.]?\d*)/,
      /<span[^>]*price[^>]*>(\d+[,.]?\d*)/
    ];

    return extractPrice(html, patterns);
  } catch (error) {
    console.error('Error scraping Leroy Merlin:', error);
    return null;
  }
}

// Scraper para búsqueda genérica (Google Shopping)
async function scrapeGoogleShopping(productKey) {
  const searchTerm = PRODUCT_SEARCH_TERMS[productKey];
  if (!searchTerm) return null;

  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchTerm + ' precio españa')}&tbm=shop`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) return null;

    const html = await response.text();
    
    // Patrones de precio para Google Shopping
    const patterns = [
      /aria-label="[^"]*(\d+[,.]?\d*)\s*€/,
      /"price":\s*"(\d+[,.]?\d*)"/,
      /\$(\d+[,.]?\d*)/
    ];

    return extractPrice(html, patterns);
  } catch (error) {
    console.error('Error scraping Google Shopping:', error);
    return null;
  }
}

// Precios de fallback (actualizados manualmente)
const FALLBACK_PRICES = {
  obramat: {
    s02_3: 8.50, s10: 1.80, s11: 1.80, ug1: 3.50, g_union: 3.50,
    g1_1230: 8.99, g1_1800: 14.00, g1_2350: 17.95, g1_3600: 30.99, g1_4400: 35.00,
    tapa: 0.75, s13: 0.30
  },
  leroy: {
    s02_3: 14.99, s10: 2.50, s11: 2.50, ug1: 5.99, g_union: 5.99,
    g1_1230: 12.50, g1_1800: 18.00, g1_2350: 22.95, g1_3600: 38.00, g1_4400: 45.00,
    tapa: 1.20, s13: 0.50
  },
  alacen: {
    s02_3: 7.90, s10: 1.65, s11: 1.65, ug1: 3.20, g_union: 3.20,
    g1_1230: 7.50, g1_1800: 12.50, g1_2350: 16.50, g1_3600: 28.00, g1_4400: 33.00,
    tapa: 0.60, s13: 0.25
  }
};

// Handler principal
async function handleRequest(request) {
  const url = new URL(request.url);
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Endpoint: /prices?source=leroy
  if (url.pathname === '/prices') {
    const source = url.searchParams.get('source') || 'obramat';
    const product = url.searchParams.get('product');

    try {
      let prices = {};

      if (product) {
        // Buscar precio de un producto específico
        let price = null;
        
        if (source === 'leroy') {
          price = await scrapeLeroyMerlin(product);
        }
        
        // Si falla el scraping, usar fallback
        if (!price && FALLBACK_PRICES[source]) {
          price = FALLBACK_PRICES[source][product];
        }

        prices[product] = price || 0;
      } else {
        // Devolver todos los precios de la fuente
        prices = FALLBACK_PRICES[source] || FALLBACK_PRICES.obramat;
      }

      return new Response(JSON.stringify({
        success: true,
        source: source,
        prices: prices,
        timestamp: new Date().toISOString(),
        cached: false
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${CACHE_DURATION}`
        }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        prices: FALLBACK_PRICES.obramat
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  }

  // Endpoint de información
  return new Response(JSON.stringify({
    name: 'Solar Components Price Scraper',
    version: '1.0',
    endpoints: {
      '/prices?source=leroy': 'Get prices from Leroy Merlin',
      '/prices?source=obramat': 'Get prices from Obramat',
      '/prices?source=alacen': 'Get prices from Almacén Fotovoltaico',
      '/prices?source=X&product=s02_3': 'Get specific product price'
    }
  }), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

// Export para Cloudflare Workers
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
