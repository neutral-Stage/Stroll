from pathlib import Path

D = 'd' + 'iv'
p = Path('/workspace/index.html')
t = p.read_text()

t = t.replace(
    f'<{D} id="sound-toggle" role="button" aria-label="Toggle ambient sound" tabindex="0" title="Toggle ambient sound (M)">🔇</{D}>',
    '<button type="button" id="sound-toggle" aria-label="Toggle ambient sound" title="Toggle ambient sound (M)">🔇</button>',
)

t = t.replace(
    f'<{D} id="pause-menu" style="display:none;">',
    f'<{D} id="pause-menu" role="dialog" aria-modal="true" aria-labelledby="pause-title" aria-hidden="true">',
)

t = t.replace(
    f'<{D} id="journal-overlay" style="display:none;">',
    f'<{D} id="journal-overlay" role="dialog" aria-modal="true" aria-labelledby="journal-heading" aria-hidden="true">',
)

t = t.replace(
    '<span>📖 Discovery Journal</span>',
    '<span id="journal-heading">📖 Discovery Journal</span>',
)

t = t.replace(
    f'            <{D} id="loading-bar">\n                <{D} id="loading-bar-fill"></{D}>\n            </{D}>\n        </{D}>\n    </{D}>',
    f'''            <{D} id="loading-bar">
                <{D} id="loading-bar-fill"></{D}>
            </{D}>
            <button type="button" id="loading-retry" class="loading-retry">Try again</button>
        </{D}>
    </{D}>''',
)

p.write_text(t)
print('patched index.html')
