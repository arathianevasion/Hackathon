import type { DocumentId } from "../contract";

/**
 * An uploaded Document's bytes, kept beside its row so the check can read
 * them. Only the extraction call ever gets them; no page shows them back.
 */
export interface StoredDocumentFile {
  /** The Document's id. */
  id: DocumentId;
  mediaType: string;
  sizeBytes: number;
  base64: string;
}
