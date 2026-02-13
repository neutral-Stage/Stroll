// ============================================================
// Stroll — A Peaceful City Walk
// A calm, relaxing 3D browser game using Three.js
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

    // Pastel/warm building colors
    const BUILDING_COLORS = [
        0xF4E4C1, 0xE8D5B7, 0xF0C9A0, 0xDEB887, 0xD4A574,
        0xE6C9A8, 0xF5DEB3, 0xFFE4C4, 0xFAD6A5, 0xF0E68C,
        0xE8D4A2, 0xD2B48C, 0xC4A882, 0xBDB76B, 0xF5F0DC,
        0xFFF8DC, 0xFAEBD7, 0xFFEFD5, 0xFFE4B5, 0xFFDAB9,
        0xE6CCAB, 0xD4A98C, 0xC9967E, 0xBE8C71, 0xCFB095
    ];

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

    // --- Initialize ---
    function init() {
        detectMobile();
        setupScene();
        setupLighting();
        setupFog();
        generateCity();
        generatePark();
        generateTrees();
        generateBenches();
        generateLampPosts();
        generateNPCs();
        setupGround();
        setupSkybox();
        setupControls();
        setupMobileControls();

        // Hide loading screen
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
        }, 1500);

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

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
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

    // --- Lighting (Golden Hour) ---
    function setupLighting() {
        // Warm ambient light
        const ambient = new THREE.AmbientLight(0xFFE0B2, 0.4);
        scene.add(ambient);

        // Hemisphere light for sky/ground color blending
        const hemi = new THREE.HemisphereLight(0xFDB813, 0x8B6914, 0.3);
        scene.add(hemi);

        // Main directional light (sun at golden hour - low angle)
        const sun = new THREE.DirectionalLight(0xFFA726, 1.2);
        sun.position.set(-80, 30, -60);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 300;
        sun.shadow.camera.left = -120;
        sun.shadow.camera.right = 120;
        sun.shadow.camera.top = 120;
        sun.shadow.camera.bottom = -120;
        sun.shadow.bias = -0.001;
        scene.add(sun);

        // Secondary warm fill light
        const fill = new THREE.DirectionalLight(0xFF8A65, 0.3);
        fill.position.set(60, 20, 40);
        scene.add(fill);

        // Subtle warm point light near player start
        const warmGlow = new THREE.PointLight(0xFFCC80, 0.5, 50);
        warmGlow.position.set(0, 8, 0);
        scene.add(warmGlow);
    }

    // --- Fog ---
    function setupFog() {
        scene.fog = new THREE.FogExp2(0xFFE8CC, 0.008);
    }

    // --- Skybox (gradient sky) ---
    function setupSkybox() {
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, '#1a1a3e');
        gradient.addColorStop(0.2, '#2d1b69');
        gradient.addColorStop(0.4, '#e85d04');
        gradient.addColorStop(0.55, '#fb8b24');
        gradient.addColorStop(0.7, '#fca311');
        gradient.addColorStop(0.85, '#ffba49');
        gradient.addColorStop(1.0, '#ffe8cc');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 2, 256);

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.LinearFilter;

        const skyGeo = new THREE.SphereGeometry(400, 32, 32);
        const skyMat = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.BackSide,
            fog: false
        });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        scene.add(sky);
    }

    // --- Ground ---
    function setupGround() {
        // Main ground
        const groundGeo = new THREE.PlaneGeometry(CITY_SIZE * 2, CITY_SIZE * 2);
        const groundMat = new THREE.MeshLambertMaterial({ color: 0x8B8B7A });
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
                // Skip some blocks randomly for variety
                if (Math.random() < 0.15) continue;

                // Skip center area for park
                if (Math.abs(gx) < 25 && Math.abs(gz) < 25) continue;

                generateBlock(gx + STREET_WIDTH / 2, gz + STREET_WIDTH / 2);
            }
        }

        // Generate sidewalks along streets
        generateSidewalks();
    }

    function generateBlock(bx, bz) {
        // Each block can have 1-4 buildings
        const numBuildings = 1 + Math.floor(Math.random() * 3);
        const subSize = BLOCK_SIZE / numBuildings;

        for (let i = 0; i < numBuildings; i++) {
            const height = 4 + Math.random() * 20;
            const width = subSize * (0.6 + Math.random() * 0.35);
            const depth = BLOCK_SIZE * (0.5 + Math.random() * 0.4);

            const x = bx + i * subSize + subSize / 2;
            const z = bz + BLOCK_SIZE / 2;

            const color = BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)];

            createBuilding(x, height, z, width, depth, color);
        }
    }

    function createBuilding(x, height, z, width, depth, color) {
        const geo = new THREE.BoxGeometry(width, height, depth);
        const mat = new THREE.MeshLambertMaterial({ color: color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, height / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        buildings.push({ mesh, x, z, width, depth, height });

        // Add windows
        addWindows(mesh, width, height, depth, color);

        // Occasionally add rooftop details
        if (Math.random() < 0.3) {
            addRooftopDetail(x, height, z, width, depth);
        }
    }

    function addWindows(building, width, height, depth, buildingColor) {
        const windowColor = 0xFFF8E1;
        const glowColor = 0xFFE082;
        const windowMat = new THREE.MeshBasicMaterial({
            color: Math.random() < 0.4 ? glowColor : windowColor
        });

        const windowSize = 0.6;
        const windowSpacingY = 3;
        const windowSpacingX = 2.5;

        const numFloors = Math.floor(height / windowSpacingY);
        const numWindowsX = Math.floor(width / windowSpacingX);
        const numWindowsZ = Math.floor(depth / windowSpacingX);

        // Front and back faces
        for (let floor = 0; floor < numFloors; floor++) {
            for (let wx = 0; wx < numWindowsX; wx++) {
                if (Math.random() < 0.2) continue; // Some windows missing
                const winGeo = new THREE.PlaneGeometry(windowSize, windowSize * 1.3);

                // Front
                const winFront = new THREE.Mesh(winGeo, windowMat);
                winFront.position.set(
                    -width / 2 + windowSpacingX * (wx + 0.5) + (width - numWindowsX * windowSpacingX) / 2,
                    -height / 2 + windowSpacingY * (floor + 0.5) + 1,
                    depth / 2 + 0.01
                );
                building.add(winFront);

                // Back
                const winBack = new THREE.Mesh(winGeo, windowMat);
                winBack.position.set(
                    -width / 2 + windowSpacingX * (wx + 0.5) + (width - numWindowsX * windowSpacingX) / 2,
                    -height / 2 + windowSpacingY * (floor + 0.5) + 1,
                    -depth / 2 - 0.01
                );
                winBack.rotation.y = Math.PI;
                building.add(winBack);
            }
        }

        // Side faces
        for (let floor = 0; floor < numFloors; floor++) {
            for (let wz = 0; wz < numWindowsZ; wz++) {
                if (Math.random() < 0.2) continue;
                const winGeo = new THREE.PlaneGeometry(windowSize, windowSize * 1.3);

                // Left
                const winLeft = new THREE.Mesh(winGeo, windowMat);
                winLeft.position.set(
                    -width / 2 - 0.01,
                    -height / 2 + windowSpacingY * (floor + 0.5) + 1,
                    -depth / 2 + windowSpacingX * (wz + 0.5) + (depth - numWindowsZ * windowSpacingX) / 2
                );
                winLeft.rotation.y = -Math.PI / 2;
                building.add(winLeft);

                // Right
                const winRight = new THREE.Mesh(winGeo, windowMat);
                winRight.position.set(
                    width / 2 + 0.01,
                    -height / 2 + windowSpacingY * (floor + 0.5) + 1,
                    -depth / 2 + windowSpacingX * (wz + 0.5) + (depth - numWindowsZ * windowSpacingX) / 2
                );
                winRight.rotation.y = Math.PI / 2;
                building.add(winRight);
            }
        }
    }

    function addRooftopDetail(x, height, z, width, depth) {
        // Small box on roof (AC unit, water tank, etc.)
        const detailSize = 1 + Math.random() * 2;
        const geo = new THREE.BoxGeometry(detailSize, detailSize, detailSize);
        const mat = new THREE.MeshLambertMaterial({ color: 0x9E9E9E });
        const detail = new THREE.Mesh(geo, mat);
        detail.position.set(
            x + (Math.random() - 0.5) * width * 0.5,
            height + detailSize / 2,
            z + (Math.random() - 0.5) * depth * 0.5
        );
        detail.castShadow = true;
        scene.add(detail);
    }

    function generateSidewalks() {
        const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0xC8C0B0 });
        const halfCity = CITY_SIZE / 2;
        const cellSize = BLOCK_SIZE + STREET_WIDTH;

        for (let gx = -halfCity; gx < halfCity; gx += cellSize) {
            for (let gz = -halfCity; gz < halfCity; gz += cellSize) {
                // Sidewalk around each block
                const sx = gx + STREET_WIDTH / 2;
                const sz = gz + STREET_WIDTH / 2;

                // Create sidewalk strips
                const strips = [
                    { x: sx + BLOCK_SIZE / 2, z: sz - 0.8, w: BLOCK_SIZE + 1.6, d: 1.5 },
                    { x: sx + BLOCK_SIZE / 2, z: sz + BLOCK_SIZE + 0.8, w: BLOCK_SIZE + 1.6, d: 1.5 },
                    { x: sx - 0.8, z: sz + BLOCK_SIZE / 2, w: 1.5, d: BLOCK_SIZE },
                    { x: sx + BLOCK_SIZE + 0.8, z: sz + BLOCK_SIZE / 2, w: 1.5, d: BLOCK_SIZE }
                ];

                strips.forEach(s => {
                    const geo = new THREE.BoxGeometry(s.w, 0.15, s.d);
                    const mesh = new THREE.Mesh(geo, sidewalkMat);
                    mesh.position.set(s.x, 0.075, s.z);
                    mesh.receiveShadow = true;
                    scene.add(mesh);
                });
            }
        }
    }

    // --- Park ---
    function generatePark() {
        // Grass area in center
        const parkGeo = new THREE.PlaneGeometry(45, 45);
        const parkMat = new THREE.MeshLambertMaterial({ color: 0x7CB342 });
        const park = new THREE.Mesh(parkGeo, parkMat);
        park.rotation.x = -Math.PI / 2;
        park.position.set(0, 0.02, 0);
        park.receiveShadow = true;
        scene.add(park);

        // Park path
        const pathGeo = new THREE.PlaneGeometry(3, 40);
        const pathMat = new THREE.MeshLambertMaterial({ color: 0xBCAAA4 });
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

        // Park trees (larger, nicer)
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const radius = 12 + Math.random() * 6;
            createTree(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius,
                true
            );
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
        // Base
        const baseGeo = new THREE.CylinderGeometry(3, 3.5, 0.8, 8);
        const stoneMat = new THREE.MeshLambertMaterial({ color: 0xBDBDBD });
        const base = new THREE.Mesh(baseGeo, stoneMat);
        base.position.set(x, 0.4, z);
        base.castShadow = true;
        base.receiveShadow = true;
        scene.add(base);

        // Water
        const waterGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.3, 8);
        const waterMat = new THREE.MeshLambertMaterial({ color: 0x4FC3F7, transparent: true, opacity: 0.7 });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.position.set(x, 0.85, z);
        scene.add(water);

        // Center pillar
        const pillarGeo = new THREE.CylinderGeometry(0.3, 0.4, 2, 6);
        const pillar = new THREE.Mesh(pillarGeo, stoneMat);
        pillar.position.set(x, 1.8, z);
        pillar.castShadow = true;
        scene.add(pillar);

        // Top bowl
        const topGeo = new THREE.CylinderGeometry(1.2, 0.5, 0.5, 8);
        const top = new THREE.Mesh(topGeo, stoneMat);
        top.position.set(x, 2.8, z);
        top.castShadow = true;
        scene.add(top);
    }

    // --- Trees ---
    function generateTrees() {
        const halfCity = CITY_SIZE / 2;
        for (let i = 0; i < TREE_COUNT; i++) {
            let x, z;
            let attempts = 0;
            do {
                x = (Math.random() - 0.5) * CITY_SIZE;
                z = (Math.random() - 0.5) * CITY_SIZE;
                attempts++;
            } while (isInsideBuilding(x, z) && attempts < 20);

            if (attempts < 20) {
                createTree(x, z, Math.random() < 0.3);
            }
        }
    }

    function createTree(x, z, large) {
        const trunkHeight = large ? 3 + Math.random() * 2 : 1.5 + Math.random() * 1.5;
        const trunkRadius = large ? 0.3 : 0.15;

        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, trunkHeight, 5);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x795548 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(x, trunkHeight / 2, z);
        trunk.castShadow = true;
        scene.add(trunk);

        // Foliage (stacked cones for low-poly look)
        const foliageColors = [0x558B2F, 0x689F38, 0x7CB342, 0x8BC34A, 0x9CCC65];
        const foliageColor = foliageColors[Math.floor(Math.random() * foliageColors.length)];
        const foliageMat = new THREE.MeshLambertMaterial({ color: foliageColor });

        const layers = large ? 3 : 2;
        for (let l = 0; l < layers; l++) {
            const radius = (large ? 2.5 : 1.5) - l * 0.4;
            const height = (large ? 2.5 : 1.8) - l * 0.3;
            const coneGeo = new THREE.ConeGeometry(radius, height, 6);
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

        const woodMat = new THREE.MeshLambertMaterial({ color: 0x8D6E63 });
        const metalMat = new THREE.MeshLambertMaterial({ color: 0x424242 });

        // Seat
        const seatGeo = new THREE.BoxGeometry(1.8, 0.1, 0.6);
        const seat = new THREE.Mesh(seatGeo, woodMat);
        seat.position.y = 0.7;
        group.add(seat);

        // Back
        const backGeo = new THREE.BoxGeometry(1.8, 0.6, 0.08);
        const back = new THREE.Mesh(backGeo, woodMat);
        back.position.set(0, 1.1, -0.25);
        back.rotation.x = -0.15;
        group.add(back);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.08, 0.7, 0.5);
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

    // --- Lamp Posts ---
    function generateLampPosts() {
        const halfCity = CITY_SIZE / 2;
        const cellSize = BLOCK_SIZE + STREET_WIDTH;

        let count = 0;
        for (let gx = -halfCity; gx < halfCity && count < LAMP_COUNT; gx += cellSize) {
            for (let gz = -halfCity; gz < halfCity && count < LAMP_COUNT; gz += cellSize) {
                if (Math.random() < 0.5) continue;
                createLampPost(gx + 2, gz + 2);
                count++;
            }
        }
    }

    function createLampPost(x, z) {
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x37474F });

        // Pole
        const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 5, 6);
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(x, 2.5, z);
        pole.castShadow = true;
        scene.add(pole);

        // Arm
        const armGeo = new THREE.BoxGeometry(1.2, 0.06, 0.06);
        const arm = new THREE.Mesh(armGeo, poleMat);
        arm.position.set(x + 0.6, 4.8, z);
        scene.add(arm);

        // Lamp head
        const lampGeo = new THREE.BoxGeometry(0.5, 0.3, 0.5);
        const lampMat = new THREE.MeshBasicMaterial({ color: 0xFFE082 });
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.set(x + 1.1, 4.65, z);
        scene.add(lamp);

        // Light
        const light = new THREE.PointLight(0xFFE082, 0.4, 15);
        light.position.set(x + 1.1, 4.5, z);
        scene.add(light);
    }

    // --- NPCs ---
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

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.6, 1.0, 0.4);
        const bodyMat = new THREE.MeshLambertMaterial({ color: color });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1.3;
        group.add(body);

        // Head
        const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const skinColor = Math.random() < 0.5 ? 0xFFCC80 : 0xD7A86E;
        const headMat = new THREE.MeshLambertMaterial({ color: skinColor });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 2.1;
        group.add(head);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.25);
        const legMat = new THREE.MeshLambertMaterial({ color: 0x455A64 });
        [-0.15, 0.15].forEach(lx => {
            const leg = new THREE.Mesh(legGeo, legMat);
            leg.position.set(lx, 0.45, 0);
            group.add(leg);
        });

        // Generate a walking path
        const path = generateNPCPath();
        const startPoint = path[0];
        group.position.set(startPoint.x, 0, startPoint.z);
        group.castShadow = true;

        scene.add(group);

        npcs.push({
            mesh: group,
            path: path,
            pathIndex: 0,
            speed: 0.015 + Math.random() * 0.015,
            progress: 0,
            bobPhase: Math.random() * Math.PI * 2
        });
    }

    function generateNPCPath() {
        const points = [];
        const numPoints = 4 + Math.floor(Math.random() * 6);

        // Start somewhere on a street
        let x = (Math.random() - 0.5) * CITY_SIZE * 0.7;
        let z = (Math.random() - 0.5) * CITY_SIZE * 0.7;

        for (let i = 0; i < numPoints; i++) {
            points.push({ x, z });
            // Walk in a direction
            if (Math.random() < 0.5) {
                x += (Math.random() - 0.5) * 40;
            } else {
                z += (Math.random() - 0.5) * 40;
            }
            // Clamp to city bounds
            x = Math.max(-CITY_SIZE / 2 + 5, Math.min(CITY_SIZE / 2 - 5, x));
            z = Math.max(-CITY_SIZE / 2 + 5, Math.min(CITY_SIZE / 2 - 5, z));
        }

        return points;
    }

    function updateNPCs(delta) {
        npcs.forEach(npc => {
            const from = npc.path[npc.pathIndex];
            const to = npc.path[(npc.pathIndex + 1) % npc.path.length];

            npc.progress += npc.speed * delta * 60;

            if (npc.progress >= 1) {
                npc.progress = 0;
                npc.pathIndex = (npc.pathIndex + 1) % npc.path.length;
            }

            // Lerp position
            const x = from.x + (to.x - from.x) * npc.progress;
            const z = from.z + (to.z - from.z) * npc.progress;

            npc.mesh.position.x = x;
            npc.mesh.position.z = z;

            // Face direction of movement
            const dx = to.x - from.x;
            const dz = to.z - from.z;
            if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
                npc.mesh.rotation.y = Math.atan2(dx, dz);
            }

            // Walking bob
            npc.bobPhase += delta * 8;
            npc.mesh.position.y = Math.abs(Math.sin(npc.bobPhase)) * 0.08;
        });
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
        const joystickArea = document.getElementById('joystick-area');

        // Joystick for movement
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
                    // Right side - look
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
                    // Left side - move
                    const dx = touch.clientX - centerX;
                    const dy = touch.clientY - centerY;
                    const maxDist = 35;
                    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), maxDist);
                    const angle = Math.atan2(dy, dx);

                    joystickDelta.x = (Math.cos(angle) * dist) / maxDist;
                    joystickDelta.y = (Math.sin(angle) * dist) / maxDist;

                    joystickThumb.style.transform = `translate(${joystickDelta.x * 25}px, ${joystickDelta.y * 25}px)`;
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

        // Auto-start on mobile (no pointer lock needed)
        fadeControlsHint();
    }

    function fadeControlsHint() {
        if (controlsHintVisible) {
            controlsHintVisible = false;
            setTimeout(() => {
                document.getElementById('controls-hint').style.opacity = '0';
            }, 3000);
        }
    }

    // --- Player Movement ---
    function updatePlayer(delta) {
        let moveX = 0;
        let moveZ = 0;

        // Keyboard input
        if (keys['KeyW'] || keys['ArrowUp']) moveZ -= 1;
        if (keys['KeyS'] || keys['ArrowDown']) moveZ += 1;
        if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;

        // Mobile joystick input
        if (joystickActive) {
            moveX += joystickDelta.x;
            moveZ += joystickDelta.y;
        }

        // Normalize
        const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
        if (len > 0) {
            moveX /= len;
            moveZ /= len;
        }

        // Apply movement relative to camera direction
        const speed = WALK_SPEED * delta * 60;
        const sinYaw = Math.sin(player.yaw);
        const cosYaw = Math.cos(player.yaw);

        const newX = player.x + (moveX * cosYaw + moveZ * sinYaw) * speed;
        const newZ = player.z + (-moveX * sinYaw + moveZ * cosYaw) * speed;

        // Simple collision check
        if (!isInsideBuilding(newX, newZ, 1.5)) {
            player.x = newX;
            player.z = newZ;
        } else if (!isInsideBuilding(newX, player.z, 1.5)) {
            player.x = newX;
        } else if (!isInsideBuilding(player.x, newZ, 1.5)) {
            player.z = newZ;
        }

        // Clamp to city bounds
        const bound = CITY_SIZE / 2 - 2;
        player.x = Math.max(-bound, Math.min(bound, player.x));
        player.z = Math.max(-bound, Math.min(bound, player.z));

        // Update camera
        camera.position.set(player.x, PLAYER_HEIGHT, player.z);

        // Gentle head bob when moving
        if (len > 0.1) {
            const bobAmount = Math.sin(Date.now() * 0.005) * 0.04;
            camera.position.y += bobAmount;
        }

        // Camera rotation
        camera.rotation.order = 'YXZ';
        camera.rotation.y = player.yaw;
        camera.rotation.x = player.pitch;
    }

    // --- Thoughts ---
    function scheduleThought() {
        const delay = 15000 + Math.random() * 25000; // 15-40 seconds
        setTimeout(() => {
            showThought();
            scheduleThought();
        }, delay);
    }

    function showThought() {
        const bubble = document.getElementById('thought-bubble');
        const thought = THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)];
        bubble.textContent = '"' + thought + '"';
        bubble.classList.add('visible');

        setTimeout(() => {
            bubble.classList.remove('visible');
        }, 6000);
    }

    // --- Sound Toggle ---
    (function setupSoundToggle() {
        const toggle = document.getElementById('sound-toggle');
        let soundOn = false;
        let audioCtx = null;

        toggle.addEventListener('click', () => {
            if (!soundOn) {
                // Create ambient sound using Web Audio API
                if (!audioCtx) {
                    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                }
                // Generate a gentle ambient drone
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
    })();

    function createAmbientSound(ctx) {
        // Create a gentle, warm ambient drone
        const now = ctx.currentTime;

        // Base drone
        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(110, now);
        const gain1 = ctx.createGain();
        gain1.gain.setValueAtTime(0.03, now);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);

        // Harmonic
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(165, now);
        const gain2 = ctx.createGain();
        gain2.gain.setValueAtTime(0.015, now);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now);

        // High shimmer
        const osc3 = ctx.createOscillator();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(330, now);
        const gain3 = ctx.createGain();
        gain3.gain.setValueAtTime(0.008, now);

        // LFO for shimmer
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.3, now);
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(0.005, now);
        lfo.connect(lfoGain);
        lfoGain.connect(gain3.gain);
        lfo.start(now);

        osc3.connect(gain3);
        gain3.connect(ctx.destination);
        osc3.start(now);

        // Gentle noise for "city ambience"
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = (Math.random() * 2 - 1) * 0.5;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;

        // Filter the noise to be very soft
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, now);
        filter.Q.setValueAtTime(0.5, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.015, now);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(now);
    }

    // --- Animation Loop ---
    function animate() {
        requestAnimationFrame(animate);

        const delta = Math.min(clock.getDelta(), 0.1);

        updatePlayer(delta);
        updateNPCs(delta);

        renderer.render(scene, camera);
    }

    // --- Start ---
    window.addEventListener('DOMContentLoaded', init);

})();
