# Mente Vacuna - Juego Multijugador 🐮

Juego de fiesta donde los jugadores deben pensar como un rebaño y dar respuestas mayoritarias para ganar puntos.

## 🎮 Características

- **Multijugador en tiempo real** con WebSockets
- **Persistencia completa**: reconexión automática si recargas la página
- **Sistema de lobbies** con códigos únicos
- **Sin límite de jugadores** por lobby (recomendado 3-10)
- **Interfaz responsive** optimizada para móviles y escritorio

## 🏗️ Arquitectura

### Frontend (client/)
- **React** con Vite
- **Socket.IO Client** para comunicación en tiempo real
- **LocalStorage** para persistencia de sesión
- Deploy en **Netlify**

### Backend (server/)
- **Node.js** con Express
- **Socket.IO** para WebSockets
- **MongoDB** (opcional) para persistencia
- Modo memoria si MongoDB no está disponible
- Deploy en **Render**

## 📦 Instalación y Desarrollo Local

### Requisitos
- Node.js 18+ 
- npm o yarn
- MongoDB (opcional, funciona sin él)

### 1. Clonar e instalar

```bash
# Instalar dependencias del servidor
cd server
npm install

# Instalar dependencias del cliente
cd ../client
npm install
```

### 2. Configurar variables de entorno

**Server (.env):**
```bash
cd server
cp .env.example .env
# Editar .env con tus valores
```

**Client (.env):**
```bash
cd client
cp .env.example .env
# Editar .env con la URL de tu servidor
```

### 3. Ejecutar en desarrollo

**Terminal 1 - Servidor:**
```bash
cd server
npm run dev
# Servidor corriendo en http://localhost:3001
```

**Terminal 2 - Cliente:**
```bash
cd client
npm run dev
# Cliente corriendo en http://localhost:3000
```

## 🚀 Deployment

### Backend en Render

1. Crea un nuevo **Web Service** en [Render](https://render.com)
2. Conecta tu repositorio de GitHub
3. Configuración:
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
   - **Root Directory**: Déjalo vacío
4. Variables de entorno:
   ```
   PORT=3001
   NODE_ENV=production
   CLIENT_URL=https://tu-app.netlify.app
   MONGODB_URI=mongodb+srv://... (opcional)
   ```

### MongoDB Atlas (Opcional)

1. Crea una cuenta en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Crea un cluster gratuito
3. Obtén la URI de conexión
4. Agrégala como `MONGODB_URI` en Render

**Nota**: Si no configuras MongoDB, el servidor usará almacenamiento en memoria (se pierde al reiniciar).

### Frontend en Netlify

1. Crea un nuevo sitio en [Netlify](https://netlify.com)
2. Conecta tu repositorio de GitHub
3. Configuración:
   - **Base directory**: `client`
   - **Build command**: `npm run build`
   - **Publish directory**: `client/dist`
4. Variable de entorno:
   ```
   VITE_SERVER_URL=https://tu-servidor.onrender.com
   ```

## 🎯 Cómo Jugar

1. **Crear Partida**: Un jugador crea un lobby y comparte el código
2. **Unirse**: Otros jugadores ingresan el código para unirse
3. **Jugar**: 
   - Se muestra una pregunta
   - Todos escriben su respuesta en secreto
   - Las respuestas se revelan
   - La mayoría gana 1 punto 🐄
   - Las respuestas únicas reciben la vaca rosa 🌸
4. **Ganar**: Primer jugador en llegar a 8 puntos SIN la vaca rosa

## 📱 Características Técnicas

### Persistencia
- **LocalStorage** guarda `lobbyCode` y `playerId`
- Al recargar la página, reconecta automáticamente
- El servidor mantiene el estado del juego
- Los jugadores pueden salir y volver sin problemas

### Sistema de Reconexión
- Detecta automáticamente sesiones guardadas
- Restaura estado del juego completo
- Notifica a otros jugadores de la reconexión
- Manejo de desconexiones temporales

### Escalabilidad
- Socket.IO con rooms para múltiples lobbies
- MongoDB para persistencia distribuida
- Modo memoria para desarrollo sin DB
- Expiración automática de lobbies antiguos (24h)

## 🛠️ Estructura del Proyecto

```
mente_vacuna/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── App.jsx        # Componente principal
│   │   ├── App.css        # Estilos
│   │   └── main.jsx       # Entry point
│   ├── index.html
│   ├── vite.config.js
│   ├── netlify.toml       # Config de Netlify
│   └── package.json
│
├── server/                 # Backend Node.js
│   ├── src/
│   │   ├── server.js      # Servidor principal
│   │   ├── gameManager.js # Lógica del juego
│   │   ├── database.js    # Gestión de MongoDB
│   │   └── questions.js   # Banco de preguntas
│   ├── .env.example
│   └── package.json
│
└── docs/
    └── Manual.md          # Reglas del juego
```

## 🔧 Comandos Útiles

```bash
# Desarrollo
npm run dev          # Ejecutar en modo desarrollo

# Producción
npm run build        # Build del cliente
npm start            # Iniciar servidor

# Ver logs en Render
# Directamente en el dashboard de Render
```

## 🐛 Troubleshooting

### El cliente no se conecta al servidor
- Verifica que `VITE_SERVER_URL` esté correcta
- Asegúrate que el servidor esté corriendo
- Revisa CORS en el servidor

### Error de reconexión
- Borra el localStorage: `localStorage.clear()`
- Verifica que el lobby aún exista

### MongoDB no conecta
- El servidor funcionará en modo memoria
- Verifica la URI de MongoDB
- Revisa whitelist de IPs en MongoDB Atlas

## 📝 Próximas Mejoras

- [ ] Sistema de avatares personalizados
- [ ] Más categorías de preguntas
- [ ] Temporizador por ronda
- [ ] Chat en el lobby
- [ ] Historial de partidas
- [ ] Logros y estadísticas

## 📄 Licencia

MIT

## 👥 Contribuciones

¡Las contribuciones son bienvenidas! Por favor abre un issue o PR.

---

**¡Diviértete jugando Mente Vacuna! 🐮🎉**
