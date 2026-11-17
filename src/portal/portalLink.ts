import { randomInt } from "node:crypto";
import type { ClientId, IsoDateTime, PortalLink } from "../contract";
import type { Store } from "../store/store";

/** Every Portal link starts with this; the outbound filter lets no other link out. */
export const PORTAL_LINK_BASE = "https://portal.example/r/";
/** How long a Portal link stays open (spec: 72 hours, configurable). */
export const PORTAL_LINK_TTL_HOURS = 72;

/** At most this many Portal links per Client in any 24 hours (spec: "max 3 per 24 hours, then a Notification"). */
export const PORTAL_LINKS_PER_DAY = 3;

/** Thrown instead of issuing a Portal link past the cap; the Agent has been told by a Notification. */
export class PortalLinkLimitError extends Error {
  constructor() {
    super(`No Portal link: ${PORTAL_LINKS_PER_DAY} Portal links in 24 hours`);
  }
}

const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TOKEN_LENGTH = 10;
const HOUR_MS = 3_600_000;

/** A Portal link as stored: the link the Client gets, plus who it is for and whether it was used. */
export interface IssuedPortalLink extends PortalLink {
  /** The token, which is also the row id. */
  id: string;
  clientId: ClientId;
  issuedAt: IsoDateTime;
  /** When the link was opened; a used link never opens again. */
  usedAt: IsoDateTime | null;
  /** When the Client tapped "I'll come back later"; a closed link never opens or takes an upload again. */
  closedAt?: IsoDateTime | null;
}

/** How many Portal links this Client was sent in the 24 hours up to `at`. */
export function linksInLastDay(store: Store, clientId: ClientId, at: Date): number {
  const since = at.getTime() - 24 * HOUR_MS;
  return store.list("portalLinks").filter((l) => l.clientId === clientId && Date.parse(l.issuedAt) > since).length;
}

/** Stores a fresh single-use Portal link for one DMI, open for 72 hours from `at`. */
export function issuePortalLink(store: Store, clientId: ClientId, dmiId: string, at: Date): IssuedPortalLink {
  const token = Array.from({ length: TOKEN_LENGTH }, () => TOKEN_ALPHABET[randomInt(TOKEN_ALPHABET.length)]).join("");
  const link: IssuedPortalLink = {
    id: token,
    url: `${PORTAL_LINK_BASE}${token}`,
    clientId,
    dmiId,
    issuedAt: at.toISOString(),
    expiresAt: new Date(at.getTime() + PORTAL_LINK_TTL_HOURS * HOUR_MS).toISOString(),
    usedAt: null,
  };
  store.add("portalLinks", link);
  return link;
}

/** The Client's most recent Portal link for a DMI if it still opens (not used, closed or expired); null otherwise. */
export function livePortalLink(store: Store, clientId: ClientId, dmiId: string, at: Date): IssuedPortalLink | null {
  const latest = store
    .list("portalLinks")
    .filter((l) => l.clientId === clientId && l.dmiId === dmiId)
    .at(-1);
  if (!latest || latest.usedAt !== null || latest.closedAt || Date.parse(latest.expiresAt) <= at.getTime()) return null;
  return latest;
}

export type Redemption =
  | { ok: true; link: IssuedPortalLink }
  | { ok: false; reason: "unknown" | "used" | "closed" | "expired" };

/** Opens a Portal link by its url: once only, and only before it expires. */
export function redeemPortalLink(store: Store, url: string, at: Date): Redemption {
  const link = store.list("portalLinks").find((l) => l.url === url);
  if (!link) return { ok: false, reason: "unknown" };
  if (link.closedAt) return { ok: false, reason: "closed" };
  if (link.usedAt !== null) return { ok: false, reason: "used" };
  if (Date.parse(link.expiresAt) <= at.getTime()) return { ok: false, reason: "expired" };
  const used = { ...link, usedAt: at.toISOString() };
  store.update("portalLinks", used);
  return { ok: true, link: used };
}

/** How long an opened Portal link keeps its upload page usable (spec: a 30-minute upload session). */
export const UPLOAD_SESSION_MINUTES = 30;

export type UploadSession =
  | { ok: true; link: IssuedPortalLink }
  | { ok: false; reason: "unknown" | "not_opened" | "used" | "closed" | "expired" };

/**
 * The upload session a Portal link opened, if it is still running: from the
 * link's first open, for 30 minutes. Reading it changes nothing.
 */
export function uploadSession(store: Store, url: string, at: Date): UploadSession {
  const link = store.list("portalLinks").find((l) => l.url === url);
  if (!link) return { ok: false, reason: "unknown" };
  if (link.closedAt) return { ok: false, reason: "closed" };
  if (link.usedAt === null) return { ok: false, reason: Date.parse(link.expiresAt) <= at.getTime() ? "expired" : "not_opened" };
  if (at.getTime() >= Date.parse(link.usedAt) + UPLOAD_SESSION_MINUTES * 60_000) return { ok: false, reason: "used" };
  return { ok: true, link };
}

/**
 * The Client taps a Portal link: its first open uses the single-use link up
 * and starts the upload session; opening it again within that session (a
 * reload, "Done" and back) returns the same session and nothing else.
 */
export function openUploadSession(store: Store, url: string, at: Date): UploadSession {
  const running = uploadSession(store, url, at);
  if (running.ok || running.reason !== "not_opened") return running;
  return redeemPortalLink(store, url, at);
}
