interface ScheduledEvent {
  type: string;
  scheduledTime: number;
  waitUntil(promise: Promise<any>): void;
}

declare function addEventListener(
  type: 'scheduled',
  handler: (event: ScheduledEvent) => void,
): void