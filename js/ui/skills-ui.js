import { getPlayerStats, spendXP, upgradeMaxHealth, upgradeMaxStamina } from '../player/player.js';
import { showToast } from '../hud.js';

let uiVisible = false;
let uiElement = null;

export function initSkillsUI() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'u' || e.key === 'U') {
            toggleSkillsUI();
        }
    });
}

function toggleSkillsUI() {
    uiVisible = !uiVisible;
    if (uiVisible) {
        showSkillsUI();
    } else {
        hideSkillsUI();
    }
}

function showSkillsUI() {
    if (!uiElement) {
        uiElement = document.createElement('div');
        uiElement.id = 'skills-ui';
        document.body.appendChild(uiElement);
        
        // Base styling
        uiElement.style.position = 'absolute';
        uiElement.style.top = '50%';
        uiElement.style.left = '50%';
        uiElement.style.transform = 'translate(-50%, -50%)';
        uiElement.style.backgroundColor = 'rgba(10, 10, 15, 0.95)';
        uiElement.style.color = '#fff';
        uiElement.style.padding = '30px';
        uiElement.style.borderRadius = '10px';
        uiElement.style.fontFamily = 'monospace';
        uiElement.style.width = '400px';
        uiElement.style.border = '2px solid #ffaa00';
        uiElement.style.zIndex = '2000';
        uiElement.style.boxShadow = '0 0 20px rgba(255, 170, 0, 0.3)';
    }

    updateSkillsUI();
    uiElement.style.display = 'block';
}

function hideSkillsUI() {
    if (uiElement) {
        uiElement.style.display = 'none';
    }
}

function updateSkillsUI() {
    if (!uiElement) return;

    const stats = getPlayerStats();

    uiElement.innerHTML = `
        <h2 style="color: #ffaa00; margin-top: 0; text-align: center; border-bottom: 1px solid #333; padding-bottom: 10px;">SKILL TREE</h2>
        <div style="margin-bottom: 20px; font-size: 16px; text-align: center;">
            Available XP: <span style="color: #00ffff; font-weight: bold;">${stats.xp}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 5px;">
            <div>
                <div style="font-weight: bold;">Titanium Bones</div>
                <div style="font-size: 12px; color: #aaa;">+20 Max Health</div>
                <div style="font-size: 12px; color: #ff5555;">Current: ${stats.maxHealth}</div>
            </div>
            <button id="btn-upgrade-health" style="background: ${stats.xp >= 500 ? '#4CAF50' : '#555'}; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: ${stats.xp >= 500 ? 'pointer' : 'not-allowed'};">
                500 XP
            </button>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 5px;">
            <div>
                <div style="font-weight: bold;">Marathon Runner</div>
                <div style="font-size: 12px; color: #aaa;">+20 Max Stamina</div>
                <div style="font-size: 12px; color: #00aaff;">Current: ${stats.maxStamina}</div>
            </div>
            <button id="btn-upgrade-stamina" style="background: ${stats.xp >= 500 ? '#4CAF50' : '#555'}; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: ${stats.xp >= 500 ? 'pointer' : 'not-allowed'};">
                500 XP
            </button>
        </div>
        
        <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #777;">
            Press U to Close
        </div>
    `;

    document.getElementById('btn-upgrade-health').addEventListener('click', () => {
        if (spendXP(500)) {
            upgradeMaxHealth(20);
            showToast('Skill Unlocked', 'Titanium Bones (+20 Health)', 'success');
            updateSkillsUI();
        }
    });

    document.getElementById('btn-upgrade-stamina').addEventListener('click', () => {
        if (spendXP(500)) {
            upgradeMaxStamina(20);
            showToast('Skill Unlocked', 'Marathon Runner (+20 Stamina)', 'success');
            updateSkillsUI();
        }
    });
}
