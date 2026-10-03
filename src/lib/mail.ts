import nodemailer from "nodemailer";
import { env } from "./env";
import { log } from "./logger";

export const mailConfigured = () => !!env().SMTP_URL;

/** Envia e-mail por SMTP (SMTP_URL). Com SMTP_URL=log (apenas desenvolvimento) o e-mail é escrito no log do servidor. */
export async function sendMail(to: string, subject: string, text: string) {
  const e = env();
  if (!e.SMTP_URL) throw new Error("SMTP não configurado");
  if (e.SMTP_URL === "log") { log.info("mail_dev", { to, subject, text }); return; }
  const from = e.MAIL_FROM ?? `Carvex <no-reply@${new URL(e.APP_URL).hostname}>`;
  await nodemailer.createTransport(e.SMTP_URL).sendMail({ from, to, subject, text });
}
