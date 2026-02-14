/**
 * Cloudflare Worker - Solar Components Price Scraper v2.3.1
 * Sistema híbrido: Scraping real + Fallback manual
 * 
 * Características:
 * - Scraping real de múltiples tiendas españolas
 * - Detección automática de precios por unidad/paquete
 * - Fallback a precios manuales si el scraping falla
 * - Sistema de caché inteligente (24h)
 * - Logging detallado para debugging
 */

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const CACHE_DURATION = 86400; // 24 horas en segundos
const SCRAPING_TIMEOUT = 8000; // 8 segundos máximo por scraping

// Mapeo de productos a términos de búsqueda y SKUs conocidos
const PRODUCT_DATABASE = {
  's02_3': {
    name: 'Soporte Teja S02.3 Sunfer',
    search: 'fijacion salvatejas sunfer s02.3',
    leroyMerlin: { sku: '91449931', url: 'https://www.leroymerlin.es/productos/electricidad-domotica/energia-solar/estructuras-para-placas-solares/material-suelto/2-fijaciones-salvatejas-sunfer-para-tejas-curva-arabe-s02-3-91449931.html' },
    carlosAlcaraz: { sku: 'SUNMSS02.3', url: 'https://carlosalcaraz.com/producto/energia-solar/estructuras/material-suelto/s02-3-v1/' },
    obramat: { sku: '10972241', url: 'https://www.obramat.es/productos/fijacion-salvateja-s02-sunfer-2uds-10972241.html' }
  },
  's10': { name: 'Presor Lateral S10', search: 'presor lateral solar s10 sunfer' },
  's11': { name: 'Presor Central S11', search: 'presor central solar s11 sunfer' },
  'ug1': { name: 'Unión UG1 Sunfer', search: 'union perfil ug1 sunfer' },
  'g1_1230': { name: 'Perfil G1-1230mm', search: 'perfil aluminio solar 1230mm' },
  'g1_1800': { name: 'Perfil G1-1800mm', search: 'perfil aluminio solar 1800mm' },
  'g1_2350': { name: 'Perfil G1-2350mm', search: 'perfil aluminio solar 2350mm' },
  'g1_3600': { name: 'Perfil G1-3600mm', search: 'perfil aluminio solar 3600mm' },
  'g1_4400': { name: 'Perfil G1-4400mm', search: 'perfil aluminio solar 4400mm' },
  'tapa': { name: 'Tapa Terminal G1', search: 'tapa terminal perfil solar' },
  's13': { name: 'Tornillería S13', search: 'tornilleria acero inoxidable m8 solar' }
};

// Precios de fallback (actualizados: 2026-02-14)
const FALLBACK_PRICES = {
  obramat: {
    s02_3: 8.50, s10: 1.80, s11: 1.80, ug1: 3.50, g_union: 3.50,
    g1_1230: 8.99, g1_1800: 14.00, g1_2350: 17.95, g1_3600: 30.99, g1_4400: 35.00,
    tapa: 0.75, s13: 0.30
  },
  leroy: {
    s02_3: 7.40, s10: 2.50, s11: 2.50, ug1: 5.99, g_union: 5.99,
    g1_1230: 12.50, g1_1800: 18.00, g1_2350: 22.95, g1_3600: 38.00, g1_4400: 45.00,
    tapa: 1.20, s13: 0.50
  },
  carlos: {
    s02_3: 5.30, s10: 1.95, s11: 1.95, ug1: 3.90, g_union: 3.90,
    g1_1230: 9.50, g1_1800: 15.00, g1_2350: 18.50, g1_3600: 32.00, g1_4400: 36.50,
    tapa: 0.85, s13: 0.35
  },
  alacen: {
    s02_3: 7.90, s10: 1.65, s11: 1.65, ug1: 3.20, g_union: 3.20,
    g1_1230: 7.50, g1_1800: 12.50, g1_2350: 16.50, g1_3600: 28.00, g1_4400: 33.00,
    tapa: 0.60, s13: 0.25
  }
};

