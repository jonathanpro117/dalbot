# dalbot multiplayer demo

Prototype de shooter 2D sincronizado con Phaser + Vite en el cliente y Socket.IO en el servidor.

## Estructura
- `client/`: cliente Vite con Phaser. Renderiza el mapa, nave del jugador, proyectiles y realiza interpolación de estados.
- `server/`: servidor Node.js con Socket.IO. Gestiona sala única, actualiza estados de jugadores/proyectiles y valida disparos/colisiones.

## Ejecución
1. Instala dependencias en cada carpeta (`client/` y `server/`):
   ```bash
   npm install
   ```
2. Inicia el servidor (tickrate por defecto 20 Hz):
   ```bash
   cd server
   npm start
   ```
3. Inicia el cliente (render 60 FPS, inputs a ~30 por segundo):
   ```bash
   cd client
   npm run dev
   ```
4. Abre dos pestañas en `http://localhost:5173` para probar la sincronización y colisiones.

## Notas técnicas
- Mapa 2D simple con cuadrícula de 1600x900.
- Detección de colisión círculo/caja aproximada para proyectiles y cuerpos de las naves, con daño y respawn (HP vuelve a 100).
- El cliente interpola posiciones/rotaciones recibidas del servidor para suavizar movimiento; el servidor valida inputs y emite el estado en cada tick.
