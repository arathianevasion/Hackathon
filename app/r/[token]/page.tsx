import { openUploadSession, PORTAL_LINK_BASE } from "../../../src/portal/portalLink";
import { uploadPageState } from "../../../src/portal/uploadPage";
import { demoStore } from "../../../src/store/demo";
import { UploadPage } from "../../UploadPage";

export const dynamic = "force-dynamic";

/**
 * A Portal link's real URL on this server, opened in the phone's own browser.
 * Opening it starts the upload session; a reload within the session shows the
 * same page. A plain link brings the Client here, so nothing prefetches it.
 */
export default async function PortalUploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ client?: string }>;
}) {
  const { token } = await params;
  const { client } = await searchParams;
  const store = demoStore();
  const now = new Date();
  openUploadSession(store, `${PORTAL_LINK_BASE}${token}`, now);
  const state = uploadPageState(store, token, now);
  return (
    <main className="phone-full">
      <div className="br-bar">
        <a href={client ? `/phone?client=${encodeURIComponent(client)}` : "/phone"} className="br-done">
          Done
        </a>
        <span className="br-url">portal.example/r/{token}</span>
      </div>
      <div className="br-body">
        <UploadPage token={token} state={state} />
      </div>
      <div className="br-foot">Secure upload · this page shows no personal information</div>
    </main>
  );
}