// ============================================================================
// UTILIDADES DE SCRAPING
// ============================================================================

/**
 * Extrae precio de HTML usando múltiples patrones
 * Detecta automáticamente si el precio es por unidad o por paquete
 */
function extractPriceFromHTML(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const priceStr = match[1].replace(/[^\d,\.]/g, '').replace(',', '.');
      const price = parseFloat(priceStr);

      if (!isNaN(price) && price > 0 && price < 10000) {
        // Detectar si es precio por paquete
        const quantity = detectQuantity(html, match.index);

        return {
          price: price,
          quantity: quantity,
          unitPrice: quantity > 1 ? price / quantity : price
        };
      }
    }
  }
  return null;
}

/**
 * Detecta la cantidad de unidades en un paquete
 * Busca patrones como "2 unidades", "pack de 4", etc.
 */
function detectQuantity(html, pricePosition) {
  // Extraer contexto alrededor del precio (500 caracteres antes y después)
  const start = Math.max(0, pricePosition - 500);
  const end = Math.min(html.length, pricePosition + 500);
  const context = html.substring(start, end).toLowerCase();

  // Patrones de cantidad
  const quantityPatterns = [
    /(\d+)\s*unidades?/i,
    /pack\s*de\s*(\d+)/i,
    /(\d+)\s*uds?\.?/i,
    /paquete\s*de\s*(\d+)/i,
    /(\d+)\s*fijaciones/i,
    /(\d+)\s*piezas/i
  ];

  for (const pattern of quantityPatterns) {
    const match = context.match(pattern);
    if (match && match[1]) {
      const qty = parseInt(match[1]);
      if (qty > 0 && qty <= 100) return qty;
    }
  }

  return 1; // Por defecto, 1 unidad
}

/**
 * Fetch con timeout
 */
async function fetchWithTimeout(url, options = {}, timeout = SCRAPING_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ============================================================================
// SCRAPERS POR TIENDA
// ============================================================================

/**
 * Scraper para Leroy Merlin
 */
async function scrapeLeroyMerlin(productKey) {
  const product = PRODUCT_DATABASE[productKey];
  if (!product) return null;

  try {
    // Si tenemos URL directa, usarla
    const url = product.leroyMerlin?.url ||
      `https://www.leroymerlin.es/search?q=${encodeURIComponent(product.search)}`;

    // Headers más realistas para evitar bloqueo
    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.google.com/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    if (!response.ok) {
      console.log(`⚠️ Leroy Merlin HTTP ${response.status}: ${response.statusText}`);
      return null;
    }

    const html = await response.text();

    // Primero intentar extraer del JSON estructurado (como Carlos Alcaraz)
    const jsonMatch = html.match(/"offers":\s*\{[^}]*"price":\s*"?([\d,\.]+)"?[^}]*\}/);
    if (jsonMatch) {
      const jsonPrice = parseFloat(jsonMatch[1].replace(',', '.'));
      if (jsonPrice > 0) {
        // Detectar cantidad en el contexto
        const quantityMatch = html.match(/(\d+)\s*unidades?/i) || html.match(/pack\s*de\s*(\d+)/i);
        const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
        const unitPrice = quantity > 1 ? jsonPrice / quantity : jsonPrice;
        console.log(`✅ Leroy Merlin JSON price: ${jsonPrice}€ / ${quantity} uds = ${unitPrice.toFixed(2)}€`);
        return parseFloat(unitPrice.toFixed(2));
      }
    }

    // Patrones específicos de Leroy Merlin
    const patterns = [
      /"price":\s*"?([\d,\.]+)"?/,
      /class="price[^"]*"[^>]*>([\d,\.]+)/,
      /<span[^>]*data-price[^>]*>([\d,\.]+)/,
      /€\s*([\d,\.]+)/,
      /([\d,\.]+)\s*€/
    ];

    const result = extractPriceFromHTML(html, patterns);

    if (result) {
      console.log(`✅ Leroy Merlin scraping success: ${productKey} = ${result.unitPrice}€ (${result.quantity} uds)`);
      return result.unitPrice;
    }

    return null;
  } catch (error) {
    console.error(`❌ Leroy Merlin scraping failed for ${productKey}:`, error.message);
    return null;
  }
}

