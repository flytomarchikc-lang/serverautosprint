const express = require('express');
const app = express();
const cors = require('cors');

app.use(cors());
app.use(express.json());

const activePlayers = new Map();

// ДОБАВЬ СЮДА СВОИ UUID И НИКИ!
const playerRanks = {
    // UUID (для лицензии)
    "36a8dcbc-5895-4e4b-b4e3-3868817546d1": "CREATOR_TESTER",
    
    // Ники (для пиратки)
    "flytomarchik": "CREATOR_TESTER",
    "TestPlayer": "TESTER"
};

setInterval(() => {
    const now = Date.now();
    for (const [id, data] of activePlayers.entries()) {
        if (now - data.timestamp > 120000) {
            activePlayers.delete(id);
            console.log(`Removed inactive: ${id}`);
        }
    }
}, 30000);

app.post('/heartbeat', (req, res) => {
    const { uuid, username } = req.body;
    
    console.log('Heartbeat received:', { uuid, username });
    
    if (!uuid && !username) {
        return res.status(400).json({ error: 'UUID or username required' });
    }
    
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
