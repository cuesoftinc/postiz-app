import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import {
  VideoAbstract,
  VideoParams,
} from '@gitroom/nestjs-libraries/videos/video.interface';

@Injectable()
export class VideoManager {
  constructor(private _moduleRef: ModuleRef) {}

  getAllVideos(): {
    identifier: string;
    title: string;
    dto: any;
    description: string;
    target: VideoAbstract<any>,
    tools: { functionName: string; output: string }[];
    placement: string;
    trial: boolean;
  }[] {
    return (Reflect.getMetadata('video', VideoAbstract) || [])
      .filter((f: any) => f.available)
      .map((p: any) => ({
        target: p.target,
        identifier: p.identifier,
        title: p.title,
        tools: p.tools,
        dto: p.dto,
        description: p.description,
        placement: p.placement,
        trial: p.trial,
      }));
  }

  checkAvailableVideoFunction(method: any) {
    const videoFunction = Reflect.getMetadata('video-function', method);
    return !videoFunction;
  }

  getVideoByName(
    identifier: string
  ): (VideoParams & { instance: VideoAbstract<any> }) | undefined {
    const video = (Reflect.getMetadata('video', VideoAbstract) || []).find(
      (p: any) => p.identifier === identifier
    );

    // An unknown identifier arrives here as undefined, and the return type says
    // so, but reading `video.target` below happened first and threw a
    // TypeError. That made every caller's `if (!video)` guard dead code and
    // turned a bad `identifier` in the request body into a 500 instead of the
    // 404 the guard was written to report.
    if (!video) {
      return undefined;
    }

    return {
      ...video,
      instance: this._moduleRef.get(video.target, {
        strict: false,
      }),
    };
  }
}
