const express = require('express');
const app = express();
const cors = require('cors');

app.use(cors());
app.use(express.json());

const activePlayers = new Map(); // UUID -> { timestamp, rank }

// Ранги игроков (UUID или ник)
const playerRanks = {
    // UUID (для лицензионных аккаунтов)
    "36a8dcbc-5895-4e4b-b4e3-3868817546d1": "CREATOR_TESTER", // Создатель + тестер
    "4822eb4d-7fc4-4d9d-bd7c-af7a68e8a9a4": "TESTER", // Тестировщик

    // Ники (для пиратских аккаунтов)
    "AutoSprintTest": "TESTER"
};

// Очистка неактивных игроков
setInterval(() => {
    const now = Date.now();
    for (const [id, data] of activePlayers.entries()) {
        if (now - data.timestamp > 120000) {
            activePlayers.delete(id);
            console.log(`Removed inactive: ${id}`);
        }
    }
}, 30000);

// Heartbeat от клиента
app.post('/heartbeat', (req, res) => {
    const { uuid, username } = req.body;

    if (!uuid && !username) {
        return res.status(400).json({ error: 'UUID or username required' });
    }

    // Определяем идентификатор (UUID или ник)
    const playerId = uuid || username;

    // Определяем ранг
    let rank = "PLAYER"; // По умолчанию обычный игрок

    // Проверяем UUID
    if (uuid && playerRanks[uuid]) {
        rank = playerRanks[uuid];
    }
    // Проверяем ник (для пиратов)
    else if (username && playerRanks[username]) {
        rank = playerRanks[username];
    }

    activePlayers.set(playerId, {
        timestamp: Date.now(),
        rank: rank,
        uuid: uuid,
        username: username
    });

    console.log(`Heartbeat: ${playerId} (${rank})`);
    res.json({ success: true, rank: rank, count: activePlayers.size });
});

// Получить список всех игроков с рангами
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

    res.json({ players });
});

// Проверить конкретного игрока
app.get('/player/:id', (req, res) => {
    const { id } = req.params;
    const data = activePlayers.get(id);

    if (data) {
        res.json({
            id: id,
            hasMod: true,
            rank: data.rank,
            uuid: data.uuid,
            username: data.username
        });
    } else {
        res.json({ id: id, hasMod: false });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`AutoSprint API running on port ${PORT}`);
});
