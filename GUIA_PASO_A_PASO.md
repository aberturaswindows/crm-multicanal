# 🚀 GUÍA PASO A PASO - NexoCRM

## Para quién es esta guía
Esta guía está pensada para alguien que **nunca programó**. Cada paso está explicado en detalle.
Si te trabás en algún punto, copiá el mensaje de error y consultame.

---

## PASO 0: Cosas que necesitás antes de empezar

- [ ] Una computadora (Windows, Mac o Linux)
- [ ] Conexión a internet
- [ ] Una tarjeta de crédito/débito (para registrarte en servicios, la mayoría tiene plan gratuito)
- [ ] Acceso de administrador a:
  - La página de Facebook de la empresa
  - La cuenta de Instagram Business de la empresa
  - Los 3 números de WhatsApp de la empresa

---

## PASO 1: Crear cuentas en los servicios (30 minutos)

### 1.1 — GitHub (donde va a vivir el código)
1. Ir a **https://github.com**
2. Click en **"Sign up"**
3. Crear una cuenta con tu email
4. Verificar el email

### 1.2 — Railway (donde va a correr el servidor)
1. Ir a **https://railway.app**
2. Click en **"Login"** → **"Login with GitHub"**
3. Autorizar Railway

### 1.3 — Anthropic (la IA para clasificar mensajes)
1. Ir a **https://console.anthropic.com/**
2. Crear una cuenta
3. Ir a **"API Keys"** → **"Create Key"**
4. Copiar la key (empieza con `sk-ant-...`) y guardarla en un lugar seguro
5. Cargar crédito: **$5 USD** alcanzan para varios meses

### 1.4 — Meta Business (WhatsApp + Instagram + Facebook)
1. Ir a **https://business.facebook.com/**
2. Si no tenés cuenta Business, crear una
3. Ir a **https://developers.facebook.com/**
4. Click en **"Mis apps"** → **"Crear app"**
5. Elegir **"Otro"** → **"Empresa"**
6. Nombre: "CRM de [tu empresa]"

> ⚠️ **IMPORTANTE**: La verificación del negocio en Meta puede tardar 3-7 días.
> Podés avanzar con los otros pasos mientras tanto.

---

## PASO 2: Subir el código a GitHub (15 minutos)

### 2.1 — Instalar Git
- **Windows**: Descargar de https://git-scm.com/download/win e instalar (siguiente, siguiente, siguiente)
- **Mac**: Abrir Terminal y escribir `git --version` (se instala solo)

### 2.2 — Instalar Node.js
1. Ir a **https://nodejs.org**
2. Descargar la versión **LTS** (el botón verde de la izquierda)
3. Instalar (siguiente, siguiente, siguiente)
4. Reiniciar la computadora

### 2.3 — Subir el proyecto

Abrir la **Terminal** (Mac/Linux) o **CMD** (Windows) y escribir estos comandos **uno por uno**:

```bash
# 1. Ir al escritorio
cd ~/Desktop

# 2. Crear el repositorio en GitHub
#    (primero ir a github.com → "+" → "New repository" → nombre: "nexocrm" → "Create")

# 3. Descomprimir el ZIP que te di en el escritorio

# 4. Entrar a la carpeta
cd nexocrm

# 5. Instalar dependencias (tarda 1-2 minutos)
npm install

# 6. Probar que funciona localmente
npm start
#    Deberías ver el mensaje "CRM MULTICANAL CON IA" 
#    Abrí el navegador en http://localhost:3000
#    Ctrl+C para detenerlo

# 7. Subir a GitHub
git init
git add .
git commit -m "Primera versión del CRM"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/nexocrm.git
git push -u origin main
```

> 💡 Reemplazá `TU_USUARIO` con tu usuario de GitHub.
> Si te pide contraseña, usá un "Personal Access Token" de GitHub 
> (Settings → Developer Settings → Personal Access Tokens → Generate)

---

## PASO 3: Hacer deploy en Railway (10 minutos)

1. Ir a **https://railway.app/dashboard**
2. Click en **"New Project"**
3. Click en **"Deploy from GitHub repo"**
4. Seleccionar **"nexocrm"**
5. Railway va a detectar que es Node.js y empezar a construirlo

### 3.1 — Configurar las variables de entorno
1. En Railway, click en el servicio desplegado
2. Ir a la pestaña **"Variables"**
3. Click en **"New Variable"** y agregar estas (una por una):

| Variable | Valor |
|----------|-------|
| `ANTHROPIC_API_KEY` | La key de Anthropic (paso 1.3) |
| `COMPANY_NAME` | El nombre de tu empresa |
| `ADMIN_PASSWORD` | Una contraseña segura |
| `META_VERIFY_TOKEN` | Inventar un texto secreto, ej: `mi_crm_secreto_2026` |

> 💡 Las demás variables (WhatsApp, Instagram, etc.) se agregan después cuando tengamos las APIs configuradas.

### 3.2 — Obtener la URL pública
1. En Railway, ir a **"Settings"** del servicio
2. En **"Networking"** → **"Generate Domain"**
3. Te va a dar una URL tipo: `https://nexocrm-xxxx.up.railway.app`
4. **Copiar esta URL** — la vas a necesitar para los webhooks

### 3.3 — Verificar que funciona
1. Abrir la URL en el navegador
2. Deberías ver el CRM funcionando
3. Ir a `TU_URL/health` para ver el estado de los canales

---

## PASO 4: Conectar WhatsApp (30 minutos)

