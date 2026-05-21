import cron from 'node-cron';
import { container } from 'tsyringe';

import { ScannerService } from './service/scanner.service';

export const scanner = container.resolve(ScannerService);

const task = cron.schedule('*/30 * * * *', async () => {
  await scanner.run();
});

void task.start();
void scanner.run();
