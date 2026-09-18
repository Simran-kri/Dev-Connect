import nodemailer from "nodemailer";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  return transporter;
}

// Falls back to logging the email to the server console when EMAIL_USER/
// EMAIL_PASS aren't set, so the OTP flow can be built and tested end-to-end
// before real email delivery is wired up.
export async function sendEmail({ to, subject, text }) {
  const client = getTransporter();

  if (!client) {
    console.log("\n===== EMAIL NOT CONFIGURED - printing instead of sending =====");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text);
    console.log("================================================================\n");
    return { delivered: false };
  }

  await client.sendMail({
    from: `DevConnect <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text
  });
  return { delivered: true };
}

export function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
