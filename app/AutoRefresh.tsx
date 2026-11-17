"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { startAutoRefresh } from "../src/autoRefresh";

const REFRESH_MS = 2000;

/** A refresh must not touch a reply being typed or an upload in progress. */
function pageIsBusy(): boolean {
  const field = document.activeElement;
  const typing = (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) && field.type !== "file" && field.value !== "";
  return typing || document.querySelector('form[aria-busy="true"]') !== null;
}

/** Re-renders the page's server data every couple of seconds, so a text or upload on the other device shows up. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => startAutoRefresh(() => router.refresh(), REFRESH_MS, pageIsBusy), [router]);
  return null;
}
