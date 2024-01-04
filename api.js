const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

// Kết nối đến cơ sở dữ liệu SQLite
const db = new sqlite3.Database('inappropriateMessages.db');

// Tạo bảng nếu chưa tồn tại
db.run('CREATE TABLE IF NOT EXISTS inappropriateMessages (id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT, user TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)');

app.use(bodyParser.json());

// API endpoint để nhận tin nhắn không phù hợp
app.post('/api/inappropriate-messages', async (req, res) => {
    try {
        const { content, user } = req.body;

        // Lưu tin nhắn và thông tin người dùng vào cơ sở dữ liệu
        db.run('INSERT INTO inappropriateMessages (content, user) VALUES (?, ?)', [content, user], function (error) {
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

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
