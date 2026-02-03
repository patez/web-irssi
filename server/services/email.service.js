import nodemailer from 'nodemailer';
import config from '../config.js';
import { logger } from '../utils/logger.js';

class EmailService {
    constructor() {
        if (config.email.user && config.email.pass) {
            this.transporter = nodemailer.createTransport({
                host: config.email.host,
                port: config.email.port,
                secure: false,
                auth: {
                    user: config.email.user,
                    pass: config.email.pass
                }
            });
        } else {
            logger.warn('Email not configured - activation links will be logged to console');
        }
    }

    async sendActivation(email, username, token) {
        const activationLink = `${config.baseUrl}/activate?token=${token}`;
        
        if (!this.transporter) {
            logger.info(`Activation link for ${username}: ${activationLink}`);
            return { success: true, link: activationLink };
        }

        try {
            await this.transporter.sendMail({
                from: config.email.from,
                to: email,
                subject: 'Activate your IRC account',
                html: `
                    <h2>Welcome to IRC, ${username}!</h2>
                    <p>An administrator has created an account for you.</p>
                    <p>Click the link below to set your password and activate your account:</p>
                    <p><a href="${activationLink}">${activationLink}</a></p>
                    <p>This link will expire in 24 hours.</p>
                `
            });
            return { success: true, link: activationLink };
        } catch (error) {
            logger.error(`Email send failed: ${error.message}`);
            logger.info(`Activation link for ${username}: ${activationLink}`);
            return { success: false, link: activationLink, error: error.message };
        }
    }
}

export default new EmailService();
