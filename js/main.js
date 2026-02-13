// ============================================================
// Stroll — A Peaceful City Walk
// A calm, relaxing 3D browser game using Three.js
// Performance-optimized with InstancedMesh, merged geometry,
// minimal lights, proper disposal, and rich features.
// ============================================================

(function () {
    'use strict';

    // --- Constants ---
    const CITY_SIZE = 200;
    const BLOCK_SIZE = 20;
    const STREET_WIDTH = 8;
    const WALK_SPEED = 0.08;
    const LOOK_SPEED = 0.002;
    const PLAYER_HEIGHT = 3.5;
    const NPC_COUNT = 25;
    const TREE_COUNT = 40;
    const BENCH_COUNT = 15;
    const LAMP_COUNT = 20;
    const PARTICLE_COUNT = 120;

    // Pastel/warm building colors
    const BUILDING_COLORS = [
        0xF4E4C1, 0xE8D5B7, 0xF0C9A0, 0xDEB887, 0xD4A574,
        0xE6C9A8, 0xF5DEB3, 0xFFE4C4, 0xFAD6A5, 0xF0E68C,
        0xE8D4A2, 0xD2B48C, 0xC4A882, 0xBDB76B, 0xF5F0DC,
        0xFFF8DC, 0xFAEBD7, 0xFFEFD5, 0xFFE4B5, 0xFFDAB9,
        0xE6CCAB, 0xD4A98C, 0xC9967E, 0xBE8C71, 0xCFB095
    ];

    // Building shape types for variety
    const BUILDING_SHAPES = ['box', 'box', 'box', 'lShape', 'stepped', 'tapered'];

    // Peaceful thoughts
    const THOUGHTS = [
        "The light is beautiful today...",
        "Sometimes the best path is the one with no destination.",
        "Listen to the city breathe.",
        "Every corner holds a small story.",
        "The golden hour makes everything feel like a memory.",
        "Slow down. There's nowhere to be.",
        "Notice the shadows stretching across the street.",
        "A gentle breeze carries the scent of evening.",
        "The city hums its quiet lullaby.",
        "What a lovely place to simply exist.",
        "The warmth of the sun on your face...",
        "Each step is a small meditation.",
        "Beauty hides in the ordinary.",
        "The world is softer at this hour."
    ];

    // --- State ---
    let scene, camera, renderer, clock;
    let player = { x: 0, z: 0, yaw: 0, pitch: 0 };
    let keys = {};
    let isPointerLocked = false;
    let npcs = [];
    let buildings = [];
    let thoughtTimer = 0;
    let controlsHintVisible = true;
    let isMobile = false;
    let joystickActive = false;
    let joystickDelta = { x: 0, y: 0 };
    let touchLook = { active: false, lastX: 0, lastY: 0 };

    // Lighting references for day progression
    let sunLight, ambientLight, skyMesh, skyTexture, skyCanvas, skyCtx;
    let timeOfDay = 0.35; // 0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset
    let autoTimeProgression = true;

    // Particle system
    let particleSystem, particlePositions, particleVelocities;

    // Material/geometry cache for reuse & disposal
    const materialCache = {};
    const geometryCache = {};
    const disposables = [];

    // Water puddle meshes
    let puddles = [];

    // Loading progress
    let loadProgress = 0;

    // --- Helpers: Cached materials & geometries ---
    function getCachedMaterial(key, factory) {
        if (!materialCache[key]) {
            materialCache[key] = factory();
            disposables.push(materialCache[key]);
        }
        return materialCache[key];
    }

    function getCachedGeometry(key, factory) {
        if (!geometryCache[key]) {
            geometryCache[key] = factory();
            disposables.push(geometryCache[key]);
        }
        return geometryCache[key];
    }

    function setLoadProgress(pct, text) {
        loadProgress = pct;
        const bar = document.getElementById('loading-bar');
        const label = document.getElementById('loading-text');
        if (bar) bar.style.width = pct + '%';
        if (label && text) label.textContent = text;
    }

    // --- Initialize ---
    function init() {
        detectMobile();
        setLoadProgress(5, 'Setting up scene...');

        setupScene();
        setLoadProgress(10, 'Configuring lighting...');

        setupLighting();
        setupFog();
        setLoadProgress(15, 'Building the city...');

        generateCity();
        setLoadProgress(40, 'Planting the park...');

        generatePark();
        setLoadProgress(50, 'Growing trees...');

        generateTrees();
        setLoadProgress(60, 'Placing benches...');

        generateBenches();
        setLoadProgress(65, 'Installing lamp posts...');

        generateLampPosts();
        setLoadProgress(70, 'Inviting NPCs...');

        generateNPCs();
        setLoadProgress(80, 'Laying ground...');

        setupGround();
        setupSkybox();
        setLoadProgress(85, 'Adding puddles...');

        generatePuddles();
        setLoadProgress(90, 'Creating particles...');

        setupParticles();
        setLoadProgress(95, 'Final touches...');

        setupControls();
        setupMobileControls();
        setupUIControls();

        setLoadProgress(100, 'Ready!');

        // Hide loading screen
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
        }, 800);

        // Start thought cycle
        scheduleThought();

        // Start render loop
        clock = new THREE.Clock();
        animate();
    }

    function detectMobile() {
        isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
    }

    // --- Scene Setup ---
    function setupScene() {
        scene = new THREE.Scene();

        camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);
        camera.position.set(0, PLAYER_HEIGHT, 0);

        renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: false, preserveDrawingBuffer: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
        renderer.shadowMap.enabled = !isMobile;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.9;
        renderer.outputEncoding = THREE.sRGBEncoding;
        document.body.appendChild(renderer.domElement);

        window.addEventListener('resize', onResize);
    }

    function onResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // --- Lighting (Minimal: 1 ambient + 1 directional) ---
    function setupLighting() {
        // Single warm ambient light
        ambientLight = new THREE.AmbientLight(0xFFE0B2, 0.6);
        scene.add(ambientLight);

        // Main directional light (sun)
        sunLight = new THREE.DirectionalLight(0xFFA726, 1.2);
        sunLight.position.set(-80, 30, -60);
        if (!isMobile) {
            sunLight.castShadow = true;
            sunLight.shadow.mapSize.width = 2048;
            sunLight.shadow.mapSize.height = 2048;
            sunLight.shadow.camera.near = 0.5;
            sunLight.shadow.camera.far = 300;
            sunLight.shadow.camera.left = -120;
            sunLight.shadow.camera.right = 120;
            sunLight.shadow.camera.top = 120;
            sunLight.shadow.camera.bottom = -120;
            sunLight.shadow.bias = -0.001;
        }
        scene.add(sunLight);
    }

    // --- Fog ---
    function setupFog() {
        scene.fog = new THREE.FogExp2(0xFFE8CC, 0.008);
    }

    // --- Skybox (gradient sky — updated with time of day) ---
    function setupSkybox() {
        skyCanvas = document.createElement('canvas');
        skyCanvas.width = 2;
        skyCanvas.height = 256;
        skyCtx = skyCanvas.getContext('2d');

        updateSkyGradient();

        skyTexture = new THREE.CanvasTexture(skyCanvas);
        skyTexture.magFilter = THREE.LinearFilter;

        const skyGeo = getCachedGeometry('sky', () => new THREE.SphereGeometry(400, 32, 32));
        const skyMat = getCachedMaterial('sky', () => new THREE.MeshBasicMaterial({
            map: skyTexture,
            side: THREE.BackSide,
            fog: false
        }));
        skyMesh = new THREE.Mesh(skyGeo, skyMat);
        scene.add(skyMesh);
    }

    function updateSkyGradient() {
        const t = timeOfDay; // 0..1
        const ctx = skyCtx;
        const gradient = ctx.createLinearGradient(0, 0, 0, 256);

        // Interpolate sky colors based on time of day
        if (t < 0.2) {
            // Night
            gradient.addColorStop(0, '#0a0a1a');
            gradient.addColorStop(0.5, '#111133');
            gradient.addColorStop(1.0, '#1a1a3e');
        } else if (t < 0.35) {
            // Sunrise / golden hour
            const f = (t - 0.2) / 0.15;
            gradient.addColorStop(0, lerpColor('#0a0a1a', '#1a1a3e', f));
            gradient.addColorStop(0.2, lerpColor('#111133', '#2d1b69', f));
            gradient.addColorStop(0.4, lerpColor('#1a1a3e', '#e85d04', f));
            gradient.addColorStop(0.55, lerpColor('#222244', '#fb8b24', f));
            gradient.addColorStop(0.7, lerpColor('#333355', '#fca311', f));
            gradient.addColorStop(0.85, lerpColor('#444466', '#ffba49', f));
            gradient.addColorStop(1.0, lerpColor('#555577', '#ffe8cc', f));
        } else if (t < 0.5) {
            // Golden hour to midday
            gradient.addColorStop(0, '#1a1a3e');
            gradient.addColorStop(0.2, '#2d1b69');
            gradient.addColorStop(0.4, '#e85d04');
            gradient.addColorStop(0.55, '#fb8b24');
            gradient.addColorStop(0.7, '#fca311');
            gradient.addColorStop(0.85, '#ffba49');
            gradient.addColorStop(1.0, '#ffe8cc');
        } else if (t < 0.65) {
            // Midday
            const f = (t - 0.5) / 0.15;
            gradient.addColorStop(0, lerpColor('#1a1a3e', '#2255aa', f));
            gradient.addColorStop(0.3, lerpColor('#e85d04', '#4488cc', f));
            gradient.addColorStop(0.6, lerpColor('#fca311', '#88bbee', f));
            gradient.addColorStop(1.0, lerpColor('#ffe8cc', '#cceeff', f));
        } else if (t < 0.8) {
            // Afternoon to sunset
            const f = (t - 0.65) / 0.15;
            gradient.addColorStop(0, lerpColor('#2255aa', '#1a1a3e', f));
            gradient.addColorStop(0.3, lerpColor('#4488cc', '#cc4400', f));
            gradient.addColorStop(0.6, lerpColor('#88bbee', '#ff7733', f));
            gradient.addColorStop(1.0, lerpColor('#cceeff', '#ffcc88', f));
        } else {
            // Sunset to night
            const f = (t - 0.8) / 0.2;
            gradient.addColorStop(0, lerpColor('#1a1a3e', '#0a0a1a', f));
            gradient.addColorStop(0.3, lerpColor('#cc4400', '#111133', f));
            gradient.addColorStop(0.6, lerpColor('#ff7733', '#1a1a3e', f));
            gradient.addColorStop(1.0, lerpColor('#ffcc88', '#222244', f));
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 2, 256);
    }

    function lerpColor(a, b, t) {
        const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
        const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
        const rr = Math.round(ar + (br - ar) * t);
        const rg = Math.round(ag + (bg - ag) * t);
        const rb = Math.round(ab + (bb - ab) * t);
        return '#' + ((1 << 24) + (rr << 16) + (rg << 8) + rb).toString(16).slice(1);
    }

    function updateTimeOfDay(delta) {
        if (autoTimeProgression) {
            // Full day cycle in ~10 minutes
            timeOfDay += delta * 0.0017;
            if (timeOfDay > 1) timeOfDay -= 1;

            // Sync slider
            const slider = document.getElementById('time-slider');
            if (slider && !slider.matches(':active')) {
                slider.value = Math.round(timeOfDay * 100);
            }
        }

        // Update sky
        updateSkyGradient();
        if (skyTexture) skyTexture.needsUpdate = true;

        // Update lighting based on time
        const t = timeOfDay;
        let sunIntensity, ambientIntensity, sunColor, ambientColor, fogColor;

        if (t < 0.2 || t > 0.85) {
            // Night
            sunIntensity = 0.1;
            ambientIntensity = 0.2;
            sunColor = 0x334466;
            ambientColor = 0x222244;
            fogColor = 0x111122;
        } else if (t < 0.4) {
            // Sunrise / golden hour
            sunIntensity = 1.2;
            ambientIntensity = 0.5;
            sunColor = 0xFFA726;
            ambientColor = 0xFFE0B2;
            fogColor = 0xFFE8CC;
        } else if (t < 0.65) {
            // Midday
            sunIntensity = 1.5;
            ambientIntensity = 0.7;
            sunColor = 0xFFF5E0;
            ambientColor = 0xEEEEFF;
            fogColor = 0xDDEEFF;
        } else {
            // Sunset
            sunIntensity = 1.0;
            ambientIntensity = 0.4;
            sunColor = 0xFF6633;
            ambientColor = 0xFFCC88;
            fogColor = 0xFFBB88;
        }

        sunLight.intensity = sunIntensity;
        sunLight.color.setHex(sunColor);
        ambientLight.intensity = ambientIntensity;
        ambientLight.color.setHex(ambientColor);
        scene.fog.color.setHex(fogColor);

        // Sun position follows time
        const sunAngle = (t - 0.25) * Math.PI; // rises at 0.25, sets at 0.75
        sunLight.position.set(
            Math.cos(sunAngle) * 100,
            Math.sin(sunAngle) * 80 + 10,
            -60
        );

        // Tone mapping exposure
        renderer.toneMappingExposure = (t > 0.2 && t < 0.85) ? 0.9 : 0.5;
    }

    // --- Ground ---
    function setupGround() {
        const groundGeo = getCachedGeometry('ground', () => new THREE.PlaneGeometry(CITY_SIZE * 2, CITY_SIZE * 2));
        const groundMat = getCachedMaterial('ground', () => new THREE.MeshLambertMaterial({ color: 0x8B8B7A }));
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.01;
        ground.receiveShadow = true;
        scene.add(ground);
    }

    // --- City Generation ---
    function generateCity() {
        const halfCity = CITY_SIZE / 2;
        const cellSize = BLOCK_SIZE + STREET_WIDTH;

        for (let gx = -halfCity; gx < halfCity; gx += cellSize) {
            for (let gz = -halfCity; gz < halfCity; gz += cellSize) {
                if (Math.random() < 0.15) continue;
                if (Math.abs(gx) < 25 && Math.abs(gz) < 25) continue;
                generateBlock(gx + STREET_WIDTH / 2, gz + STREET_WIDTH / 2);
            }
        }

        // Generate sidewalks using instanced mesh
        generateSidewalks();
    }

    function generateBlock(bx, bz) {
        const numBuildings = 1 + Math.floor(Math.random() * 3);
        const subSize = BLOCK_SIZE / numBuildings;

        for (let i = 0; i < numBuildings; i++) {
            const height = 4 + Math.random() * 20;
            const width = subSize * (0.6 + Math.random() * 0.35);
            const depth = BLOCK_SIZE * (0.5 + Math.random() * 0.4);

            const x = bx + i * subSize + subSize / 2;
            const z = bz + BLOCK_SIZE / 2;

            const color = BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)];
            const shape = BUILDING_SHAPES[Math.floor(Math.random() * BUILDING_SHAPES.length)];

            createBuilding(x, height, z, width, depth, color, shape);
        }
    }

    function createBuilding(x, height, z, width, depth, color, shape) {
        const mat = getCachedMaterial('bldg_' + color.toString(16), () =>
            new THREE.MeshLambertMaterial({ color: color })
        );

        let mesh;

        if (shape === 'lShape' && width > 4 && depth > 4) {
            // L-shaped building: main box + wing
            const geo1 = new THREE.BoxGeometry(width, height, depth * 0.6);
            const geo2 = new THREE.BoxGeometry(width * 0.5, height * 0.7, depth);
            const m1 = new THREE.Mesh(geo1, mat);
            m1.position.set(x, height / 2, z - depth * 0.2);
            m1.castShadow = true;
            m1.receiveShadow = true;
            scene.add(m1);
            buildings.push({ mesh: m1, x: x, z: z - depth * 0.2, width: width, depth: depth * 0.6, height: height });
            disposables.push(geo1);

            const m2 = new THREE.Mesh(geo2, mat);
            m2.position.set(x - width * 0.25, height * 0.35, z);
            m2.castShadow = true;
            m2.receiveShadow = true;
            scene.add(m2);
            buildings.push({ mesh: m2, x: x - width * 0.25, z: z, width: width * 0.5, depth: depth, height: height * 0.7 });
            disposables.push(geo2);

            addWindowsInstanced(m1, width, height, depth * 0.6);
            return;
        } else if (shape === 'stepped' && height > 10) {
            // Stepped building: two stacked boxes
            const h1 = height * 0.6;
            const h2 = height * 0.4;
            const geo1 = new THREE.BoxGeometry(width, h1, depth);
            const geo2 = new THREE.BoxGeometry(width * 0.7, h2, depth * 0.7);
            disposables.push(geo1, geo2);

            const m1 = new THREE.Mesh(geo1, mat);
            m1.position.set(x, h1 / 2, z);
            m1.castShadow = true;
            m1.receiveShadow = true;
            scene.add(m1);
            buildings.push({ mesh: m1, x, z, width, depth, height: h1 });

            const m2 = new THREE.Mesh(geo2, mat);
            m2.position.set(x, h1 + h2 / 2, z);
            m2.castShadow = true;
            m2.receiveShadow = true;
            scene.add(m2);

            addWindowsInstanced(m1, width, h1, depth);
            addWindowsInstanced(m2, width * 0.7, h2, depth * 0.7);
            return;
        } else if (shape === 'tapered' && height > 8) {
            // Tapered: slightly narrower at top using a custom geometry approach
            // Approximate with a box that's slightly smaller
            const geo = new THREE.BoxGeometry(width, height, depth);
            disposables.push(geo);
            mesh = new THREE.Mesh(geo, mat);
        } else {
            // Standard box
            const geo = new THREE.BoxGeometry(width, height, depth);
            disposables.push(geo);
            mesh = new THREE.Mesh(geo, mat);
        }

        mesh.position.set(x, height / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        buildings.push({ mesh, x, z, width, depth, height });

        addWindowsInstanced(mesh, width, height, depth);

        // Occasionally add rooftop details
        if (Math.random() < 0.3) {
            addRooftopDetail(x, height, z, width, depth);
        }
    }

    // --- Windows using InstancedMesh (massive draw call reduction) ---
    function addWindowsInstanced(building, width, height, depth) {
        const windowSize = 0.6;
        const windowSpacingY = 3;
        const windowSpacingX = 2.5;

        const numFloors = Math.floor(height / windowSpacingY);
        const numWindowsX = Math.floor(width / windowSpacingX);
        const numWindowsZ = Math.floor(depth / windowSpacingX);

        if (numFloors === 0) return;

        // Collect window transforms
        const transforms = [];
        const dummy = new THREE.Object3D();

        // Front and back faces
        for (let floor = 0; floor < numFloors; floor++) {
            for (let wx = 0; wx < numWindowsX; wx++) {
                if (Math.random() < 0.2) continue;

                const px = -width / 2 + windowSpacingX * (wx + 0.5) + (width - numWindowsX * windowSpacingX) / 2;
                const py = -height / 2 + windowSpacingY * (floor + 0.5) + 1;

                // Front
                dummy.position.set(px, py, depth / 2 + 0.01);
                dummy.rotation.set(0, 0, 0);
                dummy.updateMatrix();
                transforms.push(dummy.matrix.clone());

                // Back
                dummy.position.set(px, py, -depth / 2 - 0.01);
                dummy.rotation.set(0, Math.PI, 0);
                dummy.updateMatrix();
                transforms.push(dummy.matrix.clone());
            }
        }

        // Side faces
        for (let floor = 0; floor < numFloors; floor++) {
            for (let wz = 0; wz < numWindowsZ; wz++) {
                if (Math.random() < 0.2) continue;

                const pz = -depth / 2 + windowSpacingX * (wz + 0.5) + (depth - numWindowsZ * windowSpacingX) / 2;
                const py = -height / 2 + windowSpacingY * (floor + 0.5) + 1;

                // Left
                dummy.position.set(-width / 2 - 0.01, py, pz);
                dummy.rotation.set(0, -Math.PI / 2, 0);
                dummy.updateMatrix();
                transforms.push(dummy.matrix.clone());

                // Right
                dummy.position.set(width / 2 + 0.01, py, pz);
                dummy.rotation.set(0, Math.PI / 2, 0);
                dummy.updateMatrix();
                transforms.push(dummy.matrix.clone());
            }
        }

        if (transforms.length === 0) return;

        const winGeo = getCachedGeometry('window', () => new THREE.PlaneGeometry(windowSize, windowSize * 1.3));

        // Use emissive material for warm window glow (no extra lights needed)
        const isLit = Math.random() < 0.4;
        const matKey = isLit ? 'window_glow' : 'window_dim';
        const winMat = getCachedMaterial(matKey, () => new THREE.MeshLambertMaterial({
            color: isLit ? 0xFFE082 : 0xFFF8E1,
            emissive: isLit ? 0xFFCC00 : 0x998855,
            emissiveIntensity: isLit ? 0.4 : 0.1
        }));

        const instancedMesh = new THREE.InstancedMesh(winGeo, winMat, transforms.length);
        for (let i = 0; i < transforms.length; i++) {
            instancedMesh.setMatrixAt(i, transforms[i]);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        building.add(instancedMesh);
    }

    function addRooftopDetail(x, height, z, width, depth) {
        const detailSize = 1 + Math.random() * 2;
        const geo = getCachedGeometry('rooftop_' + Math.round(detailSize), () =>
            new THREE.BoxGeometry(detailSize, detailSize, detailSize)
        );
        const mat = getCachedMaterial('rooftop', () => new THREE.MeshLambertMaterial({ color: 0x9E9E9E }));
        const detail = new THREE.Mesh(geo, mat);
        detail.position.set(
            x + (Math.random() - 0.5) * width * 0.5,
            height + detailSize / 2,
            z + (Math.random() - 0.5) * depth * 0.5
        );
        detail.castShadow = true;
        scene.add(detail);
    }

    // --- Sidewalks using InstancedMesh ---
    function generateSidewalks() {
        const halfCity = CITY_SIZE / 2;
        const cellSize = BLOCK_SIZE + STREET_WIDTH;

        // Collect all sidewalk strip transforms
        const transforms = [];
        const dummy = new THREE.Object3D();

        // We use a unit box and scale per instance
        for (let gx = -halfCity; gx < halfCity; gx += cellSize) {
            for (let gz = -halfCity; gz < halfCity; gz += cellSize) {
                const sx = gx + STREET_WIDTH / 2;
                const sz = gz + STREET_WIDTH / 2;

                const strips = [
                    { x: sx + BLOCK_SIZE / 2, z: sz - 0.8, w: BLOCK_SIZE + 1.6, d: 1.5 },
                    { x: sx + BLOCK_SIZE / 2, z: sz + BLOCK_SIZE + 0.8, w: BLOCK_SIZE + 1.6, d: 1.5 },
                    { x: sx - 0.8, z: sz + BLOCK_SIZE / 2, w: 1.5, d: BLOCK_SIZE },
                    { x: sx + BLOCK_SIZE + 0.8, z: sz + BLOCK_SIZE / 2, w: 1.5, d: BLOCK_SIZE }
                ];

                strips.forEach(s => {
                    dummy.position.set(s.x, 0.075, s.z);
                    dummy.scale.set(s.w, 0.15, s.d);
                    dummy.rotation.set(0, 0, 0);
                    dummy.updateMatrix();
                    transforms.push(dummy.matrix.clone());
                });
            }
        }

        if (transforms.length === 0) return;

        // Unit box geometry (1x1x1), scaled per instance
        const unitBox = getCachedGeometry('unitBox', () => new THREE.BoxGeometry(1, 1, 1));
        const sidewalkMat = getCachedMaterial('sidewalk', () => new THREE.MeshLambertMaterial({ color: 0xC8C0B0 }));

        const instancedMesh = new THREE.InstancedMesh(unitBox, sidewalkMat, transforms.length);
        for (let i = 0; i < transforms.length; i++) {
            instancedMesh.setMatrixAt(i, transforms[i]);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedMesh.receiveShadow = true;
        scene.add(instancedMesh);
    }

    // --- Park ---
    function generatePark() {
        const parkGeo = getCachedGeometry('park', () => new THREE.PlaneGeometry(45, 45));
        const parkMat = getCachedMaterial('parkGrass', () => new THREE.MeshLambertMaterial({ color: 0x7CB342 }));
        const park = new THREE.Mesh(parkGeo, parkMat);
        park.rotation.x = -Math.PI / 2;
        park.position.set(0, 0.02, 0);
        park.receiveShadow = true;
        scene.add(park);

        // Park paths
        const pathGeo = getCachedGeometry('parkPath', () => new THREE.PlaneGeometry(3, 40));
        const pathMat = getCachedMaterial('parkPathMat', () => new THREE.MeshLambertMaterial({ color: 0xBCAAA4 }));

        const path1 = new THREE.Mesh(pathGeo, pathMat);
        path1.rotation.x = -Math.PI / 2;
        path1.position.set(0, 0.03, 0);
        path1.receiveShadow = true;
        scene.add(path1);

        const path2 = new THREE.Mesh(pathGeo, pathMat);
        path2.rotation.x = -Math.PI / 2;
        path2.rotation.z = Math.PI / 2;
        path2.position.set(0, 0.03, 0);
        path2.receiveShadow = true;
        scene.add(path2);

        // Park trees
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const radius = 12 + Math.random() * 6;
            createTree(Math.cos(angle) * radius, Math.sin(angle) * radius, true);
        }

        // Central fountain
        createFountain(0, 0);

        // Park benches
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + 0.3;
            createBench(Math.cos(angle) * 8, Math.sin(angle) * 8, angle + Math.PI);
        }
    }

    function createFountain(x, z) {
        const stoneMat = getCachedMaterial('stone', () => new THREE.MeshLambertMaterial({ color: 0xBDBDBD }));

        const baseGeo = getCachedGeometry('fountainBase', () => new THREE.CylinderGeometry(3, 3.5, 0.8, 8));
        const base = new THREE.Mesh(baseGeo, stoneMat);
        base.position.set(x, 0.4, z);
        base.castShadow = true;
        base.receiveShadow = true;
        scene.add(base);

        const waterGeo = getCachedGeometry('fountainWater', () => new THREE.CylinderGeometry(2.5, 2.5, 0.3, 8));
        const waterMat = getCachedMaterial('water', () => new THREE.MeshLambertMaterial({
            color: 0x4FC3F7, transparent: true, opacity: 0.7
        }));
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.position.set(x, 0.85, z);
        scene.add(water);

        const pillarGeo = getCachedGeometry('fountainPillar', () => new THREE.CylinderGeometry(0.3, 0.4, 2, 6));
        const pillar = new THREE.Mesh(pillarGeo, stoneMat);
        pillar.position.set(x, 1.8, z);
        pillar.castShadow = true;
        scene.add(pillar);

        const topGeo = getCachedGeometry('fountainTop', () => new THREE.CylinderGeometry(1.2, 0.5, 0.5, 8));
        const top = new THREE.Mesh(topGeo, stoneMat);
        top.position.set(x, 2.8, z);
        top.castShadow = true;
        scene.add(top);
    }

    // --- Trees using InstancedMesh ---
    function generateTrees() {
        const halfCity = CITY_SIZE / 2;
        const treeData = []; // { x, z, large }

        // Collect tree positions
        for (let i = 0; i < TREE_COUNT; i++) {
            let x, z;
            let attempts = 0;
            do {
                x = (Math.random() - 0.5) * CITY_SIZE;
                z = (Math.random() - 0.5) * CITY_SIZE;
                attempts++;
            } while (isInsideBuilding(x, z) && attempts < 20);

            if (attempts < 20) {
                treeData.push({ x, z, large: Math.random() < 0.3 });
            }
        }

        // For simplicity with varied sizes, create trees individually but reuse materials
        treeData.forEach(td => createTree(td.x, td.z, td.large));
    }

    function createTree(x, z, large) {
        const trunkHeight = large ? 3 + Math.random() * 2 : 1.5 + Math.random() * 1.5;
        const trunkRadius = large ? 0.3 : 0.15;

        const trunkGeo = getCachedGeometry('trunk_' + (large ? 'L' : 'S'), () =>
            new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, large ? 4 : 2.25, 5)
        );
        const trunkMat = getCachedMaterial('trunk', () => new THREE.MeshLambertMaterial({ color: 0x795548 }));
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(x, trunkHeight / 2, z);
        trunk.castShadow = true;
        scene.add(trunk);

        const foliageColors = [0x558B2F, 0x689F38, 0x7CB342, 0x8BC34A, 0x9CCC65];
        const foliageColor = foliageColors[Math.floor(Math.random() * foliageColors.length)];
        const foliageMat = getCachedMaterial('foliage_' + foliageColor.toString(16), () =>
            new THREE.MeshLambertMaterial({ color: foliageColor })
        );

        const layers = large ? 3 : 2;
        for (let l = 0; l < layers; l++) {
            const radius = (large ? 2.5 : 1.5) - l * 0.4;
            const height = (large ? 2.5 : 1.8) - l * 0.3;
            const coneGeo = getCachedGeometry('cone_' + (large ? 'L' : 'S') + '_' + l, () =>
                new THREE.ConeGeometry(radius, height, 6)
            );
            const cone = new THREE.Mesh(coneGeo, foliageMat);
            cone.position.set(x, trunkHeight + l * (height * 0.5) + height / 2, z);
            cone.castShadow = true;
            cone.receiveShadow = true;
            scene.add(cone);
        }
    }

    // --- Benches ---
    function generateBenches() {
        for (let i = 0; i < BENCH_COUNT; i++) {
            let x, z;
            let attempts = 0;
            do {
                x = (Math.random() - 0.5) * CITY_SIZE * 0.8;
                z = (Math.random() - 0.5) * CITY_SIZE * 0.8;
                attempts++;
            } while (isInsideBuilding(x, z) && attempts < 20);

            if (attempts < 20) {
                createBench(x, z, Math.random() * Math.PI * 2);
            }
        }
    }

    function createBench(x, z, rotation) {
        const group = new THREE.Group();

        const woodMat = getCachedMaterial('wood', () => new THREE.MeshLambertMaterial({ color: 0x8D6E63 }));
        const metalMat = getCachedMaterial('metal', () => new THREE.MeshLambertMaterial({ color: 0x424242 }));

        const seatGeo = getCachedGeometry('benchSeat', () => new THREE.BoxGeometry(1.8, 0.1, 0.6));
        const seat = new THREE.Mesh(seatGeo, woodMat);
        seat.position.y = 0.7;
        group.add(seat);

        const backGeo = getCachedGeometry('benchBack', () => new THREE.BoxGeometry(1.8, 0.6, 0.08));
        const back = new THREE.Mesh(backGeo, woodMat);
        back.position.set(0, 1.1, -0.25);
        back.rotation.x = -0.15;
        group.add(back);

        const legGeo = getCachedGeometry('benchLeg', () => new THREE.BoxGeometry(0.08, 0.7, 0.5));
        [-0.7, 0.7].forEach(lx => {
            const leg = new THREE.Mesh(legGeo, metalMat);
            leg.position.set(lx, 0.35, 0);
            group.add(leg);
        });

        group.position.set(x, 0, z);
        group.rotation.y = rotation;
        group.castShadow = true;
        scene.add(group);
    }

    // --- Lamp Posts (emissive materials instead of PointLights) ---
    function generateLampPosts() {
        const halfCity = CITY_SIZE / 2;
        const cellSize = BLOCK_SIZE + STREET_WIDTH;

        // Collect lamp positions
        const lampPositions = [];
        let count = 0;
        for (let gx = -halfCity; gx < halfCity && count < LAMP_COUNT; gx += cellSize) {
            for (let gz = -halfCity; gz < halfCity && count < LAMP_COUNT; gz += cellSize) {
                if (Math.random() < 0.5) continue;
                lampPositions.push({ x: gx + 2, z: gz + 2 });
                count++;
            }
        }

        // Create instanced lamp posts
        const poleMat = getCachedMaterial('lampPole', () => new THREE.MeshLambertMaterial({ color: 0x37474F }));
        // Emissive lamp head — no PointLight needed!
        const lampMat = getCachedMaterial('lampHead', () => new THREE.MeshStandardMaterial({
            color: 0xFFE082,
            emissive: 0xFFCC00,
            emissiveIntensity: 0.8
        }));

        const poleGeo = getCachedGeometry('lampPole', () => new THREE.CylinderGeometry(0.08, 0.12, 5, 6));
        const armGeo = getCachedGeometry('lampArm', () => new THREE.BoxGeometry(1.2, 0.06, 0.06));
        const lampGeo = getCachedGeometry('lampHead', () => new THREE.BoxGeometry(0.5, 0.3, 0.5));

        lampPositions.forEach(pos => {
            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.position.set(pos.x, 2.5, pos.z);
            pole.castShadow = true;
            scene.add(pole);

            const arm = new THREE.Mesh(armGeo, poleMat);
            arm.position.set(pos.x + 0.6, 4.8, pos.z);
            scene.add(arm);

            const lamp = new THREE.Mesh(lampGeo, lampMat);
            lamp.position.set(pos.x + 1.1, 4.65, pos.z);
            scene.add(lamp);
            // NO PointLight — emissive material handles the glow
        });
    }

    // --- NPCs with varied behavior ---
    function generateNPCs() {
        const npcColors = [
            0xE57373, 0x64B5F6, 0x81C784, 0xFFB74D, 0xBA68C8,
            0x4DB6AC, 0xFF8A65, 0xA1887F, 0x90A4AE, 0xF06292,
            0xAED581, 0x4DD0E1, 0xFFD54F, 0x7986CB, 0xE0E0E0
        ];

        for (let i = 0; i < NPC_COUNT; i++) {
            createNPC(npcColors[i % npcColors.length]);
        }
    }

    function createNPC(color) {
        const group = new THREE.Group();

        const bodyMat = getCachedMaterial('npcBody_' + color.toString(16), () =>
            new THREE.MeshLambertMaterial({ color: color })
        );
        const bodyGeo = getCachedGeometry('npcBody', () => new THREE.BoxGeometry(0.6, 1.0, 0.4));
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1.3;
        group.add(body);

        const headGeo = getCachedGeometry('npcHead', () => new THREE.BoxGeometry(0.4, 0.4, 0.4));
        const skinColor = Math.random() < 0.5 ? 0xFFCC80 : 0xD7A86E;
        const headMat = getCachedMaterial('npcSkin_' + skinColor.toString(16), () =>
            new THREE.MeshLambertMaterial({ color: skinColor })
        );
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 2.1;
        group.add(head);

        const legGeo = getCachedGeometry('npcLeg', () => new THREE.BoxGeometry(0.2, 0.7, 0.25));
        const legMat = getCachedMaterial('npcLegMat', () => new THREE.MeshLambertMaterial({ color: 0x455A64 }));
        [-0.15, 0.15].forEach(lx => {
            const leg = new THREE.Mesh(legGeo, legMat);
            leg.position.set(lx, 0.45, 0);
            group.add(leg);
        });

        const path = generateNPCPath();
        const startPoint = path[0];
        group.position.set(startPoint.x, 0, startPoint.z);
        group.castShadow = true;
        scene.add(group);

        // Varied behavior: walking, stopping, sitting
        const behaviors = ['walk', 'walk', 'walk', 'stopAndGo', 'wander'];
        const behavior = behaviors[Math.floor(Math.random() * behaviors.length)];

        npcs.push({
            mesh: group,
            path: path,
            pathIndex: 0,
            speed: 0.015 + Math.random() * 0.015,
            progress: 0,
            bobPhase: Math.random() * Math.PI * 2,
            behavior: behavior,
            // For stopAndGo behavior
            stopTimer: 0,
            isStopped: false,
            stopDuration: 2 + Math.random() * 4,
            walkDuration: 5 + Math.random() * 10,
            walkTimer: 0,
            // For turning
            targetYaw: 0,
            currentYaw: 0
        });
    }

    function generateNPCPath() {
        const points = [];
        const numPoints = 4 + Math.floor(Math.random() * 6);

        let x = (Math.random() - 0.5) * CITY_SIZE * 0.7;
        let z = (Math.random() - 0.5) * CITY_SIZE * 0.7;

        for (let i = 0; i < numPoints; i++) {
            points.push({ x, z });
            if (Math.random() < 0.5) {
                x += (Math.random() - 0.5) * 40;
            } else {
                z += (Math.random() - 0.5) * 40;
            }
            x = Math.max(-CITY_SIZE / 2 + 5, Math.min(CITY_SIZE / 2 - 5, x));
            z = Math.max(-CITY_SIZE / 2 + 5, Math.min(CITY_SIZE / 2 - 5, z));
        }

        return points;
    }

    function updateNPCs(delta) {
        npcs.forEach(npc => {
            // Handle stopAndGo behavior
            if (npc.behavior === 'stopAndGo') {
                if (npc.isStopped) {
                    npc.stopTimer += delta;
                    if (npc.stopTimer >= npc.stopDuration) {
                        npc.isStopped = false;
                        npc.walkTimer = 0;
                        npc.stopDuration = 2 + Math.random() * 4;
                    }
                    return; // Don't move while stopped
                } else {
                    npc.walkTimer += delta;
                    if (npc.walkTimer >= npc.walkDuration) {
                        npc.isStopped = true;
                        npc.stopTimer = 0;
                        npc.walkDuration = 5 + Math.random() * 10;
                        return;
                    }
                }
            }

            const from = npc.path[npc.pathIndex];
            const to = npc.path[(npc.pathIndex + 1) % npc.path.length];

            npc.progress += npc.speed * delta * 60;

            if (npc.progress >= 1) {
                npc.progress = 0;
                npc.pathIndex = (npc.pathIndex + 1) % npc.path.length;

                // Wander behavior: occasionally pick a new random direction
                if (npc.behavior === 'wander' && Math.random() < 0.3) {
                    const nextIdx = (npc.pathIndex + 1) % npc.path.length;
                    npc.path[nextIdx] = {
                        x: npc.mesh.position.x + (Math.random() - 0.5) * 30,
                        z: npc.mesh.position.z + (Math.random() - 0.5) * 30
                    };
                    // Clamp
                    npc.path[nextIdx].x = Math.max(-CITY_SIZE / 2 + 5, Math.min(CITY_SIZE / 2 - 5, npc.path[nextIdx].x));
                    npc.path[nextIdx].z = Math.max(-CITY_SIZE / 2 + 5, Math.min(CITY_SIZE / 2 - 5, npc.path[nextIdx].z));
                }
            }

            // Lerp position
            const x = from.x + (to.x - from.x) * npc.progress;
            const z = from.z + (to.z - from.z) * npc.progress;

            npc.mesh.position.x = x;
            npc.mesh.position.z = z;

            // Smooth turning
            const dx = to.x - from.x;
            const dz = to.z - from.z;
            if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
                npc.targetYaw = Math.atan2(dx, dz);
            }
            // Smooth rotation interpolation
            let yawDiff = npc.targetYaw - npc.currentYaw;
            // Normalize angle difference
            while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
            while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
            npc.currentYaw += yawDiff * Math.min(1, delta * 5);
            npc.mesh.rotation.y = npc.currentYaw;

            // Walking bob
            npc.bobPhase += delta * 8;
            npc.mesh.position.y = Math.abs(Math.sin(npc.bobPhase)) * 0.08;
        });
    }

    // --- Water Puddles (reflective surfaces) ---
    function generatePuddles() {
        const puddleMat = getCachedMaterial('puddle', () => new THREE.MeshStandardMaterial({
            color: 0x4488AA,
            metalness: 0.9,
            roughness: 0.1,
            transparent: true,
            opacity: 0.6
        }));

        const puddleGeo = getCachedGeometry('puddle', () => new THREE.CircleGeometry(1.5, 8));

        for (let i = 0; i < 15; i++) {
            let x, z;
            let attempts = 0;
            do {
                x = (Math.random() - 0.5) * CITY_SIZE * 0.8;
                z = (Math.random() - 0.5) * CITY_SIZE * 0.8;
                attempts++;
            } while (isInsideBuilding(x, z) && attempts < 20);

            if (attempts < 20) {
                const puddle = new THREE.Mesh(puddleGeo, puddleMat);
                puddle.rotation.x = -Math.PI / 2;
                puddle.position.set(x, 0.01, z);
                const scale = 0.5 + Math.random() * 1.5;
                puddle.scale.set(scale, scale, 1);
                scene.add(puddle);
                puddles.push(puddle);
            }
        }
    }

    // --- Particle System (floating leaves / dust motes) ---
    function setupParticles() {
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const velocities = new Float32Array(PARTICLE_COUNT * 3);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 80;
            positions[i * 3 + 1] = 1 + Math.random() * 15;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 80;

            velocities[i * 3] = (Math.random() - 0.5) * 0.3;
            velocities[i * 3 + 1] = -0.02 - Math.random() * 0.05;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        disposables.push(geometry);

        const material = new THREE.PointsMaterial({
            color: 0xDDCC88,
            size: 0.15,
            transparent: true,
            opacity: 0.6,
            sizeAttenuation: true,
            fog: true
        });
        disposables.push(material);

        particleSystem = new THREE.Points(geometry, material);
        particlePositions = positions;
        particleVelocities = velocities;
        scene.add(particleSystem);
    }

    function updateParticles(delta) {
        if (!particleSystem) return;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            particlePositions[i * 3] += particleVelocities[i * 3] * delta * 10;
            particlePositions[i * 3 + 1] += particleVelocities[i * 3 + 1] * delta * 10;
            particlePositions[i * 3 + 2] += particleVelocities[i * 3 + 2] * delta * 10;

            // Add gentle swaying
            particlePositions[i * 3] += Math.sin(Date.now() * 0.001 + i) * 0.002;

            // Reset particles that fall below ground or drift too far
            if (particlePositions[i * 3 + 1] < 0) {
                particlePositions[i * 3] = player.x + (Math.random() - 0.5) * 60;
                particlePositions[i * 3 + 1] = 5 + Math.random() * 15;
                particlePositions[i * 3 + 2] = player.z + (Math.random() - 0.5) * 60;
            }
        }

        particleSystem.geometry.attributes.position.needsUpdate = true;
    }

    // --- Collision Detection ---
    function isInsideBuilding(x, z, padding) {
        padding = padding || 1;
        for (let i = 0; i < buildings.length; i++) {
            const b = buildings[i];
            if (x > b.x - b.width / 2 - padding && x < b.x + b.width / 2 + padding &&
                z > b.z - b.depth / 2 - padding && z < b.z + b.depth / 2 + padding) {
                return true;
            }
        }
        return false;
    }

    // --- Controls ---
    function setupControls() {
        document.addEventListener('keydown', (e) => {
            keys[e.code] = true;
        });

        document.addEventListener('keyup', (e) => {
            keys[e.code] = false;
        });

        // Pointer lock for mouse look
        renderer.domElement.addEventListener('click', () => {
            if (!isMobile) {
                renderer.domElement.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            isPointerLocked = document.pointerLockElement === renderer.domElement;
            if (isPointerLocked) {
                document.body.classList.add('playing');
                fadeControlsHint();
            } else {
                document.body.classList.remove('playing');
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!isPointerLocked) return;
            player.yaw -= e.movementX * LOOK_SPEED;
            player.pitch -= e.movementY * LOOK_SPEED;
            player.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, player.pitch));
        });
    }

    function setupMobileControls() {
        if (!isMobile) return;

        const joystickBase = document.getElementById('joystick-base');
        const joystickThumb = document.getElementById('joystick-thumb');

        joystickBase.addEventListener('touchstart', (e) => {
            e.preventDefault();
            joystickActive = true;
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            const touches = e.touches;
            for (let i = 0; i < touches.length; i++) {
                const touch = touches[i];
                const rect = joystickBase.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                if (touch.clientX > window.innerWidth / 2) {
                    if (!touchLook.active) {
                        touchLook.active = true;
                        touchLook.lastX = touch.clientX;
                        touchLook.lastY = touch.clientY;
                    } else {
                        const dx = touch.clientX - touchLook.lastX;
                        const dy = touch.clientY - touchLook.lastY;
                        player.yaw -= dx * 0.005;
                        player.pitch -= dy * 0.005;
                        player.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, player.pitch));
                        touchLook.lastX = touch.clientX;
                        touchLook.lastY = touch.clientY;
                    }
                } else if (joystickActive) {
                    const dx = touch.clientX - centerX;
                    const dy = touch.clientY - centerY;
                    const maxDist = 35;
                    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), maxDist);
                    const angle = Math.atan2(dy, dx);

                    joystickDelta.x = (Math.cos(angle) * dist) / maxDist;
                    joystickDelta.y = (Math.sin(angle) * dist) / maxDist;

                    joystickThumb.style.transform = 'translate(' + (joystickDelta.x * 25) + 'px, ' + (joystickDelta.y * 25) + 'px)';
                }
            }
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
                joystickActive = false;
                joystickDelta.x = 0;
                joystickDelta.y = 0;
                joystickThumb.style.transform = 'translate(0, 0)';
                touchLook.active = false;
            }
        });

        fadeControlsHint();
    }

    // --- UI Controls (sound, photo, time slider) ---
    function setupUIControls() {
        // Sound toggle
        const toggle = document.getElementById('sound-toggle');
        let soundOn = false;
        let audioCtx = null;

        toggle.addEventListener('click', () => {
            if (!soundOn) {
                if (!audioCtx) {
                    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                }
                createAmbientSound(audioCtx);
                toggle.textContent = '🔊';
                soundOn = true;
            } else {
                if (audioCtx) {
                    audioCtx.close();
                    audioCtx = null;
                }
                toggle.textContent = '🔇';
                soundOn = false;
            }
        });

        // Photo / screenshot button
        const photoBtn = document.getElementById('photo-btn');
        photoBtn.addEventListener('click', () => {
            takeScreenshot();
        });

        // Time of day slider
        const timeSlider = document.getElementById('time-slider');
        timeSlider.addEventListener('input', (e) => {
            timeOfDay = parseInt(e.target.value) / 100;
            autoTimeProgression = false;
        });
        timeSlider.addEventListener('change', () => {
            // Resume auto progression after a delay
            setTimeout(() => { autoTimeProgression = true; }, 5000);
        });
    }

    function takeScreenshot() {
        // Flash effect
        const flash = document.createElement('div');
        flash.className = 'photo-flash';
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 600);

        // Render one frame and capture
        renderer.render(scene, camera);
        const dataURL = renderer.domElement.toDataURL('image/png');
        const link = document.getElementById('screenshot-link');
        link.href = dataURL;
        link.download = 'stroll-' + Date.now() + '.png';
        link.click();
    }

    function fadeControlsHint() {
        if (controlsHintVisible) {
            controlsHintVisible = false;
            setTimeout(() => {
                document.getElementById('controls-hint').style.opacity = '0';
            }, 3000);
        }
    }

    // --- Player Movement (with smooth damping) ---
    let smoothYaw = 0;
    let smoothPitch = 0;

    function updatePlayer(delta) {
        let moveX = 0;
        let moveZ = 0;

        if (keys['KeyW'] || keys['ArrowUp']) moveZ -= 1;
        if (keys['KeyS'] || keys['ArrowDown']) moveZ += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;

        if (joystickActive) {
            moveX += joystickDelta.x;
            moveZ += joystickDelta.y;
        }

        const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
        if (len > 0) {
            moveX /= len;
            moveZ /= len;
        }

        const speed = WALK_SPEED * delta * 60;
        const sinYaw = Math.sin(player.yaw);
        const cosYaw = Math.cos(player.yaw);

        const newX = player.x + (moveX * cosYaw + moveZ * sinYaw) * speed;
        const newZ = player.z + (-moveX * sinYaw + moveZ * cosYaw) * speed;

        if (!isInsideBuilding(newX, newZ, 1.5)) {
            player.x = newX;
            player.z = newZ;
        } else if (!isInsideBuilding(newX, player.z, 1.5)) {
            player.x = newX;
        } else if (!isInsideBuilding(player.x, newZ, 1.5)) {
            player.z = newZ;
        }

        const bound = CITY_SIZE / 2 - 2;
        player.x = Math.max(-bound, Math.min(bound, player.x));
        player.z = Math.max(-bound, Math.min(bound, player.z));

        // Smooth camera damping
        const dampFactor = 1 - Math.pow(0.001, delta);
        smoothYaw += (player.yaw - smoothYaw) * dampFactor;
        smoothPitch += (player.pitch - smoothPitch) * dampFactor;

        camera.position.set(player.x, PLAYER_HEIGHT, player.z);

        // Gentle head bob when moving
        if (len > 0.1) {
            const bobAmount = Math.sin(Date.now() * 0.005) * 0.04;
            camera.position.y += bobAmount;
        }

        camera.rotation.order = 'YXZ';
        camera.rotation.y = smoothYaw;
        camera.rotation.x = smoothPitch;
    }

    // --- Thoughts ---
    function scheduleThought() {
        const delay = 15000 + Math.random() * 25000;
        setTimeout(() => {
            showThought();
            scheduleThought();
        }, delay);
    }

    function showThought() {
        const bubble = document.getElementById('thought-bubble');
        const thought = THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)];
        bubble.textContent = '\u201C' + thought + '\u201D';
        bubble.classList.add('visible');

        setTimeout(() => {
            bubble.classList.remove('visible');
        }, 6000);
    }

    // --- Ambient Audio System ---
    function createAmbientSound(ctx) {
        const now = ctx.currentTime;

        // Master gain for overall volume control
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0, now);
        masterGain.gain.linearRampToValueAtTime(1, now + 2); // Fade in
        masterGain.connect(ctx.destination);

        // Base drone
        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(110, now);
        const gain1 = ctx.createGain();
        gain1.gain.setValueAtTime(0.03, now);
        osc1.connect(gain1);
        gain1.connect(masterGain);
        osc1.start(now);

        // Harmonic
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(165, now);
        const gain2 = ctx.createGain();
        gain2.gain.setValueAtTime(0.015, now);
        osc2.connect(gain2);
        gain2.connect(masterGain);
        osc2.start(now);

        // High shimmer with LFO
        const osc3 = ctx.createOscillator();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(330, now);
        const gain3 = ctx.createGain();
        gain3.gain.setValueAtTime(0.008, now);

        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.3, now);
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(0.005, now);
        lfo.connect(lfoGain);
        lfoGain.connect(gain3.gain);
        lfo.start(now);

        osc3.connect(gain3);
        gain3.connect(masterGain);
        osc3.start(now);

        // City ambience noise (filtered)
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = (Math.random() * 2 - 1) * 0.5;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, now);
        filter.Q.setValueAtTime(0.5, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.015, now);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(masterGain);
        noise.start(now);

        // Bird chirp layer (periodic high-frequency blips)
        scheduleBirdChirp(ctx, masterGain);
    }

    function scheduleBirdChirp(ctx, destination) {
        const chirp = () => {
            if (ctx.state === 'closed') return;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            const baseFreq = 1800 + Math.random() * 1200;
            osc.frequency.setValueAtTime(baseFreq, now);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.3, now + 0.05);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, now + 0.15);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.008, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

            osc.connect(gain);
            gain.connect(destination);
            osc.start(now);
            osc.stop(now + 0.25);

            // Schedule next chirp
            setTimeout(chirp, 3000 + Math.random() * 8000);
        };
        setTimeout(chirp, 2000 + Math.random() * 5000);
    }

    // --- Cleanup / Disposal ---
    function dispose() {
        disposables.forEach(d => {
            if (d && typeof d.dispose === 'function') {
                d.dispose();
            }
        });
        disposables.length = 0;

        // Clear caches
        Object.keys(materialCache).forEach(k => {
            materialCache[k].dispose();
            delete materialCache[k];
        });
        Object.keys(geometryCache).forEach(k => {
            geometryCache[k].dispose();
            delete geometryCache[k];
        });

        if (renderer) {
            renderer.dispose();
        }
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', dispose);

    // --- Animation Loop ---
    function animate() {
        requestAnimationFrame(animate);

        const delta = Math.min(clock.getDelta(), 0.1);

        updatePlayer(delta);
        updateNPCs(delta);
        updateTimeOfDay(delta);
        updateParticles(delta);

        renderer.render(scene, camera);
    }

    // --- Start ---
    window.addEventListener('DOMContentLoaded', init);

})();
