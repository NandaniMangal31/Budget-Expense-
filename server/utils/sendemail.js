import nodemailer from "nodemailer";

/**
 * 📨 Automated SMTP Mailer Channel
 * Ships rich transactional alert communications out to validated accounts
 */
const sendEmail = async (toEmail, subject, htmlContent) => {
  try {
    // 🛡️ Fail-safe check to prevent crashing if environment tokens are unconfigured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn("⚠️ System SMTP Mailer warning: Outbound mail server environment variables missing.");
      return;
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS, // Secured Google Workspace App Password context
      },
    });

    const mailOptions = {
      from: `"Smart Budget Analyzer" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: subject,
      html: htmlContent, // Explicitly handles HTML elements for rich email designs
    };

    await transporter.sendMail(mailOptions);
    console.log(`📨 Operational Update: Alert email safely delivered to destination node: [${toEmail}]`);
  } catch (error) {
    console.error("🚨 Mail Pipeline Protocol Connection Error:", error.message || error);
  }
};

export default sendEmail;