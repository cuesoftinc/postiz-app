import { Injectable } from '@nestjs/common';
import {
  ThirdPartyAbstract,
  ThirdPartyParams,
} from '@gitroom/nestjs-libraries/3rdparties/thirdparty.interface';
import { ModuleRef } from '@nestjs/core';
import { ThirdPartyService } from '@gitroom/nestjs-libraries/database/prisma/third-party/third-party.service';

@Injectable()
export class ThirdPartyManager {
  constructor(
    private _moduleRef: ModuleRef,
    private _thirdPartyService: ThirdPartyService
  ) {}

  getAllThirdParties(): any[] {
    return (Reflect.getMetadata('third:party', ThirdPartyAbstract) || []).map(
      (p: any) => ({
        identifier: p.identifier,
        title: p.title,
        description: p.description,
        fields: p.fields || [],
      })
    );
  }

  getThirdPartyByName(
    identifier: string
  ): (ThirdPartyParams & { instance: ThirdPartyAbstract }) | undefined {
    const thirdParty = (
      Reflect.getMetadata('third:party', ThirdPartyAbstract) || []
    ).find((p: any) => p.identifier === identifier);

    return { ...thirdParty, instance: this._moduleRef.get(thirdParty.target) };
  }

  /**
   * Resolves a provider method by name, or `undefined` if the name is not one
   * the provider class itself declares.
   *
   * The name arrives as a raw URL segment and the resolved function is called
   * with the DECRYPTED api key as its first argument, so an unchecked lookup
   * puts every own AND inherited property in range - `constructor`, anything
   * on `Object.prototype`, and any service Nest injected onto the instance.
   * Walking the prototype chain and stopping at `ThirdPartyAbstract` limits
   * the answer to the provider's own methods, and reading the property
   * descriptor rather than the property means a getter is never triggered by
   * the lookup itself.
   */
  getProviderFunction(
    instance: ThirdPartyAbstract,
    functionName: string
  ): ((apiKey: string, data?: any) => Promise<any>) | undefined {
    if (functionName === 'constructor') {
      return undefined;
    }

    for (
      let prototype = Object.getPrototypeOf(instance);
      prototype &&
      prototype !== ThirdPartyAbstract.prototype &&
      prototype !== Object.prototype;
      prototype = Object.getPrototypeOf(prototype)
    ) {
      if (!Object.prototype.hasOwnProperty.call(prototype, functionName)) {
        continue;
      }

      const value = Object.getOwnPropertyDescriptor(
        prototype,
        functionName
      )?.value;

      return typeof value === 'function' ? value : undefined;
    }

    return undefined;
  }

  deleteIntegration(org: string, id: string) {
    return this._thirdPartyService.deleteIntegration(org, id);
  }

  getIntegrationById(org: string, id: string) {
    return this._thirdPartyService.getIntegrationById(org, id);
  }

  getAllThirdPartiesByOrganization(org: string) {
    return this._thirdPartyService.getAllThirdPartiesByOrganization(org);
  }

  saveIntegration(
    org: string,
    identifier: string,
    apiKey: string,
    data: { name: string; username: string; id: string }
  ) {
    return this._thirdPartyService.saveIntegration(
      org,
      identifier,
      apiKey,
      data
    );
  }
}
