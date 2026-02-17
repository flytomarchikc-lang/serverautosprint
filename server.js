const express = require('express');
const app = express();
const cors = require('cors');

app.use(cors());
app.use(express.json());

// { uuid -> { timestamp, serverAddress, username } }
const activePlayers = new Map();

// ─── Утилита логгирования с временем ─────────────────────────────────────────
function log(level, message) {
    const now = new Date();
    const time = now.toISOString().replace('T', ' ').substring(0, 19);
    const prefix = level === 'INFO'  ? '\x1b[32m[INFO] \x1b[0m'
                 : level === 'WARN'  ? '\x1b[33m[WARN] \x1b[0m'
                 : level === 'ERROR' ? '\x1b[31m[ERROR]\x1b[0m'
                 : '\x1b[36m[DEBUG]\x1b[0m';
    console.log(`\x1b[90m${time}\x1b[0m ${prefix} ${message}`);
}

// ─── Очистка неактивных игроков каждые 30 секунд ─────────────────────────────
setInterval(() => {
    const now = Date.now();
    for (const [uuid, data] of activePlayers.entries()) {
        if (now - data.timestamp > 120000) {
            log('INFO', `⬅  Игрок \x1b[33m${data.username || uuid}\x1b[0m покинул \x1b[36m${data.serverAddress || 'unknown'}\x1b[0m (таймаут хартбита)`);
            activePlayers.delete(uuid);
        }
    }
}, 30000);

// ─── POST /heartbeat ──────────────────────────────────────────────────────────
// Тело: { uuid, serverAddress, username }
app.post('/heartbeat', (req, res) => {
    const { uuid, serverAddress, username } = req.body;
    if (!uuid) return res.status(400).json({ error: 'UUID required' });

    const isNew    = !activePlayers.has(uuid);
    const prevData = activePlayers.get(uuid) || {};
    const server   = serverAddress || prevData.serverAddress || 'unknown';
    const name     = username      || prevData.username      || uuid.substring(0, 8) + '...';

    // Если игрок новый или сменил сервер — красивый лог
    if (isNew) {
        log('INFO', `➡  Игрок \x1b[33m${name}\x1b[0m зашёл на \x1b[36m${server}\x1b[0m  [uuid: ${uuid}]`);
    } else if (prevData.serverAddress && prevData.serverAddress !== server) {
        log('INFO', `🔀 Игрок \x1b[33m${name}\x1b[0m переключился: \x1b[36m${prevData.serverAddress}\x1b[0m → \x1b[36m${server}\x1b[0m`);
    }

    activePlayers.set(uuid, {
        timestamp:     Date.now(),
        serverAddress: server,
        username:      name
    });

    res.json({ success: true, count: activePlayers.size });
});

// ─── POST /leave  (вызывается при выходе игрока из Minecraft) ─────────────────
app.post('/leave', (req, res) => {
    const { uuid } = req.body;
    if (!uuid) return res.status(400).json({ error: 'UUID required' });

    const data = activePlayers.get(uuid);
    if (data) {
        log('INFO', `⬅  Игрок \x1b[33m${data.username || uuid}\x1b[0m вышел с \x1b[36m${data.serverAddress || 'unknown'}\x1b[0m`);
        activePlayers.delete(uuid);
    }
    res.json({ success: true });
});

// ─── GET /players  — плоский список UUID ─────────────────────────────────────
app.get('/players', (req, res) => {
    const players = Array.from(activePlayers.keys());
    res.json({ players });
});

// ─── GET /players/grouped  — игроки сгруппированы по серверу ─────────────────
// Пример ответа:
// {
//   "dexland.org":  [{ uuid, username }, ...],
//   "hypixel.net":  [{ uuid, username }, ...]
// }
app.get('/players/grouped', (req, res) => {
    const grouped = {};
    for (const [uuid, data] of activePlayers.entries()) {
        const server = data.serverAddress || 'unknown';
        if (!grouped[server]) grouped[server] = [];
        grouped[server].push({ uuid, username: data.username || null });
    }
    res.json(grouped);
});

// ─── GET /player/:uuid ────────────────────────────────────────────────────────
app.get('/player/:uuid', (req, res) => {
    const data   = activePlayers.get(req.params.uuid);
    const hasMod = !!data;
    res.json({
        uuid:          req.params.uuid,
        hasMod,
        serverAddress: data ? data.serverAddress : null,
        username:      data ? data.username : null
    });
});

// ─── GET /stats ───────────────────────────────────────────────────────────────
app.get('/stats', (req, res) => {
    const serverCount = new Set(
        Array.from(activePlayers.values()).map(d => d.serverAddress)
    ).size;
    res.json({
        totalPlayers: activePlayers.size,
        totalServers: serverCount
    });
});

// ─── Запуск ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    log('INFO', `🚀 AutoSprint API запущен на порту \x1b[35m${PORT}\x1b[0m`);
});
