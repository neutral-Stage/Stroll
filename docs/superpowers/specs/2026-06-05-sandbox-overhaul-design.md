# Stroll Sandbox & Elemental VFX Overhaul Specification

This design document outlines the implementation plan for transforming *Stroll* into an interactive open-world sandbox game with advanced high-fidelity elemental visual effects, survival weapon progression, and dynamic sandbox missions.

---

## 1. Architecture & Global Systems

### 1.1 Survival Sandbox Progression
The starting player inventory will be restricted to encourage exploration and sandbox interactivity:
- Restrict starting weapons in `initInventory()` within [js/player/inventory.js](file:///Users/sar333/Documents/sar projects/Stroll/js/player/inventory.js) to:
  - Fists (melee, infinite use)
  - Knife (melee, infinite use)
  - Pistol (ranged, 15 bullets in clip, 30 in reserve)
- Lock all other weapons. They must be collected via street weapon crates or dropped by defeated enemies.
- Modify `cycleAll()` and category-specific switching keys in [js/player/inventory.js](file:///Users/sar333/Documents/sar projects/Stroll/js/player/inventory.js) so that they only select owned weapons.

### 1.2 Pickups & Skeletal Grab Gestures
- When the player is within $2.0$ meters of any street pickup (cash, ammo, health, armor, weapon cases), `updatePickups()` in [js/weapons/pickups.js](file:///Users/sar333/Documents/sar projects/Stroll/js/weapons/pickups.js) will trigger the pickup collection.
- Set `player.pickupActive = true` and `player.pickupTimer = 0.4` (seconds).
- This will cause the 3rd-person avatar torso to bend forward and sweep its right hand down to the ground.

---

## 2. High-Fidelity Elemental VFX

### 2.1 Laser (Blinding Energy Beam)
- Draw a double-layered laser cylinder: a bright white core (`0.03` radius) and a neon-pink outer sheath (`0.12` radius) using additive blending.
- On building or ground impact, spawn a bright glowing PointLight that fades out in `0.2s`.
- Emit a dense spray of 30+ bright sparks shooting outward in the direction of the surface normal.

### 2.2 Wind (Volumetric Tornado)
- Create a physical tornado funnel using a stack of 10 nested, rotating `TorusGeometry` rings starting from radius `1.5` at the ground up to `6.5` at the top in [js/weapons/powers-system.js](file:///Users/sar333/Documents/sar projects/Stroll/js/weapons/powers-system.js).
- Spawn swirling, expanding dust clouds (procedural dark boxes) that rise from the bottom of the funnel.
- Pull up and throw enemies and traffic cars caught in a 12-meter radius using upward/radial physics forces. Query nearby entities via `queryNearby` inside `updateVisuals` of [js/weapons/powers-system.js](file:///Users/sar333/Documents/sar projects/Stroll/js/weapons/powers-system.js) and apply forces using `applyExplosionForce` (defined in [js/core/physics.js](file:///Users/sar333/Documents/sar projects/Stroll/js/core/physics.js)) or direct velocity offsets to simulate pulling/throwing.

### 2.3 Freeze (Crystalline Ice & Decals)
- Cast a spiraling cone of translucent, faceted ice shards (using `TetrahedronGeometry` and `IcosahedronGeometry` with high roughness/specular reflection).
- When the shards hit the ground, spawn an expanding frost decal (`RingGeometry` on the ground that scales from `0.5` to `3.5` meters and fades out).
- Add frost decals to the particle system group `P_GROUP` in [js/weapons/powers-system.js](file:///Users/sar333/Documents/sar projects/Stroll/js/weapons/powers-system.js). The decal geometry (`ringDecalGeo`) is shared globally to maximize rendering performance and avoid GC pressure; only the instanced cloned materials are disposed of when their lifetime expires to prevent memory leaks.
- Frozen enemies turn bright cyan, stop moving, and take double damage from physical impacts (like slashes or bullets). Update `damageEnemyAtPoint` inside [js/enemies/enemy-manager.js](file:///Users/sar333/Documents/sar projects/Stroll/js/enemies/enemy-manager.js) to check if the target's visual status has `vis.frozenTimer > 0` and double the damage calculation before calling `damageEntity`.

### 2.4 Thunder (Branching Lightning & Scorch Marks)
- Draw a jagged main lightning bolt with 2-3 smaller, random branching sub-bolts that split off and strike nearby ground points.
- Trigger a blinding sky flash and leave a black charred scorch decal on the ground (using a dark flat `CircleGeometry` that fades over 10 seconds).
- Add scorch decals to `P_GROUP` in [js/weapons/powers-system.js](file:///Users/sar333/Documents/sar projects/Stroll/js/weapons/powers-system.js). The scorch geometry (`circleDecalGeo`) is shared globally, and only the instanced materials are disposed of upon expiration.

### 2.5 Fire (Dense Fluid Flamethrower)
- Fire dense clusters of overlapping particles that expand and transition: White-Hot Center -> Yellow Flame -> Orange Embers -> Black Smoke.
- Ignite target enemies, drivable vehicles, and traffic cars. Defeated targets and ignited cars will burn and take damage over time, leaving small fire patches that damage any entity that enters them. Ignite vehicles using `igniteVehicleAtPoint` and `igniteTrafficAtPoint` in their respective managers.

---

## 3. Destructibility & Collisions

### 3.1 Collision Bypass on Collapsed Buildings
- Modify `resolveBuildings()`, `isInsideAnyBuilding()`, and `getBuildingAt()` in [js/core/physics.js](file:///Users/sar333/Documents/sar projects/Stroll/js/core/physics.js) to ignore buildings if `!b.intact` or `b.destroyed` is true.
- Allows players, NPCs, traffic cars, projectiles, and elemental beams to seamlessly pass through collapsed ruins.

### 3.2 Concrete Debris Shards
- Upgrade `spawnColoredDebris()` in `js/destruction/explosions.js` to spawn 15-25 concrete chunks (medium-grey, rough box geometries of varying scales) ejected outward with horizontal velocity.
- Debris will fall with gravity, bounce on the ground (`y = 0`), slow down due to friction, and fade out after 3 seconds.

---

## 4. Sandbox Missions

We will expand [js/missions/mission-manager.js](file:///Users/sar333/Documents/sar projects/Stroll/js/missions/mission-manager.js) to feature 5 sandbox missions:
1. **Welcome Walk**: Walk to the central park (checks controls/camera).
2. **Rooftop Loot Run**: Find 3 cash briefcases placed on high rooftops in the East District. Gang members spawn to guard them.
3. **Survive the Horde**: A 60-second timed horde wave. Flying gargoyles and monsters spawn rapidly.
4. **Rampage**: Causing maximum destruction! Destroy 15 buildings, benches, lamp posts, or cars in 90 seconds.
5. **UFO Takedown (Boss Battle)**: A giant UFO saucer spawns at $y=22$ above the park, firing green laser beams and spawning monsters. Destroy it to complete the game.

Fix ES module compatibility by removing the dynamic `require` call at line 128 of [js/missions/mission-manager.js](file:///Users/sar333/Documents/sar projects/Stroll/js/missions/mission-manager.js) and replacing it with a top-level ESM `import { spawnEnemy } from '../enemies/enemy-manager.js';` at the head of the file.

---

## 5. Configuration & Loot Tuning

- Modify [js/config.js](file:///Users/sar333/Documents/sar projects/Stroll/js/config.js) to change the `cashDrop` configuration for `ENEMY_TYPES.SWAT` to `[20, 100]` to enable rewards when fighting elite units.

---

## 6. Verification Plan

### 6.1 Automated Tests
- Run `npm run test` to verify zero page console errors or WebGL crashes.

### 6.2 Manual Playtest
- Verify starting loadout is Fists, Knife, and Pistol.
- Verify weapon crates spawn on streets and rooftops.
- Verify volumetric superpower visual effects.
- Verify traversing collapsed buildings and debris physics.
- Play through and complete all 5 sandbox missions.
