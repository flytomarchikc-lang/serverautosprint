const express = require('express');
const app = express();
const cors = require('cors');

app.use(cors());
app.use(express.json());

const activePlayers = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [uuid, timestamp] of activePlayers.entries()) {
        if (now - timestamp > 120000) {
            activePlayers.delete(uuid);
            console.log(`Removed inactive: ${uuid}`);
        }
    }
}, 30000);

app.post('/heartbeat', (req, res) => {
    const { uuid } = req.body;
    if (!uuid) return res.status(400).json({ error: 'UUID required' });

    activePlayers.set(uuid, Date.now());
    console.log(`Heartbeat: ${uuid}`);
    res.json({ success: true, count: activePlayers.size });
});

app.get('/players', (req, res) => {
    const players = Array.from(activePlayers.keys());
    res.json({ players });
});

app.get('/player/:uuid', (req, res) => {
    const hasMod = activePlayers.has(req.params.uuid);
    res.json({ uuid: req.params.uuid, hasMod });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`AutoSprint API running on port ${PORT}`);
});
    
    const playerId = uuid || username;
    
    let rank = "PLAYER";
    
    if (uuid && playerRanks[uuid]) {
        rank = playerRanks[uuid];
    } else if (username && playerRanks[username]) {
        rank = playerRanks[username];
    }
    
    activePlayers.set(playerId, {
        timestamp: Date.now(),
        rank: rank,
        uuid: uuid,
        username: username
    });
    
    console.log(`Player ${playerId} registered with rank: ${rank}`);
    res.json({ success: true, rank: rank, count: activePlayers.size });
});

app.get('/players', (req, res) => {
    const players = [];
    
    for (const [id, data] of activePlayers.entries()) {
        players.push({
            id: id,
            uuid: data.uuid,
            username: data.username,
            rank: data.rank
        });
    }
    
    console.log(`Sending ${players.length} players`);
    res.json({ players });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`AutoSprint API running on port ${PORT}`);
});

