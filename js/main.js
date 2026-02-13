// ============================================================
// Stroll — A Peaceful City Walk
// A calm, relaxing 3D browser game using Three.js
// Performance-optimized with instanced geometry, merged meshes,
// day/night cycle, particles, post-processing, and more.
// ============================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
    const PARTICLE_COUNT = 200;

    // Pastel/warm building colors — expanded for procedural variety
    const BUILDING_COLORS = [
        0xF4E4C1, 0xE8D5B7, 0xF0C9A0, 0xDEB887, 0xD4A574,
        0xE6C9A8, 0xF5DEB3, 0xFFE4C4, 0xFAD6A5, 0xF0E68C,
        0xE8D4A2, 0xD2B48C, 0xC4A882, 0xBDB76B, 0xF5F0DC,
        0xFFF8DC, 0xFAEBD7, 0xFFEFD5, 0xFFE4B5, 0xFFDAB9,
        0xE6CCAB, 0xD4A98C, 0xC9967E, 0xBE8C71, 0xCFB095,
        // Additional variety colors
        0xC8B8A0, 0xB8A890, 0xD8C8B0, 0xE0D0C0, 0xA89888,
        0xF0E0D0, 0xE8D8C8, 0xD0C0B0, 0xC0B0A0, 0xB0A090
    ];

    // Building shape types for procedural variety
    const BUILDING_SHAPES = ['box', 'box-stepped', 'box-with-ledge', 'l-shape'];

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
    let scene, camera, renderer, clock, composer;
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

    // Day/night cycle
    let timeOfDay = 0.65; // 0=midnight, 0.25=sunrise, 0.5=noon, 0.65=golden hour, 0.75=sunset, 1=midnight
    let autoTimeEnabled = true;
    let sunLight, ambientLight, hemiLight, fillLight;
    let skyMesh, skyMaterial;

    // Particles
    let particleSystem;

    // Puddles
    let puddles = [];

    // Disposal tracking
    const disposables = { geometries: [], materials: [], textures: [] };

    // Loading
    let loadingProgress = 0;
    const LOAD_STEPS = 10;

    // --- Initialize ---
    function init() {
        detectMobile();
        setupScene();
        updateLoadingBar(1);

        setupLighting();
        updateLoadingBar(2);

        setupFog();
        generateCity();
        updateLoadingBar(4);

        generatePark();
        updateLoadingBar(5);

        generateTrees();
        generateBenches();
        updateLoadingBar(6);

        generateLampPosts();
        generateNPCs();
        updateLoadingBar(7);

        setupGround();
        generatePuddles();
        updateLoadingBar(8);

        setupSkybox();
        setupParticles();
        updateLoadingBar(9);

        setupPostProcessing();
        setupControls();
        setupMobileControls();
        setupUIControls();
        updateLoadingBar(10);

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

    function updateLoadingBar(step) {
        const pct = Math.min(100, Math.round((step / LOAD_STEPS) * 100));
        const bar = document.getElementById('loading-bar');
        if (bar) bar.style.width = pct + '%';
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

        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            preserveDrawingBuffer: true // needed for screenshot
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.9;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        document.body.appendChild(renderer.domElement);

        window.addEventListener('resize', onResize);
    }

    function onResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        if (composer) {
            composer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    // --- Post-Processing (bloom + vignette) ---
    function setupPostProcessing() {
        composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        // Subtle bloom
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.3,  // strength
            0.6,  // radius
            0.85  // threshold
        );
        composer.addPass(bloomPass);

        // Vignette shader
        const vignetteShader = {
            uniforms: {
                tDiffuse: { value: null },
                offset: { value: 1.0 },
                darkness: { value: 1.2 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float offset;
                uniform float darkness;
                varying vec2 vUv;
                void main() {
                    vec4 texel = texture2D(tDiffuse, vUv);
                    vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
                    float vignette = 1.0 - dot(uv, uv);
                    texel.rgb *= mix(1.0 - darkness, 1.0, smoothstep(0.0, 1.0, vignette));
                    gl_FragColor = texel;
                }
            `
        };
        const vignettePass = new ShaderPass(vignetteShader);
        composer.addPass(vignettePass);
    }

    // --- Lighting (Golden Hour with day/night cycle) ---
    function setupLighting() {
        // Warm ambient light
        ambientLight = new THREE.AmbientLight(0xFFE0B2, 0.4);
        scene.add(ambientLight);

        // Hemisphere light for sky/ground color blending
        hemiLight = new THREE.HemisphereLight(0xFDB813, 0x8B6914, 0.3);
        scene.add(hemiLight);

        // Main directional light (sun)
        sunLight = new THREE.DirectionalLight(0xFFA726, 1.2);
        sunLight.position.set(-80, 30, -60);
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
        scene.add(sunLight);

        // Secondary warm fill light
        fillLight = new THREE.DirectionalLight(0xFF8A65, 0.3);
        fillLight.position.set(60, 20, 40);
        scene.add(fillLight);
    }

    // --- Day/Night Cycle ---
    function updateDayNightCycle(t) {
        // t: 0=midnight, 0.25=sunrise, 0.5=noon, 0.65=golden hour, 0.75=sunset, 1=midnight

        // Sun position (circular arc)
        const sunAngle = (t - 0.25) * Math.PI * 2; // sunrise at t=0.25
        const sunY = Math.sin(sunAngle) * 80;
        const sunX = Math.cos(sunAngle) * 100;
        sunLight.position.set(sunX, Math.max(sunY, -10), -60);

        // Sun intensity based on height
        const sunHeight = Math.max(0, sunY / 80);
        sunLight.intensity = sunHeight * 1.4;

        // Sun color shifts
        if (t > 0.2 && t < 0.35) {
            // Sunrise - warm orange
            sunLight.color.setHex(0xFF8C00);
        } else if (t > 0.6 && t < 0.8) {
            // Golden hour / sunset
            sunLight.color.setHex(0xFFA726);
        } else if (t > 0.35 && t < 0.6) {
            // Midday - bright white-yellow
            sunLight.color.setHex(0xFFF5E0);
        } else {
            // Night
            sunLight.color.setHex(0x4466AA);
        }

        // Ambient light
        const isNight = sunHeight < 0.1;
        const ambientIntensity = isNight ? 0.08 : 0.2 + sunHeight * 0.3;
        ambientLight.intensity = ambientIntensity;
        ambientLight.color.setHex(isNight ? 0x223355 : 0xFFE0B2);

        // Hemisphere
        hemiLight.intensity = isNight ? 0.05 : 0.15 + sunHeight * 0.2;

        // Fill light
        fillLight.intensity = sunHeight * 0.3;

        // Fog color
        if (scene.fog) {
            const fogColor = new THREE.Color();
            if (isNight) {
                fogColor.setHex(0x111122);
            } else if (t > 0.6 && t < 0.8) {
                fogColor.setHex(0xFFE8CC);
            } else {
                fogColor.lerpColors(new THREE.Color(0xCCDDEE), new THREE.Color(0xFFE8CC), sunHeight);
            }
            scene.fog.color.copy(fogColor);
        }

        // Tone mapping exposure
        renderer.toneMappingExposure = isNight ? 0.4 : 0.6 + sunHeight * 0.5;

        // Update sky
        updateSkyColors(t);

        // Update time label
        const label = document.getElementById('time-label');
        if (label) {
            if (t > 0.22 && t < 0.35) label.textContent = '🌅';
            else if (t > 0.35 && t < 0.6) label.textContent = '☀️';
            else if (t > 0.6 && t < 0.78) label.textContent = '🌇';
            else label.textContent = '🌙';
        }
    }

    function updateSkyColors(t) {
        if (!skyMesh) return;

        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 256);

        if (t > 0.3 && t < 0.7) {
            // Daytime
            gradient.addColorStop(0, '#1a3a6e');
            gradient.addColorStop(0.3, '#4a7ab5');
            gradient.addColorStop(0.6, '#87CEEB');
            gradient.addColorStop(0.85, '#B0E0E6');
            gradient.addColorStop(1.0, '#E0F0FF');
        } else if ((t > 0.2 && t <= 0.3) || (t >= 0.7 && t < 0.8)) {
            // Sunrise/sunset
            gradient.addColorStop(0, '#1a1a3e');
            gradient.addColorStop(0.2, '#2d1b69');
            gradient.addColorStop(0.4, '#e85d04');
            gradient.addColorStop(0.55, '#fb8b24');
            gradient.addColorStop(0.7, '#fca311');
            gradient.addColorStop(0.85, '#ffba49');
            gradient.addColorStop(1.0, '#ffe8cc');
        } else {
            // Night
            gradient.addColorStop(0, '#050510');
            gradient.addColorStop(0.3, '#0a0a20');
            gradient.addColorStop(0.6, '#111133');
            gradient.addColorStop(0.85, '#1a1a3e');
            gradient.addColorStop(1.0, '#222244');
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 2, 256);

        if (skyMesh.material.map) {
            skyMesh.material.map.dispose();
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.LinearFilter;
        skyMesh.material.map = texture;
        skyMesh.material.needsUpdate = true;
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
        disposables.textures.push(texture);

        const skyGeo = new THREE.SphereGeometry(400, 32, 32);
        const skyMat = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.BackSide,
            fog: false
        });
        disposables.geometries.push(skyGeo);
        disposables.materials.push(skyMat);

        skyMesh = new THREE.Mesh(skyGeo, skyMat);
        scene.add(skyMesh);
    }

    // --- Ground ---
    function setupGround() {
        const groundGeo = new THREE.PlaneGeometry(CITY_SIZE * 2, CITY_SIZE * 2);
        const groundMat = new THREE.MeshLambertMaterial({ color: 0x8B8B7A });
        disposables.geometries.push(groundGeo);
        disposables.materials.push(groundMat);

        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.01;
        ground.receiveShadow = true;
        scene.add(ground);
    }

    // --- Puddles (reflective patches) ---
    function generatePuddles() {
        const puddleMat = new THREE.MeshStandardMaterial({
            color: 0x4488AA,
            metalness: 0.9,
            roughness: 0.1,
            transparent: true,
            opacity: 0.5,
            envMapIntensity: 1.0
        });
        disposables.materials.push(puddleMat);

        const puddleGeometries = [];
        for (let i = 0; i < 30; i++) {
            let x, z;
            let attempts = 0;
            do {
                x = (Math.random() - 0.5) * CITY_SIZE * 0.8;
                z = (Math.random() - 0.5) * CITY_SIZE * 0.8;
                attempts++;
            } while (isInsideBuilding(x, z) && attempts < 20);

            if (attempts < 20) {
                const w = 1 + Math.random() * 3;
                const d = 1 + Math.random() * 2;
                const geo = new THREE.PlaneGeometry(w, d);
                geo.rotateX(-Math.PI / 2);
                geo.translate(x, 0.02, z);
                puddleGeometries.push(geo);
            }
        }

        if (puddleGeometries.length > 0) {
            const mergedGeo = mergeGeometries(puddleGeometries);
            disposables.geometries.push(mergedGeo);
            const puddleMesh = new THREE.Mesh(mergedGeo, puddleMat);
            puddleMesh.receiveShadow = true;
            scene.add(puddleMesh);

            // Dispose temp geometries
            puddleGeometries.forEach(g => g.dispose());
        }
    }

    // --- City Generation (with merged geometry for performance) ---
    function generateCity() {
        const halfCity = CITY_SIZE / 2;
        const cellSize = BLOCK_SIZE + STREET_WIDTH;

        // Collect all building data first, then batch-create
        const buildingData = [];

        for (let gx = -halfCity; gx < halfCity; gx += cellSize) {
            for (let gz = -halfCity; gz < halfCity; gz += cellSize) {
                if (Math.random() < 0.15) continue;
                if (Math.abs(gx) < 25 && Math.abs(gz) < 25) continue;

                const bx = gx + STREET_WIDTH / 2;
                const bz = gz + STREET_WIDTH / 2;
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

                    buildingData.push({ x, z, height, width, depth, color, shape });
                }
            }
        }

        // Create buildings with merged window geometry
        createBuildingsBatched(buildingData);

        // Generate sidewalks (merged)
        generateSidewalks();
    }

    function createBuildingsBatched(buildingData) {
        // Group buildings by color for fewer materials
        const colorGroups = {};

        buildingData.forEach(bd => {
            const key = bd.color;
            if (!colorGroups[key]) colorGroups[key] = [];
            colorGroups[key].push(bd);
        });

        // Window geometries to merge
        const windowGeometries = [];
        const windowMat = new THREE.MeshBasicMaterial({ color: 0xFFF8E1 });
        const glowWindowMat = new THREE.MeshStandardMaterial({
            color: 0xFFE082,
            emissive: 0xFFE082,
            emissiveIntensity: 0.3
        });
        disposables.materials.push(windowMat, glowWindowMat);

        // Rooftop detail geometries to merge
        const rooftopGeometries = [];

        Object.entries(colorGroups).forEach(([colorHex, group]) => {
            const color = parseInt(colorHex);
            const buildingGeometries = [];

            group.forEach(bd => {
                const geos = createBuildingGeometry(bd);
                geos.forEach(g => {
                    g.translate(bd.x, bd.height / 2, bd.z);
                    buildingGeometries.push(g);
                });

                // Store collision data
                buildings.push({
                    x: bd.x, z: bd.z,
                    width: bd.width, depth: bd.depth, height: bd.height
                });

                // Collect window geometries
                collectWindowGeometries(bd, windowGeometries);

                // Rooftop details
                if (Math.random() < 0.3) {
                    collectRooftopGeometries(bd, rooftopGeometries);
                }
            });

            if (buildingGeometries.length > 0) {
                const merged = mergeGeometries(buildingGeometries);
                const mat = new THREE.MeshLambertMaterial({ color });
                disposables.geometries.push(merged);
                disposables.materials.push(mat);

                const mesh = new THREE.Mesh(merged, mat);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                scene.add(mesh);

                buildingGeometries.forEach(g => g.dispose());
            }
        });

        // Merge all windows into one mesh
        if (windowGeometries.length > 0) {
            const mergedWindows = mergeGeometries(windowGeometries);
            disposables.geometries.push(mergedWindows);
            const winMesh = new THREE.Mesh(mergedWindows, glowWindowMat);
            scene.add(winMesh);
            windowGeometries.forEach(g => g.dispose());
        }

        // Merge rooftop details
        if (rooftopGeometries.length > 0) {
            const mergedRooftops = mergeGeometries(rooftopGeometries);
            const rooftopMat = new THREE.MeshLambertMaterial({ color: 0x9E9E9E });
            disposables.geometries.push(mergedRooftops);
            disposables.materials.push(rooftopMat);
            const rooftopMesh = new THREE.Mesh(mergedRooftops, rooftopMat);
            rooftopMesh.castShadow = true;
            scene.add(rooftopMesh);
            rooftopGeometries.forEach(g => g.dispose());
        }
    }

    function createBuildingGeometry(bd) {
        const geometries = [];

        switch (bd.shape) {
            case 'box-stepped': {
                // Main body
                const mainGeo = new THREE.BoxGeometry(bd.width, bd.height * 0.7, bd.depth);
                mainGeo.translate(0, -(bd.height * 0.15), 0);
                geometries.push(mainGeo);
                // Upper step (narrower)
                const stepW = bd.width * 0.7;
                const stepD = bd.depth * 0.7;
                const stepH = bd.height * 0.3;
                const stepGeo = new THREE.BoxGeometry(stepW, stepH, stepD);
                stepGeo.translate(0, bd.height * 0.35 - stepH / 2 + stepH / 2, 0);
                geometries.push(stepGeo);
                break;
            }
            case 'box-with-ledge': {
                // Main body
                const mainGeo = new THREE.BoxGeometry(bd.width, bd.height, bd.depth);
                geometries.push(mainGeo);
                // Ledge at mid-height
                const ledgeGeo = new THREE.BoxGeometry(bd.width + 0.4, 0.3, bd.depth + 0.4);
                ledgeGeo.translate(0, -bd.height * 0.1, 0);
                geometries.push(ledgeGeo);
                break;
            }
            case 'l-shape': {
                // Main body
                const mainGeo = new THREE.BoxGeometry(bd.width, bd.height, bd.depth);
                geometries.push(mainGeo);
                // L extension
                const extW = bd.width * 0.4;
                const extH = bd.height * 0.6;
                const extGeo = new THREE.BoxGeometry(extW, extH, bd.depth * 0.5);
                extGeo.translate(bd.width * 0.3, -(bd.height - extH) / 2, bd.depth * 0.25);
                geometries.push(extGeo);
                break;
            }
            default: {
                // Standard box
                const geo = new THREE.BoxGeometry(bd.width, bd.height, bd.depth);
                geometries.push(geo);
                break;
            }
        }

        return geometries;
    }

    function collectWindowGeometries(bd, windowGeometries) {
        const windowSize = 0.6;
        const windowSpacingY = 3;
        const windowSpacingX = 2.5;

        const numFloors = Math.floor(bd.height / windowSpacingY);
        const numWindowsX = Math.floor(bd.width / windowSpacingX);
        const numWindowsZ = Math.floor(bd.depth / windowSpacingX);

        // Front and back faces
        for (let floor = 0; floor < numFloors; floor++) {
            for (let wx = 0; wx < numWindowsX; wx++) {
                if (Math.random() < 0.2) continue;

                const winX = bd.x - bd.width / 2 + windowSpacingX * (wx + 0.5) + (bd.width - numWindowsX * windowSpacingX) / 2;
                const winY = windowSpacingY * (floor + 0.5) + 1;

                // Front
                const geoF = new THREE.PlaneGeometry(windowSize, windowSize * 1.3);
                geoF.translate(winX, winY, bd.z + bd.depth / 2 + 0.02);
                windowGeometries.push(geoF);

                // Back
                const geoB = new THREE.PlaneGeometry(windowSize, windowSize * 1.3);
                geoB.rotateY(Math.PI);
                geoB.translate(winX, winY, bd.z - bd.depth / 2 - 0.02);
                windowGeometries.push(geoB);
            }
        }

        // Side faces
        for (let floor = 0; floor < numFloors; floor++) {
            for (let wz = 0; wz < numWindowsZ; wz++) {
                if (Math.random() < 0.2) continue;

                const winZ = bd.z - bd.depth / 2 + windowSpacingX * (wz + 0.5) + (bd.depth - numWindowsZ * windowSpacingX) / 2;
                const winY = windowSpacingY * (floor + 0.5) + 1;

                // Left
                const geoL = new THREE.PlaneGeometry(windowSize, windowSize * 1.3);
                geoL.rotateY(-Math.PI / 2);
                geoL.translate(bd.x - bd.width / 2 - 0.02, winY, winZ);
                windowGeometries.push(geoL);

                // Right
                const geoR = new THREE.PlaneGeometry(windowSize, windowSize * 1.3);
                geoR.rotateY(Math.PI / 2);
                geoR.translate(bd.x + bd.width / 2 + 0.02, winY, winZ);
                windowGeometries.push(geoR);
            }
        }
    }

    function collectRooftopGeometries(bd, rooftopGeometries) {
        const detailSize = 1 + Math.random() * 2;
        const geo = new THREE.BoxGeometry(detailSize, detailSize, detailSize);
        geo.translate(
            bd.x + (Math.random() - 0.5) * bd.width * 0.5,
            bd.height + detailSize / 2,
            bd.z + (Math.random() - 0.5) * bd.depth * 0.5
        );
        rooftopGeometries.push(geo);
    }

    function generateSidewalks() {
        const sidewalkGeometries = [];
        const halfCity = CITY_SIZE / 2;
        const cellSize = BLOCK_SIZE + STREET_WIDTH;

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
                    const geo = new THREE.BoxGeometry(s.w, 0.15, s.d);
                    geo.translate(s.x, 0.075, s.z);
                    sidewalkGeometries.push(geo);
                });
            }
        }

        if (sidewalkGeometries.length > 0) {
            const merged = mergeGeometries(sidewalkGeometries);
            const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0xC8C0B0 });
            disposables.geometries.push(merged);
            disposables.materials.push(sidewalkMat);

            const mesh = new THREE.Mesh(merged, sidewalkMat);
            mesh.receiveShadow = true;
            scene.add(mesh);

            sidewalkGeometries.forEach(g => g.dispose());
        }
    }

    // --- Park ---
    function generatePark() {
        // Grass area in center
        const parkGeo = new THREE.PlaneGeometry(45, 45);
        const parkMat = new THREE.MeshLambertMaterial({ color: 0x7CB342 });
        disposables.geometries.push(parkGeo);
        disposables.materials.push(parkMat);
        const park = new THREE.Mesh(parkGeo, parkMat);
        park.rotation.x = -Math.PI / 2;
        park.position.set(0, 0.02, 0);
        park.receiveShadow = true;
        scene.add(park);

        // Park paths (merged)
        const pathGeo1 = new THREE.PlaneGeometry(3, 40);
        pathGeo1.rotateX(-Math.PI / 2);
        pathGeo1.translate(0, 0.03, 0);

        const pathGeo2 = new THREE.PlaneGeometry(40, 3);
        pathGeo2.rotateX(-Math.PI / 2);
        pathGeo2.translate(0, 0.03, 0);

        const mergedPaths = mergeGeometries([pathGeo1, pathGeo2]);
        const pathMat = new THREE.MeshLambertMaterial({ color: 0xBCAAA4 });
        disposables.geometries.push(mergedPaths);
        disposables.materials.push(pathMat);
        const pathMesh = new THREE.Mesh(mergedPaths, pathMat);
        pathMesh.receiveShadow = true;
        scene.add(pathMesh);
        pathGeo1.dispose();
        pathGeo2.dispose();

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
        const stoneMat = new THREE.MeshLambertMaterial({ color: 0xBDBDBD });
        disposables.materials.push(stoneMat);

        const fountainGeometries = [];

        // Base
        const baseGeo = new THREE.CylinderGeometry(3, 3.5, 0.8, 8);
        baseGeo.translate(x, 0.4, z);
        fountainGeometries.push(baseGeo);

        // Center pillar
        const pillarGeo = new THREE.CylinderGeometry(0.3, 0.4, 2, 6);
        pillarGeo.translate(x, 1.8, z);
        fountainGeometries.push(pillarGeo);

        // Top bowl
        const topGeo = new THREE.CylinderGeometry(1.2, 0.5, 0.5, 8);
        topGeo.translate(x, 2.8, z);
        fountainGeometries.push(topGeo);

        const merged = mergeGeometries(fountainGeometries);
        disposables.geometries.push(merged);
        const fountainMesh = new THREE.Mesh(merged, stoneMat);
        fountainMesh.castShadow = true;
        fountainMesh.receiveShadow = true;
        scene.add(fountainMesh);
        fountainGeometries.forEach(g => g.dispose());

        // Water
        const waterGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.3, 8);
        const waterMat = new THREE.MeshStandardMaterial({
            color: 0x4FC3F7,
            transparent: true,
            opacity: 0.7,
            metalness: 0.3,
            roughness: 0.2
        });
        disposables.geometries.push(waterGeo);
        disposables.materials.push(waterMat);
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.position.set(x, 0.85, z);
        scene.add(water);
    }

    // --- Trees (merged geometry) ---
    function generateTrees() {
        const trunkGeometries = [];
        const foliageGeometriesByColor = {};

        // Street trees
        for (let i = 0; i < TREE_COUNT; i++) {
            let x, z;
            let attempts = 0;
            do {
                x = (Math.random() - 0.5) * CITY_SIZE;
                z = (Math.random() - 0.5) * CITY_SIZE;
                attempts++;
            } while (isInsideBuilding(x, z) && attempts < 20);

            if (attempts < 20) {
                collectTreeGeometries(x, z, Math.random() < 0.3, trunkGeometries, foliageGeometriesByColor);
            }
        }

        // Merge trunks
        if (trunkGeometries.length > 0) {
            const merged = mergeGeometries(trunkGeometries);
            const trunkMat = new THREE.MeshLambertMaterial({ color: 0x795548 });
            disposables.geometries.push(merged);
            disposables.materials.push(trunkMat);
            const mesh = new THREE.Mesh(merged, trunkMat);
            mesh.castShadow = true;
            scene.add(mesh);
            trunkGeometries.forEach(g => g.dispose());
        }

        // Merge foliage by color
        Object.entries(foliageGeometriesByColor).forEach(([colorHex, geos]) => {
            if (geos.length > 0) {
                const merged = mergeGeometries(geos);
                const mat = new THREE.MeshLambertMaterial({ color: parseInt(colorHex) });
                disposables.geometries.push(merged);
                disposables.materials.push(mat);
                const mesh = new THREE.Mesh(merged, mat);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                scene.add(mesh);
                geos.forEach(g => g.dispose());
            }
        });
    }

    function createTree(x, z, large) {
        // For park trees that need individual creation
        const trunkGeometries = [];
        const foliageGeometriesByColor = {};
        collectTreeGeometries(x, z, large, trunkGeometries, foliageGeometriesByColor);

        if (trunkGeometries.length > 0) {
            const merged = mergeGeometries(trunkGeometries);
            const trunkMat = new THREE.MeshLambertMaterial({ color: 0x795548 });
            disposables.geometries.push(merged);
            disposables.materials.push(trunkMat);
            const mesh = new THREE.Mesh(merged, trunkMat);
            mesh.castShadow = true;
            scene.add(mesh);
            trunkGeometries.forEach(g => g.dispose());
        }

        Object.entries(foliageGeometriesByColor).forEach(([colorHex, geos]) => {
            if (geos.length > 0) {
                const merged = mergeGeometries(geos);
                const mat = new THREE.MeshLambertMaterial({ color: parseInt(colorHex) });
                disposables.geometries.push(merged);
                disposables.materials.push(mat);
                const mesh = new THREE.Mesh(merged, mat);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                scene.add(mesh);
                geos.forEach(g => g.dispose());
            }
        });
    }

    function collectTreeGeometries(x, z, large, trunkGeometries, foliageGeometriesByColor) {
        const trunkHeight = large ? 3 + Math.random() * 2 : 1.5 + Math.random() * 1.5;
        const trunkRadius = large ? 0.3 : 0.15;

        const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, trunkHeight, 5);
        trunkGeo.translate(x, trunkHeight / 2, z);
        trunkGeometries.push(trunkGeo);

        const foliageColors = [0x558B2F, 0x689F38, 0x7CB342, 0x8BC34A, 0x9CCC65];
        const foliageColor = foliageColors[Math.floor(Math.random() * foliageColors.length)];

        if (!foliageGeometriesByColor[foliageColor]) {
            foliageGeometriesByColor[foliageColor] = [];
        }

        const layers = large ? 3 : 2;
        for (let l = 0; l < layers; l++) {
            const radius = (large ? 2.5 : 1.5) - l * 0.4;
            const height = (large ? 2.5 : 1.8) - l * 0.3;
            const coneGeo = new THREE.ConeGeometry(radius, height, 6);
            coneGeo.translate(x, trunkHeight + l * (height * 0.5) + height / 2, z);
            foliageGeometriesByColor[foliageColor].push(coneGeo);
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

    // --- Lamp Posts (emissive materials instead of PointLights) ---
    function generateLampPosts() {
        const halfCity = CITY_SIZE / 2;
        const cellSize = BLOCK_SIZE + STREET_WIDTH;

        const poleGeometries = [];
        const armGeometries = [];
        const lampGeometries = [];

        let count = 0;
        for (let gx = -halfCity; gx < halfCity && count < LAMP_COUNT; gx += cellSize) {
            for (let gz = -halfCity; gz < halfCity && count < LAMP_COUNT; gz += cellSize) {
                if (Math.random() < 0.5) continue;
                const x = gx + 2;
                const z = gz + 2;

                // Pole
                const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 5, 6);
                poleGeo.translate(x, 2.5, z);
                poleGeometries.push(poleGeo);

                // Arm
                const armGeo = new THREE.BoxGeometry(1.2, 0.06, 0.06);
                armGeo.translate(x + 0.6, 4.8, z);
                armGeometries.push(armGeo);

                // Lamp head
                const lampGeo = new THREE.BoxGeometry(0.5, 0.3, 0.5);
                lampGeo.translate(x + 1.1, 4.65, z);
                lampGeometries.push(lampGeo);

                count++;
            }
        }

        // Merge poles
        if (poleGeometries.length > 0) {
            const allPoleGeos = [...poleGeometries, ...armGeometries];
            const merged = mergeGeometries(allPoleGeos);
            const poleMat = new THREE.MeshLambertMaterial({ color: 0x37474F });
            disposables.geometries.push(merged);
            disposables.materials.push(poleMat);
            const mesh = new THREE.Mesh(merged, poleMat);
            mesh.castShadow = true;
            scene.add(mesh);
            allPoleGeos.forEach(g => g.dispose());
        }

        // Merge lamp heads with emissive material (no PointLights!)
        if (lampGeometries.length > 0) {
            const merged = mergeGeometries(lampGeometries);
            const lampMat = new THREE.MeshStandardMaterial({
                color: 0xFFE082,
                emissive: 0xFFE082,
                emissiveIntensity: 0.8
            });
            disposables.geometries.push(merged);
            disposables.materials.push(lampMat);
            const mesh = new THREE.Mesh(merged, lampMat);
            scene.add(mesh);
            lampGeometries.forEach(g => g.dispose());
        }
    }

    // --- Particles (leaves, dust motes) ---
    function setupParticles() {
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const velocities = new Float32Array(PARTICLE_COUNT * 3);
        const sizes = new Float32Array(PARTICLE_COUNT);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 100;
            positions[i * 3 + 1] = 1 + Math.random() * 15;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 100;

            velocities[i * 3] = (Math.random() - 0.5) * 0.02;
            velocities[i * 3 + 1] = -0.005 - Math.random() * 0.01;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;

            sizes[i] = 0.1 + Math.random() * 0.3;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        disposables.geometries.push(geometry);

        // Store velocities for animation
        geometry.userData = { velocities };

        const material = new THREE.PointsMaterial({
            color: 0xDDCC88,
            size: 0.2,
            transparent: true,
            opacity: 0.4,
            sizeAttenuation: true,
            depthWrite: false
        });
        disposables.materials.push(material);

        particleSystem = new THREE.Points(geometry, material);
        scene.add(particleSystem);
    }

    function updateParticles(delta) {
        if (!particleSystem) return;

        const positions = particleSystem.geometry.attributes.position.array;
        const velocities = particleSystem.geometry.userData.velocities;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3;

            // Add gentle wind sway
            positions[i3] += velocities[i3] + Math.sin(Date.now() * 0.0003 + i) * 0.003;
            positions[i3 + 1] += velocities[i3 + 1];
            positions[i3 + 2] += velocities[i3 + 2] + Math.cos(Date.now() * 0.0004 + i) * 0.003;

            // Reset particles that fall below ground or drift too far
            if (positions[i3 + 1] < 0 || Math.abs(positions[i3] - player.x) > 60) {
                positions[i3] = player.x + (Math.random() - 0.5) * 80;
                positions[i3 + 1] = 3 + Math.random() * 15;
                positions[i3 + 2] = player.z + (Math.random() - 0.5) * 80;
            }
        }

        particleSystem.geometry.attributes.position.needsUpdate = true;
    }

    // --- NPCs (with improved behavior) ---
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

        // Determine behavior type
        const behaviorRoll = Math.random();
        let behavior = 'walk';
        if (behaviorRoll < 0.15) behavior = 'sit';
        else if (behaviorRoll < 0.3) behavior = 'stop-and-go';

        npcs.push({
            mesh: group,
            path: path,
            pathIndex: 0,
            speed: 0.015 + Math.random() * 0.015,
            progress: 0,
            bobPhase: Math.random() * Math.PI * 2,
            behavior: behavior,
            waitTimer: 0,
            isWaiting: false,
            waitDuration: 3 + Math.random() * 5
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
            // Handle sitting NPCs
            if (npc.behavior === 'sit') {
                // Sitting NPCs stay in place with slight idle animation
                npc.mesh.position.y = -0.3; // lower to bench height
                return;
            }

            // Handle stop-and-go behavior
            if (npc.behavior === 'stop-and-go' && npc.isWaiting) {
                npc.waitTimer += delta;
                if (npc.waitTimer >= npc.waitDuration) {
                    npc.isWaiting = false;
                    npc.waitTimer = 0;
                    npc.waitDuration = 3 + Math.random() * 5;
                }
                return;
            }

            const from = npc.path[npc.pathIndex];
            const to = npc.path[(npc.pathIndex + 1) % npc.path.length];

            npc.progress += npc.speed * delta * 60;

            if (npc.progress >= 1) {
                npc.progress = 0;
                npc.pathIndex = (npc.pathIndex + 1) % npc.path.length;

                // Stop-and-go NPCs pause at waypoints
                if (npc.behavior === 'stop-and-go' && Math.random() < 0.4) {
                    npc.isWaiting = true;
                    return;
                }
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
                const targetYaw = Math.atan2(dx, dz);
                // Smooth rotation
                let diff = targetYaw - npc.mesh.rotation.y;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                npc.mesh.rotation.y += diff * 0.1;
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

            // Screenshot shortcut
            if (e.code === 'KeyP') {
                takeScreenshot();
            }
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

        fadeControlsHint();
    }

    // --- UI Controls ---
    function setupUIControls() {
        // Sound toggle
        const soundToggle = document.getElementById('sound-toggle');
        let soundOn = false;
        let audioCtx = null;

        soundToggle.addEventListener('click', () => {
            if (!soundOn) {
                if (!audioCtx) {
                    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                }
                createAmbientSound(audioCtx);
                soundToggle.textContent = '🔊';
                soundOn = true;
            } else {
                if (audioCtx) {
                    audioCtx.close();
                    audioCtx = null;
                }
                soundToggle.textContent = '🔇';
                soundOn = false;
            }
        });

        // Time of day slider
        const timeSlider = document.getElementById('time-slider');
        timeSlider.addEventListener('input', (e) => {
            timeOfDay = parseInt(e.target.value) / 100;
            autoTimeEnabled = false;
            updateDayNightCycle(timeOfDay);
        });

        // Double-click slider to re-enable auto time
        timeSlider.addEventListener('dblclick', () => {
            autoTimeEnabled = true;
        });

        // Screenshot button
        const screenshotBtn = document.getElementById('screenshot-btn');
        screenshotBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            takeScreenshot();
        });
    }

    function takeScreenshot() {
        // Flash effect
        const flash = document.getElementById('screenshot-flash');
        flash.classList.add('flash');
        setTimeout(() => flash.classList.remove('flash'), 150);

        // Render one frame to ensure buffer is fresh
        renderer.render(scene, camera);

        // Capture
        const link = document.createElement('a');
        link.download = `stroll-${Date.now()}.png`;
        link.href = renderer.domElement.toDataURL('image/png');
        link.click();
    }

    function fadeControlsHint() {
        if (controlsHintVisible) {
            controlsHintVisible = false;
            setTimeout(() => {
                const hint = document.getElementById('controls-hint');
                if (hint) hint.style.opacity = '0';
            }, 3000);
        }
    }

    // --- Player Movement ---
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

        // Smooth camera follow with damping
        const targetX = player.x;
        const targetZ = player.z;
        const camDamping = 0.15;

        camera.position.x += (targetX - camera.position.x) * camDamping;
        camera.position.z += (targetZ - camera.position.z) * camDamping;
        camera.position.y = PLAYER_HEIGHT;

        // Gentle head bob when moving
        if (len > 0.1) {
            const bobAmount = Math.sin(Date.now() * 0.005) * 0.04;
            camera.position.y += bobAmount;
        }

        // Smooth camera rotation with damping
        camera.rotation.order = 'YXZ';
        camera.rotation.y += (player.yaw - camera.rotation.y) * 0.2;
        camera.rotation.x += (player.pitch - camera.rotation.x) * 0.2;
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
        bubble.textContent = '"' + thought + '"';
        bubble.classList.add('visible');

        setTimeout(() => {
            bubble.classList.remove('visible');
        }, 6000);
    }

    // --- Ambient Sound (birds + city) ---
    function createAmbientSound(ctx) {
        const now = ctx.currentTime;

        // Base drone
        const osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(110, now);
        const gain1 = ctx.createGain();
        gain1.gain.setValueAtTime(0.025, now);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);

        // Harmonic
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(165, now);
        const gain2 = ctx.createGain();
        gain2.gain.setValueAtTime(0.012, now);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now);

        // High shimmer with LFO
        const osc3 = ctx.createOscillator();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(330, now);
        const gain3 = ctx.createGain();
        gain3.gain.setValueAtTime(0.006, now);

        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.3, now);
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(0.004, now);
        lfo.connect(lfoGain);
        lfoGain.connect(gain3.gain);
        lfo.start(now);

        osc3.connect(gain3);
        gain3.connect(ctx.destination);
        osc3.start(now);

        // Bird-like chirps (periodic high-frequency blips)
        function scheduleBirdChirp() {
            if (ctx.state === 'closed') return;
            const chirpTime = ctx.currentTime + Math.random() * 3;
            const chirpOsc = ctx.createOscillator();
            chirpOsc.type = 'sine';
            const baseFreq = 1200 + Math.random() * 800;
            chirpOsc.frequency.setValueAtTime(baseFreq, chirpTime);
            chirpOsc.frequency.exponentialRampToValueAtTime(baseFreq * 1.3, chirpTime + 0.05);
            chirpOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, chirpTime + 0.1);

            const chirpGain = ctx.createGain();
            chirpGain.gain.setValueAtTime(0, chirpTime);
            chirpGain.gain.linearRampToValueAtTime(0.015, chirpTime + 0.02);
            chirpGain.gain.linearRampToValueAtTime(0, chirpTime + 0.12);

            chirpOsc.connect(chirpGain);
            chirpGain.connect(ctx.destination);
            chirpOsc.start(chirpTime);
            chirpOsc.stop(chirpTime + 0.15);

            setTimeout(scheduleBirdChirp, 2000 + Math.random() * 5000);
        }
        scheduleBirdChirp();

        // Gentle noise for city ambience
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
        noiseGain.gain.setValueAtTime(0.012, now);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(now);
    }

    // --- Disposal ---
    function dispose() {
        disposables.geometries.forEach(g => g.dispose());
        disposables.materials.forEach(m => m.dispose());
        disposables.textures.forEach(t => t.dispose());
        if (renderer) renderer.dispose();
        if (composer) {
            composer.passes.forEach(p => {
                if (p.dispose) p.dispose();
            });
        }
    }

    // Clean up on page unload
    window.addEventListener('beforeunload', dispose);

    // --- Animation Loop ---
    function animate() {
        requestAnimationFrame(animate);

        const delta = Math.min(clock.getDelta(), 0.1);

        updatePlayer(delta);
        updateNPCs(delta);
        updateParticles(delta);

        // Slow auto time progression
        if (autoTimeEnabled) {
            timeOfDay += delta * 0.002; // Very slow cycle
            if (timeOfDay > 1) timeOfDay -= 1;
            updateDayNightCycle(timeOfDay);

            // Sync slider
            const slider = document.getElementById('time-slider');
            if (slider) slider.value = Math.round(timeOfDay * 100);
        }

        // Use composer for post-processing
        if (composer) {
            composer.render();
        } else {
            renderer.render(scene, camera);
        }
    }

    // --- Start ---
    window.addEventListener('DOMContentLoaded', init);

})();
