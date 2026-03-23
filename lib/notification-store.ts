export type AgentNotification = {
  id: string;
  timestamp: string;
  source: "heartbeat" | "cron";
  jobName: string;
  result: string;
  read: boolean;
};

const MAX = 50;
const notifications: AgentNotification[] = [];

export function addNotification(n: Omit<AgentNotification, "id" | "read">): AgentNotification {
  const notification: AgentNotification = {
    ...n,
    id: Math.random().toString(36).slice(2, 10),
    read: false,
  };
  notifications.unshift(notification);
  if (notifications.length > MAX) notifications.length = MAX;
  return notification;
}

export function getNotifications(): AgentNotification[] {
  return [...notifications];
}

export function markRead(id: string): void {
  const n = notifications.find((x) => x.id === id);
  if (n) n.read = true;
}

export function markAllRead(): void {
  notifications.forEach((n) => (n.read = true));
}
