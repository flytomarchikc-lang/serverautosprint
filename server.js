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