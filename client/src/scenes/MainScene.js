import Phaser from 'phaser';
import { socket } from '../network/socket';

const MAP_WIDTH = 1600;
const MAP_HEIGHT = 900;
const INPUT_RATE = 1000 / 30; // 30 FPS input cadence

export default class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
    this.players = new Map();
    this.projectiles = new Map();
    this.lastInputSent = 0;
  }

  create() {
    this.drawMap();
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,SPACE');

    this.healthText = this.add.text(16, 16, 'HP: --', {
      fontSize: '18px',
      color: '#f8f9fa'
    }).setScrollFactor(0);

    this.infoText = this.add.text(16, 40, 'Move: WASD / Arrows | Shoot: Space', {
      fontSize: '14px',
      color: '#9ca3af'
    }).setScrollFactor(0);

    this.socket = socket;
    this.playerId = null;

    this.socket.on('connect', () => {
      this.socket.emit('join');
    });

    this.socket.on('init', (payload) => {
      this.playerId = payload.id;
      this.consumeState(payload.state, true);
    });

    this.socket.on('state', (state) => {
      this.consumeState(state, false);
    });

    this.socket.on('disconnect', () => {
      this.players.forEach((sprite) => sprite.destroy());
      this.projectiles.forEach((sprite) => sprite.destroy());
      this.players.clear();
      this.projectiles.clear();
    });
  }

  drawMap() {
    const g = this.add.graphics();
    g.fillStyle(0x0b1220, 1);
    g.fillRect(-MAP_WIDTH / 2, -MAP_HEIGHT / 2, MAP_WIDTH, MAP_HEIGHT);

    g.lineStyle(2, 0x1f2937, 1);
    for (let x = -MAP_WIDTH / 2; x <= MAP_WIDTH / 2; x += 100) {
      g.lineBetween(x, -MAP_HEIGHT / 2, x, MAP_HEIGHT / 2);
    }
    for (let y = -MAP_HEIGHT / 2; y <= MAP_HEIGHT / 2; y += 100) {
      g.lineBetween(-MAP_WIDTH / 2, y, MAP_WIDTH / 2, y);
    }

    this.cameras.main.setBounds(-MAP_WIDTH / 2, -MAP_HEIGHT / 2, MAP_WIDTH, MAP_HEIGHT);
  }

  createPlayerSprite(player) {
    const ship = this.add.triangle(player.x, player.y, 0, 20, 20, -12, -20, -12, 0x60a5fa);
    ship.setDepth(2);
    ship.setData('id', player.id);
    ship.setData('target', { x: player.x, y: player.y, angle: player.angle });

    const nameText = this.add.text(player.x, player.y + 26, `HP: ${player.hp}`, {
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0.5);

    ship.setData('hpLabel', nameText);
    this.players.set(player.id, ship);

    if (player.id === this.playerId) {
      this.cameras.main.startFollow(ship, true, 0.12, 0.12);
    }
  }

  updatePlayerSprite(player) {
    const sprite = this.players.get(player.id);
    if (!sprite) {
      this.createPlayerSprite(player);
      return;
    }

    sprite.getData('hpLabel').setText(`HP: ${player.hp}`);
    sprite.getData('hpLabel').setPosition(player.x, player.y + 26);
    sprite.setData('target', { x: player.x, y: player.y, angle: player.angle });
  }

  createProjectileSprite(projectile) {
    const circle = this.add.circle(projectile.x, projectile.y, 6, 0xf59e0b);
    circle.setData('id', projectile.id);
    circle.setDepth(1);
    this.projectiles.set(projectile.id, circle);
  }

  updateProjectileSprite(projectile) {
    const sprite = this.projectiles.get(projectile.id);
    if (!sprite) {
      this.createProjectileSprite(projectile);
      return;
    }
    sprite.setPosition(projectile.x, projectile.y);
  }

  consumeState(state, fullSync) {
    const seenPlayers = new Set();
    state.players.forEach((player) => {
      seenPlayers.add(player.id);
      this.updatePlayerSprite(player);
      if (player.id === this.playerId) {
        this.healthText.setText(`HP: ${player.hp}`);
      }
    });

    if (!fullSync) {
      this.players.forEach((sprite, id) => {
        if (!seenPlayers.has(id)) {
          sprite.getData('hpLabel').destroy();
          sprite.destroy();
          this.players.delete(id);
        }
      });
    }

    const seenProjectiles = new Set();
    state.projectiles.forEach((projectile) => {
      seenProjectiles.add(projectile.id);
      this.updateProjectileSprite(projectile);
    });

    this.projectiles.forEach((sprite, id) => {
      if (!seenProjectiles.has(id)) {
        sprite.destroy();
        this.projectiles.delete(id);
      }
    });
  }

  gatherInput() {
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const up = this.cursors.up.isDown || this.keys.W.isDown;
    const down = this.cursors.down.isDown || this.keys.S.isDown;
    const shoot = this.keys.SPACE.isDown;

    const dx = (right ? 1 : 0) - (left ? 1 : 0);
    const dy = (down ? 1 : 0) - (up ? 1 : 0);

    return { dx, dy, shoot };
  }

  update(time, delta) {
    if (!this.playerId) return;

    const input = this.gatherInput();
    if (time - this.lastInputSent > INPUT_RATE) {
      this.socket.emit('input', input);
      this.lastInputSent = time;
    }

    this.players.forEach((sprite) => {
      const target = sprite.getData('target');
      const lerp = 0.2;
      sprite.x = Phaser.Math.Linear(sprite.x, target.x, lerp);
      sprite.y = Phaser.Math.Linear(sprite.y, target.y, lerp);
      sprite.rotation = Phaser.Math.Angle.RotateTo(sprite.rotation, target.angle, 0.1);
      const hpLabel = sprite.getData('hpLabel');
      hpLabel.setPosition(sprite.x, sprite.y + 26);
    });

    this.projectiles.forEach((sprite) => {
      sprite.setDepth(1);
    });
  }
}
