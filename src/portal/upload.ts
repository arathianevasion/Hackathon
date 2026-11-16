import type { DomainEvent } from "../contract";
import type { Store } from "../store/store";
import { uploadSession } from "./portalLink";
import { uploadPageCopy } from "./uploadPage";

/** A file the Client picked on the upload page, with the document they said it is. */
export interface Upload {
  /** The label of the document choice that was selected. */
  choice: string;
  fileName: string;
  mediaType: string;
  bytes: Uint8Array;
}

/**
 * Takes a file from the upload page: only inside the Portal link's upload
 * session and while the DMI is open. Stores the Document as pending, with its
 * file kept for the check, and returns the event that runs the Assistant.
 */
export function receiveUpload(
  { store, now }: { store: Store; now: () => Date },
  url: string,
  upload: Upload,
): Extract<DomainEvent, { name: "document.uploaded" }> {
  const session = uploadSession(store, url, now());
  if (!session.ok) throw new Error(`No upload session: ${session.reason}`);
  const { dmiId, clientId } = session.link;
  const dmi = store.list("dmis").find((d) => d.id === dmiId);
  if (!dmi) throw new Error(`No DMI ${dmiId}`);
  if (dmi.status !== "open") throw new Error(`DMI ${dmiId} is ${dmi.status}`);
  const choice = uploadPageCopy(dmi.type).choices.find((c) => c.label === upload.choice);
  const id = `${dmiId}-upload-${store.list("documents").filter((d) => d.dmiId === dmiId).length + 1}`;
  store.add("documents", {
    id,
    dmiId,
    documentType: choice?.documentType ?? "unknown",
    fileName: upload.fileName,
    uploadedAt: now().toISOString(),
    precheck: { result: "pending", reasons: [] },
    submission: "not_submitted",
    watermark: "SPECIMEN",
  });
  const bytes = Buffer.from(upload.bytes);
  store.add("documentFiles", { id, mediaType: upload.mediaType, sizeBytes: bytes.length, base64: bytes.toString("base64") });
  return { name: "document.uploaded", clientId, dmiId, documentId: id };
}
