// game.js - PAC-MAN AI Laboratory & Retro Arcade Engine
(function() {
    'use strict';

    // Directions & Geometry
    const DIRS = {
        STOP:  { x: 0,  y: 0,  name: 'STOP' },
        WEST:  { x: -1, y: 0,  name: 'West',  angle: Math.PI },
        EAST:  { x: 1,  y: 0,  name: 'East',  angle: 0 },
        NORTH: { x: 0,  y: -1, name: 'North', angle: -Math.PI / 2 },
        SOUTH: { x: 0,  y: 1,  name: 'South', angle: Math.PI / 2 }
    };

    const GHOST_CONFIGS = [
        { id: 0, name: 'Blinky', role: 'Shadow / Direct Chase', color: '#ff3344', eye: '#ffffff' },
        { id: 1, name: 'Pinky',  role: 'Speedy / Ambush Ahead',  color: '#ff77b4', eye: '#ffffff' },
        { id: 2, name: 'Inky',   role: 'Bashful / Flank Pivot',  color: '#00f0ff', eye: '#ffffff' },
        { id: 3, name: 'Clyde',  role: 'Pokey / Shy Scatter',    color: '#ff9933', eye: '#ffffff' }
    ];

    class PacmanGame {
        constructor() {
            // Canvases
            this.canvas = document.getElementById('gameCanvas');
            this.ctx = this.canvas.getContext('2d');
            this.previewCanvas = document.getElementById('previewCanvas');
            this.previewCtx = this.previewCanvas ? this.previewCanvas.getContext('2d') : null;

            // HUD Elements
            this.scoreEl = document.getElementById('scoreValue');
            this.highScoreEl = document.getElementById('highScoreValue');
            this.dotsEl = document.getElementById('dotsValue');
            this.livesEl = document.getElementById('livesContainer');
            this.overlay = document.getElementById('gameOverlay');
            this.overlayTitle = document.getElementById('overlayTitle');
            this.overlaySubtitle = document.getElementById('overlaySubtitle');

            // AI Monitor Telemetry Elements
            this.monitorStatusTag = document.getElementById('monitorStatusTag');
            this.metricAlgo = document.getElementById('metricAlgo');
            this.metricExplored = document.getElementById('metricExplored');
            this.metricPathLen = document.getElementById('metricPathLen');
            this.metricTime = document.getElementById('metricTime');
            this.metricState = document.getElementById('metricState');
            this.metricTarget = document.getElementById('metricTarget');
            this.mazeDimensionsText = document.getElementById('mazeDimensionsText');

            // Dimensions & Grid
            this.tileSize = 20;
            this.grid = [];
            this.width = 0;
            this.height = 0;

            // Gameplay State
            this.score = 0;
            this.highScore = parseInt(localStorage.getItem('pacman_high_score') || '0', 10);
            this.lives = 3;
            this.dotsLeft = 0;

            this.pacman = null;
            this.ghosts = [];
            this.food = new Set();
            this.capsules = new Set();

            // Mode & AI Algorithms
            this.mode = 'manual'; // 'manual' or 'ai'
            this.aiAlgo = 'astar'; // 'astar', 'bfs', 'dfs', 'greedy'
            this.aiPath = [];
            this.visitedNodes = [];
            this.currentTargetNode = null;
            this.showAiTrail = true;
            this.lastSearchMetrics = {
                exploredCount: 0,
                pathLength: 0,
                timeMs: 0.0,
                state: 'IDLE',
                status: 'READY'
            };

            // Animation timing
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
            this.pulseAnim = 0;

            // Session Stats for modal
            this.sessionStats = {
                gamesStarted: 0,
                dotsEaten: 0,
                ghostsEaten: 0,
                nodesExploredTotal: 0
            };

            this.initListeners();
            this.fetchAvailableLayouts();
            this.loadLayout(this.currentLayout);
            this.renderHighScores();

            // Main rendering loop
            requestAnimationFrame(this.loop.bind(this));
        }

        renderHighScores() {
            if (this.highScoreEl) this.highScoreEl.textContent = this.highScore;
        }

        initListeners() {
            // Keyboard Controls (Arrows and WASD)
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
                    const k = e.key.toLowerCase();
                    if (e.key === 'ArrowLeft'  || k === 'a') this.pacman.nextDir = DIRS.WEST;
                    if (e.key === 'ArrowRight' || k === 'd') this.pacman.nextDir = DIRS.EAST;
                    if (e.key === 'ArrowUp'    || k === 'w') this.pacman.nextDir = DIRS.NORTH;
                    if (e.key === 'ArrowDown'  || k === 's') this.pacman.nextDir = DIRS.SOUTH;
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
                el.addEventListener('touchstart', trigger, { passive: false });
            };

            bindDpad('btnUp', DIRS.NORTH);
            bindDpad('btnDown', DIRS.SOUTH);
            bindDpad('btnLeft', DIRS.WEST);
            bindDpad('btnRight', DIRS.EAST);

            // Controls Toolbar Buttons
            document.getElementById('btnPlay')?.addEventListener('click', () => {
                if (this.isPaused) this.togglePause();
                if (this.isGameOver || this.isVictory) this.restart();
            });

            document.getElementById('btnPause')?.addEventListener('click', () => this.togglePause());
            document.getElementById('btnRestart')?.addEventListener('click', () => this.restart());
            document.getElementById('overlayBtn')?.addEventListener('click', () => {
                this.overlay.classList.remove('active');
                this.restart();
            });

            // Sound Toggle
            const soundBtn = document.getElementById('btnSound');
            if (soundBtn) {
                soundBtn.addEventListener('click', () => {
                    const isMuted = window.soundManager.toggleMute();
                    soundBtn.innerHTML = isMuted 
                        ? `<span class="btn-icon">🔇</span><span class="btn-label">Muted</span>`
                        : `<span class="btn-icon">🔊</span><span class="btn-label">Sound</span>`;
                    soundBtn.classList.toggle('muted', isMuted);
                });
            }

            // Layout Selector
            const layoutSelect = document.getElementById('layoutSelect');
            if (layoutSelect) {
                layoutSelect.addEventListener('change', (e) => {
                    this.currentLayout = e.target.value;
                    this.loadLayout(this.currentLayout);
                });
            }

            // Speed Slider
            const speedSlider = document.getElementById('speedSlider');
            const speedValue = document.getElementById('speedValue');
            if (speedSlider) {
                speedSlider.addEventListener('input', (e) => {
                    this.speedFactor = parseFloat(e.target.value);
                    if (speedValue) speedValue.textContent = `${this.speedFactor.toFixed(1)}x`;
                });
            }

            // AI Algorithm Selector
            const aiAlgoSelect = document.getElementById('aiAlgoSelect');
            if (aiAlgoSelect) {
                aiAlgoSelect.addEventListener('change', (e) => {
                    this.aiAlgo = e.target.value;
                    this.updateAlgorithmDisplayName();
                    if (this.mode === 'ai') this.recalculateAiPath();
                });
            }

            // AI Trail Checkbox
            const trailCheckbox = document.getElementById('trailCheckbox');
            if (trailCheckbox) {
                trailCheckbox.addEventListener('change', (e) => {
                    this.showAiTrail = e.target.checked;
                });
            }

            // Mode Switch Buttons
            const tabManual = document.getElementById('tabManual');
            const tabAi = document.getElementById('tabAi');
            const aiReadyBadge = document.getElementById('aiReadyBadge');

            if (tabManual && tabAi) {
                tabManual.addEventListener('click', () => {
                    this.mode = 'manual';
                    tabManual.classList.add('active');
                    tabAi.classList.remove('active');
                    if (aiReadyBadge) aiReadyBadge.innerHTML = `<span class="badge-dot"></span><span>MANUAL</span>`;
                    this.metricState.textContent = 'MANUAL CONTROL';
                    this.metricState.className = 'metric-val text-white';
                    this.monitorStatusTag.textContent = 'USER DIRECT STEERING';
                    this.aiPath = [];
                    this.visitedNodes = [];
                });

                tabAi.addEventListener('click', () => {
                    this.mode = 'ai';
                    tabAi.classList.add('active');
                    tabManual.classList.remove('active');
                    if (aiReadyBadge) aiReadyBadge.innerHTML = `<span class="badge-dot"></span><span>AI ACTIVE</span>`;
                    this.recalculateAiPath();
                });
            }

            // Navigation Modals
            this.initNavModals();
        }

        updateAlgorithmDisplayName() {
            const names = {
                'astar': 'A* Search (Manhattan)',
                'bfs': 'Breadth-First Search (BFS)',
                'dfs': 'Depth-First Search (DFS)',
                'greedy': 'Greedy Best-First'
            };
            if (this.metricAlgo) {
                this.metricAlgo.textContent = names[this.aiAlgo] || this.aiAlgo.toUpperCase();
            }
        }

        async fetchAvailableLayouts() {
            try {
                const res = await fetch('/api/layouts');
                const data = await res.json();
                const group = document.getElementById('dynamicLayoutsGroup');
                if (group && data.layouts) {
                    const standard = new Set([
                        'originalClassic', 'mediumClassic', 'smallClassic', 
                        'mediumMaze', 'bigMaze', 'trickySearch', 'tinyMaze'
                    ]);
                    group.innerHTML = '';
                    data.layouts.forEach(name => {
                        if (!standard.has(name)) {
                            const opt = document.createElement('option');
                            opt.value = name;
                            opt.textContent = name;
                            group.appendChild(opt);
                        }
                    });
                }
            } catch (e) {
                // Ignore if local static
            }
        }

        async loadLayout(layoutName) {
            try {
                const res = await fetch(`/api/layout?name=${encodeURIComponent(layoutName)}`);
                const data = await res.json();
                this.parseGrid(data.grid);
            } catch (err) {
                console.warn('Falling back to default layout:', err);
                this.parseGrid(this.getDefaultLayout());
            }
            this.restart();
            this.drawMazePreview();
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

            // Normalize jagged rows
            for (let y = 0; y < this.height; y++) {
                while (this.grid[y].length < this.width) {
                    this.grid[y].push(' ');
                }
            }

            if (this.mazeDimensionsText) {
                this.mazeDimensionsText.textContent = `${this.width} × ${this.height}`;
            }

            // Adjust canvas dimension based on layout size
            const maxW = 560;
            const maxH = 580;
            this.tileSize = Math.floor(Math.min(maxW / this.width, maxH / this.height));
            this.tileSize = Math.max(14, Math.min(26, this.tileSize));

            this.canvas.width = this.width * this.tileSize;
            this.canvas.height = this.height * this.tileSize;
        }

        drawMazePreview() {
            if (!this.previewCtx) return;
            const pCtx = this.previewCtx;
            const pw = this.previewCanvas.width;
            const ph = this.previewCanvas.height;

            pCtx.clearRect(0, 0, pw, ph);
            pCtx.fillStyle = '#000000';
            pCtx.fillRect(0, 0, pw, ph);

            if (!this.width || !this.height) return;

            const scaleX = pw / this.width;
            const scaleY = ph / this.height;

            pCtx.fillStyle = '#00f0ff';
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    if (this.grid[y][x] === '%') {
                        pCtx.fillRect(x * scaleX, y * scaleY, Math.max(1, scaleX), Math.max(1, scaleY));
                    }
                }
            }
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
            this.currentTargetNode = null;
            this.sessionStats.gamesStarted++;

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

            // Fallback for maze layouts without food
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
                const config = GHOST_CONFIGS[index % colorsCount];
                this.ghosts.push({
                    id: index,
                    x: pt.x,
                    y: pt.y,
                    startX: pt.x,
                    startY: pt.y,
                    dir: DIRS.NORTH,
                    color: config.color,
                    name: config.name,
                    role: config.role,
                    speed: 0.09,
                    progress: 0,
                    isDead: false
                });
            });

            this.updateHUD();
            this.renderLives();
            this.updateAlgorithmDisplayName();
            this.overlay.classList.remove('active');
            window.soundManager.playStart();

            if (this.mode === 'ai') {
                this.recalculateAiPath();
            } else {
                this.metricState.textContent = 'MANUAL CONTROL';
                this.metricState.className = 'metric-val text-white';
                this.monitorStatusTag.textContent = 'USER DIRECT STEERING';
            }
        }

        updateHUD() {
            if (this.scoreEl) this.scoreEl.textContent = this.score;
            if (this.dotsEl) this.dotsEl.textContent = this.dotsLeft;
            if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem('pacman_high_score', this.highScore.toString());
                this.renderHighScores();
            }
        }

        renderLives() {
            if (!this.livesEl) return;
            this.livesEl.innerHTML = '';
            for (let i = 0; i < this.lives; i++) {
                const dot = document.createElement('span');
                dot.className = 'life-dot';
                this.livesEl.appendChild(dot);
            }
        }

        togglePause() {
            if (this.isGameOver || this.isVictory) return;
            this.isPaused = !this.isPaused;
            const btn = document.getElementById('btnPause');
            if (btn) btn.textContent = this.isPaused ? '▶ RESUME' : '⏸ PAUSE';
            if (this.metricState) {
                this.metricState.textContent = this.isPaused ? 'PAUSED' : (this.mode === 'ai' ? 'NAVIGATING' : 'MANUAL CONTROL');
            }
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

        /* ==================================================================
           AI PATHFINDING ALGORITHMS: BFS, DFS, A*, GREEDY BEST-FIRST
           ================================================================== */
        recalculateAiPath() {
            if (!this.pacman || this.dotsLeft === 0) return;
            const startKey = `${Math.round(this.pacman.x)},${Math.round(this.pacman.y)}`;
            const goals = new Set([...this.food, ...this.capsules]);
            if (goals.size === 0) return;

            let result = null;
            if (this.aiAlgo === 'bfs') {
                result = this.runBFS(startKey, goals);
            } else if (this.aiAlgo === 'dfs') {
                result = this.runDFS(startKey, goals);
            } else if (this.aiAlgo === 'greedy') {
                result = this.runGreedyBFS(startKey, goals);
            } else {
                result = this.runAStar(startKey, goals);
            }

            if (result) {
                this.aiPath = result.path;
                this.visitedNodes = result.visited;
                this.currentTargetNode = result.target;

                // Update Telemetry Metrics
                this.lastSearchMetrics.exploredCount = result.visited.length;
                this.lastSearchMetrics.pathLength = result.path.length;
                this.lastSearchMetrics.timeMs = result.timeMs;
                this.sessionStats.nodesExploredTotal += result.visited.length;

                if (this.metricExplored) this.metricExplored.textContent = result.visited.length;
                if (this.metricPathLen) this.metricPathLen.textContent = result.path.length;
                if (this.metricTime) this.metricTime.textContent = `${result.timeMs} ms`;
                if (this.metricTarget && result.target) {
                    this.metricTarget.textContent = `[ ${result.target.x} , ${result.target.y} ]`;
                }
                if (this.metricState) {
                    this.metricState.textContent = 'PATH FOUND';
                    this.metricState.className = 'metric-val text-green';
                }
                if (this.monitorStatusTag) {
                    this.monitorStatusTag.textContent = 'OPTIMAL PATH FOUND';
                }
            }
        }

        runBFS(startKey, goals) {
            const t0 = performance.now();
            const queue = [[startKey]];
            const visited = new Set([startKey]);
            const visitedOrder = [];

            while (queue.length > 0) {
                const path = queue.shift();
                const currKey = path[path.length - 1];
                const [cx, cy] = currKey.split(',').map(Number);
                visitedOrder.push({ x: cx, y: cy });

                if (goals.has(currKey)) {
                    const t1 = performance.now();
                    return { 
                        path: path.slice(1).map(k => k.split(',').map(Number)), 
                        visited: visitedOrder,
                        timeMs: (t1 - t0).toFixed(1),
                        target: { x: cx, y: cy }
                    };
                }

                for (const neighbor of this.getLegalNeighbors(cx, cy)) {
                    const nKey = `${neighbor.x},${neighbor.y}`;
                    if (!visited.has(nKey)) {
                        visited.add(nKey);
                        queue.push([...path, nKey]);
                    }
                }
            }
            const t1 = performance.now();
            return { path: [], visited: visitedOrder, timeMs: (t1 - t0).toFixed(1), target: null };
        }

        runDFS(startKey, goals) {
            const t0 = performance.now();
            const stack = [[startKey]];
            const visited = new Set([startKey]);
            const visitedOrder = [];

            while (stack.length > 0) {
                const path = stack.pop();
                const currKey = path[path.length - 1];
                const [cx, cy] = currKey.split(',').map(Number);
                visitedOrder.push({ x: cx, y: cy });

                if (goals.has(currKey)) {
                    const t1 = performance.now();
                    return { 
                        path: path.slice(1).map(k => k.split(',').map(Number)), 
                        visited: visitedOrder,
                        timeMs: (t1 - t0).toFixed(1),
                        target: { x: cx, y: cy }
                    };
                }

                for (const neighbor of this.getLegalNeighbors(cx, cy)) {
                    const nKey = `${neighbor.x},${neighbor.y}`;
                    if (!visited.has(nKey)) {
                        visited.add(nKey);
                        stack.push([...path, nKey]);
                    }
                }
            }
            const t1 = performance.now();
            return { path: [], visited: visitedOrder, timeMs: (t1 - t0).toFixed(1), target: null };
        }

        runAStar(startKey, goals) {
            const t0 = performance.now();
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
                    const t1 = performance.now();
                    return { 
                        path: path.slice(1).map(k => k.split(',').map(Number)), 
                        visited: visitedOrder,
                        timeMs: (t1 - t0).toFixed(1),
                        target: { x: cx, y: cy }
                    };
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
            const t1 = performance.now();
            return { path: [], visited: visitedOrder, timeMs: (t1 - t0).toFixed(1), target: null };
        }

        runGreedyBFS(startKey, goals) {
            const t0 = performance.now();
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

            const pq = [{ priority: heuristic(sx, sy), path: [startKey] }];
            const visited = new Set([startKey]);
            const visitedOrder = [];

            while (pq.length > 0) {
                pq.sort((a, b) => a.priority - b.priority);
                const { path } = pq.shift();
                const currKey = path[path.length - 1];
                const [cx, cy] = currKey.split(',').map(Number);
                visitedOrder.push({ x: cx, y: cy });

                if (goals.has(currKey)) {
                    const t1 = performance.now();
                    return {
                        path: path.slice(1).map(k => k.split(',').map(Number)),
                        visited: visitedOrder,
                        timeMs: (t1 - t0).toFixed(1),
                        target: { x: cx, y: cy }
                    };
                }

                for (const neighbor of this.getLegalNeighbors(cx, cy)) {
                    const nKey = `${neighbor.x},${neighbor.y}`;
                    if (!visited.has(nKey)) {
                        visited.add(nKey);
                        pq.push({ priority: heuristic(neighbor.x, neighbor.y), path: [...path, nKey] });
                    }
                }
            }
            const t1 = performance.now();
            return { path: [], visited: visitedOrder, timeMs: (t1 - t0).toFixed(1), target: null };
        }

        // Main Loop
        loop() {
            this.pulseAnim = (this.pulseAnim + 0.05) % (Math.PI * 2);
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

            // Floating score text lifetime
            for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
                const ft = this.floatingTexts[i];
                ft.y -= 0.5 * step;
                ft.life -= 0.02 * step;
                if (ft.life <= 0) this.floatingTexts.splice(i, 1);
            }

            this.updatePacman(step);
            this.updateGhosts(step);
            this.updateGhostStatuses();
            this.checkCollisions();
        }

        updateGhostStatuses() {
            this.ghosts.forEach((g, idx) => {
                const statusEl = document.getElementById(`ghost${idx}Status`);
                if (!statusEl) return;
                if (g.isDead) {
                    statusEl.textContent = 'Respawning / Return';
                    statusEl.style.color = '#8c9cb3';
                } else if (this.scaredTimer > 0) {
                    statusEl.textContent = 'Frightened / Vulnerable';
                    statusEl.style.color = '#3366ff';
                } else {
                    statusEl.textContent = `Active / ${g.name === 'Blinky' ? 'Direct Chase' : g.name === 'Pinky' ? 'Ambush' : g.name === 'Inky' ? 'Flank' : 'Scatter'}`;
                    statusEl.style.color = '#00ff88';
                }
            });
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

                    if (this.metricState) {
                        this.metricState.textContent = 'NAVIGATING';
                        this.metricState.className = 'metric-val text-green';
                    }
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
                        this.sessionStats.dotsEaten++;
                        this.updateHUD();
                        window.soundManager.playWaka();
                        if (this.mode === 'ai') this.recalculateAiPath();
                    }

                    // Eat Power Pellet (Capsule)
                    if (this.capsules.has(posKey)) {
                        this.capsules.delete(posKey);
                        this.score += 50;
                        this.dotsLeft--;
                        this.sessionStats.dotsEaten++;
                        this.scaredTimer = this.scaredMaxTime;
                        this.ghostStreak = 0;
                        this.updateHUD();
                        window.soundManager.playPowerPellet();
                        this.floatingTexts.push({ x: p.x, y: p.y, text: '+50', color: '#00f0ff', life: 1 });
                        if (this.mode === 'ai') this.recalculateAiPath();
                    }

                    // Pop reached AI path node
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
                    const opposite = { x: -g.dir.x, y: -g.dir.y };
                    let options = legal.filter(n => !(n.dir.x === opposite.x && n.dir.y === opposite.y));
                    if (options.length === 0) options = legal;

                    if (options.length > 0) {
                        if (this.scaredTimer > 0) {
                            // Frightened: move randomly or away from Pacman
                            g.dir = options[Math.floor(Math.random() * options.length)].dir;
                        } else {
                            // Intelligent chase towards Pacman
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
                        this.sessionStats.ghostsEaten++;
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
                this.overlayTitle.textContent = 'MISSION FAILED';
                this.overlaySubtitle.textContent = `All lives lost. Final Score: ${this.score}`;
                this.overlay.classList.add('active');
            } else {
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
            this.overlayTitle.textContent = 'MISSION ACCOMPLISHED';
            this.overlaySubtitle.textContent = `Maze cleared! Final Score: ${this.score}`;
            this.overlay.classList.add('active');
        }

        /* ==================================================================
           RENDERING: PURE BLACK CANVAS + SUBTLE ELECTRIC CYAN/BLUE ACCENTS
           ================================================================== */
        render() {
            const ctx = this.ctx;
            const ts = this.tileSize;

            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            // 1. Pure Black Background
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            // 2. Draw Maze Walls: Thin Glowing Electric-Blue Lines
            ctx.save();
            ctx.strokeStyle = '#00f0ff';
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 4; // Very limited, controlled glow
            ctx.lineWidth = 1.6;

            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    if (this.grid[y][x] === '%') {
                        ctx.fillStyle = '#060a14';
                        ctx.fillRect(x * ts, y * ts, ts, ts);
                        ctx.strokeRect(x * ts + 1, y * ts + 1, ts - 2, ts - 2);
                    }
                }
            }
            ctx.restore();

            // 3. AI Autopilot Visual Demonstrations
            if (this.mode === 'ai' && this.showAiTrail) {
                // A) Explored nodes: Small Blue/Cyan dots
                ctx.save();
                ctx.fillStyle = '#00a8ff';
                ctx.shadowColor = '#00f0ff';
                ctx.shadowBlur = 3;
                this.visitedNodes.forEach(node => {
                    ctx.beginPath();
                    ctx.arc((node.x + 0.5) * ts, (node.y + 0.5) * ts, 2.2, 0, Math.PI * 2);
                    ctx.fill();
                });
                ctx.restore();

                // B) Target Node: Green Glowing Node with Animated Pulse
                if (this.currentTargetNode) {
                    ctx.save();
                    const tg = this.currentTargetNode;
                    const pulseRadius = 4 + Math.sin(this.pulseAnim * 2) * 1.5;
                    ctx.fillStyle = '#00ff88';
                    ctx.shadowColor = '#00ff88';
                    ctx.shadowBlur = 8;
                    ctx.beginPath();
                    ctx.arc((tg.x + 0.5) * ts, (tg.y + 0.5) * ts, pulseRadius, 0, Math.PI * 2);
                    ctx.fill();

                    // Outer pulse ring
                    ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
                    ctx.lineWidth = 1.2;
                    ctx.beginPath();
                    ctx.arc((tg.x + 0.5) * ts, (tg.y + 0.5) * ts, pulseRadius + 3, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }

                // C) Calculated Search Path: Clean Yellow Line
                if (this.aiPath.length > 0 && this.pacman) {
                    ctx.save();
                    ctx.strokeStyle = '#ffd700';
                    ctx.shadowColor = '#ffd700';
                    ctx.shadowBlur = 6;
                    ctx.lineWidth = 2.2;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.beginPath();
                    const px = (this.pacman.x + this.pacman.dir.x * this.pacman.progress + 0.5) * ts;
                    const py = (this.pacman.y + this.pacman.dir.y * this.pacman.progress + 0.5) * ts;
                    ctx.moveTo(px, py);
                    this.aiPath.forEach(pt => {
                        ctx.lineTo((pt[0] + 0.5) * ts, (pt[1] + 0.5) * ts);
                    });
                    ctx.stroke();

                    // Waypoint markers along yellow path
                    ctx.fillStyle = '#ffffff';
                    this.aiPath.forEach(pt => {
                        ctx.beginPath();
                        ctx.arc((pt[0] + 0.5) * ts, (pt[1] + 0.5) * ts, 1.4, 0, Math.PI * 2);
                        ctx.fill();
                    });
                    ctx.restore();
                }
            }

            // 4. White Food Pellets (Dots)
            ctx.save();
            ctx.fillStyle = '#ffffff';
            this.food.forEach(key => {
                const [x, y] = key.split(',').map(Number);
                ctx.beginPath();
                ctx.arc((x + 0.5) * ts, (y + 0.5) * ts, 2.2, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.restore();

            // 5. Pink Power Pellets (Capsules)
            ctx.save();
            const pulse = (Math.sin(this.pulseAnim) + 1) * 1.5 + 4.5;
            ctx.fillStyle = '#ff77b4';
            ctx.shadowColor = '#ff77b4';
            ctx.shadowBlur = 6;
            this.capsules.forEach(key => {
                const [x, y] = key.split(',').map(Number);
                ctx.beginPath();
                ctx.arc((x + 0.5) * ts, (y + 0.5) * ts, pulse, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.restore();

            // 6. Realistic Pac-Man (Yellow)
            if (this.pacman) {
                const p = this.pacman;
                const px = (p.x + p.dir.x * p.progress + 0.5) * ts;
                const py = (p.y + p.dir.y * p.progress + 0.5) * ts;
                const radius = ts * 0.44;
                const angle = p.dir.angle || 0;

                ctx.save();
                ctx.translate(px, py);
                ctx.rotate(angle);

                ctx.fillStyle = '#ffd700';
                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = 8;

                ctx.beginPath();
                ctx.arc(0, 0, radius, this.mouthAngle, Math.PI * 2 - this.mouthAngle);
                ctx.lineTo(0, 0);
                ctx.closePath();
                ctx.fill();

                // Eye
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(radius * 0.15, -radius * 0.5, radius * 0.16, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            }

            // 7. Original Pac-Man Ghosts
            this.ghosts.forEach(g => {
                const gx = (g.x + g.dir.x * g.progress + 0.5) * ts;
                const gy = (g.y + g.dir.y * g.progress + 0.5) * ts;
                const r = ts * 0.44;

                ctx.save();
                ctx.translate(gx, gy);

                if (g.isDead) {
                    this.drawGhostEyes(ctx, r, g.dir);
                } else {
                    let bodyColor = g.color;
                    if (this.scaredTimer > 0) {
                        const isExpiring = this.scaredTimer < 80 && Math.floor(this.scaredTimer / 10) % 2 === 0;
                        bodyColor = isExpiring ? '#ffffff' : '#3366ff';
                    }

                    ctx.fillStyle = bodyColor;
                    ctx.shadowColor = bodyColor;
                    ctx.shadowBlur = 6;

                    // Ghost Head & Body
                    ctx.beginPath();
                    ctx.arc(0, -r * 0.2, r, Math.PI, 0, false);
                    ctx.lineTo(r, r);

                    // Skirt
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

            // 8. Floating Badges
            this.floatingTexts.forEach(ft => {
                ctx.save();
                ctx.font = 'bold 12px "Outfit", sans-serif';
                ctx.fillStyle = ft.color;
                ctx.globalAlpha = Math.max(0, ft.life);
                ctx.shadowColor = ft.color;
                ctx.shadowBlur = 6;
                ctx.textAlign = 'center';
                ctx.fillText(ft.text, (ft.x + 0.5) * ts, (ft.y + 0.5) * ts);
                ctx.restore();
            });
        }

        drawGhostEyes(ctx, r, dir) {
            const eyeOffsetX = dir.x * 2;
            const eyeOffsetY = dir.y * 2;

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(-r * 0.38, -r * 0.2, r * 0.3, 0, Math.PI * 2);
            ctx.arc(r * 0.38, -r * 0.2, r * 0.3, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#080c33';
            ctx.beginPath();
            ctx.arc(-r * 0.38 + eyeOffsetX, -r * 0.2 + eyeOffsetY, r * 0.16, 0, Math.PI * 2);
            ctx.arc(r * 0.38 + eyeOffsetX, -r * 0.2 + eyeOffsetY, r * 0.16, 0, Math.PI * 2);
            ctx.fill();
        }

        /* ==================================================================
           NAVIGATION MODAL DIALOGS
           ================================================================== */
        initNavModals() {
            const modalContainer = document.getElementById('modalContainer');
            const modalTitle = document.getElementById('modalTitle');
            const modalBody = document.getElementById('modalBody');
            const closeBtn = document.getElementById('modalCloseBtn');

            const openModal = (title, contentHtml) => {
                if (!modalContainer) return;
                modalTitle.textContent = title;
                modalBody.innerHTML = contentHtml;
                modalContainer.classList.add('active');
            };

            const closeModal = () => {
                if (modalContainer) modalContainer.classList.remove('active');
            };

            closeBtn?.addEventListener('click', closeModal);
            modalContainer?.addEventListener('click', (e) => {
                if (e.target === modalContainer) closeModal();
            });

            // Nav link click events
            document.getElementById('navPlay')?.addEventListener('click', () => {
                this.setActiveNav('navPlay');
                closeModal();
                this.canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });

            document.getElementById('navAlgorithms')?.addEventListener('click', () => {
                this.setActiveNav('navAlgorithms');
                openModal('AI Search Algorithms Guide', `
                    <h4>Search Formulation</h4>
                    <p>In the Pac-Man domain, navigation is formulated as a Graph Search problem where states represent coordinates <code>(x, y)</code>, actions are cardinal directions, and the transition cost is uniform.</p>
                    
                    <table class="modal-table">
                        <thead>
                            <tr>
                                <th>Algorithm</th>
                                <th>Strategy</th>
                                <th>Optimal?</th>
                                <th>Time Complexity</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>A* Search</td>
                                <td>f(n) = g(n) + h(n) (Manhattan)</td>
                                <td style="color: #00ff88;">Yes (Admissible)</td>
                                <td>O(b<sup>d</sup>)</td>
                            </tr>
                            <tr>
                                <td>Breadth-First (BFS)</td>
                                <td>FIFO Queue Frontier</td>
                                <td style="color: #00ff88;">Yes (Unweighted)</td>
                                <td>O(b<sup>d</sup>)</td>
                            </tr>
                            <tr>
                                <td>Greedy Best-First</td>
                                <td>f(n) = h(n)</td>
                                <td style="color: #ff3344;">No (Suboptimal)</td>
                                <td>O(b<sup>m</sup>)</td>
                            </tr>
                            <tr>
                                <td>Depth-First (DFS)</td>
                                <td>LIFO Stack Frontier</td>
                                <td style="color: #ff3344;">No</td>
                                <td>O(b<sup>m</sup>)</td>
                            </tr>
                        </tbody>
                    </table>

                    <h4>Heuristics</h4>
                    <p>The Manhattan distance heuristic computes <code>|x1 - x2| + |y1 - y2|</code> between Pac-Man and the closest food pellet, guaranteeing admissible and consistent state evaluation.</p>
                `);
            });

            document.getElementById('navMazes')?.addEventListener('click', () => {
                this.setActiveNav('navMazes');
                openModal('Available Maze Architectures', `
                    <h4>Benchmark Layouts</h4>
                    <p>The system provides all 37 Berkeley CS188 benchmark layouts loaded dynamically from the environment:</p>
                    <table class="modal-table">
                        <thead>
                            <tr>
                                <th>Layout</th>
                                <th>Characteristics</th>
                                <th>Ideal Benchmark</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>originalClassic</td>
                                <td>Standard arcade maze with 4 ghost houses</td>
                                <td>Arcade gameplay & general AI</td>
                            </tr>
                            <tr>
                                <td>mediumMaze</td>
                                <td>Sparse pathfinding maze with dead ends</td>
                                <td>BFS vs DFS comparison</td>
                            </tr>
                            <tr>
                                <td>bigMaze</td>
                                <td>Large scale navigation maze</td>
                                <td>A* heuristic efficiency</td>
                            </tr>
                            <tr>
                                <td>trickySearch</td>
                                <td>Complex corners and multiple food clusters</td>
                                <td>Sub-optimal vs Optimal search</td>
                            </tr>
                        </tbody>
                    </table>
                `);
            });

            document.getElementById('navStats')?.addEventListener('click', () => {
                this.setActiveNav('navStats');
                openModal('Session Telemetry & Stats', `
                    <h4>Real-time Session Metrics</h4>
                    <table class="modal-table">
                        <tbody>
                            <tr><td><strong>Games Launched:</strong></td><td>${this.sessionStats.gamesStarted}</td></tr>
                            <tr><td><strong>Current Score:</strong></td><td>${this.score}</td></tr>
                            <tr><td><strong>High Score:</strong></td><td>${this.highScore}</td></tr>
                            <tr><td><strong>Total Pellets Cleared:</strong></td><td>${this.sessionStats.dotsEaten}</td></tr>
                            <tr><td><strong>Ghosts Consumed:</strong></td><td>${this.sessionStats.ghostsEaten}</td></tr>
                            <tr><td><strong>Cumulative Nodes Explored:</strong></td><td>${this.sessionStats.nodesExploredTotal}</td></tr>
                            <tr><td><strong>Current Maze:</strong></td><td>${this.currentLayout}</td></tr>
                            <tr><td><strong>Active Algorithm:</strong></td><td>${this.aiAlgo.toUpperCase()}</td></tr>
                        </tbody>
                    </table>
                `);
            });

            document.getElementById('navAbout')?.addEventListener('click', () => {
                this.setActiveNav('navAbout');
                openModal('About PAC-MAN AI Laboratory', `
                    <h4>Project Overview</h4>
                    <p>This laboratory brings classic arcade heritage together with modern Artificial Intelligence algorithms originally developed at UC Berkeley CS188.</p>
                    <p>The web client features custom HTML5 canvas rendering, Web Audio synthesis, and real-time visualization of state space frontiers, tree exploration, and optimal path navigation.</p>
                `);
            });

            document.getElementById('btnSettings')?.addEventListener('click', () => {
                openModal('System & Visual Settings', `
                    <h4>Keybindings & Input</h4>
                    <table class="modal-table">
                        <tbody>
                            <tr><td><strong>Movement:</strong></td><td>Arrow Keys or W, A, S, D</td></tr>
                            <tr><td><strong>Pause / Resume:</strong></td><td>Spacebar</td></tr>
                            <tr><td><strong>Restart:</strong></td><td>R Key or Restart Button</td></tr>
                            <tr><td><strong>Sound Toggle:</strong></td><td>Sound Button in Header</td></tr>
                        </tbody>
                    </table>
                `);
            });
        }

        setActiveNav(id) {
            document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
            document.getElementById(id)?.classList.add('active');
        }
    }

    // Launch
    window.addEventListener('DOMContentLoaded', () => {
        window.pacmanGame = new PacmanGame();
    });
})();
