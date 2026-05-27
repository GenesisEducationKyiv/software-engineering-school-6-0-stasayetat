import winston, { format, transports } from 'winston';

const { combine } = format;
const { Console } = transports;

const blue = '\x1b[34m';
const reset = '\x1b[0m';

export const createConsoleTransport = () => {
  const consoleFormat = format.combine(
    winston.format.timestamp({ format: 'YY-MM-DD HH:mm:ss.SSS' }),
    winston.format.printf(({ timestamp, message }) => {
      return `${String(timestamp)} ${blue}${String(message)}${reset}`;
    }),
  );

  return new Console({ format: combine(consoleFormat) });
};
