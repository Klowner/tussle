import { Observable } from "rxjs";
import { map, take, switchMap } from "rxjs/operators";
import type { B2AuthorizeAccountResponse } from "./actions/b2AuthorizeAccount";
import type { B2Auth } from "./b2auth";

interface B2DownloadInfo {
  url: string;
  authorization: string;
  requestReauth: () => void;
}
export class B2Downloader {
  constructor (private readonly b2auth: B2Auth) {}

  byFileId(
    fileId: string,
  ): Observable<B2DownloadInfo> {
    return this.b2auth.state$.pipe(
      take(1),
      map((state) => ({
        url: buildDownloadByIdURL(state, fileId),
        authorization: state.authorizationToken,
        requestReauth: () => this.b2auth.reauthorize(),
      }))
    );
  }

  byFileName(
    bucketName: string,
    fileName: string,
  ): Observable<B2DownloadInfo> {
    return this.b2auth.state$.pipe(
      take(1),
      map((state) => {
        const url = buildDownloadByNameURL(state, bucketName, fileName);
        return {
          url,
          authorization: state.authorizationToken,
          requestReauth: () => this.b2auth.reauthorize(),
        };
      }),
    );
  }
}

function buildDownloadByIdURL(
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

function buildDownloadByNameURL(
  auth: B2AuthorizeAccountResponse,
  bucketName: string,
  fileName: string,
): string {
  return [
    auth.downloadUrl,
    "file",
    bucketName,
    fileName,
  ].join("/");
}
