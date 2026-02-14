# 🚀 Worker v2.0 - Sistema Híbrido de Scraping

## 📖 Resumen Ejecutivo

Has actualizado tu Cloudflare Worker a la **versión 2.0** con un sistema híbrido inteligente que combina:
- **Scraping real** de tiendas online
- **Detección automática** de precios por unidad/paquete  
- **Fallback robusto** a precios manuales

## 🎯 Problema Resuelto

### Antes (v1.0)
❌ Solo usaba precios hardcodeados (fallback)  
❌ No detectaba precios por paquete (ej: "14,79€ / 2 uds")  
❌ Precios desactualizados sin forma de saberlo  

### Ahora (v2.0)
✅ Intenta obtener precios reales de las webs  
✅ Detecta automáticamente "14,79€ / 2 uds" → 7,40€ por unidad  
✅ Si falla, usa fallback actualizado  
✅ Te dice qué precios son reales vs. manuales  

## 🔧 Cómo Funciona (Técnicamente)

### 1️⃣ Scraping Real

```javascript
// Ejemplo: Leroy Merlin
async function scrapeLeroyMerlin(productKey) {
  // 1. Accede a la URL del producto
  const url = 'https://www.leroymerlin.es/productos/.../s02-3-91449531.html';
  
  // 2. Descarga el HTML
  const html = await fetch(url);
  
  // 3. Busca el precio con patrones regex
  const patterns = [
    /"price":\s*"?([\d,\.]+)"?/,
    /([\d,\.]+)\s*€/
  ];
  
  // 4. Detecta cantidad (si es paquete)
  const quantity = detectQuantity(html); // Ej: "2 unidades" → 2
  
  // 5. Calcula precio unitario
  return price / quantity; // 14.79 / 2 = 7.395€
}
```

### 2️⃣ Detección de Cantidad

```javascript
function detectQuantity(html, pricePosition) {
  // Busca en el contexto alrededor del precio
  const context = html.substring(pricePosition - 500, pricePosition + 500);
  
  // Patrones que detecta:
  // - "2 unidades"
  // - "pack de 4"
  // - "paquete de 3"
  // - "4 fijaciones"
  // - "5 piezas"
  
  // Si encuentra "2 unidades" → devuelve 2
  // Si no encuentra nada → devuelve 1 (precio unitario)
}
```

### 3️⃣ Fallback Automático

```javascript
async function getProductPrice(source, productKey) {
  let price = null;
  let method = 'fallback';
  
  try {
    // Intenta scraping
    if (source === 'leroy') {
      price = await scrapeLeroyMerlin(productKey);
      if (price) method = 'scraped';
    }
  } catch (error) {
    console.error('Scraping failed:', error);
  }
  
  // Si falla, usa fallback
  if (!price) {
    price = FALLBACK_PRICES[source][productKey];
    method = 'fallback';
  }
  
  return { price, method };
}
```

## 📊 Ejemplo Real

### Petición:
```
GET https://solar-price-scraper.bouaouda.workers.dev/prices?source=leroy&product=s02_3
```

### Respuesta:
```json
{
  "success": true,
  "source": "leroy",
  "prices": {
    "s02_3": 7.40
  },
  "methods": {
    "s02_3": "scraped"  ← ¡Precio obtenido por scraping real!
  },
  "timestamp": "2026-02-14T05:00:00.000Z"
}
```

### Si el scraping falla:
```json
{
  "success": true,
  "source": "leroy",
  "prices": {
    "s02_3": 7.40
  },
  "methods": {
    "s02_3": "fallback"  ← Precio manual de respaldo
  },
  "timestamp": "2026-02-14T05:00:00.000Z"
}
```

## 🛍️ Tiendas Implementadas

| Tienda | Scraping | Fallback | Detección Paquetes |
|--------|----------|----------|-------------------|
| **Leroy Merlin** | ✅ Sí | ✅ Sí | ✅ Sí |
| **Carlos Alcaraz** | ✅ Sí | ✅ Sí | ✅ Sí |
| **Obramat** | ⏳ Pendiente | ✅ Sí | - |
| **Almacén Fotovoltaico** | ⏳ Pendiente | ✅ Sí | - |

## 🔍 Cómo Verificar que Funciona

### 1. Ver logs en Cloudflare
1. Ve a tu dashboard de Cloudflare
2. Workers & Pages → `solar-price-scraper`
3. Pestaña **Logs**
4. Verás mensajes como:
   ```
   ✅ Leroy Merlin scraping success: s02_3 = 7.40€ (2 uds)
   ❌ Leroy Merlin scraping failed for s10: timeout
   ```

### 2. Probar en el navegador
```
https://solar-price-scraper.bouaouda.workers.dev/prices?source=leroy&product=s02_3
```

Mira el campo `methods` en la respuesta:
- `"scraped"` = ¡Funcionó el scraping! 🎉
- `"fallback"` = Usó precio manual

## ⚙️ Configuración Avanzada

### Añadir más productos
Edita `PRODUCT_DATABASE` en el worker:

```javascript
const PRODUCT_DATABASE = {
  's02_3': {
    name: 'Soporte Teja S02.3 Sunfer',
    search: 'fijacion salvatejas sunfer s02.3',
    leroyMerlin: { 
      url: 'https://www.leroymerlin.es/productos/.../s02-3-91449531.html' 
    },
    carlosAlcaraz: { 
      url: 'https://carlosalcaraz.com/producto/.../s02-3-v/' 
    }
  },
  // Añade más productos aquí...
};
```

### Actualizar precios de fallback
Edita `FALLBACK_PRICES`:

```javascript
const FALLBACK_PRICES = {
  leroy: {
    s02_3: 7.40,  // ← Actualiza este valor
    s10: 2.50,
    // ...
  }
};
```

### Ajustar timeout de scraping
```javascript
const SCRAPING_TIMEOUT = 8000; // 8 segundos (ajusta si es necesario)
```

## 🚨 Limitaciones y Consideraciones

### ⚠️ El scraping puede fallar si:
1. **La web cambia su estructura** → Actualiza los patrones regex
2. **Cloudflare Workers es bloqueado** → La web detecta el User-Agent
3. **Timeout** → La web tarda más de 8 segundos en responder
4. **La web usa JavaScript** → El worker no ejecuta JS, solo lee HTML

### ✅ Por eso el fallback es crucial:
- Garantiza que siempre haya precios disponibles
- Actualízalos manualmente cada 1-2 meses
- Usa los precios scrapeados para verificar y actualizar el fallback

## 📈 Próximos Pasos (Opcional)

1. **Implementar scraping para Obramat y Almacén Fotovoltaico**
2. **Añadir más productos** al `PRODUCT_DATABASE`
3. **Mejorar patrones** si el scraping falla
4. **Añadir notificaciones** cuando el scraping falla (email, webhook)
5. **Dashboard de monitoreo** para ver qué precios están actualizados

## 🎓 Conclusión

Has creado un sistema robusto y profesional que:
- ✅ Intenta obtener precios reales
- ✅ Detecta automáticamente precios por paquete
- ✅ Nunca falla gracias al fallback
- ✅ Es transparente (sabes qué precios son reales)
- ✅ Es mantenible (fácil actualizar fallbacks)

¡Perfecto para un entorno de producción! 🚀
