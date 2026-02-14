# 🔧 Mejoras Anti-Bloqueo para Leroy Merlin

## 🎯 Objetivo

Intentar evitar el error **HTTP 403 Forbidden** que Leroy Merlin devuelve cuando detecta scraping desde Cloudflare Workers.

## 🛠️ Mejoras Implementadas

### 1️⃣ **Headers HTTP Más Realistas**

**ANTES:**
```javascript
headers: {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9'
}
```

**DESPUÉS:**
```javascript
headers: {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ...',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.google.com/',  ← Simula que vienes de Google
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
  'Upgrade-Insecure-Requests': '1'
}
```

**Cambios clave:**
- ✅ **Referer de Google** - Simula que el usuario viene de una búsqueda de Google
- ✅ **Headers Sec-Fetch-*** - Headers modernos que envían los navegadores reales
- ✅ **Accept más completo** - Incluye formatos de imagen modernos (avif, webp)
- ✅ **Accept-Encoding** - Indica que acepta compresión
- ✅ **User-Agent de macOS** - Cambiado de Windows a macOS

### 2️⃣ **Extracción de JSON Estructurado**

Añadida la misma lógica que funciona para Carlos Alcaraz:

```javascript
// Primero intentar extraer del JSON estructurado
const jsonMatch = html.match(/"offers":\s*\{[^}]*"price":\s*"?([\d,\.]+)"?[^}]*\}/);
if (jsonMatch) {
  const jsonPrice = parseFloat(jsonMatch[1].replace(',', '.'));
  if (jsonPrice > 0) {
    // Detectar cantidad (2 unidades, pack de 4, etc.)
    const quantityMatch = html.match(/(\d+)\s*unidades?/i) || html.match(/pack\s*de\s*(\d+)/i);
    const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
    const unitPrice = quantity > 1 ? jsonPrice / quantity : jsonPrice;
    return parseFloat(unitPrice.toFixed(2));
  }
}
```

**Ventajas:**
- ✅ Extrae precios del JSON estructurado (schema.org)
- ✅ Detecta automáticamente si es paquete o unidad
- ✅ Calcula precio unitario correctamente

### 3️⃣ **Logging Mejorado**

```javascript
if (!response.ok) {
  console.log(`⚠️ Leroy Merlin HTTP ${response.status}: ${response.statusText}`);
  return null;
}
```

Ahora registra el código de error específico para debugging.

---

## 🧪 Cómo Probar

### Paso 1: Redesplegar el Worker

1. Copia el contenido de `cloudflare-worker-price-scraper.js`
2. Ve a Cloudflare Dashboard → Workers → `solar-price-scraper`
3. Pega y despliega

### Paso 2: Probar el Debug Endpoint

```bash
https://solar-price-scraper.bouaouda.workers.dev/debug?source=leroy&product=s02_3
```

**Qué buscar:**
- ✅ `error: null` (sin errores)
- ✅ `htmlLength > 0` (recibió HTML)
- ✅ `patternMatches` con resultados

**Si sigue fallando:**
- ❌ `error: "HTTP 403: Forbidden"` → Leroy Merlin sigue bloqueando

### Paso 3: Probar el Endpoint de Precios

```bash
https://solar-price-scraper.bouaouda.workers.dev/prices?source=leroy&product=s02_3
```

**Éxito:**
```json
{
  "methods": { "s02_3": "scraped" },  ← ¡Funciona!
  "prices": { "s02_3": 7.4 }
}
```

**Fallo:**
```json
{
  "methods": { "s02_3": "fallback" },  ← Sigue bloqueado
  "prices": { "s02_3": 7.4 }
}
```

---

## 📊 Probabilidad de Éxito

### ✅ **Factores a Favor:**

1. **Headers más realistas** - Simula mejor un navegador real
2. **Referer de Google** - Muchas webs permiten tráfico de Google
3. **JSON estructurado** - Si el HTML llega, extraerá el precio
4. **User-Agent actualizado** - Navegador moderno

### ⚠️ **Factores en Contra:**

1. **IP de Cloudflare** - Leroy Merlin puede bloquear rangos de IPs de data centers
2. **Sin cookies** - Los navegadores reales tienen cookies de sesión
3. **Sin JavaScript** - Cloudflare Workers no ejecuta JavaScript del cliente
4. **Protección anti-bot avanzada** - Pueden usar Cloudflare Bot Management o similar

---

## 🎲 Probabilidad Estimada

| Escenario | Probabilidad | Notas |
|-----------|--------------|-------|
| **Funciona completamente** | 30% | Si solo bloqueaban por headers básicos |
| **Sigue bloqueado (403)** | 60% | Si bloquean por IP de data center |
| **Funciona intermitentemente** | 10% | Si tienen rate limiting |

---

## 🔄 Plan B: Si Sigue Bloqueado

### Opción 1: **Mantener el Fallback** ✅ (RECOMENDADO)
- El sistema híbrido ya funciona perfectamente
- Actualizar precios manualmente cada 1-2 meses
- Costo: $0
- Esfuerzo: Bajo

### Opción 2: **Servicio de Proxy** 💰
- Usar un servicio como ScraperAPI, Bright Data, o Oxylabs
- Costo: ~$50-100/mes
- Complejidad: Media
- Ejemplo:
  ```javascript
  const proxyUrl = `http://api.scraperapi.com/?api_key=YOUR_KEY&url=${encodeURIComponent(url)}`;
  const response = await fetch(proxyUrl);
  ```

### Opción 3: **Worker Externo con Proxy** 🔧
- Crear un servidor intermedio (Heroku, Railway, etc.)
- El servidor hace el scraping con IPs residenciales
- El Worker de Cloudflare llama a tu servidor
- Costo: $0-10/mes
- Complejidad: Alta

### Opción 4: **API Oficial** 📞
- Contactar con Leroy Merlin para acceso a API
- Probabilidad de éxito: Muy baja
- Costo: Desconocido

---

## 💡 Recomendación Final

**Si las mejoras no funcionan:**

1. ✅ **Mantén el sistema híbrido actual**
   - Carlos Alcaraz funciona con scraping ✅
   - Leroy Merlin usa fallback confiable ✅
   - Sistema robusto y sin costos adicionales

2. ✅ **Actualiza los fallback periódicamente**
   - Cada 1-2 meses revisa manualmente los precios
   - Usa el endpoint `/debug` para verificar si algo cambia

3. ✅ **Monitorea con el debug endpoint**
   - Si algún día Leroy Merlin deja de bloquear, lo sabrás
   - El sistema automáticamente empezará a usar scraping

---

## 🎯 Conclusión

Hemos implementado las mejores prácticas anti-bloqueo disponibles en Cloudflare Workers:
- ✅ Headers realistas
- ✅ Referer de Google
- ✅ User-Agent moderno
- ✅ Extracción de JSON estructurado

**Si funciona**: ¡Genial! Tendrás scraping real de Leroy Merlin 🎉

**Si no funciona**: El sistema híbrido sigue siendo robusto y confiable ✅

---

**Fecha**: 2026-02-14  
**Versión**: 2.2 - Anti-Bloqueo Mejorado