/**
 * Scraper para Carlos Alcaraz
 */
async function scrapeCarlosAlcaraz(productKey) {
  const product = PRODUCT_DATABASE[productKey];
  if (!product) return null;

  try {
    const url = product.carlosAlcaraz?.url ||
      `https://carlosalcaraz.com/?s=${encodeURIComponent(product.search)}`;

    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-ES,es;q=0.9'
      }
    });

    if (!response.ok) return null;

    const html = await response.text();

    // Primero intentar extraer del JSON estructurado (schema.org)
    const jsonMatch = html.match(/"offers":\s*\{[^}]*"price":\s*"?([\d,\.]+)"?[^}]*\}/);
    if (jsonMatch) {
      const jsonPrice = parseFloat(jsonMatch[1].replace(',', '.'));
      // Si el precio es menor a 5€, probablemente es sin IVA, aplicar IVA
      if (jsonPrice > 0 && jsonPrice < 5) {
        const priceWithVAT = jsonPrice * 1.21;
        console.log(`✅ Carlos Alcaraz JSON price found: ${jsonPrice}€ (sin IVA) → ${priceWithVAT.toFixed(2)}€ (con IVA)`);
        return parseFloat(priceWithVAT.toFixed(2));
      }
    }

    // Patrones específicos de Carlos Alcaraz (priorizando "con IVA")
    const patterns = [
      /([\d,\.]+)\s*€\s*\/\s*Ud\.?\s*con\s*IVA/i,
      /con\s*IVA[^\d]*([\d,\.]+)\s*€/i,
      /precio[^\d]*([\d,\.]+)\s*€[^\d]*con\s*IVA/i,
      /<span[^>]*class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>([\d,\.]+)/i,
      /class="price[^"]*"[^>]*>([\d,\.]+)/,
      /<span[^>]*class="[^"]*amount[^"]*"[^>]*>([\d,\.]+)/,
      /([\d,\.]+)\s*€/
    ];

    const result = extractPriceFromHTML(html, patterns);

    if (result) {
      console.log(`✅ Carlos Alcaraz scraping success: ${productKey} = ${result.unitPrice}€`);
      return result.unitPrice;
    }

    return null;
  } catch (error) {
    console.error(`❌ Carlos Alcaraz scraping failed for ${productKey}:`, error.message);
    return null;
  }
}

/**
 * Scraper para Obramat
 */
