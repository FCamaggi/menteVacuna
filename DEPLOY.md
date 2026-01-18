# Guía de Deploy - Mente Vacuna

## 📋 Checklist Pre-Deploy

- [ ] Repositorio en GitHub
- [ ] Variables de entorno configuradas
- [ ] MongoDB Atlas creado (opcional)
- [ ] Cuenta en Render
- [ ] Cuenta en Netlify

## 🔧 Paso 1: Configurar MongoDB Atlas (Opcional)

### Si quieres persistencia entre reinicios del servidor:

1. Ve a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Crea una cuenta gratuita
3. Crea un nuevo cluster (Free Tier M0)
4. En "Database Access", crea un usuario:
   - Username: `menteVacunaUser`
   - Password: Genera una contraseña segura
   - Database User Privileges: Read and write to any database

5. En "Network Access", agrega:
   - IP Address: `0.0.0.0/0` (permitir desde cualquier lugar)
   
6. En "Database", click en "Connect":
   - Selecciona "Connect your application"
   - Copia la URI de conexión
   - Reemplaza `<password>` con tu contraseña
   - Guárdala para el siguiente paso

**Ejemplo de URI:**
```
mongodb+srv://menteVacunaUser:TuPassword123@cluster0.xxxxx.mongodb.net/mente_vacuna?retryWrites=true&w=majority
```

## 🚀 Paso 2: Deploy del Backend en Render

