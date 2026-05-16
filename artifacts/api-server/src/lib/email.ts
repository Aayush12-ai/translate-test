import nodemailer from "nodemailer";
import { logger } from "../lib/logger";
import { buildFrontendUrl } from "./frontend";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || "noreply@translateapp.com",
      ...options,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${options.to}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send email to ${options.to}:`, error);
    return false;
  }
}

export async function sendMeetingApprovalEmail(
  userEmail: string,
  userName: string,
  topic: string,
  scheduledAt: Date,
  meetingLink: string,
): Promise<boolean> {
  const formattedDate = new Date(scheduledAt).toLocaleString();

  const html = `
    <h2>Meeting Approved!</h2>
    <p>Hi ${userName},</p>
    <p>Your meeting request for "<strong>${topic}</strong>" has been approved!</p>
    <p><strong>Scheduled Date & Time:</strong> ${formattedDate}</p>
    <p><strong>Meeting Link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>
    <p>You can join the video call using the link above at the scheduled time.</p>
    <p>If you have any questions, please contact us.</p>
    <p>Best regards,<br>The Translation Team</p>
  `;

  return sendEmail({
    to: userEmail,
    subject: `Meeting Approved: ${topic}`,
    html,
  });
}

export async function sendAdminMeetingScheduledEmail(
  adminEmail: string,
  userName: string,
  userEmail: string,
  topic: string,
  scheduledAt: Date,
  userMeetingLink: string,
  hostMeetingLink: string,
): Promise<boolean> {
  const formattedDate = new Date(scheduledAt).toLocaleString();

  const html = `
    <h2>Meeting Scheduled</h2>
    <p>A meeting request has been approved and scheduled.</p>
    <p><strong>User:</strong> ${userName} (${userEmail})</p>
    <p><strong>Topic:</strong> ${topic}</p>
    <p><strong>Scheduled Date & Time:</strong> ${formattedDate}</p>
    <p><strong>Your Host Link:</strong> <a href="${hostMeetingLink}">${hostMeetingLink}</a></p>
    <p><strong>User Join Link:</strong> <a href="${userMeetingLink}">${userMeetingLink}</a></p>
    <p>You can also review this request in your dashboard.</p>
    <p><a href="${buildFrontendUrl("/admin/dashboard")}">Open Admin Dashboard</a></p>
    <p>Best regards,<br>The Translation Team</p>
  `;

  return sendEmail({
    to: adminEmail,
    subject: `Meeting Scheduled: ${topic}`,
    html,
  });
}

export async function sendMeetingRejectionEmail(
  userEmail: string,
  userName: string,
  topic: string,
  reason: string,
): Promise<boolean> {
  const html = `
    <h2>Meeting Request Update</h2>
    <p>Hi ${userName},</p>
    <p>Unfortunately, your meeting request for "<strong>${topic}</strong>" has been declined.</p>
    <p><strong>Reason:</strong> ${reason}</p>
    <p>Please feel free to submit another request or contact us for more information.</p>
    <p>Best regards,<br>The Translation Team</p>
  `;

  return sendEmail({
    to: userEmail,
    subject: `Meeting Request Declined: ${topic}`,
    html,
  });
}

export async function sendMeetingRequestNotification(
  adminEmail: string,
  userName: string,
  userEmail: string,
  topic: string,
  description: string,
): Promise<boolean> {
  const html = `
    <h2>New Meeting Request</h2>
    <p>You have a new meeting request!</p>
    <p><strong>User Name:</strong> ${userName}</p>
    <p><strong>User Email:</strong> ${userEmail}</p>
    <p><strong>Topic:</strong> ${topic}</p>
    <p><strong>Description:</strong> ${description}</p>
    <p>Please log in to your admin dashboard to review and approve/reject this request.</p>
    <p><a href="${buildFrontendUrl("/admin/login")}">Open Admin Login</a></p>
    <p>Best regards,<br>The Translation Team</p>
  `;

  return sendEmail({
    to: adminEmail,
    subject: `New Meeting Request: ${topic}`,
    html,
  });
}
