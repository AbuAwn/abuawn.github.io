# 🔧 Worker v2.1 - Correcciones y Debug

## 🐛 Problema Encontrado

Durante la investigación, descubrimos que el scraping fallaba por:

### 1. **SKU Incorrecto en Leroy Merlin**
- ❌ **SKU antiguo**: `91449531` → Devuelve error 404
- ✅ **SKU correcto**: `91449931` → Funciona correctamente

### 2. **Falta de herramientas de debugging**
- No había forma de ver qué HTML estaba recibiendo el worker
- Imposible diagnosticar por qué los patrones no coincidían

## ✅ Soluciones Implementadas

### 1. **SKU Corregido**
```javascript
// ANTES:
leroyMerlin: { sku: '91449531', url: '...91449531.html' }

// DESPUÉS:
leroyMerlin: { sku: '91449931', url: '...91449931.html' }
```

### 2. **Nuevo Endpoint de Debug**
```
GET /debug?source=leroy&product=s02_3
```

Este endpoint devuelve:
- **URL** que está intentando scrapear
- **HTML recibido** (primeros 2000 caracteres)
- **Patrones encontrados** con los regex
- **Errores** si los hay
- **Información útil**: si contiene "precio", "€", etc.

**Ejemplo de respuesta:**
```json
{
  "url": "https://www.leroymerlin.es/productos/.../s02-3-91449931.html",
  "source": "leroy",
  "product": "s02_3",
  "htmlLength": 125000,
  "htmlPreview": "<!DOCTYPE html><html>...",
  "error": null,
  "patternMatches": [
    {
      "pattern": "/([\d,\.]+)\s*€/",
      "match": "14,79 €",
      "price": "14,79"
    }
  ],
  "containsPrice": true,
  "containsEuro": true
}
```

## 🚀 Cómo Redesplegar

### Paso 1: Copiar el código actualizado
1. Abre el archivo: `cloudflare-worker-price-scraper.js`
2. Selecciona todo (Ctrl+A / Cmd+A)
3. Copia (Ctrl+C / Cmd+C)

### Paso 2: Desplegar en Cloudflare
1. Ve a: https://dash.cloudflare.com
2. Workers & Pages → `solar-price-scraper`
3. Click en **"Edit Code"**
4. Selecciona todo el código del editor (Ctrl+A / Cmd+A)
5. Pega el nuevo código (Ctrl+V / Cmd+V)
6. Click en **"Save and Deploy"**

### Paso 3: Verificar el despliegue
Visita: https://solar-price-scraper.bouaouda.workers.dev/

Deberías ver:
```json
{
  "version": "2.1 - Debug Enabled",
  ...
}
```

## 🧪 Cómo Probar

### 1. Probar el endpoint de debug
```
https://solar-price-scraper.bouaouda.workers.dev/debug?source=leroy&product=s02_3
```

**Qué buscar:**
- ✅ `htmlLength` > 0 (recibió HTML)
- ✅ `error` = null (sin errores)
- ✅ `patternMatches` tiene elementos (encontró precios)
- ✅ `containsPrice` = true
- ✅ `containsEuro` = true

### 2. Probar el scraping real
```
https://solar-price-scraper.bouaouda.workers.dev/prices?source=leroy&product=s02_3
```

**Qué buscar:**
```json
{
  "methods": {
    "s02_3": "scraped"  ← ¡Debe decir "scraped" no "fallback"!
  },
  "prices": {
    "s02_3": 7.4  ← Precio correcto (14.79 / 2)
  }
}
```

### 3. Probar Carlos Alcaraz
```
https://solar-price-scraper.bouaouda.workers.dev/debug?source=carlos&product=s02_3
https://solar-price-scraper.bouaouda.workers.dev/prices?source=carlos&product=s02_3
```

## 🔍 Diagnóstico de Problemas

### Si `methods` sigue diciendo "fallback":

1. **Revisa el debug endpoint** para ver qué HTML recibe
2. **Verifica los patrones** en `patternMatches`
3. **Posibles causas:**
   - La web usa JavaScript para cargar precios (Cloudflare Workers no ejecuta JS)
   - La web bloquea Cloudflare Workers
   - Los patrones regex no coinciden con el HTML actual

### Si `htmlLength` = 0:

- La web está bloqueando el request
- Timeout (tarda más de 8 segundos)
- URL incorrecta

### Si `error` no es null:

- Lee el mensaje de error
- Puede ser timeout, 404, 403 (bloqueado), etc.

## 📊 Cambios en el Código

| Archivo | Cambio | Líneas |
|---------|--------|--------|
| `cloudflare-worker-price-scraper.js` | SKU corregido | 25 |
| `cloudflare-worker-price-scraper.js` | Endpoint `/debug` añadido | 391-477 |
| `cloudflare-worker-price-scraper.js` | Versión actualizada a 2.1 | 484 |

## 🎯 Expectativas Realistas

### ✅ Lo que debería funcionar ahora:
- **Leroy Merlin S02.3**: Debería hacer scraping real (SKU corregido)
- **Debug endpoint**: Permite diagnosticar problemas
- **Fallback robusto**: Siempre hay precios disponibles

### ⚠️ Limitaciones conocidas:
- **JavaScript**: Si la web carga precios con JS, el worker no los verá
- **Anti-bot**: Algunas webs pueden bloquear Cloudflare Workers
- **Cambios en webs**: Si cambian el HTML, hay que actualizar patrones

### 💡 Recomendación:
Usa el endpoint `/debug` para entender qué está pasando. Si el scraping falla consistentemente, mantén los precios de fallback actualizados manualmente cada 1-2 meses.

## 📝 Próximos Pasos (Después de Redesplegar)

1. **Probar debug endpoint** para Leroy Merlin
2. **Verificar si ahora dice "scraped"** en lugar de "fallback"
3. **Si funciona**: ¡Celebrar! 🎉
4. **Si no funciona**: Analizar la respuesta del debug y ajustar patrones

---

**Fecha de actualización**: 2026-02-14  
**Versión**: 2.1 - Debug Enabled
