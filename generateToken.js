const  = require('jsonwebtoken');

const payload = {
  id: 2,
  role: 'admin'
};

const secret = 'kawther'; // Ton nouveau secret JWT

const token = jwt.sign(payload, secret, { expiresIn: '10h' });

console.log('Nouveau token JWT :\n', token);
