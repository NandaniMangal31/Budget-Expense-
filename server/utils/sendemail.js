import nodemailer from "nodemailer";

const sendEmail = async (toEmail, subject, htmlContent) => {
  try {
    // ✅ Create transporter using Gmail service
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // Your Gmail address
        pass: process.env.EMAIL_PASS, // Gmail App Password (not your normal password!)
      },
    });

    // ✅ Mail options
    const mailOptions = {
      from: `"Smart Budget Analyzer" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject,
      html: htmlContent, // Rich HTML template
    };

    // ✅ Send mail
    await transporter.sendMail(mailOptions);
    console.log("📨 Budget alert email sent successfully!");
  } catch (error) {
    console.error("🚨 Email Pipeline Error:", error.message);
  }
};

export default sendEmail;
