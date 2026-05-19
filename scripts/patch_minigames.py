from pathlib import Path

D = 'd' + 'iv'
p = Path('/workspace/js/minigames.js')
text = p.read_text()
old = f"""    ui.innerHTML = `
        <{D} style="font-size: 20px; margin-bottom: 10px;">${{titles[gameType]}}</{D}>
        <{D} id="game-instructions" style="font-size: 14px; opacity: 0.8; margin-bottom: 10px;"></{D}>
        <{D} id="game-score" style="font-size: 18px; font-weight: bold;">Score: 0</{D}>
        <{D} id="game-progress" style="margin-top: 10px; font-size: 12px; opacity: 0.6;"></{D}>
    `;"""
new = f"""    ui.innerHTML = `
        <{D} class="minigame-title">${{titles[gameType]}}</{D}>
        <{D} id="game-instructions" class="minigame-instructions">Press G again to end</{D}>
        <{D} id="game-score" class="minigame-score">Score: 0</{D}>
        <{D} id="game-progress" class="minigame-progress"></{D}>
    `;"""
if old not in text:
    raise SystemExit('old block not found')
p.write_text(text.replace(old, new, 1))
print('patched minigames.js')
