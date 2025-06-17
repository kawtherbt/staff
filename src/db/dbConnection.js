const {Pool} = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.connect((err,client,release)=>{
    if(err){
       return console.error("error connecting",err.stack);
    }
    console.log("connected with success");
    release();
});

module.exports = pool;