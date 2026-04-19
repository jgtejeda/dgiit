const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Hol@9753.7ok',
    database: process.env.DB_NAME || 'sgc_pro'
};

async function check() {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.query('DESCRIBE users');
    console.log(JSON.stringify(rows, null, 2));
    await conn.end();
}
check().catch(console.error);
