import * as THREE from 'three';
import { getPlayerStats, addCash, getPlayerLevel } from '../player/player.js';
import { pickupWeapon } from '../player/inventory.js';
import { getPlayerVehicle, isPlayerDriving } from '../vehicles/vehicle-system.js';
import { showToast } from '../hud.js';

let sceneRef = null;
const shops = [];
let nearbyShop = null;

const SHOP_TYPES = {
    GUN_STORE: { name: 'Ammu-Nation', color: 0xFF5252, icon: '🔫' },
    REPAIR: { name: 'Pay \'n\' Spray', color: 0x4CAF50, icon: '🔧' }
};

const ITEMS = [
    { type: 'pistol', name: '9mm Pistol', cost: 200, shop: 'GUN_STORE' },
    { type: 'shotgun', name: 'Pump Shotgun', cost: 800, shop: 'GUN_STORE' },
    { type: 'smg', name: 'MP5 SMG', cost: 1200, shop: 'GUN_STORE' },
    { type: 'assault', name: 'M4 Carbine', cost: 2500, shop: 'GUN_STORE' },
    { type: 'sniper', name: 'Sniper Rifle', cost: 4000, shop: 'GUN_STORE' },
    { type: 'rpg', name: 'RPG-7', cost: 8000, shop: 'GUN_STORE' }
];

export function initEconomy(scene) {
    sceneRef = scene;

    // Create Shop Markers
    // Shop 1: Gun Store near origin
    createShopMarker(20, 0, 30, SHOP_TYPES.GUN_STORE);
    createShopMarker(-40, 0, -50, SHOP_TYPES.GUN_STORE);
    
    // Shop 2: Repair Shop
    createShopMarker(50, 0, -20, SHOP_TYPES.REPAIR);
    createShopMarker(-60, 0, 40, SHOP_TYPES.REPAIR);

    // Setup input listener for interaction
    document.addEventListener('keydown', (e) => {
        if (e.key === 'e' || e.key === 'E') {
            handleInteraction('E');
        } else if (e.key === 'r' || e.key === 'R') {
            handleInteraction('R');
        } else if (e.key === 'f' || e.key === 'F') {
            handleInteraction('F');
        }
    });
}

