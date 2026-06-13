import { ReleaseNotificationConsumer } from '@notifier/subscription/release-notification.consumer';
import { ReleaseNotificationService } from '@notifier/subscription/service/release-notification.service';
import { EventConsumer } from '@shared/rabbitmq/event-consumer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('ReleaseNotificationConsumer', () => {
  let notificationConsumer: ReleaseNotificationConsumer;
  let mockEventConsumer: EventConsumer;
  let mockReleaseNotificationService: ReleaseNotificationService;

  beforeEach(() => {
    mockEventConsumer = {
      consume: vi.fn().mockResolvedValue(undefined),
    } as unknown as EventConsumer;

    mockReleaseNotificationService = {
      notifyNewRelease: vi.fn().mockResolvedValue(true),
    } as unknown as ReleaseNotificationService;

    notificationConsumer = new ReleaseNotificationConsumer(mockEventConsumer, mockReleaseNotificationService);
  });

  it('should call consume with correct queue, exchange and routing key', async () => {
    await notificationConsumer.start();

    expect(mockEventConsumer.consume).toHaveBeenCalledWith({
      queue: 'release_notifications',
      exchange: 'releases',
      routingKey: 'new_release_detected',
      handler: expect.any(Function) as unknown,
    });
  });

  it('should call notifyNewRelease with payload data', async () => {
    vi.mocked(mockEventConsumer.consume).mockImplementation(async ({ handler }) => {
      await handler({ repoId: 'repo-1', tag: 'v2.0.0' });
    });

    await notificationConsumer.start();

    expect(mockReleaseNotificationService.notifyNewRelease).toHaveBeenCalledWith('repo-1', 'v2.0.0');
  });
});
