// @ts-check
/**
 * radio.js — Simple procedural radio stations for vehicles
 * @module audio/radio
 */

import { showToast } from '../hud.js';
import { isPlayerDriving } from '../vehicles/vehicle-system.js';

let audioCtx = null;
let masterGain = null;
let currentStation = 0;
let isPlaying = false;
let nextNoteTime = 0;

const STATIONS = [
    { name: 'Los Santos Rock', bpm: 120, synth: 'sawtooth' },
    { name: 'Non-Stop Pop FM', bpm: 128, synth: 'square' },
    { name: 'Radio Los Santos', bpm: 90, synth: 'triangle' },
    { name: 'West Coast Classics', bpm: 95, synth: 'sine' }
];

export function toggleRadio() {
    if (!isPlayerDriving()) {
        showToast('Radio', 'You must be in a vehicle to use the radio.', 'info');
        return;
    }
    
    if (isPlaying) {
        stopRadio();
    } else {
        startRadio();
    }
}

export function nextStation() {
    if (!isPlaying) return;
    currentStation = (currentStation + 1) % STATIONS.length;
    
    // Stop current beat sequence immediately
    nextNoteTime = 0;
    
    showToast('Tuning...', STATIONS[currentStation].name, 'info');
}

function startRadio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.15;
        masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();

    isPlaying = true;
    nextNoteTime = audioCtx.currentTime;
    showToast('Radio ON', STATIONS[currentStation].name, 'info');
}

function stopRadio() {
    isPlaying = false;
    showToast('Radio OFF', '', 'info');
}

export function updateRadio() {
    if (!isPlaying) return;
    
    // Auto-turn off if player exits vehicle
    if (!isPlayerDriving()) {
        stopRadio();
        return;
    }

    if (!audioCtx) return;
    
    // Very simple procedural beep-bop to simulate music
    if (audioCtx.currentTime >= nextNoteTime) {
        const station = STATIONS[currentStation];
        const beatLen = 60 / station.bpm;
        nextNoteTime = audioCtx.currentTime + beatLen * 0.5;
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = station.synth;
        
        // Random note from pentatonic scale (A minor)
        const notes = [220, 261.63, 293.66, 329.63, 392.00, 440];
        osc.frequency.value = notes[Math.floor(Math.random() * notes.length)] * (Math.random() < 0.2 ? 0.5 : 1);
        
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + beatLen * 0.4);
        
        osc.connect(gain).connect(masterGain);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + beatLen * 0.5);
    }
}