async function scrapeObramat(productKey) {
  const product = PRODUCT_DATABASE[productKey];
  if (!product) return null;

  try {
    const url = product.obramat?.url ||
      `https://www.obramat.es/search?q=${encodeURIComponent(product.search)}`;

    // Headers realistas para evitar bloqueo
    const response = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.google.com/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    if (!response.ok) {
      console.log(`⚠️ Obramat HTTP ${response.status}: ${response.statusText}`);
      return null;
    }

    const html = await response.text();

    // Primero intentar extraer del JSON estructurado (schema.org)
    const jsonMatch = html.match(/"offers":\s*\{[^}]*"price":\s*"?([\d,\.]+)"?[^}]*\}/);
    if (jsonMatch) {
      const jsonPrice = parseFloat(jsonMatch[1].replace(',', '.'));
      if (jsonPrice > 0) {
        // Detectar cantidad en el contexto (Obramat usa "2UDS", "PACK DE X", etc.)
        const quantityMatch = html.match(/(\d+)\s*UDS/i) ||
          html.match(/(\d+)\s*unidades?/i) ||
          html.match(/pack\s*de\s*(\d+)/i) ||
          html.match(/bolsa\s*de\s*(\d+)/i);
        const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
        const unitPrice = quantity > 1 ? jsonPrice / quantity : jsonPrice;
        console.log(`✅ Obramat JSON price: ${jsonPrice}€ / ${quantity} uds = ${unitPrice.toFixed(2)}€`);
        return parseFloat(unitPrice.toFixed(2));
      }
    }

    // Patrones específicos de Obramat
    const patterns = [
      // Precio con IVA (preferido)
      /([\d,\.]+)\s*€\s*IVA\s*\/\s*Unidad/i,
      /<span[^>]*class="[^"]*mc-price__amount--big[^"]*"[^>]*>([\d,\.]+)/i,
      // Precio en tarjetas de producto
      /<span[^>]*class="[^"]*mc-option-card__label[^"]*"[^>]*>([\d,\.]+)/i,
      // JSON estructurado
      /"price":\s*"?([\d,\.]+)"?/,
      // Genéricos
      /class="price[^"]*"[^>]*>([\d,\.]+)/,
      /<span[^>]*class="[^"]*amount[^"]*"[^>]*>([\d,\.]+)/,
      /([\d,\.]+)\s*€/
    ];

    const result = extractPriceFromHTML(html, patterns);

    if (result) {
      console.log(`✅ Obramat scraping success: ${productKey} = ${result.unitPrice}€ (${result.quantity} uds)`);
      return result.unitPrice;
    }

    return null;
  } catch (error) {
    console.error(`❌ Obramat scraping failed for ${productKey}:`, error.message);
    return null;
  }
}

/**
 * Scraper genérico usando Google Shopping
 */
