import bcrypt from 'bcrypt';
const hash = bcrypt.hashSync('password123', 12);
console.log(hash);
