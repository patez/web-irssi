import bcrypt from 'bcrypt';
import crypto from 'crypto';

export function hashPassword(password) {
    return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, hash) {
    return bcrypt.compareSync(password, hash);
}

export function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}
