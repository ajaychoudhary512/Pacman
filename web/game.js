// game.js - Full Pacman Game Engine with Built-in AI Search Visualization
(function() {
    'use strict';

    // Constants & Directions
    const DIRS = {
        STOP: { x: 0, y: 0, name: 'STOP' },
        WEST: { x: -1, y: 0, name: 'West', angle: Math.PI },
        EAST: { x: 1, y: 0, name: 'East', angle: 0 },
        NORTH: { x: 0, y: -1, name: 'North', angle: -Math.PI / 2 },
        SOUTH: { x: 0, y: 1, name: 'South', angle: Math.PI / 2 }
    };

    const GHOST_COLORS = {
        0: { name: 'Blinky', normal: '#ff3344', eye: '#ffffff' },
        1: { name: 'Pinky',  normal: '#ff77b4', eye: '#ffffff' },
        2: { name: 'Inky',   normal: '#00f0ff', eye: '#ffffff' },
        3: { name: 'Clyde',  normal: '#ff9933', eye: '#ffffff' }
    };

    class PacmanGame {
        constructor() {
            this.canvas = document.getElementById('gameCanvas');
            this.ctx = this.canvas.getContext('2d');
            
            this.scoreEl = document.getElementById('scoreValue');
            this.highScoreEl = document.getElementById('highScoreValue');
            this.dotsEl = document.getElementById('dotsValue');
            this.livesEl = document.getElementById('livesContainer');
            this.overlay = document.getElementById('gameOverlay');
            this.overlayTitle = document.getElementById('overlayTitle');
            this.overlaySubtitle = document.getElementById('overlaySubtitle');

            this.tileSize = 20;
            this.grid = [];
            this.width = 0;
            this.height = 0;

            this.score = 0;
            this.highScore = parseInt(localStorage.getItem('pacman_high_score') || '0', 10);
            this.lives = 3;
            this.dotsLeft = 0;

            this.pacman = null;
            this.ghosts = [];
            this.food = new Set();
            this.capsules = new Set();

            this.mode = 'manual'; // 'manual' or 'ai'
            this.aiAlgo = 'bfs';  // 'bfs', 'dfs', 'astar'
            this.aiPath = [];
            this.visitedNodes = [];
            this.showAiTrail = true;

            this.speedFactor = 1.0;
            this.isPaused = false;
            this.isGameOver = false;
            this.isVictory = false;

            this.floatingTexts = [];
            this.scaredTimer = 0;
            this.scaredMaxTime = 400; // frames
            this.ghostStreak = 0;

            this.currentLayout = 'originalClassic';
            this.mouthAngle = 0.2;
            this.mouthSpeed = 0.04;

            this.initListeners();
            this.loadLayout(this.currentLayout);
            this.renderHighScores();

            // Start main game loop
            requestAnimationFrame(this.loop.bind(this));
        }

        renderHighScores() {
            this.highScoreEl.textContent = this.highScore;
        }

        initListeners() {
            // Keyboard Controls
            window.addEventListener('keydown', (e) => {
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                    e.preventDefault();
                }
                if (e.key === ' ' || e.code === 'Space') {
                    this.togglePause();
                    return;
                }
                if (this.isPaused || this.isGameOver || this.isVictory) return;

                if (this.mode === 'manual' && this.pacman) {
                    if (e.key === 'ArrowLeft'  || e.key.toLowerCase() === 'a') this.pacman.nextDir = DIRS.WEST;
                    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') this.pacman.nextDir = DIRS.EAST;
                    if (e.key === 'ArrowUp'    || e.key.toLowerCase() === 'w') this.pacman.nextDir = DIRS.NORTH;
                    if (e.key === 'ArrowDown'  || e.key.toLowerCase() === 's') this.pacman.nextDir = DIRS.SOUTH;
                }
            });

            // Virtual D-pad
            const bindDpad = (id, dir) => {
                const el = document.getElementById(id);
                if (!el) return;
                const trigger = (e) => {
                    e.preventDefault();
                    if (this.mode === 'manual' && this.pacman) this.pacman.nextDir = dir;
                };
                el.addEventListener('mousedown', trigger);
                el.addEventListener('touchstart', trigger);
            };

            bindDpad('btnUp', DIRS.NORTH);
            bindDpad('btnDown', DIRS.SOUTH);
            bindDpad('btnLeft', DIRS.WEST);
            bindDpad('btnRight', DIRS.EAST);

            // Controls buttons
            document.getElementById('btnPause')?.addEventListener('click', () => this.togglePause());
            document.getElementById('btnRestart')?.addEventListener('click', () => this.restart());
            document.getElementById('overlayBtn')?.addEventListener('click', () => {
                this.overlay.classList.remove('active');
                this.restart();
            });

            // Sound button
            const soundBtn = document.getElementById('btnSound');
            if (soundBtn) {
                soundBtn.addEventListener('click', () => {
                    const isMuted = window.soundManager.toggleMute();
                    soundBtn.textContent = isMuted ? '🔇 Unmute' : '🔊 Sound';
                    soundBtn.classList.toggle('active', !isMuted);
                });
            }

            // Layout selector
            const layoutSelect = document.getElementById('layoutSelect');
            if (layoutSelect) {
                layoutSelect.addEventListener('change', (e) => {
                    this.currentLayout = e.target.value;
                    this.loadLayout(this.currentLayout);
                });
            }

            // Speed slider
            const speedSlider = document.getElementById('speedSlider');
            if (speedSlider) {
                speedSlider.addEventListener('input', (e) => {
                    this.speedFactor = parseFloat(e.target.value);
                });
            }

            // AI Algorithm select
            const aiAlgoSelect = document.getElementById('aiAlgoSelect');
            if (aiAlgoSelect) {
                aiAlgoSelect.addEventListener('change', (e) => {
                    this.aiAlgo = e.target.value;
                    if (this.mode === 'ai') this.recalculateAiPath();
                });
            }

            // AI Trail Toggle
            const trailCheckbox = document.getElementById('trailCheckbox');
            if (trailCheckbox) {
                trailCheckbox.addEventListener('change', (e) => {
                    this.showAiTrail = e.target.checked;
                });
            }

            // Mode tabs
            const tabManual = document.getElementById('tabManual');
            const tabAi = document.getElementById('tabAi');
            const aiSettings = document.getElementById('aiSettings');

            if (tabManual && tabAi) {
                tabManual.addEventListener('click', () => {
                    this.mode = 'manual';
                    tabManual.classList.add('active');
                    tabAi.classList.remove('active');
                    if (aiSettings) aiSettings.style.display = 'none';
                    this.aiPath = [];
                    this.visitedNodes = [];
                });
                tabAi.addEventListener('click', () => {
                    this.mode = 'ai';
                    tabAi.classList.add('active');
                    tabManual.classList.remove('active');
                    if (aiSettings) aiSettings.style.display = 'flex';
                    this.recalculateAiPath();
                });
            }
        }

        async loadLayout(layoutName) {
            try {
                const res = await fetch(`/api/layout?name=${encodeURIComponent(layoutName)}`);
                const data = await res.json();
                this.parseGrid(data.grid);
            } catch (err) {
                console.warn('Falling back to default layout due to network:', err);
                this.parseGrid(this.getDefaultLayout());
            }
            this.restart();
        }

        getDefaultLayout() {
            return [
                "%%%%%%%%%%%%%%%%%%%%%%%%%%%%",
                "%............%%............%",
                "%.%%%%.%%%%%.%%.%%%%%.%%%%.%",
                "%o%%%%.%%%%%.%%.%%%%%.%%%%o%",
                "%.%%%%.%%%%%.%%.%%%%%.%%%%.%",
                "%..........................%",
                "%.%%%%.%%.%%%%%%%%.%%.%%%%.%",
                "%.%%%%.%%.%%%%%%%%.%%.%%%%.%",
                "%......%%....%%....%%......%",
                "%%%%%%.%%%%% %% %%%%%.%%%%%%",
                "%%%%%%.%%%%% %% %%%%%.%%%%%%",
                "%%%%%%.%            %.%%%%%%",
                "%%%%%%.% %%%%  %%%% %.%%%%%%",
                "%     .  %G  GG  G%  .     %",
                "%%%%%%.% %%%%%%%%%% %.%%%%%%",
                "%%%%%%.%            %.%%%%%%",
                "%%%%%%.% %%%%%%%%%% %.%%%%%%",
                "%............%%............%",
                "%.%%%%.%%%%%.%%.%%%%%.%%%%.%",
                "%.%%%%.%%%%%.%%.%%%%%.%%%%.%",
                "%o..%%.......  .......%%..o%",
                "%%%.%%.%%.%%%%%%%%.%%.%%.%%%",
                "%%%.%%.%%.%%%%%%%%.%%.%%.%%%",
                "%......%%....%%....%%......%",
                "%.%%%%%%%%%%.%%.%%%%%%%%%%.%",
                "%.............P............%",
                "%%%%%%%%%%%%%%%%%%%%%%%%%%%%"
            ];
        }

        parseGrid(lines) {
            this.grid = lines.map(line => line.split(''));
            this.height = this.grid.length;
            this.width = Math.max(...this.grid.map(row => row.length));

            // Pad rows if jagged
            for (let y = 0; y < this.height; y++) {
                while (this.grid[y].length < this.width) {
                    this.grid[y].push(' ');
                }
            }

            // Adjust canvas dimension based on layout size
            const maxW = 560;
            const maxH = 580;
            this.tileSize = Math.floor(Math.min(maxW / this.width, maxH / this.height));
            this.tileSize = Math.max(14, Math.min(26, this.tileSize));

            this.canvas.width = this.width * this.tileSize;
            this.canvas.height = this.height * this.tileSize;
        }

        restart() {
            this.isGameOver = false;
            this.isVictory = false;
            this.isPaused = false;
            this.score = 0;
            this.lives = 3;
            this.scaredTimer = 0;
            this.ghostStreak = 0;
            this.floatingTexts = [];
            this.aiPath = [];
            this.visitedNodes = [];

            this.food.clear();
            this.capsules.clear();
            this.ghosts = [];

            let pacStart = { x: 1, y: 1 };
            let ghostStarts = [];

            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    const char = this.grid[y][x];
                    if (char === '.') this.food.add(`${x},${y}`);
                    else if (char === 'o') this.capsules.add(`${x},${y}`);
                    else if (char === 'P') pacStart = { x, y };
                    else if (char === 'G') ghostStarts.push({ x, y });
                }
            }

            // If no food found, place one dot at empty space for test layouts
            if (this.food.size === 0 && this.capsules.size === 0) {
                this.food.add(`${pacStart.x + 1},${pacStart.y}`);
            }

            this.dotsLeft = this.food.size + this.capsules.size;

            this.pacman = {
                x: pacStart.x,
                y: pacStart.y,
                dir: DIRS.STOP,
                nextDir: DIRS.WEST,
                speed: 0.12,
                progress: 0
            };

            const colorsCount = 4;
            ghostStarts.forEach((pt, index) => {
                const colorConfig = GHOST_COLORS[index % colorsCount];
                this.ghosts.push({
                    id: index,
                    x: pt.x,
                    y: pt.y,
                    startX: pt.x,
                    startY: pt.y,
                    dir: DIRS.NORTH,
                    color: colorConfig.normal,
                    name: colorConfig.name,
                    speed: 0.09,
                    progress: 0,
                    isDead: false
                });
            });

            this.updateHUD();
            this.renderLives();
            this.overlay.classList.remove('active');
            window.soundManager.playStart();

            if (this.mode === 'ai') {
                this.recalculateAiPath();
            }
        }

        updateHUD() {
            this.scoreEl.textContent = this.score;
            this.dotsEl.textContent = this.dotsLeft;
            if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem('pacman_high_score', this.highScore.toString());
                this.renderHighScores();
            }
        }

        renderLives() {
            this.livesEl.innerHTML = '';
            for (let i = 0; i < this.lives; i++) {
                const icon = document.createElement('div');
                icon.className = 'life-icon';
                this.livesEl.appendChild(icon);
            }
        }

        togglePause() {
            if (this.isGameOver || this.isVictory) return;
            this.isPaused = !this.isPaused;
            const btn = document.getElementById('btnPause');
            if (btn) btn.textContent = this.isPaused ? '▶ Resume' : '⏸ Pause';
        }

        isWall(x, y) {
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) return true;
            return this.grid[y][x] === '%';
        }

        getLegalNeighbors(x, y) {
            const res = [];
            [DIRS.NORTH, DIRS.SOUTH, DIRS.WEST, DIRS.EAST].forEach(d => {
                const nx = x + d.x;
                const ny = y + d.y;
                if (!this.isWall(nx, ny)) {
                    res.push({ x: nx, y: ny, dir: d });
                }
            });
            return res;
        }

        /* AI Pathfinding Implementations: BFS, DFS, A* */
        recalculateAiPath() {
            if (!this.pacman || this.dotsLeft === 0) return;
            const startKey = `${Math.round(this.pacman.x)},${Math.round(this.pacman.y)}`;
            
            // Goal: Closest food or capsule
            const goals = new Set([...this.food, ...this.capsules]);
            if (goals.size === 0) return;

            let result = null;
            if (this.aiAlgo === 'bfs') {
                result = this.runBFS(startKey, goals);
            } else if (this.aiAlgo === 'dfs') {
                result = this.runDFS(startKey, goals);
            } else {
                result = this.runAStar(startKey, goals);
            }

            if (result) {
                this.aiPath = result.path;
                this.visitedNodes = result.visited;
            }
        }

        runBFS(startKey, goals) {
            const queue = [[startKey]];
            const visited = new Set([startKey]);
            const visitedOrder = [];

            while (queue.length > 0) {
                const path = queue.shift();
                const currKey = path[path.length - 1];
                const [cx, cy] = currKey.split(',').map(Number);
                visitedOrder.push({ x: cx, y: cy });

                if (goals.has(currKey)) {
                    return { path: path.slice(1).map(k => k.split(',').map(Number)), visited: visitedOrder };
                }

                for (const neighbor of this.getLegalNeighbors(cx, cy)) {
                    const nKey = `${neighbor.x},${neighbor.y}`;
                    if (!visited.has(nKey)) {
                        visited.add(nKey);
                        queue.push([...path, nKey]);
                    }
                }
            }
            return null;
        }

        runDFS(startKey, goals) {
            const stack = [[startKey]];
            const visited = new Set([startKey]);
            const visitedOrder = [];

            while (stack.length > 0) {
                const path = stack.pop();
                const currKey = path[path.length - 1];
                const [cx, cy] = currKey.split(',').map(Number);
                visitedOrder.push({ x: cx, y: cy });

                if (goals.has(currKey)) {
                    return { path: path.slice(1).map(k => k.split(',').map(Number)), visited: visitedOrder };
                }

                for (const neighbor of this.getLegalNeighbors(cx, cy)) {
                    const nKey = `${neighbor.x},${neighbor.y}`;
                    if (!visited.has(nKey)) {
                        visited.add(nKey);
                        stack.push([...path, nKey]);
                    }
                }
            }
            return null;
        }

        runAStar(startKey, goals) {
            const [sx, sy] = startKey.split(',').map(Number);
            const heuristic = (x, y) => {
                let minD = Infinity;
                goals.forEach(gKey => {
                    const [gx, gy] = gKey.split(',').map(Number);
                    const d = Math.abs(x - gx) + Math.abs(y - gy);
                    if (d < minD) minD = d;
                });
                return minD;
            };

            const pq = [{ cost: 0, priority: heuristic(sx, sy), path: [startKey] }];
            const costSoFar = new Map([[startKey, 0]]);
            const visitedOrder = [];

            while (pq.length > 0) {
                pq.sort((a, b) => a.priority - b.priority);
                const { path, cost } = pq.shift();
                const currKey = path[path.length - 1];
                const [cx, cy] = currKey.split(',').map(Number);
                visitedOrder.push({ x: cx, y: cy });

                if (goals.has(currKey)) {
                    return { path: path.slice(1).map(k => k.split(',').map(Number)), visited: visitedOrder };
                }

                for (const neighbor of this.getLegalNeighbors(cx, cy)) {
                    const nKey = `${neighbor.x},${neighbor.y}`;
                    const newCost = cost + 1;
                    if (!costSoFar.has(nKey) || newCost < costSoFar.get(nKey)) {
                        costSoFar.set(nKey, newCost);
                        const priority = newCost + heuristic(neighbor.x, neighbor.y);
                        pq.push({ cost: newCost, priority, path: [...path, nKey] });
                    }
                }
            }
            return null;
        }

        // Main Loop
        loop() {
            if (!this.isPaused && !this.isGameOver && !this.isVictory) {
                this.update();
            }
            this.render();
            requestAnimationFrame(this.loop.bind(this));
        }

        update() {
            const step = this.speedFactor;

            // Scared Timer countdown
            if (this.scaredTimer > 0) {
                this.scaredTimer -= step;
                if (this.scaredTimer <= 0) {
                    this.ghostStreak = 0;
                }
            }

            // Update floating score texts
            for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
                const ft = this.floatingTexts[i];
                ft.y -= 0.5 * step;
                ft.life -= 0.02 * step;
                if (ft.life <= 0) this.floatingTexts.splice(i, 1);
            }

            // Pacman Movement
            this.updatePacman(step);

            // Ghost Movement
            this.updateGhosts(step);

            // Check Ghost Collisions
            this.checkCollisions();
        }

        updatePacman(step) {
            const p = this.pacman;
            if (!p) return;

            // Mouth animation
            this.mouthAngle += this.mouthSpeed * step;
            if (this.mouthAngle > 0.45 || this.mouthAngle < 0.05) {
                this.mouthSpeed = -this.mouthSpeed;
            }

            // AI Autopilot Decision
            if (this.mode === 'ai') {
                if (this.aiPath.length === 0) {
                    this.recalculateAiPath();
                }
                if (this.aiPath.length > 0 && p.progress === 0) {
                    const nextTile = this.aiPath[0];
                    const dx = nextTile[0] - p.x;
                    const dy = nextTile[1] - p.y;
                    if (dx > 0) p.nextDir = DIRS.EAST;
                    else if (dx < 0) p.nextDir = DIRS.WEST;
                    else if (dy > 0) p.nextDir = DIRS.SOUTH;
                    else if (dy < 0) p.nextDir = DIRS.NORTH;
                }
            }

            // At tile boundary (progress == 0), decide direction
            if (p.progress === 0) {
                if (p.nextDir && !this.isWall(p.x + p.nextDir.x, p.y + p.nextDir.y)) {
                    p.dir = p.nextDir;
                }
                if (this.isWall(p.x + p.dir.x, p.y + p.dir.y)) {
                    p.dir = DIRS.STOP;
                }
            }

            // Move Pacman
            if (p.dir !== DIRS.STOP) {
                p.progress += p.speed * step;
                if (p.progress >= 1) {
                    p.x += p.dir.x;
                    p.y += p.dir.y;
                    p.progress = 0;

                    // Eat food dot
                    const posKey = `${p.x},${p.y}`;
                    if (this.food.has(posKey)) {
                        this.food.delete(posKey);
                        this.score += 10;
                        this.dotsLeft--;
                        this.updateHUD();
                        window.soundManager.playWaka();
                        if (this.mode === 'ai') this.recalculateAiPath();
                    }

                    // Eat Power Pellet (Capsule)
                    if (this.capsules.has(posKey)) {
                        this.capsules.delete(posKey);
                        this.score += 50;
                        this.dotsLeft--;
                        this.scaredTimer = this.scaredMaxTime;
                        this.ghostStreak = 0;
                        this.updateHUD();
                        window.soundManager.playPowerPellet();
                        this.floatingTexts.push({ x: p.x, y: p.y, text: '+50', color: '#00f0ff', life: 1 });
                        if (this.mode === 'ai') this.recalculateAiPath();
                    }

                    // Pop reached AI node
                    if (this.mode === 'ai' && this.aiPath.length > 0) {
                        const target = this.aiPath[0];
                        if (target[0] === p.x && target[1] === p.y) {
                            this.aiPath.shift();
                        }
                    }

                    // Victory Check
                    if (this.dotsLeft === 0) {
                        this.triggerVictory();
                    }
                }
            }
        }

        updateGhosts(step) {
            this.ghosts.forEach(g => {
                if (g.isDead) {
                    // Respawning towards center
                    g.x += (g.startX - g.x) * 0.1;
                    g.y += (g.startY - g.y) * 0.1;
                    if (Math.abs(g.x - g.startX) < 0.2 && Math.abs(g.y - g.startY) < 0.2) {
                        g.x = g.startX;
                        g.y = g.startY;
                        g.isDead = false;
                        g.progress = 0;
                    }
                    return;
                }

                if (g.progress === 0) {
                    const legal = this.getLegalNeighbors(g.x, g.y);
                    // Avoid immediately reversing unless dead end
                    const opposite = { x: -g.dir.x, y: -g.dir.y };
                    let options = legal.filter(n => !(n.dir.x === opposite.x && n.dir.y === opposite.y));
                    if (options.length === 0) options = legal;

                    if (options.length > 0) {
                        if (this.scaredTimer > 0) {
                            // Frightened: move randomly or away from Pacman
                            g.dir = options[Math.floor(Math.random() * options.length)].dir;
                        } else {
                            // Chase Pacman
                            let bestChoice = options[0];
                            let bestDist = Infinity;
                            options.forEach(opt => {
                                const dist = Math.hypot(opt.x - this.pacman.x, opt.y - this.pacman.y);
                                if (dist < bestDist) {
                                    bestDist = dist;
                                    bestChoice = opt;
                                }
                            });
                            g.dir = bestChoice.dir;
                        }
                    }
                }

                // Move ghost
                const ghostSpeed = (this.scaredTimer > 0 ? g.speed * 0.65 : g.speed) * step;
                g.progress += ghostSpeed;
                if (g.progress >= 1) {
                    g.x += g.dir.x;
                    g.y += g.dir.y;
                    g.progress = 0;
                }
            });
        }

        checkCollisions() {
            const px = this.pacman.x + this.pacman.dir.x * this.pacman.progress;
            const py = this.pacman.y + this.pacman.dir.y * this.pacman.progress;

            this.ghosts.forEach(g => {
                if (g.isDead) return;
                const gx = g.x + g.dir.x * g.progress;
                const gy = g.y + g.dir.y * g.progress;
                const dist = Math.hypot(px - gx, py - gy);

                if (dist < 0.7) {
                    if (this.scaredTimer > 0) {
                        // Eat Ghost!
                        g.isDead = true;
                        this.ghostStreak++;
                        const pts = 200 * Math.pow(2, this.ghostStreak - 1);
                        this.score += pts;
                        this.updateHUD();
                        window.soundManager.playEatGhost();
                        this.floatingTexts.push({ x: gx, y: gy, text: `+${pts}`, color: '#ff007f', life: 1 });
                    } else {
                        // Pacman Dies!
                        this.handlePacmanDeath();
                    }
                }
            });
        }

        handlePacmanDeath() {
            this.lives--;
            this.renderLives();
            window.soundManager.playDeath();

            if (this.lives <= 0) {
                this.isGameOver = true;
                this.overlayTitle.textContent = 'GAME OVER';
                this.overlaySubtitle.textContent = `Final Score: ${this.score}`;
                this.overlay.classList.add('active');
            } else {
                // Reset positions
                this.pacman.progress = 0;
                this.pacman.dir = DIRS.STOP;
                this.ghosts.forEach(g => {
                    g.x = g.startX;
                    g.y = g.startY;
                    g.progress = 0;
                    g.dir = DIRS.NORTH;
                });
            }
        }

        triggerVictory() {
            this.isVictory = true;
            this.score += 500;
            this.updateHUD();
            window.soundManager.playVictory();
            this.overlayTitle.textContent = 'VICTORY!';
            this.overlaySubtitle.textContent = `Level Cleared! Score: ${this.score}`;
            this.overlay.classList.add('active');
        }

        // Render Graphics on HTML5 Canvas
        render() {
            const ctx = this.ctx;
            const ts = this.tileSize;

            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            // 1. Draw Maze Walls with Neon Glow
            ctx.save();
            ctx.strokeStyle = '#00f0ff';
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 8;
            ctx.lineWidth = 2.5;

            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    if (this.grid[y][x] === '%') {
                        ctx.fillStyle = '#0a1033';
                        ctx.fillRect(x * ts, y * ts, ts, ts);
                        ctx.strokeRect(x * ts + 1.5, y * ts + 1.5, ts - 3, ts - 3);
                    }
                }
            }
            ctx.restore();

            // 2. Draw AI Search Trails (if enabled)
            if (this.mode === 'ai' && this.showAiTrail) {
                // Visited nodes glow
                ctx.fillStyle = 'rgba(157, 78, 221, 0.18)';
                this.visitedNodes.forEach(node => {
                    ctx.fillRect(node.x * ts + 2, node.y * ts + 2, ts - 4, ts - 4);
                });

                // Computed optimal path line
                if (this.aiPath.length > 0 && this.pacman) {
                    ctx.save();
                    ctx.strokeStyle = '#ffd700';
                    ctx.shadowColor = '#ffd700';
                    ctx.shadowBlur = 10;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    const px = (this.pacman.x + this.pacman.dir.x * this.pacman.progress + 0.5) * ts;
                    const py = (this.pacman.y + this.pacman.dir.y * this.pacman.progress + 0.5) * ts;
                    ctx.moveTo(px, py);
                    this.aiPath.forEach(pt => {
                        ctx.lineTo((pt[0] + 0.5) * ts, (pt[1] + 0.5) * ts);
                    });
                    ctx.stroke();
                    ctx.restore();
                }
            }

            // 3. Draw Food Pellets (Dots)
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 5;
            this.food.forEach(key => {
                const [x, y] = key.split(',').map(Number);
                ctx.beginPath();
                ctx.arc((x + 0.5) * ts, (y + 0.5) * ts, 2.5, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.restore();

            // 4. Draw Power Pellets (Capsules)
            ctx.save();
            const pulse = (Math.sin(Date.now() / 150) + 1) * 2 + 5;
            ctx.fillStyle = '#ff77b4';
            ctx.shadowColor = '#ff77b4';
            ctx.shadowBlur = 12;
            this.capsules.forEach(key => {
                const [x, y] = key.split(',').map(Number);
                ctx.beginPath();
                ctx.arc((x + 0.5) * ts, (y + 0.5) * ts, pulse, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.restore();

            // 5. Draw Pacman
            if (this.pacman) {
                const p = this.pacman;
                const px = (p.x + p.dir.x * p.progress + 0.5) * ts;
                const py = (p.y + p.dir.y * p.progress + 0.5) * ts;
                const radius = ts * 0.45;
                const angle = p.dir.angle || 0;

                ctx.save();
                ctx.translate(px, py);
                ctx.rotate(angle);

                ctx.fillStyle = '#ffd700';
                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = 14;

                ctx.beginPath();
                ctx.arc(0, 0, radius, this.mouthAngle, Math.PI * 2 - this.mouthAngle);
                ctx.lineTo(0, 0);
                ctx.closePath();
                ctx.fill();

                // Pacman Eye
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(radius * 0.15, -radius * 0.5, radius * 0.18, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            }

            // 6. Draw Ghosts
            this.ghosts.forEach(g => {
                const gx = (g.x + g.dir.x * g.progress + 0.5) * ts;
                const gy = (g.y + g.dir.y * g.progress + 0.5) * ts;
                const r = ts * 0.44;

                ctx.save();
                ctx.translate(gx, gy);

                if (g.isDead) {
                    // Draw only eyes returning to base
                    this.drawGhostEyes(ctx, r, g.dir);
                } else {
                    let bodyColor = g.color;
                    if (this.scaredTimer > 0) {
                        const isExpiring = this.scaredTimer < 80 && Math.floor(this.scaredTimer / 10) % 2 === 0;
                        bodyColor = isExpiring ? '#ffffff' : '#3366ff';
                    }

                    ctx.fillStyle = bodyColor;
                    ctx.shadowColor = bodyColor;
                    ctx.shadowBlur = 10;

                    // Ghost head and body
                    ctx.beginPath();
                    ctx.arc(0, -r * 0.2, r, Math.PI, 0, false);
                    ctx.lineTo(r, r);
                    // Wavy bottom skirt
                    const waveStep = (r * 2) / 3;
                    ctx.lineTo(r - waveStep * 0.5, r * 0.6);
                    ctx.lineTo(r - waveStep, r);
                    ctx.lineTo(r - waveStep * 1.5, r * 0.6);
                    ctx.lineTo(r - waveStep * 2, r);
                    ctx.lineTo(r - waveStep * 2.5, r * 0.6);
                    ctx.lineTo(-r, r);
                    ctx.closePath();
                    ctx.fill();

                    // Eyes
                    this.drawGhostEyes(ctx, r, g.dir);
                }
                ctx.restore();
            });

            // 7. Floating Score Badges
            this.floatingTexts.forEach(ft => {
                ctx.save();
                ctx.font = 'bold 12px "Outfit", sans-serif';
                ctx.fillStyle = ft.color;
                ctx.globalAlpha = Math.max(0, ft.life);
                ctx.shadowColor = ft.color;
                ctx.shadowBlur = 8;
                ctx.textAlign = 'center';
                ctx.fillText(ft.text, (ft.x + 0.5) * ts, (ft.y + 0.5) * ts);
                ctx.restore();
            });
        }

        drawGhostEyes(ctx, r, dir) {
            const eyeOffsetX = dir.x * 2;
            const eyeOffsetY = dir.y * 2;

            // White sclera
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(-r * 0.38, -r * 0.2, r * 0.3, 0, Math.PI * 2);
            ctx.arc(r * 0.38, -r * 0.2, r * 0.3, 0, Math.PI * 2);
            ctx.fill();

            // Pupil
            ctx.fillStyle = '#080c33';
            ctx.beginPath();
            ctx.arc(-r * 0.38 + eyeOffsetX, -r * 0.2 + eyeOffsetY, r * 0.16, 0, Math.PI * 2);
            ctx.arc(r * 0.38 + eyeOffsetX, -r * 0.2 + eyeOffsetY, r * 0.16, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Initialize Game on load
    window.addEventListener('DOMContentLoaded', () => {
        window.pacmanGame = new PacmanGame();
    });
})();
