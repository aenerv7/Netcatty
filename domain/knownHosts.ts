import type { KnownHost } from "./models";

const normalizeHost = (value: string) => value.trim().toLowerCase();

const sameKnownHostSelector = (a: KnownHost, b: KnownHost) =>
  normalizeHost(a.hostname) === normalizeHost(b.hostname) &&
  a.port === b.port &&
  a.keyType === b.keyType;

export const upsertKnownHost = (
  knownHosts: KnownHost[],
  incoming: KnownHost,
): KnownHost[] => {
  const idIndex = knownHosts.findIndex((existing) => existing.id === incoming.id);
  const index = idIndex !== -1
    ? idIndex
    : knownHosts.findIndex((existing) => sameKnownHostSelector(existing, incoming));

  if (index === -1) {
    return [...knownHosts, incoming];
  }

  const existing = knownHosts[index];
  const updated: KnownHost = {
    ...existing,
    ...incoming,
    id: existing.id,
    discoveredAt: existing.discoveredAt,
    convertedToHostId: existing.convertedToHostId ?? incoming.convertedToHostId,
    lastSeen: incoming.lastSeen ?? incoming.discoveredAt,
  };

  return [
    ...knownHosts.slice(0, index),
    updated,
    ...knownHosts.slice(index + 1),
  ];
};
