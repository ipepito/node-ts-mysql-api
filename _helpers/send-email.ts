import nodemailer from 'nodemailer';

export const sendEmail = async ({ to, subject, html }: any) => {
    const transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: {
            user: 'devan.bailey86@ethereal.email',
            pass: 'w6cg2VPSpdVDk89uhr'
        }
    });

    await transporter.sendMail({
        from: '"Test Server" <noreply@example.com>',
        to,
        subject,
        html
    });
};