export const EMAIL_SENDER = Symbol.for('EmailSendEmail');

export interface EmailSender {
  send(to: string, subject: string, htmlText: string): Promise<void>;
}
