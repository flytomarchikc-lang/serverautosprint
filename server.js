const express = require('express');
const http    = require('http');
const WebSocket = require('ws');
const cors    = require('cors');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// activePlayers: uuid → { timestamp, username }
const activePlayers = new Map();

// ircClients: uuid → { ws, username }
const ircClients = new Map();

// ─── Очистка неактивных ───────────────────────────────────────────────────────
setInterval(() => {
    const now = Date.now();
    for (const [uuid, data] of activePlayers.entries()) {
        if (now - data.timestamp > 120_000) {
            activePlayers.delete(uuid);
            console.log(`[API] Removed inactive: ${data.username} (${uuid})`);
        }
    }
}, 30_000);

// ─── REST ─────────────────────────────────────────────────────────────────────

app.post('/heartbeat', (req, res) => {
    const { uuid, username } = req.body;
    if (!uuid) return res.status(400).json({ error: 'UUID required' });
    const name  = username || uuid;
    const isNew = !activePlayers.has(uuid);
    activePlayers.set(uuid, { timestamp: Date.now(), username: name });
    console.log(`[API] Heartbeat: ${name}`);
    if (isNew) broadcastIRC(null, { type: 'user_join', uuid, username: name });
    res.json({ success: true, count: activePlayers.size });
});

app.get('/players', (req, res) => {
    res.json({ players: Array.from(activePlayers.keys()) });
});

app.get('/player/:uuid', (req, res) => {
    res.json({ uuid: req.params.uuid, hasMod: activePlayers.has(req.params.uuid) });
});

// ─── WebSocket IRC ────────────────────────────────────────────────────────────

wss.on('connection', (ws) => {
    let playerUUID = null;
    let playerName = null;
    let authed     = false;

    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw.toString());

            if (msg.type === 'auth') {
                const uuid = msg.uuid;
                const name = msg.username || uuid;
                if (!activePlayers.has(uuid)) {
                    send(ws, { type: 'error', message: 'Not recognized. Send heartbeat first.' });
                    ws.close(4001, 'Unauthorized');
                    return;
                }
                // Вытолкнуть старое соединение
                if (ircClients.has(uuid)) {
                    try { ircClients.get(uuid).ws.close(4002, 'Replaced'); } catch (_) {}
                }
                playerUUID = uuid; playerName = name; authed = true;
                ircClients.set(uuid, { ws, username: name });
                send(ws, { type: 'auth_ok' });
                console.log(`[IRC] Authed: ${name} | online: ${ircClients.size}`);
                broadcastIRC(uuid, { type: 'user_join', uuid, username: name });
                return;
            }

            if (!authed) { send(ws, { type: 'error', message: 'Not authenticated' }); return; }

            if (msg.type === 'chat') {
                const text = String(msg.message || '').trim().slice(0, 512);
                if (!text) return;
                const chatMsg = { type: 'chat', uuid: playerUUID, username: playerName, message: text, timestamp: Date.now() };
                console.log(`[IRC] ${playerName}: ${text}`);
                broadcastIRC(null, chatMsg);
            }
        } catch (e) {
            console.error('[IRC] Parse error:', e.message);
        }
    });

    ws.on('close', () => {
        if (authed && playerUUID) {
            ircClients.delete(playerUUID);
            console.log(`[IRC] Left: ${playerName} | online: ${ircClients.size}`);
            broadcastIRC(playerUUID, { type: 'user_leave', uuid: playerUUID, username: playerName });
        }
    });

    ws.on('error', (err) => console.error(`[IRC] Error (${playerName || '?'}):`, err.message));
});

function send(ws, obj) {
    try { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); } catch (_) {}
}

function broadcastIRC(excludeUUID, obj) {
    const payload = JSON.stringify(obj);
    for (const [uuid, { ws }] of ircClients.entries()) {
        if (uuid === excludeUUID) continue;
        try { if (ws.readyState === WebSocket.OPEN) ws.send(payload); } catch (_) {}
    }
}

// ─── Старт ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`AutoSprint API + IRC running on port ${PORT}`));


