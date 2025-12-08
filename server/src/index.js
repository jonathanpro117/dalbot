import http from 'http';
import { Server } from 'socket.io';

const PORT = process.env.PORT || 3001;
const TICK_RATE = 1000 / 20; // 20 ticks per second
const MAP_WIDTH = 1600;
const MAP_HEIGHT = 900;
const PLAYER_SPEED = 260;
const PROJECTILE_SPEED = 520;
const PROJECTILE_LIFETIME = 2000;
const SHOOT_COOLDOWN = 350;

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

const players = new Map();
const inputs = new Map();
const projectiles = new Map();
let projectileId = 0;

function randomSpawn() {
  return {
    x: (Math.random() - 0.5) * (MAP_WIDTH - 100),
    y: (Math.random() - 0.5) * (MAP_HEIGHT - 100)
  };
}

io.on('connection', (socket) => {
  const spawn = randomSpawn();
  const player = {
    id: socket.id,
    x: spawn.x,
    y: spawn.y,
    angle: 0,
    hp: 100,
    lastShot: 0
  };

  players.set(socket.id, player);
  inputs.set(socket.id, { dx: 0, dy: 0, shoot: false });

  socket.emit('init', serializeState(socket.id));

  socket.on('input', (data) => {
    inputs.set(socket.id, {
      dx: Math.max(-1, Math.min(1, data.dx || 0)),
      dy: Math.max(-1, Math.min(1, data.dy || 0)),
      shoot: !!data.shoot
    });
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);
    inputs.delete(socket.id);
  });
});

function clampPosition(value, max) {
  return Math.max(-max / 2, Math.min(max / 2, value));
}

function spawnProjectile(owner, angle) {
  const id = ++projectileId;
  const speedX = Math.cos(angle) * PROJECTILE_SPEED;
  const speedY = Math.sin(angle) * PROJECTILE_SPEED;
  const projectile = {
    id,
    owner,
    x: players.get(owner).x,
    y: players.get(owner).y,
    vx: speedX,
    vy: speedY,
    createdAt: Date.now()
  };
  projectiles.set(id, projectile);
}

function updatePlayer(id, dt) {
  const player = players.get(id);
  if (!player) return;

  const input = inputs.get(id) || { dx: 0, dy: 0, shoot: false };
  const length = Math.hypot(input.dx, input.dy);
  const normX = length > 0 ? input.dx / length : 0;
  const normY = length > 0 ? input.dy / length : 0;

  player.x += normX * PLAYER_SPEED * dt;
  player.y += normY * PLAYER_SPEED * dt;

  player.x = clampPosition(player.x, MAP_WIDTH);
  player.y = clampPosition(player.y, MAP_HEIGHT);

  if (length > 0) {
    player.angle = Math.atan2(normY, normX);
  }

  if (input.shoot && Date.now() - player.lastShot > SHOOT_COOLDOWN) {
    spawnProjectile(id, player.angle);
    player.lastShot = Date.now();
  }
}

function updateProjectiles(dt) {
  const now = Date.now();
  projectiles.forEach((proj, id) => {
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;

    if (
      now - proj.createdAt > PROJECTILE_LIFETIME ||
      Math.abs(proj.x) > MAP_WIDTH / 2 ||
      Math.abs(proj.y) > MAP_HEIGHT / 2
    ) {
      projectiles.delete(id);
      return;
    }

    players.forEach((player, playerId) => {
      if (playerId === proj.owner) return;
      if (circleIntersects(player.x, player.y, 22, proj.x, proj.y, 6)) {
        player.hp -= 25;
        projectiles.delete(id);
        if (player.hp <= 0) {
          const spawn = randomSpawn();
          player.x = spawn.x;
          player.y = spawn.y;
          player.hp = 100;
        }
      }
    });
  });
}

function circleIntersects(x1, y1, r1, x2, y2, r2) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy <= (r1 + r2) * (r1 + r2);
}

function serializeState(clientId) {
  return {
    id: clientId,
    state: {
      players: Array.from(players.values()).map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        angle: p.angle,
        hp: p.hp
      })),
      projectiles: Array.from(projectiles.values()).map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y
      }))
    }
  };
}

function tick() {
  const dt = TICK_RATE / 1000;
  players.forEach((_player, id) => updatePlayer(id, dt));
  updateProjectiles(dt);
  io.emit('state', serializeState('').state);
}

setInterval(tick, TICK_RATE);

server.listen(PORT, () => {
  console.log(`Game server running on :${PORT}`);
});
