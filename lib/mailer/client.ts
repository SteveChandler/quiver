import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY!);
export const MAIL_FROM = process.env.MAIL_FROM || "Quiver <invites@quiver.fyi>";