### 4.1 — Configurar WhatsApp Business API en Meta
1. En **developers.facebook.com** → tu app
2. En el menú lateral: **"Agregar producto"** → buscar **"WhatsApp"** → **"Configurar"**
3. Ir a **"API Setup"**
4. Te van a dar un **token temporal** — copiarlo
5. Agregar en Railway la variable: `WHATSAPP_TOKEN` = el token

### 4.2 — Registrar los números de teléfono
1. En **WhatsApp > API Setup** → **"Add phone number"**
2. Registrar las 3 líneas (una por una)
3. Por cada número, anotar el **"Phone Number ID"** (es un número largo)
4. Agregar en Railway:
   - `WHATSAPP_PHONE_ID_1` = ID del primer número
   - `WHATSAPP_PHONE_ID_2` = ID del segundo número
   - `WHATSAPP_PHONE_ID_3` = ID del tercer número

### 4.3 — Configurar el Webhook
1. En **WhatsApp > Configuration** → **"Webhook"**
2. **Callback URL**: `https://TU_URL_RAILWAY/webhooks/meta`
3. **Verify Token**: el mismo valor que pusiste en `META_VERIFY_TOKEN`
4. Click en **"Verify and save"**
5. En **"Webhook fields"** → suscribirse a: `messages`

### 4.4 — Token permanente
1. En **Business Settings** → **"System Users"** → crear uno
2. Asignarle permisos sobre la app de WhatsApp
3. Generar un **"Token permanente"**
4. Actualizar `WHATSAPP_TOKEN` en Railway con este token nuevo

---

## PASO 5: Conectar Instagram (15 minutos)

### 5.1 — Vincular Instagram Business
1. Tu cuenta de Instagram debe ser **Business** o **Creator**
2. Debe estar vinculada a la página de Facebook de la empresa
3. En **developers.facebook.com** → tu app
4. **"Agregar producto"** → **"Instagram"** (Messenger API) → **"Configurar"**

### 5.2 — Configurar Webhook
1. El webhook ya está configurado (es la misma URL `/webhooks/meta`)
2. En **"Instagram > Webhooks"** → suscribirse a: `messages`

### 5.3 — Token
1. Usar el mismo **Page Token** de Facebook
2. Agregar en Railway: `INSTAGRAM_TOKEN` = el token

---

## PASO 6: Conectar Facebook Messenger (10 minutos)

### 6.1 — Configurar en Meta
1. En **developers.facebook.com** → tu app
2. **"Agregar producto"** → **"Messenger"** → **"Configurar"**
3. En **"Access Tokens"** → seleccionar tu página → **"Generate Token"**
4. Copiar el token

### 6.2 — Variables y Webhook
1. Agregar en Railway:
   - `FACEBOOK_PAGE_TOKEN` = el token
   - `FACEBOOK_PAGE_ID` = el ID de tu página (está en la URL de tu página)
2. En **Messenger > Webhooks** → la URL ya está configurada desde WhatsApp
3. Suscribirse a: `messages`, `messaging_postbacks`

---

## PASO 7: Conectar Email (15 minutos)

### 7.1 — SendGrid
1. Ir a **https://signup.sendgrid.com/**
2. Crear cuenta (plan gratuito: 100 emails/día)
3. Ir a **Settings → API Keys → Create API Key**
4. Agregar en Railway: `SENDGRID_API_KEY` = la key
5. Agregar: `EMAIL_FROM` = el email de la empresa

### 7.2 — Recibir emails (Inbound Parse)
1. En SendGrid → **Settings → Inbound Parse**
2. Agregar dominio
3. URL: `https://TU_URL_RAILWAY/webhooks/email`

> 💡 **Alternativa más simple**: No configurar SendGrid y registrar emails manualmente en el CRM.

---

## PASO 8: Probar todo (15 minutos)

1. **WhatsApp**: Enviar un mensaje desde otro celular a uno de los 3 números
2. **Instagram**: Enviar un DM a la cuenta de la empresa
3. **Facebook**: Enviar un mensaje a la página de Facebook
4. Abrir el CRM en el navegador y verificar que el mensaje aparece
5. Verificar que la IA lo clasificó correctamente

---

## 🔧 Solución de problemas comunes

### "No me aparecen los mensajes en el CRM"
- Ir a `TU_URL/health` y verificar que los canales estén en `true`
- Revisar en Railway → **"Logs"** si hay errores
- Verificar que los webhooks estén activos en Meta

### "La IA no clasifica / no sugiere"
- Verificar que `ANTHROPIC_API_KEY` esté configurada correctamente
- Verificar que tengas crédito en Anthropic

### "Me da error 403 en el webhook de Meta"
- Verificar que `META_VERIFY_TOKEN` sea exactamente igual en Railway y en Meta

### "Railway me cobra?"
- Railway tiene **$5 USD de crédito gratuito por mes** (Trial plan)
- Después son ~$5-10 USD/mes dependiendo del uso
- Si necesitás más, el plan Hobby es $5 USD/mes fijo

---

## 📋 Checklist final

- [ ] GitHub: código subido
- [ ] Railway: servidor corriendo
- [ ] Anthropic: IA funcionando
- [ ] WhatsApp: 3 líneas conectadas
- [ ] Instagram: DMs conectados
- [ ] Facebook: Messenger conectado
- [ ] Email: SendGrid configurado (opcional)
- [ ] Prueba: mensaje de cada canal recibido en el CRM

---

## ¿Necesitás ayuda?

Volvé a la conversación conmigo en Claude y decime:
- Qué paso estás haciendo
- Qué error te aparece (si hay)
- Una captura de pantalla si podés

Te guío en el momento. ¡Éxitos! 🎉
