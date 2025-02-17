/*
 * Copyright (c) 2023 - Restate Software, Inc., Restate GmbH
 *
 * This file is part of the Restate SDK for Node.js/TypeScript,
 * which is released under the MIT license.
 *
 * You can find a copy of the license in file LICENSE in the root
 * directory of this repository or package, or at
 * https://github.com/restatedev/sdk-typescript/blob/main/LICENSE
 */

import { RemoteContext } from "../generated/proto/services";
import { encodeMessages } from "../io/encoder";
import { Message } from "../types/types";
import { Connection } from "./connection";

export class FencedOffError extends Error {
  constructor() {
    super("FencedOff");
  }
}

export class InvocationAlreadyCompletedError extends Error {
  constructor() {
    super("Completed");
  }
}

export class EmbeddedConnection implements Connection {
  private queue: Message[] = [];
  private flushing: Promise<void> = Promise.resolve();

  constructor(
    private readonly operationId: string,
    private readonly streamId: string,
    private readonly remote: RemoteContext
  ) {}

  send(msg: Message): Promise<void> {
    const len = this.queue.push(msg);
    if (len === 1) {
      // we are the first in line, therefore we schedule a flush,
      // BUT we must wait for the previous flush to end.
      this.flushing = this.flushing.then(() => this.scheduleFlush());
    }
    // tag along to the previously scheduled flush.
    return this.flushing;
  }

  end(): Promise<void> {
    this.flushing = this.flushing.then(() => this.flush());
    return this.flushing;
  }

  private scheduleFlush(): Promise<void> {
    // schedule a flush at the end of the current event loop iteration.
    return new Promise((resolve, reject) =>
      setImmediate(() => {
        this.flush().then(resolve).catch(reject);
      })
    );
  }

  private async flush(): Promise<void> {
    if (this.queue.length === 0) {
      return Promise.resolve();
    }
    const buffer = encodeMessages(this.queue) as Buffer;
    this.queue = [];

    const res = await this.remote.send({
      operationId: this.operationId,
      streamId: this.streamId,
      messages: buffer,
    });

    if (res.invalidStream !== undefined) {
      throw new FencedOffError();
    }
    if (res.invocationCompleted !== undefined) {
      throw new InvocationAlreadyCompletedError();
    }
  }
}
