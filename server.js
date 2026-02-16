const express = require('express');
const app = express();
const cors = require('cors');

app.use(cors());
app.use(express.json());

const activePlayers = new Map();


const SPECIAL_ROLES = {
    "36a8dcbc-5895-4e4b-b4e3-3868817546d1": "DEVELOPER",
    "4822eb4d-7fc4-4d9d-bd7c-af7a68e8a9a4": "TESTER"
};

setInterval(() => {
    const now = Date.now();
    for (const [uuid, timestamp] of activePlayers.entries()) {
        if (now - timestamp > 120000) { // Удаляем через 2 мин инактива
            activePlayers.delete(uuid);
            console.log(`Removed inactive: ${uuid}`);
        }
    }
}, 30000);

app.post('/heartbeat', (req, res) => {
    const { uuid } = req.body;
    if (!uuid) return res.status(400).json({ error: 'UUID required' });

    activePlayers.set(uuid, Date.now());
    // console.log(`Heartbeat: ${uuid}`);
    res.json({ success: true });
});

app.get('/players', (req, res) => {
    const playersList = [];

    for (const uuid of activePlayers.keys()) {

        let role = "DEFAULT";


        if (SPECIAL_ROLES[uuid]) {
            role = SPECIAL_ROLES[uuid];
        }

        playersList.push({ uuid: uuid, role: role });
    }

    res.json({ players: playersList });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`AutoSprint API running on port ${PORT}`);
});
