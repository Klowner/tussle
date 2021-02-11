import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { B2AuthorizeAccountResponse } from "./actions/b2AuthorizeAccount";
import type { B2Auth } from "./b2auth";

interface B2DownloadInfo {
  url: string;
  authorization: string;
  requestReauth: () => void;
}

function buildDownloadURL(
  auth: B2AuthorizeAccountResponse,
  fileId: string
): string {
  return [
    auth.downloadUrl,
    "/b2api/v2/b2_download_file_by_id",
    "?fileId=",
    fileId,
  ].join("");
}

export class B2Downloader {
  constructor(private readonly b2auth: B2Auth) {}

  byFileId(fileId: string): Observable<B2DownloadInfo> {
    return this.b2auth.state$.pipe(
      map((state) => ({
        url: buildDownloadURL(state, fileId),
        authorization: state.authorizationToken,
        requestReauth: () => this.b2auth.reauthorize(),
      }))
    );
  }
}
