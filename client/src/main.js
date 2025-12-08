import Phaser from 'phaser';
import MainScene from './scenes/MainScene';

const config = {
  type: Phaser.AUTO,
  width: 960,
  height: 600,
  backgroundColor: '#04070f',
  parent: 'app',
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  },
  fps: {
    target: 60
  },
  scene: [MainScene]
};

new Phaser.Game(config);
