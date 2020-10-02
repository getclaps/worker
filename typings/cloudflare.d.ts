interface ScheduledEvent {
  type: string;
  scheduledTime: number;
  waitUntil(f: any): void;
}

declare function addEventListener(
  type: 'scheduled',
  handler: (event: ScheduledEvent) => void,
): void