async function scrapeGoogleShopping(productKey) {
  const product = PRODUCT_DATABASE[productKey];
  if (!product) return null;

  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(product.search + ' precio españa')}&tbm=shop`;

    const response = await fetchWithTimeout(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) return null;

    const html = await response.text();

    const patterns = [
      /aria-label="[^"]*([\d,\.]+)\s*€/,
      /"price":\s*"([\d,\.]+)"/,
      /([\d,\.]+)\s*€/
    ];

    const result = extractPriceFromHTML(html, patterns);

    if (result) {
      console.log(`✅ Google Shopping scraping success: ${productKey} = ${result.unitPrice}€`);
      return result.unitPrice;
    }

    return null;
  } catch (error) {
    console.error(`❌ Google Shopping scraping failed for ${productKey}:`, error.message);
    return null;
  }
}

// ============================================================================
// LÓGICA PRINCIPAL
// ============================================================================

/**
 * Obtiene el precio de un producto con estrategia híbrida
 */
async function getProductPrice(source, productKey) {
  let price = null;
  let method = 'fallback';

  // Intentar scraping según la fuente
  try {
    switch (source) {
      case 'leroy':
        price = await scrapeLeroyMerlin(productKey);
        if (price) method = 'scraped';
        break;

      case 'carlos':
        price = await scrapeCarlosAlcaraz(productKey);
        if (price) method = 'scraped';
        break;

      case 'obramat':
        price = await scrapeObramat(productKey);
        if (price) method = 'scraped';
        break;

      case 'alacen':
        // Almacén Fotovoltaico usa solo fallback por ahora
        // Puedes implementar scraper específico después
        break;
    }
  } catch (error) {
    console.error(`Error in scraping ${source}/${productKey}:`, error);
  }

  // Fallback a precios manuales
  if (!price && FALLBACK_PRICES[source]) {
    price = FALLBACK_PRICES[source][productKey];
    method = 'fallback';
  }

  return { price: price || 0, method };
}

/**
 * Handler principal de peticiones
 */
async function handleRequest(request) {
  const url = new URL(request.url);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Endpoint: /prices?source=leroy&product=s02_3
  if (url.pathname === '/prices') {
    const source = url.searchParams.get('source') || 'obramat';
    const product = url.searchParams.get('product');

    try {
      let prices = {};
      let methods = {};

      if (product) {
        // Precio de un producto específico
        const result = await getProductPrice(source, product);
        prices[product] = result.price;
        methods[product] = result.method;
      } else {
        // Todos los precios de la fuente (usa fallback)
        prices = FALLBACK_PRICES[source] || FALLBACK_PRICES.obramat;
        for (let key in prices) {
          methods[key] = 'fallback';
        }
      }

      return new Response(JSON.stringify({
        success: true,
        source: source,
        prices: prices,
        methods: methods, // Indica qué precios son scrapeados vs fallback
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

  // Endpoint de DEBUG: Ver HTML que recibe el worker
  if (url.pathname === '/debug') {
    const source = url.searchParams.get('source') || 'leroy';
    const product = url.searchParams.get('product') || 's02_3';

    try {
      const productInfo = PRODUCT_DATABASE[product];
      let debugUrl = '';
      let html = '';
      let error = null;

      if (source === 'leroy' && productInfo?.leroyMerlin?.url) {
        debugUrl = productInfo.leroyMerlin.url;
      } else if (source === 'carlos' && productInfo?.carlosAlcaraz?.url) {
        debugUrl = productInfo.carlosAlcaraz.url;
      } else if (source === 'obramat' && productInfo?.obramat?.url) {
        debugUrl = productInfo.obramat.url;
      } else {
        debugUrl = `https://www.leroymerlin.es/search?q=${encodeURIComponent(productInfo?.search || 'solar')}`;
      }

      try {
        const response = await fetchWithTimeout(debugUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9'
          }
        });

        if (response.ok) {
          html = await response.text();
        } else {
          error = `HTTP ${response.status}: ${response.statusText}`;
        }
      } catch (e) {
        error = e.message;
      }

      // Buscar patrones de precio en el HTML
      const pricePatterns = [
        /"price":\s*"?([\d,\.]+)"?/,
        /class="price[^"]*"[^>]*>([\d,\.]+)/,
        /<span[^>]*data-price[^>]*>([\d,\.]+)/,
        /€\s*([\d,\.]+)/,
        /([\d,\.]+)\s*€/
      ];

      const matches = [];
      for (const pattern of pricePatterns) {
        const match = html.match(pattern);
        if (match) {
          matches.push({
            pattern: pattern.toString(),
            match: match[0],
            price: match[1]
          });
        }
      }

      return new Response(JSON.stringify({
        url: debugUrl,
        source: source,
        product: product,
        htmlLength: html.length,
        htmlPreview: html.substring(0, 2000), // Primeros 2000 caracteres
        error: error,
        patternMatches: matches,
        containsPrice: html.toLowerCase().includes('precio') || html.toLowerCase().includes('price'),
        containsEuro: html.includes('€')
      }, null, 2), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message,
        stack: error.stack
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
    version: '2.3.1 - Obramat Debug Fix',
    features: [
      'Real-time web scraping',
      'Automatic unit/pack detection',
      'Automatic VAT detection',
      'Intelligent fallback to manual prices',
      'Enhanced anti-blocking headers',
      '24h caching',
      'Detailed logging',
      'Debug endpoint for troubleshooting'
    ],
    endpoints: {
      '/prices?source=leroy': 'Get all prices from Leroy Merlin',
      '/prices?source=carlos': 'Get all prices from Carlos Alcaraz',
      '/prices?source=obramat': 'Get all prices from Obramat',
      '/prices?source=alacen': 'Get all prices from Almacén Fotovoltaico',
      '/prices?source=X&product=s02_3': 'Get specific product price with scraping',
      '/debug?source=leroy&product=s02_3': 'Debug endpoint - see HTML and pattern matches'
    },
    lastUpdate: '2026-02-14'
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
