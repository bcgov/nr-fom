import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable, Optional } from "@angular/core";
import { Configuration } from "@api-client";
import { ConfigService } from '@utility/services/config.service';
import { Observable } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class AttachmentUploadService {

  public configuration = new Configuration();
  public defaultHeaders = new HttpHeaders();

  constructor(private configService: ConfigService, protected httpClient: HttpClient, @Optional() configuration: Configuration) {
    if (configuration) {
      this.configuration = configuration;
    }
  }


 /**
  * For fileupdate using FormData, refer to these two links for useful info:
  * https://developer.mozilla.org/en-US/docs/Web/API/FormData/Using_FormData_Objects
  * https://developer.mozilla.org/en-US/docs/Web/API/FormData/append
  * @param file file's matadata
  * @param fileContent blob
  * @param projectId
  * @param attachmentTypeCode
  * @param observe set whether or not to return the data Observable as the body, response or events. defaults to returning the body.
  // * @param reportProgress flag to report request and response progress.
  */
  public attachmentCreate(file: any, fileContent ? : Blob, projectId ? : number, attachmentTypeCode ? : string, observe
    :any = 'body'): Observable < any > {

    let headers = this.defaultHeaders;

    let credential: string | undefined;
    // authentication (bearer) required
    credential = this.configuration.lookupCredential('bearer');
    if (credential) {
      headers = headers.set('Authorization', 'Bearer ' + credential);
    }
    headers = headers.set('Accept', '*');

    const formParams: FormData = new FormData();
    formParams.append('file', fileContent, file.name); // originalname is set in third param.
    formParams.append('projectId', <any>projectId);
    formParams.append('attachmentTypeCode', <any>attachmentTypeCode);

    let responseType: 'text' | 'json' = 'json';
    return this.httpClient.post<any>(`${this.configService.getApiBasePath()}/api/attachment`,
      formParams,
      {
        responseType: <any>responseType,
        withCredentials: this.configuration.withCredentials,
        headers: headers,
        observe: observe
      }
    );
  }
}
