const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ─── REST: heartbeat ─────────────────────────────────────────────────────────
const activePlayers = new Map(); // uuid -> { timestamp, username }

setInterval(() => {
    const now = Date.now();
    for (const [uuid, data] of activePlayers.entries()) {
        if (now - data.timestamp > 120000) {
            activePlayers.delete(uuid);
            console.log(`[API] Removed inactive: ${uuid}`);
        }
    }
}, 30000);

app.post('/heartbeat', (req, res) => {
    const { uuid, username } = req.body;
    if (!uuid) return res.status(400).json({ error: 'UUID required' });
    activePlayers.set(uuid, { timestamp: Date.now(), username: username || 'Unknown' });
    console.log(`[API] Heartbeat: ${uuid}`);
    res.json({ success: true, count: activePlayers.size });
});

app.get('/players', (req, res) => {
    res.json({ players: Array.from(activePlayers.keys()) });
});

app.get('/player/:uuid', (req, res) => {
    res.json({ uuid: req.params.uuid, hasMod: activePlayers.has(req.params.uuid) });
});

// ─── WebSocket IRC ────────────────────────────────────────────────────────────
// ws -> { uuid, username }
const chatClients = new Map();

// Пинг каждые 25 сек чтобы Railway не закрывал соединение
const PING_INTERVAL = 25000;

wss.on('connection', (ws) => {
    console.log('[IRC] New connection');

    // Keepalive ping
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString()); // toString() важен для Buffer
        } catch (e) {
            console.error('[IRC] Bad JSON:', raw.toString());
            return;
        }

        console.log('[IRC] Received packet type:', msg.type); // debug

        switch (msg.type) {
            case 'auth': {
                const { uuid, username } = msg;
                if (!uuid || !username) { ws.close(); return; }
                chatClients.set(ws, { uuid, username });
                console.log(`[IRC] Authed: ${username} | online: ${chatClients.size}`);

                ws.send(JSON.stringify({
                    type: 'system',
                    text: `§aДобро пожаловать в AutoSprint IRC, §f${username}§a!`
                }));

                broadcast({
                    type: 'system',
                    text: `§7${username} §aподключился к IRC`
                }, ws);
                break;
            }

            case 'message': {
                const client = chatClients.get(ws);
                if (!client) { console.warn('[IRC] message from unauthed ws'); return; }

                const text = (msg.text || '').trim().substring(0, 256);
                if (!text) break;

                console.log(`[IRC] ${client.username}: ${text}`);

                const packet = {
                    type: 'chat',
                    uuid: client.uuid,
                    username: client.username,
                    text,
                    timestamp: Date.now()
                };
                broadcast(packet); // всем включая отправителя
                break;
            }

            case 'ping': {
                ws.send(JSON.stringify({ type: 'pong' }));
                break;
            }

            default:
                console.log('[IRC] Unknown packet type:', msg.type);
        }
    });

    ws.on('close', (code, reason) => {
        const client = chatClients.get(ws);
        if (client) {
            console.log(`[IRC] Left: ${client.username} | online: ${chatClients.size - 1}`);
            chatClients.delete(ws);
            broadcast({
                type: 'system',
                text: `§7${client.username} §cотключился от IRC`
            });
        }
    });

    ws.on('error', (err) => {
        console.error('[IRC] WS error:', err.message);
        chatClients.delete(ws);
    });
});

// Проверяем живость соединений каждые 25 сек
const pingInterval = setInterval(() => {
    wss.clients.forEach(ws => {
        if (ws.isAlive === false) {
            console.log('[IRC] Terminating dead connection');
            chatClients.delete(ws);
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, PING_INTERVAL);

wss.on('close', () => clearInterval(pingInterval));

function broadcast(packet, exclude = null) {
    const data = JSON.stringify(packet);
    for (const [ws] of chatClients) {
        if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
            ws.send(data);
        }
    }
}

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`AutoSprint API + IRC running on port ${PORT}`);
});
