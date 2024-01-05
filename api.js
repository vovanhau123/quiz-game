const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

// Kết nối đến cơ sở dữ liệu SQLite
const db = new sqlite3.Database('inappropriateMessages.db');

const fs = require('fs');

function readConfig() {
    try {
        const configData = fs.readFileSync('config.json', 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        console.error('Error reading config file:', error);
        return {};
    }
}

// Tạo bảng nếu chưa tồn tại
db.run('CREATE TABLE IF NOT EXISTS inappropriateMessages (id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT, user TEXT,idchannel TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)');

app.use(bodyParser.json());

// API endpoint để nhận tin nhắn không phù hợp
app.post('/api/inappropriate-messages', async (req, res) => {
    try {
        const { content, user, idchannel } = req.body;

        // Đọc thông tin từ config
        const config = readConfig();
        const excludedUser = config.user;

        // Kiểm tra nếu user là excludedUser thì bỏ qua dữ liệu
        if (user === excludedUser) {
            return res.status(200).json({ message: `Dữ liệu từ user "${excludedUser}" đã được bỏ qua.` });
        }

        // Lưu tin nhắn và thông tin người dùng vào cơ sở dữ liệu
        db.run('INSERT INTO inappropriateMessages (content, user, idchannel) VALUES (?, ?, ?)', [content, user, idchannel], function (error) {
            if (error) {
                console.error('Error saving inappropriate message:', error);
                return res.status(500).json({ error: 'Internal Server Error' });
            }

            return res.status(201).json({ message: 'Tin nhắn không phù hợp đã được lưu.' });
        });
    } catch (error) {
        console.error('Error saving inappropriate message:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});


// API endpoint để nhận toàn bộ tin nhắn không phù hợp
app.get('/api/inappropriate-messages', async (req, res) => {
    try {
        // Lấy toàn bộ dữ liệu từ cơ sở dữ liệu
        db.all('SELECT * FROM inappropriateMessages', [], (error, rows) => {
            if (error) {
                console.error('Error retrieving inappropriate messages:', error);
                return res.status(500).json({ error: 'Internal Server Error' });
            }

            return res.status(200).json(rows);
        });
    } catch (error) {
        console.error('Error retrieving inappropriate messages:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.use(express.json());

app.post('/api/analyze', async (req, res) => {
    try {
        const forbiddenWords = ['đụ', 'cc'];

        db.all('SELECT * FROM inappropriateMessages WHERE content LIKE ? OR content LIKE ?', [`%${forbiddenWords[0]}%`, `%${forbiddenWords[1]}%`], (error, records) => {
            if (error) {
                console.error('Error analyzing inappropriate messages:', error);
                return res.status(500).json({ error: 'Internal Server Error' });
            }

            const userCounts = {};
            const wordCounts = { 'đụ': 0, 'cc': 0 };
            const idchannelCounts = {};

            records.forEach((record) => {
                const { user, idchannel, content } = record;
                userCounts[user] = (userCounts[user] || 0) + 1;

                // Count occurrences of each forbidden word
                forbiddenWords.forEach((word) => {
                    const regex = new RegExp(word, 'gi');
                    const matches = (content.match(regex) || []).length;
                    wordCounts[word] = (wordCounts[word] || 0) + matches;
                });

                idchannelCounts[idchannel] = (idchannelCounts[idchannel] || 0) + 1;
            });

            const mostUsedUser = Object.keys(userCounts).reduce((a, b) => userCounts[a] > userCounts[b] ? a : b);
            const mostUsedChannel = Object.keys(idchannelCounts).reduce((a, b) => idchannelCounts[a] > idchannelCounts[b] ? a : b);

            res.json({
                userCounts,
                wordCounts,
                mostUsedChannel,
            });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/inappropriate-messages/analysis', async (req, res) => {
    try {
        // Lấy tổng số lượng tin nhắn
        db.get('SELECT COUNT(*) AS totalMessages FROM inappropriateMessages', [], (error, resultMessages) => {
            if (error) {
                console.error('Error analyzing total messages:', error);
                return res.status(500).json({ error: 'Internal Server Error' });
            }

            const totalMessages = resultMessages.totalMessages;

            // Lấy tổng thời gian nhắn
            db.get('SELECT SUM(timestamp) AS totalTimestamp FROM inappropriateMessages', [], (error, resultTimestamp) => {
                if (error) {
                    console.error('Error analyzing total timestamp:', error);
                    return res.status(500).json({ error: 'Internal Server Error' });
                }

                const totalTimestampInSeconds = resultTimestamp.totalTimestamp || 0;

                // Chuyển đổi thời gian từ giây sang giờ, phút, giây
                const hours = Math.floor(totalTimestampInSeconds / 3600);
                const minutes = Math.floor((totalTimestampInSeconds % 3600) / 60);
                const seconds = totalTimestampInSeconds % 60;

                const formattedTotalTimestamp = `${hours} giờ ${minutes} phút ${seconds} giây`;

                // Lấy số lượng người dùng tham gia chat
                db.get('SELECT COUNT(DISTINCT user) AS totalUsers FROM inappropriateMessages', [], (error, resultUsers) => {
                    if (error) {
                        console.error('Error analyzing total users:', error);
                        return res.status(500).json({ error: 'Internal Server Error' });
                    }

                    const totalUsers = resultUsers.totalUsers;

                    // Lấy người dùng chat nhiều nhất
                    db.get('SELECT user, COUNT(user) AS messageCount FROM inappropriateMessages GROUP BY user ORDER BY messageCount DESC LIMIT 1', [], (error, resultMostActiveUser) => {
                        if (error) {
                            console.error('Error analyzing most active user:', error);
                            return res.status(500).json({ error: 'Internal Server Error' });
                        }

                        const mostActiveUser = {
                            user: resultMostActiveUser.user,
                            messageCount: resultMostActiveUser.messageCount,
                        };

                        res.json({
                            totalMessages,
                            totalTimestamp: formattedTotalTimestamp,
                            totalUsers,
                            mostActiveUser,
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error('Error analyzing messages:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});
// Create the database table if it doesn't exist
db.run('CREATE TABLE IF NOT EXISTS inappropriateMessages (id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT, user TEXT, idchannel TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)');

app.use(express.json({ limit: '100mb' }));

app.post('/api/getAll', (req, res) => {
    try {
        const messages = [];

        req.on('data', (chunk) => {
            // Collect the chunks of data
            messages.push(chunk);
        });

        req.on('end', async () => {
            try {
                const data = Buffer.concat(messages);
                const jsonData = JSON.parse(data);

                if (!jsonData.messages || !Array.isArray(jsonData.messages)) {
                    return res.status(400).json({ error: 'Invalid request format' });
                }

                // Insert all messages into the database
                const insertPromises = jsonData.messages.map(async (message) => {
                    const { content, user, idchannel } = message;
                    await db.run('INSERT INTO inappropriateMessages (content, user, idchannel) VALUES (?, ?, ?)', [content, user, idchannel]);
                });

                await Promise.all(insertPromises);

                return res.status(201).json({ message: 'All messages have been saved to the database.' });
            } catch (error) {
                console.error('Error parsing JSON data:', error);
                return res.status(400).json({ error: 'Invalid JSON format' });
            }
        });
    } catch (error) {
        console.error('Error handling request:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});



app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
