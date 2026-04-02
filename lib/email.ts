import nodemailer from 'nodemailer';

// Email configuration
// Users should configure these environment variables in .env
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.qq.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465');
const SMTP_USER = process.env.SMTP_USER; // Sender email
const SMTP_PASS = process.env.SMTP_PASS; // Sender password or auth code
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;

// Create transporter
const createTransporter = () => {
    if (!SMTP_USER || !SMTP_PASS) {
        console.warn('SMTP_USER or SMTP_PASS not set. Email sending will fail.');
        return null;
    }

    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465, // true for 465, false for other ports
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });
};

interface SendEmailOptions {
    to: string;
    subject: string;
    text?: string;
    html?: string;
}

export async function sendEmail({ to, subject, text, html }: SendEmailOptions): Promise<boolean> {
    const transporter = createTransporter();
    
    if (!transporter) {
        console.error('Email transporter not configured properly.');
        return false;
    }

    try {
        const info = await transporter.sendMail({
            from: EMAIL_FROM,
            to,
            subject,
            text,
            html,
        });
        console.log(`Email sent: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
}
