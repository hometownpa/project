// utils/emailService.js
const nodemailer = require('nodemailer');

// --- Configure your email transporter ---
// This uses environment variables for security and flexibility.
// You MUST set these in your .env file:
// EMAIL_SERVICE_HOST (e.g., 'smtp.gmail.com', 'smtp-mail.outlook.com')
// EMAIL_SERVICE_PORT (e.g., 465 for SSL, 587 for TLS)
// EMAIL_SERVICE_USER (Your email address, e.g., 'yourbank@gmail.com')
// EMAIL_SERVICE_PASS (Your email password or App Password for Gmail/Outlook)

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVICE_HOST,
    port: parseInt(process.env.EMAIL_SERVICE_PORT), // Ensure port is parsed as a number
    secure: process.env.EMAIL_SERVICE_PORT === '465', // true for 465 (SSL), false for other ports (like 587 for TLS)
    auth: {
        user: process.env.EMAIL_SERVICE_USER,
        pass: process.env.EMAIL_SERVICE_PASS,
    },
    // Optional: Ignore TLS certificate errors in development.
    // NOT recommended for production environments as it can expose you to MITM attacks.
    // Uncomment the 'tls' block only if you encounter issues with self-signed certs in dev (e.g., mailtrap.io testing).
    // tls: {
    //     rejectUnauthorized: false
    // }
});

// --- ADD THIS BLOCK TO VERIFY THE TRANSPORTER CONNECTION ---
transporter.verify(function (error, success) {
    if (error) {
        console.error("Nodemailer Transporter Verification Error:", error);
    } else {
        console.log("Nodemailer Transporter is ready to take messages!");
    }
});
// --- END OF ADDED BLOCK ---


// --- Function to send 2FA verification email ---
async function sendVerificationEmail(toEmail, code) {
    try {
        const mailOptions = {
            from: `"Hometown Bank PA" <${process.env.EMAIL_SERVICE_USER}>`, // Sender display name and email address
            to: toEmail,                         // Recipient email address
            subject: 'Hometown Bank PA: Your 2-Factor Authentication Code',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2 style="color: #0056b3;">Your Hometown Bank PA Verification Code</h2>
                    <p>Dear Customer,</p>
                    <p>You have requested a verification code to log in to your Hometown Bank PA account. Please use the following code:</p>
                    <h3 style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; color: #d9534f;">
                        <strong>${code}</strong>
                    </h3>
                    <p>This code is valid for <strong>5 minutes</strong>. Do not share this code with anyone, including bank employees.</p>
                    <p>If you did not request this, please ignore this email or contact our support immediately.</p>
                    <p>Thank you,</p>
                    <p>The Hometown Bank PA Team</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin-top: 20px;">
                    <p style="font-size: 0.8em; color: #777;">This is an automated email, please do not reply.</p>
                </div>
            `,
        };

        let info = await transporter.sendMail(mailOptions);
        console.log('2FA Email sent: %s', info.messageId);
        // For testing with Ethereal.email, you can uncomment the line below to get a preview URL:
        // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        return true; // Indicate email was sent successfully

    } catch (error) {
        console.error('Error sending 2FA email:', error);
        return false; // Indicate email sending failed
    }
}

// You can add other email sending functions here as your application grows,
// e.g., for password reset links, new account confirmations, etc.
// async function sendPasswordResetEmail(toEmail, resetToken) {
//     // ... implementation ...
// }

module.exports = {
    sendVerificationEmail,
    // sendPasswordResetEmail, // Export other functions if you add them
};