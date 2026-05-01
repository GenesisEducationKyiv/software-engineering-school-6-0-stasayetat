import cron from 'node-cron';

import { ScannerService } from './service/scanner.service';

export const scanner = new ScannerService();

const task = cron.schedule('*/30 * * * *', async () => {
  await scanner.run();
});

void task.start();
void scanner.run();
