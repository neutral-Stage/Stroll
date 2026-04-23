# 🌇 Stroll — A Peaceful City Walk (Enhanced Edition)

A beautiful, relaxing 3D browser-based experience where you explore a procedurally generated city during golden hour. Now with enhanced graphics, dynamic weather, mini-games, and much more!

![Stroll Game](https://img.shields.io/badge/Three.js-0.160.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

### 🎨 Enhanced Graphics
- **Realistic Lighting**: Improved sun shadows, hemisphere lighting, and volumetric effects
- **Dynamic Sky**: Stars and moon that appear during nighttime
- **High-Quality Shadows**: Enhanced shadow mapping for realistic depth
- **Post-Processing**: Bloom effects and FXAA anti-aliasing for a polished look

### 🌧️ Dynamic Weather System
- **Realistic Rain**: Particle-based rain with puddle reflections
- **Thunder & Lightning**: Atmospheric storm effects with sound
- **Adaptive Fog**: Weather-responsive fog density
- **Toggle with 'R' key**

### 🎵 Enhanced Audio Experience
- **Lofi Hip-Hop Music**: Procedurally generated relaxing beats
- **Multiple Ambient Moods**:
  - Calm (default)
  - Meditative
  - Dreamy
  - Nature sounds
- **Layered Soundscapes**: Wind, birds, crickets, ocean waves, wind chimes
- **Weather Sounds**: Rain ambience and thunder effects

### 🎮 Interactive Mini-Games
Press **'G'** to start a random mini-game:
- **Memory Match**: Find matching pairs of city symbols
- **Rhythm Game**: Hit notes in time with the music
- **Treasure Hunt**: Follow clues to discover hidden treasures
- **Photo Challenge**: Capture specific moments
- **Breathing Exercise**: Guided meditation game
- **Constellation Finding**: Discover star patterns at night

### 💎 Enhanced Collectibles
- **Rainbow Gems**: Color-cycling crystals (50 points each)
- **Ancient Artifacts**: Mystical relics with lore (100 points each)
- **Music Notes**: Floating melodies (25 points each)
- **Mystery Boxes**: Random rewards (variable points)
- **Original Collectibles**: Orbs, crystals, and stars

### 🎯 Core Experience
- **Procedural City**: Unique buildings, parks, and urban landscapes
- **Day/Night Cycle**: Smooth transitions from golden hour to starlit night
- **Companion Dog**: Follows you on your journey
- **Wildlife**: Butterflies and birds to discover
- **NPCs**: Peaceful citizens wandering the streets
- **Traffic System**: Ambient vehicle movement

### 📸 Creative Tools
- **Photo Mode (P)**: Orbital camera with filters
  - Apply filters with **'F'**
  - Take screenshots with **Space**
- **Meditation Mode (N)**: Guided breathing exercises
- **Discovery Journal (J)**: Track achievements and waypoints

### 🔫 Action Elements
- **Weapon System**: FPS-style pistol (Left Click to shoot)
- **Destructible Objects**: Shoot and destroy items
- **Ammo Pickups**: Scattered throughout the city
- **Interactive Flowers**: Right-click to bloom

## 🎮 Controls

### Movement
- **W A S D** or **Arrow Keys**: Walk around
- **Mouse**: Look around
- **Mouse Wheel**: Zoom in photo mode

### Actions
- **Left Click**: Shoot weapon
- **Right Click**: Interact with flowers
- **P**: Toggle photo mode
- **N**: Toggle meditation mode
- **M**: Toggle sound on/off
- **J**: Open discovery journal
- **R**: Toggle weather (rain/clear)
- **G**: Start/end mini-game
- **Esc**: Pause menu

### Photo Mode
- **Mouse**: Orbit camera
- **Scroll**: Zoom
- **F**: Cycle filters
- **Space**: Take screenshot
- **P**: Exit photo mode

## 🏆 Achievements

- **First Steps**: Start your stroll
- **Curious Collector**: Collect 10 items
- **Treasure Hunter**: Collect 25 items
- **Completionist**: Collect all items
- **Wanderer**: Discover 3 waypoints
- **Cartographer**: Discover all waypoints
- **Night Owl**: Experience nighttime
- **Photographer**: Use photo mode
- **Zen Master**: Use meditation mode
- **Flower Power**: Interact with 5 flowers
- **Marathon Walker**: Walk 1000 units
- **Stargazer**: Collect all stars

## 🎨 Visual Enhancements

### Lighting Improvements
- Enhanced directional sun with soft shadow edges
- Hemisphere light for natural sky/ground color blending
- Multiple fill and rim lights for depth
- Night-time star field with 1500+ stars
- Animated moon that follows day/night cycle

### Post-Processing Effects
- **Bloom**: Subtle glow on bright objects
- **FXAA**: Smooth anti-aliasing
- **Tone Mapping**: ACES Filmic for realistic color

### Particle Systems
- Enhanced leaf particles with realistic drift
- Firefly particles that glow at night
- Rain particles (2000+ droplets)
- Impact effects for weapon fire
- Collectible trail effects

## 🎵 Audio Features

### Music System
- **Lofi Hip-Hop**: Procedural chill beats
  - Mellow chord progressions
  - Soft drum patterns
  - Vinyl crackle texture
  - Warm bass lines

### Ambient Layers
- Wind with filtered noise
- Bird chirps (daytime)
- Cricket sounds (nighttime)
- Ocean wave simulation
- Wind chimes
- Piano melodies
- Meditation bells

### Sound Effects
- Gunshot with realistic synthesis
- Collection sounds (unique per collectible type)
- Thunder and rain ambience
- Discovery chimes
- Achievement fanfares

## 🌟 Performance Optimizations

- **Instanced Rendering**: Single draw call for all windows, trees, and foliage
- **Merged Geometries**: Sidewalks combined into single mesh
- **Shared Materials**: Reused across all buildings
- **LOD System**: Reduced detail for distant objects
- **Efficient Shadows**: High-resolution shadow maps with optimized frustum
- **Optimized Particles**: Point sprites for maximum performance

## 🛠️ Technical Stack

- **Three.js 0.160.0**: 3D rendering engine
- **Web Audio API**: Procedural sound generation
- **ES6 Modules**: Clean, modern JavaScript architecture
- **Post-Processing**: EffectComposer with custom passes

## 📁 Project Structure

```
stroll/
├── index.html              # Main HTML entry point
├── css/
│   └── style.css          # UI and HUD styling
└── js/
    ├── main.js            # Application entry point
    ├── config.js          # Configuration constants
    ├── lighting.js        # Enhanced lighting system
    ├── city.js            # Procedural city generation
    ├── npcs.js            # NPC AI and movement
    ├── controls.js        # Player input handling
    ├── audio.js           # Base audio system
    ├── lofi.js            # Lofi music generation
    ├── ambient.js         # Ambient soundscapes
    ├── particles.js       # Particle effects
    ├── collectibles.js    # Base collectible system
    ├── enhanced-collectibles.js  # New collectible types
    ├── wildlife.js        # Butterflies and birds
    ├── challenges.js      # Achievements and waypoints
    ├── photomode.js       # Photo mode system
    ├── meditation.js      # Meditation mode
    ├── interactive.js     # Interactive flowers
    ├── cinematic.js       # Intro cinematic
    ├── hud.js             # UI and HUD management
    ├── dog.js             # Companion dog AI
    ├── weapon.js          # FPS weapon system
    ├── traffic.js         # Vehicle movement
    ├── weather.js         # Dynamic weather system
    └── minigames.js       # Interactive mini-games
```

## 🎯 Development Philosophy

This project focuses on:
- **Relaxation**: Calming atmosphere without pressure
- **Exploration**: Rewarding curiosity and discovery
- **Beauty**: Visual and audio polish
- **Performance**: Smooth 60 FPS experience
- **Accessibility**: Simple, intuitive controls

## 🚀 Getting Started

1. Open `index.html` in a modern web browser
2. Click to start the experience
3. Enable sound for full immersion (press 'M')
4. Explore at your own pace

## 🎓 Tips for Best Experience

- **Use headphones** for immersive 3D audio
- **Try different times of day** to see the full day/night cycle
- **Look for hidden collectibles** in hard-to-reach places
- **Experiment with photo mode** to capture beautiful moments
- **Try the meditation mode** for a calming break
- **Toggle weather** to experience rain effects
- **Play mini-games** for fun challenges

## 📝 Customization

Edit `js/config.js` to customize:
- City size and building density
- Day/night cycle duration
- Particle counts
- Player movement speed
- Shadow quality
- And much more!

## 🐛 Known Limitations

- Requires WebGL 2.0 support
- Best experienced on desktop browsers
- Mobile support via touch controls (may have reduced performance)

## 📄 License

MIT License - Feel free to use and modify!

## 🌟 Credits

Created with love using Three.js and Web Audio API.

Special thanks to the Three.js community for excellent documentation and examples.

---

**Enjoy your peaceful stroll through the city!** 🌅

Press **Click** to start, and remember: there's nowhere to be. Just breathe and enjoy the moment.
