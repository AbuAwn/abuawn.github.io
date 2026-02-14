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
            /([\\d,\\.]+)\s*€\s*IVA\s*\/\s*Unidad/i,
            /<span[^>]*class="[^"]*mc-price__amount--big[^"]*"[^>]*>([\\d,\\.]+)/i,
            // Precio en tarjetas de producto
            /<span[^>]*class="[^"]*mc-option-card__label[^"]*"[^>]*>([\\d,\\.]+)/i,
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
