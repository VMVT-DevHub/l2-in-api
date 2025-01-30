'use strict';
import Moleculer, { Context, RestSchema } from 'moleculer';
import { Action, Method, Service } from 'moleculer-decorators';
import { throwUploadError } from '../types';
import { UserAuthMeta } from './api.service';

@Service({
  name: 'sharepoint',
  settings: {
    baseUrl: 'https://graph.microsoft.com/v1.0/drives',
  },
})
export default class SharePointService extends Moleculer.Service {
  @Method
  async authenticate() {
    const url = `https://login.microsoftonline.com/${process.env.SHARE_POINT_TENANT_ID}/oauth2/v2.0/token`;

    const postData = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.SHARE_POINT_CLIENT_ID,
      client_secret: process.env.SHARE_POINT_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
    });

    const response: any = await this.broker.call(
      'http.post',
      {
        url: url,
        opt: {
          responseType: 'json',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: postData.toString(),
        },
      },
      {
        timeout: 0,
      },
    );

    const { token_type, expires_in, access_token } = response;

    await this.broker.cacher.set(
      `${this.name}.token`,
      { token: `${token_type} ${access_token}` },
      expires_in - 60,
    );
  }

  @Method
  async getToken() {
    const tokenKey = `${this.name}.token`;
    let sharePointToken = (await this.broker.cacher.get(tokenKey))?.token;

    if (!sharePointToken) {
      await this.authenticate();
      sharePointToken = (await this.broker.cacher.get(tokenKey))?.token;
    }

    return sharePointToken;
  }

  @Method
  async uploadFile(
    token: string,
    fileStream: any,
    mimeType: string,
    name: string,
    requestId: string,
  ) {
    const uploadUrl = `${this.settings.baseUrl}/${process.env.SHARE_POINT_DRIVE_ID}/root:/${requestId}/${name}:/content`;

    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          Authorization: token,
          'Content-Type': mimeType,
        },
        body: fileStream,
        //@ts-ignore
        duplex: 'half',
      });

      if (!response.ok) {
        throwUploadError(response.status);
      }

      const responseData = await response.json();
      const { id, size, '@microsoft.graph.downloadUrl': url } = responseData;

      return { name, url, size, requestId: Number(requestId), sharepointFileId: id };
    } catch ({}) {
      throwUploadError();
    }
  }

  @Action({
    rest: <RestSchema>{
      method: 'POST',
      path: '/upload',
      type: 'multipart',
    },
  })
  async uploadFiles(
    ctx: Context<
      {},
      { filename: string; mimetype: string; $multipart: { requestId: string } } & UserAuthMeta
    >,
  ) {
    const token = await this.getToken();
    const fileStream = ctx.params;
    const fileName = ctx?.meta?.filename ?? '';
    const mimeType = ctx?.meta?.mimetype ?? '';
    const requestId = ctx?.meta?.['$multipart']?.requestId ?? '';

    return this.uploadFile(token, fileStream, mimeType, fileName, requestId);
  }

  created() {
    const hasSecrets =
      process.env.SHARE_POINT_TENANT_ID &&
      process.env.SHARE_POINT_CLIENT_ID &&
      process.env.SHARE_POINT_CLIENT_SECRET &&
      process.env.SHARE_POINT_DRIVE_ID;

    if (process.env.NODE_ENV !== 'local' && !hasSecrets) {
      this.broker.fatal('SharePoint is not configured');
    }
  }
}
