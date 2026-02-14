# Guía de Despliegue - Cloudflare Worker para Precios v2.0

## 🎯 Características del Worker v2.0

### ✨ Sistema Híbrido Inteligente
- **Scraping real** de tiendas online (Leroy Merlin, Carlos Alcaraz)
- **Detección automática** de precios por unidad vs. por paquete
- **Fallback automático** a precios manuales si el scraping falla
- **Logging detallado** para saber qué precios son scrapeados vs. manuales
- **Caché de 24 horas** para optimizar rendimiento

### 🛍️ Tiendas Soportadas
- **Leroy Merlin** (scraping + fallback)
- **Carlos Alcaraz** (scraping + fallback)
- **Obramat** (fallback manual)
- **Almacén Fotovoltaico** (fallback manual)

## 📋 Requisitos
- Cuenta gratuita en Cloudflare (https://dash.cloudflare.com/sign-up)
- 10 minutos de tiempo

## 🚀 Pasos de Despliegue

### 1. Crear cuenta en Cloudflare
1. Ve a https://dash.cloudflare.com/sign-up
2. Regístrate con tu email
3. Verifica tu email

### 2. Crear el Worker
1. En el dashboard de Cloudflare, ve a **Workers & Pages**
2. Haz clic en **Create Application**
3. Selecciona **Create Worker**
4. Dale un nombre: `solar-price-scraper`
5. Haz clic en **Deploy**

### 3. Editar el código
1. Una vez desplegado, haz clic en **Edit Code**
2. Borra todo el código de ejemplo
3. Copia y pega el contenido del archivo `cloudflare-worker-price-scraper.js`
4. Haz clic en **Save and Deploy**

### 4. Obtener la URL del Worker
Tu worker estará disponible en:
```
https://solar-price-scraper.TU-CUENTA.workers.dev
```

Copia esta URL, la necesitarás para configurar tu aplicación.

## 🔧 Configuración en tu Aplicación

Una vez desplegado el worker, actualiza la variable en tu `simuladorSolar_v1.10.html`:

```javascript
// Línea ~890 (dentro de la función applyPriceSource)
const WORKER_URL = 'https://solar-price-scraper.TU-CUENTA.workers.dev';
```

Reemplaza `TU-CUENTA` con tu subdomain de Cloudflare Workers.

## 📊 Endpoints Disponibles

### Obtener todos los precios de una fuente
```
GET https://solar-price-scraper.TU-CUENTA.workers.dev/prices?source=leroy
GET https://solar-price-scraper.TU-CUENTA.workers.dev/prices?source=obramat
GET https://solar-price-scraper.TU-CUENTA.workers.dev/prices?source=alacen
```

### Obtener precio de un producto específico
```
GET https://solar-price-scraper.TU-CUENTA.workers.dev/prices?source=leroy&product=s02_3
```

## 🎯 Respuesta de Ejemplo (v2.0)

```json
{
  "success": true,
  "source": "leroy",
  "prices": {
    "s02_3": 7.40,
    "s10": 2.50,
    "s11": 2.50,
    "ug1": 5.99,
    "g1_2350": 22.95
  },
  "methods": {
    "s02_3": "scraped",
    "s10": "fallback",
    "s11": "fallback",
    "ug1": "fallback",
    "g1_2350": "fallback"
  },
  "timestamp": "2026-02-14T05:00:00.000Z",
  "cached": false
}
```

**Nota**: El campo `methods` indica qué precios fueron obtenidos por scraping real (`"scraped"`) y cuáles son de fallback manual (`"fallback"`).

## 💡 Cómo Funciona el Sistema Híbrido

### 🔄 Flujo de Obtención de Precios

1. **Intento de Scraping Real**
   - El worker intenta acceder a la web de la tienda
   - Busca el producto usando URLs directas o búsqueda
   - Extrae el precio usando patrones inteligentes
   - **Detecta automáticamente** si el precio es por unidad o por paquete
   - Ejemplo: "14,79 € / Paquete (2 unidades)" → Calcula 7,40 € por unidad

2. **Detección de Cantidad**
   - Busca patrones como: "2 unidades", "pack de 4", "paquete de X"
   - Divide el precio automáticamente para obtener precio unitario
   - Evita errores comunes al comparar precios

3. **Fallback Automático**
   - Si el scraping falla (timeout, bloqueo, cambio de web), usa precios manuales
   - Los precios de fallback están actualizados (última revisión: 2026-02-14)
   - Garantiza que la aplicación siempre tenga precios disponibles

4. **Logging y Transparencia**
   - Cada petición registra si usó scraping o fallback
   - Puedes ver en los logs de Cloudflare qué está funcionando
   - El campo `methods` en la respuesta te dice el origen de cada precio

### 🎯 Ventajas del Sistema Híbrido

✅ **Precios actualizados** cuando el scraping funciona  
✅ **Siempre disponible** gracias al fallback  
✅ **Detección inteligente** de precios por paquete  
✅ **Transparente** - sabes qué precios son reales vs. manuales  
✅ **Robusto** - maneja errores automáticamente  

## 🔄 Actualizar Precios de Fallback

Los precios de fallback se usan cuando el scraping falla. Para actualizarlos:

1. Edita el objeto `FALLBACK_PRICES` en el worker (líneas 45-65)
2. Actualiza los valores con precios reales que hayas verificado
3. Haz clic en **Save and Deploy**

**Recomendación**: Revisa y actualiza los precios de fallback cada 1-2 meses.

## ⚠️ Solución de Problemas

### Error: "Worker not found"
- Verifica que el worker esté desplegado
- Comprueba la URL (debe incluir tu subdomain de Cloudflare)

### Error: "CORS"
- El worker ya tiene CORS configurado
- Si persiste, verifica que la URL sea correcta

### Precios no se actualizan
- Los precios se cachean 24 horas
- Puedes forzar actualización editando el worker y volviendo a desplegar

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs en Cloudflare Dashboard > Workers > tu-worker > Logs
2. Verifica que la URL del worker sea correcta
3. Prueba el endpoint directamente en el navegador
