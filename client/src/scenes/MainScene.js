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
    this.createStarfield();
    this.drawMap();
    this.createShipTexture();
    this.createProjectileTexture();
    this.createThrusterTexture();

    this.engineParticles = this.add.particles('thruster').setDepth(2);
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
    g.fillStyle(0x0b1220, 0.85);
    g.fillRect(-MAP_WIDTH / 2, -MAP_HEIGHT / 2, MAP_WIDTH, MAP_HEIGHT);

    g.lineStyle(2, 0x1f2937, 0.6);
    for (let x = -MAP_WIDTH / 2; x <= MAP_WIDTH / 2; x += 100) {
      g.lineBetween(x, -MAP_HEIGHT / 2, x, MAP_HEIGHT / 2);
    }
    for (let y = -MAP_HEIGHT / 2; y <= MAP_HEIGHT / 2; y += 100) {
      g.lineBetween(-MAP_WIDTH / 2, y, MAP_WIDTH / 2, y);
    }

    this.cameras.main.setBounds(-MAP_WIDTH / 2, -MAP_HEIGHT / 2, MAP_WIDTH, MAP_HEIGHT);
  }

  createPlayerSprite(player) {
    const ship = this.add.sprite(player.x, player.y, 'ship');
    ship.setDepth(3);
    ship.setData('id', player.id);
    ship.setData('target', { x: player.x, y: player.y, angle: player.angle });

    const nameText = this.add.text(player.x, player.y + 38, `HP: ${player.hp}`, {
      fontSize: '12px',
      color: '#dbeafe',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    ship.setData('hpLabel', nameText);
    const engineEmitter = this.engineParticles.createEmitter({
      speed: { min: 70, max: 120 },
      lifespan: { min: 250, max: 450 },
      alpha: { start: 0.9, end: 0 },
      scale: { start: 0.9, end: 0 },
      blendMode: 'ADD',
      frequency: 35,
      quantity: 1,
      gravityY: 0,
      angle: 90,
      radial: true
    });
    engineEmitter.startFollow(ship);
    ship.setData('thruster', engineEmitter);
    this.alignThruster(ship);
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
    sprite.getData('hpLabel').setPosition(player.x, player.y + 38);
    sprite.setData('target', { x: player.x, y: player.y, angle: player.angle });
  }

  createProjectileSprite(projectile) {
    const bolt = this.add.sprite(projectile.x, projectile.y, 'projectile');
    bolt.setData('id', projectile.id);
    bolt.setDepth(2);
    this.projectiles.set(projectile.id, bolt);
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
          const thruster = sprite.getData('thruster');
          if (thruster) {
            thruster.stop();
            thruster.remove();
          }
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
      sprite.rotation = Phaser.Math.Angle.RotateTo(sprite.rotation, target.angle, 0.12);
      const hpLabel = sprite.getData('hpLabel');
      hpLabel.setPosition(sprite.x, sprite.y + 38);
      this.alignThruster(sprite);
    });

    this.projectiles.forEach((sprite) => {
      sprite.setDepth(2);
    });
  }

  createStarfield() {
    const stars = this.add.graphics();
    stars.fillStyle(0x0b0f1a, 1);
    stars.fillRect(-MAP_WIDTH / 2, -MAP_HEIGHT / 2, MAP_WIDTH, MAP_HEIGHT);

    Phaser.Math.RND.sow([Date.now()]);
    for (let i = 0; i < 180; i++) {
      const x = Phaser.Math.Between(-MAP_WIDTH / 2, MAP_WIDTH / 2);
      const y = Phaser.Math.Between(-MAP_HEIGHT / 2, MAP_HEIGHT / 2);
      const size = Phaser.Math.FloatBetween(1, 2.5);
      const alpha = Phaser.Math.FloatBetween(0.35, 0.9);
      stars.fillStyle(0xffffff, alpha);
      stars.fillCircle(x, y, size);
    }
    stars.setDepth(-2);
  }

  createShipTexture() {
    if (this.textures.exists('ship')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    g.fillStyle(0x0f172a, 1);
    g.fillRoundedRect(16, 40, 48, 56, 10);

    g.fillStyle(0x14b8a6, 1);
    g.fillPoints([
      { x: 40, y: 10 },
      { x: 64, y: 52 },
      { x: 40, y: 72 },
      { x: 16, y: 52 }
    ], true);

    g.fillStyle(0x3b82f6, 1);
    g.fillRoundedRect(30, 38, 20, 30, 8);

    g.fillStyle(0xf97316, 1);
    g.fillRoundedRect(28, 88, 24, 16, 6);

    g.lineStyle(3, 0x93c5fd, 1);
    g.strokeRoundedRect(16, 40, 48, 56, 10);
    g.lineBetween(16, 58, 64, 58);
    g.lineBetween(16, 74, 64, 74);

    g.generateTexture('ship', 96, 120);
  }

  createProjectileTexture() {
    if (this.textures.exists('projectile')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xfbbf24, 1);
    g.fillRoundedRect(6, 0, 12, 28, 6);
    g.lineStyle(2, 0xffffff, 0.9);
    g.strokeRoundedRect(6, 0, 12, 28, 6);
    g.generateTexture('projectile', 24, 32);
  }

  createThrusterTexture() {
    if (this.textures.exists('thruster')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xf97316, 0.9);
    g.fillCircle(8, 8, 8);
    g.fillStyle(0x22d3ee, 0.6);
    g.fillCircle(8, 8, 5);
    g.generateTexture('thruster', 16, 16);
  }

  alignThruster(sprite) {
    const thruster = sprite.getData('thruster');
    if (!thruster) return;
    const offset = new Phaser.Math.Vector2(0, 46).rotate(sprite.rotation + Math.PI);
    thruster.followOffset.set(offset.x, offset.y);
    const angleDeg = Phaser.Math.RadToDeg(sprite.rotation) + 180;
    thruster.setAngle({ min: angleDeg - 8, max: angleDeg + 8 });
  }
}