1. Ve a [Render.com](https://render.com) y crea una cuenta
2. Click en "New +" → "Web Service"
3. Conecta tu repositorio de GitHub
4. Configuración del servicio:

```
Name: mente-vacuna-server
Region: Elige la más cercana
Branch: main
Root Directory: [VACÍO - déjalo en blanco]
Runtime: Node
Build Command: cd server && npm install
Start Command: cd server && npm start
```

5. En "Advanced", configura las variables de entorno:

```bash
PORT=3001
NODE_ENV=production
CLIENT_URL=https://PENDIENTE.netlify.app
# Si configuraste MongoDB:
MONGODB_URI=mongodb+srv://menteVacunaUser:TuPassword123@cluster0.xxxxx.mongodb.net/mente_vacuna
```

**NOTA**: `CLIENT_URL` lo actualizaremos después del deploy del frontend

6. Selecciona el plan **Free**
7. Click en "Create Web Service"

8. **Espera** a que el deploy termine (5-10 minutos)
9. Copia la URL del servidor (ej: `https://mente-vacuna-server.onrender.com`)

### ⚠️ Importante sobre Render Free Tier:
- El servidor se "duerme" después de 15 minutos de inactividad
- La primera petición después de dormirse tarda ~30 segundos en responder
- Es normal y no afecta la experiencia después de la primera carga

## 🌐 Paso 3: Deploy del Frontend en Netlify

1. Ve a [Netlify.com](https://netlify.com) y crea una cuenta
2. Click en "Add new site" → "Import an existing project"
3. Conecta tu repositorio de GitHub
4. Configuración del sitio:

```
Base directory: client
Build command: npm run build
Publish directory: client/dist
```

5. En "Advanced build settings", agrega la variable de entorno:

```bash
VITE_SERVER_URL=https://mente-vacuna-server.onrender.com
```

**IMPORTANTE**: Usa la URL de tu servidor de Render del paso anterior

6. Click en "Deploy site"
7. Espera a que termine el deploy (2-5 minutos)
8. Copia la URL generada (ej: `https://amazing-unicorn-123456.netlify.app`)

### Personalizar dominio (opcional):
- En "Site settings" → "Domain management"
- Puedes cambiar el subdominio o agregar un dominio personalizado

## 🔄 Paso 4: Actualizar CORS en Render

1. Vuelve a Render
2. Ve a tu servicio `mente-vacuna-server`
3. Click en "Environment"
4. Edita la variable `CLIENT_URL`:

```bash
CLIENT_URL=https://tu-sitio-real.netlify.app
```

5. Guarda los cambios
6. El servidor se reiniciará automáticamente

## ✅ Paso 5: Verificar el Deploy

1. Abre tu sitio de Netlify
2. Intenta crear un lobby
3. Abre otra pestaña en modo incógnito
4. Únete al lobby con el código
5. Juega una ronda completa
6. Recarga la página para verificar la reconexión

### Checklist de Verificación:
- [ ] El cliente carga correctamente
- [ ] Se puede crear un lobby
- [ ] Otros pueden unirse al lobby
- [ ] Las preguntas se muestran
- [ ] Las respuestas se envían correctamente
- [ ] La puntuación se actualiza
- [ ] La reconexión funciona al recargar

## 🐛 Troubleshooting

### Error: "Failed to connect to server"

**Causa**: El servidor no está corriendo o la URL es incorrecta

**Solución**:
1. Verifica que el servidor en Render esté "Running" (verde)
2. Revisa que `VITE_SERVER_URL` en Netlify sea correcta
3. Asegúrate de incluir `https://` en la URL

### Error: "CORS policy blocked"

**Causa**: El servidor no permite peticiones desde tu dominio

**Solución**:
1. Ve a Render → Environment
2. Verifica que `CLIENT_URL` tenga tu URL de Netlify correcta
3. Reinicia el servicio

### El servidor tarda mucho en responder

**Causa**: El servidor de Render se durmió (Free tier)

**Solución**:
- Espera 30-60 segundos en la primera carga
- Considera actualizar a un plan de pago si necesitas respuesta instantánea
- Usa un servicio de "ping" para mantener el servidor activo

### MongoDB no conecta

**Causa**: URI incorrecta o IP no permitida

**Solución**:
1. Verifica la URI en MongoDB Atlas
2. En Network Access, asegúrate de tener `0.0.0.0/0`
3. El servidor funcionará en modo memoria si MongoDB falla (perderás datos al reiniciar)

### No puedo reconectarme después de recargar

**Causa**: LocalStorage limpiado o lobby expirado

**Solución**:
- Si el servidor se reinició, los lobbies en memoria se pierden
- Si usas MongoDB, los lobbies persisten 24 horas
- Crea un nuevo lobby si el anterior ya no existe

## 📊 Monitoreo

### Logs del Servidor (Render):
1. Ve a tu servicio en Render
2. Click en "Logs" en la barra lateral
3. Aquí verás errores y actividad en tiempo real

### Logs del Cliente (Netlify):
1. Ve a tu sitio en Netlify
2. Click en "Deploys"
3. Click en el último deploy para ver el build log

### Ver tráfico:
- Render muestra peticiones y uso de recursos
- Netlify muestra número de deploys y ancho de banda

## 🔒 Seguridad

### Recomendaciones:
1. **Nunca** hagas commit de archivos `.env`
2. Usa `.env.example` como plantilla
3. Rota las credenciales de MongoDB periódicamente
4. Limita el acceso a MongoDB a IPs conocidas en producción
5. Considera agregar rate limiting para evitar spam

## 💰 Costos

### Free Tier Limits:
- **Render Free**: 750 horas/mes, servidor se duerme después de 15 min
- **Netlify Free**: 100GB ancho de banda/mes, 300 minutos build/mes
- **MongoDB Atlas Free**: 512MB storage, cluster compartido

### Cuando escalar:
- Si tienes >50 jugadores activos simultáneos
- Si necesitas respuesta instantánea (sin sleep)
- Si necesitas más de 512MB en MongoDB

## 🎉 ¡Listo!

Tu juego Mente Vacuna ahora está desplegado y accesible desde cualquier lugar.

Comparte la URL de Netlify con tus amigos y ¡a jugar! 🐮

---

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs en Render y Netlify
2. Verifica todas las variables de entorno
3. Consulta la sección de Troubleshooting
4. Abre un issue en GitHub con los detalles del error
