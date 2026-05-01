import { env } from '@shared/env';
import { logger } from '@shared/logger';
import { getErrorMessage } from '@shared/utils';
import Bottleneck from 'bottleneck';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

export namespace EmailApiClient {
  const limiter = new Bottleneck({
    maxConcurrent: 3,
    minTime: 1000 / 3,
  });

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  const resend = new Resend(env.SMTP_PASS);

  const sendViaResend = (recipientEmail: string, subject: string, htmlText: string) => {
    return limiter.schedule(() =>
      resend.emails.send({
        from: env.SMTP_SENDER_EMAIL,
        to: recipientEmail,
        subject,
        html: htmlText,
      }),
    );
  };

  const sendViaSmtp = (recipientEmail: string, subject: string, htmlText: string) => {
    return transporter.sendMail({
      from: env.SMTP_SENDER_EMAIL,
      to: recipientEmail,
      subject,
      html: htmlText,
    });
  };

  export const sendEmail = async (recipientEmail: string, subject: string, htmlText: string) => {
    try {
      if (env.NODE_ENV === 'production') {
        await sendViaResend(recipientEmail, subject, htmlText);
      } else {
        await sendViaSmtp(recipientEmail, subject, htmlText);
      }
    } catch (error) {
      logger.error(`Error sending email: ${getErrorMessage(error)}`);
      throw error;
    }
  };
}
