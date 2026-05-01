import winston from 'winston';

const blue = '\x1b[34m';
const reset = '\x1b[0m';

export const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YY-MM-DD HH:mm:ss.SSS' }),
        winston.format.printf(({ timestamp, message }) => {
          return `${String(timestamp)} ${blue}${String(message)}${reset}`;
        }),
      ),
    }),
  ],
});
