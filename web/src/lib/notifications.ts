// web/src/lib/notifications.ts
// Pequeño helper para contadores de "no vistos" usando localStorage.
// No requiere cambios de backend.

type NotifKeys = 'comms' | 'partials' | 'reportcards';

type Store = Partial<Record<NotifKeys, string>>;

const KEY = 'gt_notif_last_seen_v1';

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(s: Store) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function lastSeen(key: NotifKeys): Date {
  const s = read();
  const iso = s[key];
  return iso ? new Date(iso) : new Date(0);
}

export function touch(key: NotifKeys, when: Date = new Date()) {
  const s = read();
  s[key] = when.toISOString();
  write(s);
}

export function touchAll(when: Date = new Date()) {
  (['comms', 'partials', 'reportcards'] as NotifKeys[]).forEach((k) => touch(k, when));
}

export function getAllLastSeen() {
  return {
    comms: lastSeen('comms'),
    partials: lastSeen('partials'),
    reportcards: lastSeen('reportcards'),
  };
}
