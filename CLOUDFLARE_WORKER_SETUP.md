# Guía de Despliegue - Cloudflare Worker para Precios

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

## 🎯 Respuesta de Ejemplo

```json
{
  "success": true,
  "source": "leroy",
  "prices": {
    "s02_3": 14.99,
    "s10": 2.50,
    "s11": 2.50,
    "ug1": 5.99,
    "g1_2350": 22.95
  },
  "timestamp": "2026-02-13T22:00:00.000Z",
  "cached": false
}
```

## 💡 Notas Importantes

1. **Límites gratuitos**: 100,000 peticiones/día (más que suficiente)
2. **Cache**: Los precios se cachean 24 horas para no saturar las webs
3. **Fallback**: Si el scraping falla, usa precios de respaldo
4. **CORS**: Configurado para permitir peticiones desde cualquier origen

## 🔄 Actualizar Precios de Fallback

Si quieres actualizar los precios de respaldo manualmente:

1. Edita el objeto `FALLBACK_PRICES` en el worker
2. Actualiza los valores
3. Haz clic en **Save and Deploy**

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