function createShopMarker(x, y, z, type) {
    const group = new THREE.Group();

    // Floating marker
    const geo = new THREE.CylinderGeometry(1, 1, 0.2, 8);
    const mat = new THREE.MeshBasicMaterial({ 
        color: type.color, 
        transparent: true, 
        opacity: 0.6,
        blending: THREE.AdditiveBlending 
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 1.5;
    group.add(mesh);

    // Inner ring
    const geo2 = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 8);
    const mesh2 = new THREE.Mesh(geo2, mat);
    mesh2.position.y = 1.5;
    group.add(mesh2);

    group.position.set(x, y, z);
    sceneRef.add(group);

    shops.push({
        mesh: group,
        type: type,
        x: x,
        z: z
    });
}

export function updateEconomy(delta, elapsed, playerPos) {
    let closest = null;
    let minDist = Infinity;

    for (const shop of shops) {
        // Spin animation
        shop.mesh.rotation.y += delta;
        shop.mesh.position.y = Math.sin(elapsed * 2) * 0.2;

        const dist = Math.sqrt((playerPos.x - shop.x)**2 + (playerPos.z - shop.z)**2);
        if (dist < 3) {
            if (dist < minDist) {
                minDist = dist;
                closest = shop;
            }
        }
    }

    if (closest !== nearbyShop) {
        nearbyShop = closest;
        if (nearbyShop) {
            updateShopUI(true);
        } else {
            updateShopUI(false);
        }
    }
}

function updateShopUI(show) {
    let el = document.getElementById('shop-ui');
    if (!el) {
        el = document.createElement('div');
        el.id = 'shop-ui';
        document.body.appendChild(el);
    }

    if (!show) {
        el.style.display = 'none';
        return;
    }

    el.style.display = 'flex';
    el.style.position = 'absolute';
    el.style.bottom = '15%';
    el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
    el.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    el.style.color = '#fff';
    el.style.padding = '15px 25px';
    el.style.borderRadius = '8px';
    el.style.fontFamily = 'monospace';
    el.style.fontSize = '18px';
    el.style.zIndex = '1000';
    el.style.textAlign = 'center';

    if (nearbyShop.type === SHOP_TYPES.REPAIR) {
        el.innerHTML = `<div>${nearbyShop.type.icon} ${nearbyShop.type.name}</div><div style="font-size:14px; margin-top:5px; color:#aaa;">Press E to Repair ($500) <br> Press R to Upgrade Armor ($1000) <br> Press F to Upgrade Speed ($2000)</div>`;
    } else {
        const item = getNextAvailableWeapon();
        if (item) {
            el.innerHTML = `<div>${nearbyShop.type.icon} ${nearbyShop.type.name}</div><div style="font-size:14px; margin-top:5px; color:#aaa;">Press E to Buy ${item.name} ($${item.cost})</div>`;
        } else {
            el.innerHTML = `<div>${nearbyShop.type.icon} ${nearbyShop.type.name}</div><div style="font-size:14px; margin-top:5px; color:#aaa;">All weapons purchased!</div>`;
        }
    }
}

function getNextAvailableWeapon() {
    const level = getPlayerLevel();
    for (const item of ITEMS) {
        // Unlock higher weapons at higher levels
        const requiredLevel = ITEMS.indexOf(item) + 1;
        if (level >= requiredLevel) {
            // Need a way to check if player already has weapon? Assume they can just buy ammo
            return item;
        }
    }
    return ITEMS[0];
}

function handleInteraction(key) {
    if (!nearbyShop) return;

    const stats = getPlayerStats();

    if (nearbyShop.type === SHOP_TYPES.REPAIR) {
        if (!isPlayerDriving()) {
            showToast('Shop', 'You must be inside a vehicle to interact!', 'warning');
            return;
        }
        
        const vehicle = getPlayerVehicle();
        
        if (key === 'E') {
            const cost = 500;
            if (stats.cash >= cost) {
                if (vehicle.health >= 1000 && !vehicle.armorUpgraded) {
                    showToast('Shop', 'Vehicle is already fully repaired!', 'info');
                    return;
                }
                addCash(-cost);
                vehicle.health = vehicle.armorUpgraded ? 2000 : 1000;
                showToast('Repair', 'Vehicle repaired!', 'success');
            } else {
                showToast('Shop', 'Not enough cash for repair!', 'danger');
            }
        } else if (key === 'R') {
            const cost = 1000;
            if (stats.cash >= cost) {
                if (vehicle.armorUpgraded) {
                    showToast('Shop', 'Armor already upgraded!', 'info');
                    return;
                }
                addCash(-cost);
                vehicle.armorUpgraded = true;
                vehicle.health = 2000;
                showToast('Upgrade', 'Vehicle Armor Upgraded!', 'success');
            } else {
                showToast('Shop', 'Not enough cash for armor upgrade!', 'danger');
            }
        } else if (key === 'F') {
            const cost = 2000;
            if (stats.cash >= cost) {
                if (vehicle.speedUpgraded) {
                    showToast('Shop', 'Speed already upgraded!', 'info');
                    return;
                }
                addCash(-cost);
                vehicle.speedUpgraded = true;
                vehicle.maxSpeed = (vehicle.maxSpeed || 40) * 1.5;
                vehicle.acceleration = (vehicle.acceleration || 20) * 1.5;
                showToast('Upgrade', 'Vehicle Speed Upgraded!', 'success');
            } else {
                showToast('Shop', 'Not enough cash for speed upgrade!', 'danger');
            }
        }
    } else if (nearbyShop.type === SHOP_TYPES.GUN_STORE) {
        const item = getNextAvailableWeapon();
        if (stats.cash >= item.cost) {
            addCash(-item.cost);
            pickupWeapon(item.type, 100);
            showToast('Shop', `Purchased ${item.name}!`, 'success');
        } else {
            showToast('Shop', 'Not enough cash!', 'danger');
        }
    }
}
