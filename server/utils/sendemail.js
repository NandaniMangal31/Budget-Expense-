// backend/utils/sendEmail.js
import nodemailer from "nodemailer";

const sendEmail = async (toEmail, subject, htmlContent) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // Aapka Gmail address
        pass: process.env.EMAIL_PASS, // Aapka Gmail App Password (Normal password nahi!)
      },
    });

    const mailOptions = {
      from: `"Smart Budget Analyzer" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: subject,
      html: htmlContent, // 🔄 Changed 'text' to 'html' to support rich template designs
    };

    await transporter.sendMail(mailOptions);
    console.log("📨 Budget alert email sent successfully!");
  } catch (error) {
    console.error("Email Pipeline Error:", error);
  }
};

export default sendEmail;