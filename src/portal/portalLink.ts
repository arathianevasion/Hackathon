import { randomInt } from "node:crypto";
import type { ClientId, IsoDateTime, PortalLink } from "../contract";
import type { Store } from "../store/store";

/** Every Portal link starts with this; the outbound filter lets no other link out. */
export const PORTAL_LINK_BASE = "https://portal.example/r/";
/** How long a Portal link stays open (spec: 72 hours, configurable). */
export const PORTAL_LINK_TTL_HOURS = 72;

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

export type Redemption =
  | { ok: true; link: IssuedPortalLink }
  | { ok: false; reason: "unknown" | "used" | "expired" };

/** Opens a Portal link by its url: once only, and only before it expires. */
export function redeemPortalLink(store: Store, url: string, at: Date): Redemption {
  const link = store.list("portalLinks").find((l) => l.url === url);
  if (!link) return { ok: false, reason: "unknown" };
  if (link.usedAt !== null) return { ok: false, reason: "used" };
  if (Date.parse(link.expiresAt) <= at.getTime()) return { ok: false, reason: "expired" };
  const used = { ...link, usedAt: at.toISOString() };
  store.update("portalLinks", used);
  return { ok: true, link: used };
}
