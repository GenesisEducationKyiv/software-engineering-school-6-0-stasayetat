import { EventConsumer, RabbitMQClient } from '@shared/rabbitmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('EventConsumer', () => {
  let consumer: EventConsumer;
  let mockChannel: {
    assertExchange: ReturnType<typeof vi.fn>;
    assertQueue: ReturnType<typeof vi.fn>;
    bindQueue: ReturnType<typeof vi.fn>;
    consume: ReturnType<typeof vi.fn>;
    ack: ReturnType<typeof vi.fn>;
  };
  let mockClient: RabbitMQClient;

  beforeEach(() => {
    mockChannel = {
      assertExchange: vi.fn().mockResolvedValue(undefined),
      assertQueue: vi.fn().mockResolvedValue(undefined),
      bindQueue: vi.fn().mockResolvedValue(undefined),
      consume: vi.fn(),
      ack: vi.fn(),
    };
    mockClient = { getChannel: vi.fn().mockReturnValue(mockChannel) } as unknown as RabbitMQClient;
    consumer = new EventConsumer(mockClient);
  });

  it('should assert exchange, queue, binding and start consuming', async () => {
    mockChannel.consume.mockImplementation(() => undefined);

    await consumer.consume({queue: 'release_notifications', exchange: 'releases', routingKey: 'new_release_detected', handler: vi.fn()});

    expect(mockChannel.assertExchange).toHaveBeenCalledWith('releases', 'direct', { durable: true });
    expect(mockChannel.assertQueue).toHaveBeenCalledWith('release_notifications', { durable: true });
    expect(mockChannel.bindQueue).toHaveBeenCalledWith('release_notifications', 'releases', 'new_release_detected');
    expect(mockChannel.consume).toHaveBeenCalledWith('release_notifications', expect.any(Function));
  });

  it('should parse message, call handler, then ack', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const payload = { repoId: 'abc', tag: 'v1.0.0' };
    const msg = { content: Buffer.from(JSON.stringify(payload)) };

    mockChannel.consume.mockImplementation((_queue: string, cb: (msg: unknown) => void) => cb(msg));

    await consumer.consume({queue: 'release_notifications', exchange: 'releases', routingKey: 'new_release_detected', handler});

    expect(handler).toHaveBeenCalledWith(payload);
    expect(mockChannel.ack).toHaveBeenCalledWith(msg);
  });

  it('should ack even when handler throws', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('handler failed'));
    const msg = { content: Buffer.from(JSON.stringify({ repoId: 'abc', tag: 'v1.0.0' })) };

    mockChannel.consume.mockImplementation((_queue: string, cb: (msg: unknown) => void) => cb(msg));

    await consumer.consume({queue: 'release_notifications', exchange: 'releases', routingKey: 'new_release_detected', handler});

    expect(mockChannel.ack).toHaveBeenCalledWith(msg);
  });

  it('should skip null messages without acking', async () => {
    mockChannel.consume.mockImplementation((_queue: string, cb: (msg: unknown) => void) => { cb(null); });

    await consumer.consume({ queue: 'release_notifications', exchange: 'releases', routingKey: 'new_release_detected', handler: vi.fn() });

    expect(mockChannel.ack).not.toHaveBeenCalled();
  });

  it('should ack and log error on invalid JSON', async () => {
    const msg = { content: Buffer.from('not-json') };
    mockChannel.consume.mockImplementation((_queue: string, cb: (msg: unknown) => void) => { cb(msg); });

    await consumer.consume({ queue: 'release_notifications', exchange: 'releases', routingKey: 'new_release_detected', handler: vi.fn() });

    expect(mockChannel.ack).toHaveBeenCalledWith(msg);
  });
});
