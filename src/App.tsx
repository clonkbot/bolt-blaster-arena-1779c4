import React, { useEffect, useRef, useState, useCallback } from 'react';

interface Vector2 {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Bolt {
  x: number;
  y: number;
  collected: boolean;
  sparkle: number;
}

interface Enemy {
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  type: 'drone' | 'tank' | 'boss';
  angle: number;
  shootCooldown: number;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  isEnemy: boolean;
  color: string;
  size: number;
}

interface Weapon {
  name: string;
  damage: number;
  fireRate: number;
  ammoMax: number;
  ammoCost: number;
  color: string;
  projectileSize: number;
  spread: number;
  level: number;
  upgradeCost: number;
}

interface GameState {
  player: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    health: number;
    maxHealth: number;
    angle: number;
    invincible: number;
  };
  weapons: Weapon[];
  currentWeapon: number;
  ammo: number;
  bolts: number;
  totalBolts: number;
  enemies: Enemy[];
  projectiles: Projectile[];
  particles: Particle[];
  boltPickups: Bolt[];
  wave: number;
  score: number;
  gameOver: boolean;
  paused: boolean;
  started: boolean;
}

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 700;

const initialWeapons: Weapon[] = [
  { name: 'Blaster', damage: 10, fireRate: 200, ammoMax: 100, ammoCost: 1, color: '#00d4ff', projectileSize: 6, spread: 0, level: 1, upgradeCost: 50 },
  { name: 'Combustor', damage: 25, fireRate: 400, ammoMax: 50, ammoCost: 2, color: '#ff6b35', projectileSize: 10, spread: 0.1, level: 1, upgradeCost: 100 },
  { name: 'Plasma Storm', damage: 5, fireRate: 50, ammoMax: 200, ammoCost: 1, color: '#a855f7', projectileSize: 4, spread: 0.3, level: 1, upgradeCost: 150 },
  { name: 'Devastator', damage: 50, fireRate: 800, ammoMax: 20, ammoCost: 5, color: '#f7c94b', projectileSize: 15, spread: 0, level: 1, upgradeCost: 200 },
];

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState>({
    player: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, vx: 0, vy: 0, health: 100, maxHealth: 100, angle: 0, invincible: 0 },
    weapons: JSON.parse(JSON.stringify(initialWeapons)),
    currentWeapon: 0,
    ammo: 100,
    bolts: 0,
    totalBolts: 0,
    enemies: [],
    projectiles: [],
    particles: [],
    boltPickups: [],
    wave: 1,
    score: 0,
    gameOver: false,
    paused: false,
    started: false,
  });
  
  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef<Vector2>({ x: 0, y: 0 });
  const shootingRef = useRef(false);
  const lastShotRef = useRef(0);
  const animationRef = useRef<number>(0);
  
  const [uiState, setUiState] = useState({
    health: 100,
    maxHealth: 100,
    ammo: 100,
    ammoMax: 100,
    bolts: 0,
    wave: 1,
    score: 0,
    currentWeapon: 0,
    weapons: initialWeapons,
    gameOver: false,
    paused: false,
    started: false,
  });

  const spawnParticles = useCallback((x: number, y: number, color: string, count: number, speed: number = 3) => {
    const state = gameStateRef.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = Math.random() * speed + 1;
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: 30 + Math.random() * 20,
        maxLife: 50,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }, []);

  const spawnBolts = useCallback((x: number, y: number, count: number) => {
    const state = gameStateRef.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 30;
      state.boltPickups.push({
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        collected: false,
        sparkle: Math.random() * Math.PI * 2,
      });
    }
  }, []);

  const spawnWave = useCallback((wave: number) => {
    const state = gameStateRef.current;
    const enemyCount = 3 + wave * 2;
    
    for (let i = 0; i < enemyCount; i++) {
      const side = Math.floor(Math.random() * 4);
      let x, y;
      
      switch (side) {
        case 0: x = Math.random() * CANVAS_WIDTH; y = -50; break;
        case 1: x = CANVAS_WIDTH + 50; y = Math.random() * CANVAS_HEIGHT; break;
        case 2: x = Math.random() * CANVAS_WIDTH; y = CANVAS_HEIGHT + 50; break;
        default: x = -50; y = Math.random() * CANVAS_HEIGHT;
      }
      
      const type = wave > 3 && Math.random() < 0.2 ? 'tank' : 'drone';
      const healthMult = type === 'tank' ? 3 : 1;
      
      state.enemies.push({
        x, y,
        health: (30 + wave * 10) * healthMult,
        maxHealth: (30 + wave * 10) * healthMult,
        type,
        angle: 0,
        shootCooldown: Math.random() * 60,
      });
    }
    
    if (wave % 5 === 0) {
      state.enemies.push({
        x: CANVAS_WIDTH / 2,
        y: -100,
        health: 200 + wave * 50,
        maxHealth: 200 + wave * 50,
        type: 'boss',
        angle: 0,
        shootCooldown: 0,
      });
    }
  }, []);

  const shoot = useCallback(() => {
    const state = gameStateRef.current;
    const weapon = state.weapons[state.currentWeapon];
    const now = Date.now();
    
    if (now - lastShotRef.current < weapon.fireRate) return;
    if (state.ammo < weapon.ammoCost) return;
    
    lastShotRef.current = now;
    state.ammo -= weapon.ammoCost;
    
    const spread = (Math.random() - 0.5) * weapon.spread;
    const angle = state.player.angle + spread;
    
    state.projectiles.push({
      x: state.player.x + Math.cos(angle) * 30,
      y: state.player.y + Math.sin(angle) * 30,
      vx: Math.cos(angle) * 15,
      vy: Math.sin(angle) * 15,
      damage: weapon.damage * weapon.level,
      isEnemy: false,
      color: weapon.color,
      size: weapon.projectileSize,
    });
    
    spawnParticles(state.player.x + Math.cos(angle) * 30, state.player.y + Math.sin(angle) * 30, weapon.color, 5, 2);
  }, [spawnParticles]);

  const upgradeWeapon = useCallback((index: number) => {
    const state = gameStateRef.current;
    const weapon = state.weapons[index];
    
    if (state.bolts >= weapon.upgradeCost && weapon.level < 5) {
      state.bolts -= weapon.upgradeCost;
      weapon.level++;
      weapon.upgradeCost = Math.floor(weapon.upgradeCost * 1.8);
      weapon.damage = Math.floor(weapon.damage * 1.3);
      weapon.ammoMax = Math.floor(weapon.ammoMax * 1.2);
      
      setUiState(prev => ({
        ...prev,
        bolts: state.bolts,
        weapons: [...state.weapons],
      }));
    }
  }, []);

  const resetGame = useCallback(() => {
    gameStateRef.current = {
      player: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, vx: 0, vy: 0, health: 100, maxHealth: 100, angle: 0, invincible: 0 },
      weapons: JSON.parse(JSON.stringify(initialWeapons)),
      currentWeapon: 0,
      ammo: 100,
      bolts: 0,
      totalBolts: 0,
      enemies: [],
      projectiles: [],
      particles: [],
      boltPickups: [],
      wave: 1,
      score: 0,
      gameOver: false,
      paused: false,
      started: true,
    };
    spawnWave(1);
    setUiState({
      health: 100,
      maxHealth: 100,
      ammo: 100,
      ammoMax: 100,
      bolts: 0,
      wave: 1,
      score: 0,
      currentWeapon: 0,
      weapons: JSON.parse(JSON.stringify(initialWeapons)),
      gameOver: false,
      paused: false,
      started: true,
    });
  }, [spawnWave]);

  const startGame = useCallback(() => {
    gameStateRef.current.started = true;
    spawnWave(1);
    setUiState(prev => ({ ...prev, started: true }));
  }, [spawnWave]);

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const state = gameStateRef.current;
    
    if (!state.started || state.paused || state.gameOver) {
      animationRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    // Update player movement
    const speed = 5;
    if (keysRef.current.has('w') || keysRef.current.has('arrowup')) state.player.vy = -speed;
    else if (keysRef.current.has('s') || keysRef.current.has('arrowdown')) state.player.vy = speed;
    else state.player.vy *= 0.8;
    
    if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) state.player.vx = -speed;
    else if (keysRef.current.has('d') || keysRef.current.has('arrowright')) state.player.vx = speed;
    else state.player.vx *= 0.8;
    
    state.player.x = Math.max(30, Math.min(CANVAS_WIDTH - 30, state.player.x + state.player.vx));
    state.player.y = Math.max(30, Math.min(CANVAS_HEIGHT - 30, state.player.y + state.player.vy));
    
    // Update player angle
    state.player.angle = Math.atan2(mouseRef.current.y - state.player.y, mouseRef.current.x - state.player.x);
    
    // Shooting
    if (shootingRef.current) shoot();
    
    // Update invincibility
    if (state.player.invincible > 0) state.player.invincible--;
    
    // Update projectiles
    state.projectiles = state.projectiles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      return p.x > -50 && p.x < CANVAS_WIDTH + 50 && p.y > -50 && p.y < CANVAS_HEIGHT + 50;
    });
    
    // Update enemies
    state.enemies.forEach(enemy => {
      const dx = state.player.x - enemy.x;
      const dy = state.player.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      enemy.angle = Math.atan2(dy, dx);
      
      const moveSpeed = enemy.type === 'tank' ? 1 : enemy.type === 'boss' ? 1.5 : 2;
      if (dist > 150) {
        enemy.x += (dx / dist) * moveSpeed;
        enemy.y += (dy / dist) * moveSpeed;
      }
      
      // Enemy shooting
      enemy.shootCooldown--;
      if (enemy.shootCooldown <= 0) {
        const fireRate = enemy.type === 'boss' ? 30 : enemy.type === 'tank' ? 90 : 120;
        enemy.shootCooldown = fireRate;
        
        if (enemy.type === 'boss') {
          for (let i = 0; i < 5; i++) {
            const spreadAngle = enemy.angle + (i - 2) * 0.3;
            state.projectiles.push({
              x: enemy.x, y: enemy.y,
              vx: Math.cos(spreadAngle) * 6,
              vy: Math.sin(spreadAngle) * 6,
              damage: 15, isEnemy: true, color: '#ff3366', size: 8,
            });
          }
        } else {
          state.projectiles.push({
            x: enemy.x, y: enemy.y,
            vx: Math.cos(enemy.angle) * 5,
            vy: Math.sin(enemy.angle) * 5,
            damage: enemy.type === 'tank' ? 15 : 10, isEnemy: true, color: '#ff3366', size: 6,
          });
        }
      }
    });
    
    // Collision detection
    state.projectiles = state.projectiles.filter(p => {
      if (!p.isEnemy) {
        for (let i = state.enemies.length - 1; i >= 0; i--) {
          const e = state.enemies[i];
          const size = e.type === 'boss' ? 50 : e.type === 'tank' ? 35 : 25;
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          if (dx * dx + dy * dy < (size + p.size) * (size + p.size)) {
            e.health -= p.damage;
            spawnParticles(p.x, p.y, p.color, 8);
            
            if (e.health <= 0) {
              const boltCount = e.type === 'boss' ? 20 : e.type === 'tank' ? 8 : 3;
              spawnBolts(e.x, e.y, boltCount);
              spawnParticles(e.x, e.y, '#ff6b35', 30, 5);
              state.score += e.type === 'boss' ? 500 : e.type === 'tank' ? 100 : 50;
              state.enemies.splice(i, 1);
            }
            return false;
          }
        }
      } else {
        const dx = p.x - state.player.x;
        const dy = p.y - state.player.y;
        if (dx * dx + dy * dy < 900 && state.player.invincible <= 0) {
          state.player.health -= p.damage;
          state.player.invincible = 60;
          spawnParticles(state.player.x, state.player.y, '#ff3366', 15);
          
          if (state.player.health <= 0) {
            state.gameOver = true;
            setUiState(prev => ({ ...prev, gameOver: true }));
          }
          return false;
        }
      }
      return true;
    });
    
    // Collect bolts
    state.boltPickups.forEach(bolt => {
      if (!bolt.collected) {
        const dx = state.player.x - bolt.x;
        const dy = state.player.y - bolt.y;
        if (dx * dx + dy * dy < 1600) {
          bolt.collected = true;
          state.bolts++;
          state.totalBolts++;
          spawnParticles(bolt.x, bolt.y, '#f7c94b', 5);
        }
      }
      bolt.sparkle += 0.1;
    });
    state.boltPickups = state.boltPickups.filter(b => !b.collected);
    
    // Ammo regen
    const weapon = state.weapons[state.currentWeapon];
    if (state.ammo < weapon.ammoMax) {
      state.ammo = Math.min(weapon.ammoMax, state.ammo + 0.1);
    }
    
    // Wave progression
    if (state.enemies.length === 0) {
      state.wave++;
      spawnWave(state.wave);
    }
    
    // Update particles
    state.particles = state.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.life--;
      return p.life > 0;
    });
    
    // Render
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Grid
    ctx.strokeStyle = '#1a1a3a';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_WIDTH; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }
    
    // Bolts
    state.boltPickups.forEach(bolt => {
      ctx.save();
      ctx.translate(bolt.x, bolt.y);
      ctx.rotate(bolt.sparkle);
      
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 15);
      gradient.addColorStop(0, '#f7c94b');
      gradient.addColorStop(0.5, '#ff6b35');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#f7c94b';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', 0, 0);
      ctx.restore();
    });
    
    // Enemies
    state.enemies.forEach(enemy => {
      const size = enemy.type === 'boss' ? 50 : enemy.type === 'tank' ? 35 : 25;
      const colors = enemy.type === 'boss' ? ['#ff3366', '#a855f7'] : enemy.type === 'tank' ? ['#ff6b35', '#f7c94b'] : ['#6366f1', '#00d4ff'];
      
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(enemy.angle);
      
      // Glow
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.5);
      gradient.addColorStop(0, colors[0] + '44');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
      ctx.fill();
      
      // Body
      ctx.fillStyle = colors[0];
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = colors[1];
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
      ctx.fill();
      
      // Eye
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(size * 0.4, 0, size * 0.25, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(size * 0.5, 0, size * 0.12, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
      
      // Health bar
      if (enemy.health < enemy.maxHealth) {
        ctx.fillStyle = '#333';
        ctx.fillRect(enemy.x - 25, enemy.y - size - 15, 50, 6);
        ctx.fillStyle = enemy.type === 'boss' ? '#a855f7' : '#ff3366';
        ctx.fillRect(enemy.x - 25, enemy.y - size - 15, 50 * (enemy.health / enemy.maxHealth), 6);
      }
    });
    
    // Projectiles
    state.projectiles.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 2);
      gradient.addColorStop(0, p.color);
      gradient.addColorStop(0.5, p.color + '88');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });
    
    // Player
    ctx.save();
    ctx.translate(state.player.x, state.player.y);
    ctx.rotate(state.player.angle);
    
    // Player glow
    const playerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 50);
    playerGlow.addColorStop(0, state.player.invincible > 0 ? '#ffffff44' : '#00d4ff22');
    playerGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = playerGlow;
    ctx.beginPath();
    ctx.arc(0, 0, 50, 0, Math.PI * 2);
    ctx.fill();
    
    // Body
    ctx.fillStyle = state.player.invincible > 0 && Math.floor(state.player.invincible / 5) % 2 === 0 ? '#fff' : '#00d4ff';
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner
    ctx.fillStyle = '#0a0a1a';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    
    // Core
    ctx.fillStyle = weapon.color;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    
    // Gun
    ctx.fillStyle = '#666';
    ctx.fillRect(15, -5, 20, 10);
    ctx.fillStyle = weapon.color;
    ctx.fillRect(30, -3, 8, 6);
    
    // Eye visor
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(5, 0, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    
    // Particles
    state.particles.forEach(p => {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    
    // Update UI
    setUiState({
      health: state.player.health,
      maxHealth: state.player.maxHealth,
      ammo: Math.floor(state.ammo),
      ammoMax: weapon.ammoMax,
      bolts: state.bolts,
      wave: state.wave,
      score: state.score,
      currentWeapon: state.currentWeapon,
      weapons: state.weapons,
      gameOver: state.gameOver,
      paused: state.paused,
      started: state.started,
    });
    
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [shoot, spawnParticles, spawnBolts, spawnWave]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      
      if (e.key >= '1' && e.key <= '4') {
        const index = parseInt(e.key) - 1;
        gameStateRef.current.currentWeapon = index;
        gameStateRef.current.ammo = Math.min(gameStateRef.current.ammo, gameStateRef.current.weapons[index].ammoMax);
      }
      
      if (e.key === 'Escape') {
        gameStateRef.current.paused = !gameStateRef.current.paused;
        setUiState(prev => ({ ...prev, paused: gameStateRef.current.paused }));
      }
      
      if (e.key === ' ') {
        e.preventDefault();
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      mouseRef.current = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };
    
    const handleMouseDown = () => { shootingRef.current = true; };
    const handleMouseUp = () => { shootingRef.current = false; };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    animationRef.current = requestAnimationFrame(gameLoop);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      cancelAnimationFrame(animationRef.current);
    };
  }, [gameLoop]);

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex flex-col items-center justify-center p-4 game-container relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -top-48 -left-48 animate-pulse"></div>
        <div className="absolute w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -bottom-48 -right-48 animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute w-64 h-64 bg-orange-500/10 rounded-full blur-3xl top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      </div>

      {/* Title */}
      <h1 className="font-orbitron text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-yellow-400 to-cyan-400 mb-4 animate-pulse-glow relative z-10">
        BOLT BLASTER ARENA
      </h1>
      
      {/* HUD */}
      <div className="w-full max-w-[1200px] flex flex-wrap justify-between items-center gap-4 mb-4 relative z-10">
        {/* Health & Ammo */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="font-orbitron text-red-400 text-sm w-16">HEALTH</span>
            <div className="w-48 h-6 health-bar-bg rounded-full overflow-hidden">
              <div 
                className="h-full health-bar-fill transition-all duration-200 rounded-full"
                style={{ width: `${(uiState.health / uiState.maxHealth) * 100}%` }}
              ></div>
            </div>
            <span className="font-orbitron text-white text-sm">{uiState.health}/{uiState.maxHealth}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-orbitron text-cyan-400 text-sm w-16">AMMO</span>
            <div className="w-48 h-4 bg-[#1a1a3a] rounded-full overflow-hidden">
              <div 
                className="h-full ammo-bar-fill transition-all duration-100 rounded-full"
                style={{ width: `${(uiState.ammo / uiState.ammoMax) * 100}%` }}
              ></div>
            </div>
            <span className="font-orbitron text-white text-sm">{uiState.ammo}/{uiState.ammoMax}</span>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex gap-6">
          <div className="bolt-counter px-4 py-2 rounded-lg">
            <span className="font-orbitron text-yellow-400">⚡ {uiState.bolts}</span>
          </div>
          <div className="px-4 py-2 bg-purple-500/20 border border-purple-500/50 rounded-lg">
            <span className="font-orbitron text-purple-400">WAVE {uiState.wave}</span>
          </div>
          <div className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/50 rounded-lg">
            <span className="font-orbitron text-cyan-400">SCORE {uiState.score}</span>
          </div>
        </div>
      </div>
      
      {/* Game Canvas */}
      <div className="relative neon-border rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block max-w-full h-auto cursor-crosshair"
          style={{ imageRendering: 'pixelated' }}
        />
        
        {/* Start Screen */}
        {!uiState.started && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
            <div className="text-center">
              <h2 className="font-orbitron text-3xl text-white mb-8 animate-float">READY TO BLAST?</h2>
              <div className="bg-[#1a1a3a]/80 p-6 rounded-lg mb-8 text-left">
                <p className="text-cyan-400 font-semibold mb-3">CONTROLS:</p>
                <p className="text-gray-300 text-sm mb-2">🎮 <span className="text-white">WASD / Arrows</span> - Move</p>
                <p className="text-gray-300 text-sm mb-2">🖱️ <span className="text-white">Mouse</span> - Aim</p>
                <p className="text-gray-300 text-sm mb-2">🔫 <span className="text-white">Click</span> - Shoot</p>
                <p className="text-gray-300 text-sm mb-2">🔢 <span className="text-white">1-4</span> - Switch Weapons</p>
                <p className="text-gray-300 text-sm">⏸️ <span className="text-white">ESC</span> - Pause</p>
              </div>
              <button 
                onClick={startGame}
                className="font-orbitron text-xl px-12 py-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-black font-bold rounded-lg hover:scale-105 transition-transform hover:shadow-lg hover:shadow-orange-500/50"
              >
                START GAME
              </button>
            </div>
          </div>
        )}
        
        {/* Pause Screen */}
        {uiState.paused && !uiState.gameOver && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center backdrop-blur-sm">
            <div className="text-center">
              <h2 className="font-orbitron text-4xl text-purple-400 mb-8">PAUSED</h2>
              <p className="text-gray-400 mb-4">Press ESC to resume</p>
            </div>
          </div>
        )}
        
        {/* Game Over Screen */}
        {uiState.gameOver && (
          <div className="absolute inset-0 bg-black/90 flex items-center justify-center backdrop-blur-sm">
            <div className="text-center">
              <h2 className="font-orbitron text-5xl text-red-500 mb-4">GAME OVER</h2>
              <p className="font-orbitron text-2xl text-yellow-400 mb-2">SCORE: {uiState.score}</p>
              <p className="font-orbitron text-xl text-cyan-400 mb-8">WAVE: {uiState.wave}</p>
              <button 
                onClick={resetGame}
                className="font-orbitron text-xl px-12 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold rounded-lg hover:scale-105 transition-transform hover:shadow-lg hover:shadow-cyan-500/50"
              >
                TRY AGAIN
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Weapons Panel */}
      <div className="w-full max-w-[1200px] mt-4 relative z-10">
        <div className="flex flex-wrap gap-3 justify-center">
          {uiState.weapons.map((weapon, i) => (
            <div 
              key={weapon.name}
              className={`weapon-slot p-3 rounded-lg cursor-pointer ${uiState.currentWeapon === i ? 'active' : ''}`}
              onClick={() => {
                gameStateRef.current.currentWeapon = i;
                gameStateRef.current.ammo = Math.min(gameStateRef.current.ammo, weapon.ammoMax);
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div 
                  className="w-8 h-8 rounded-full"
                  style={{ backgroundColor: weapon.color, boxShadow: `0 0 15px ${weapon.color}` }}
                ></div>
                <div>
                  <p className="font-orbitron text-white text-sm">{weapon.name}</p>
                  <p className="text-xs text-gray-400">LVL {weapon.level}</p>
                </div>
                <span className="font-orbitron text-gray-500 text-xs ml-2">[{i + 1}]</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">DMG: {weapon.damage * weapon.level}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); upgradeWeapon(i); }}
                  disabled={uiState.bolts < weapon.upgradeCost || weapon.level >= 5}
                  className="upgrade-btn px-2 py-1 rounded text-white font-semibold"
                >
                  {weapon.level >= 5 ? 'MAX' : `⚡${weapon.upgradeCost}`}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Footer */}
      <footer className="mt-8 text-center relative z-10">
        <p className="text-gray-600 text-xs">
          Requested by <span className="text-gray-500">@JustJayJusy</span> · Built by <span className="text-gray-500">@clonkbot</span>
        </p>
      </footer>
    </div>
  );
}

export default App;
