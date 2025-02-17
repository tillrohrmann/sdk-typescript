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

import { TestGreeter, TestResponse } from "../src/generated/proto/test";
import * as restate from "../src/public_api";
import { describe, expect } from "@jest/globals";
import { TestDriver } from "./testdriver";
import {
  greetRequest,
  greetResponse,
  inputMessage,
  outputMessage,
  startMessage,
} from "./protoutils";

class Greeter implements TestGreeter {
  async greet(): Promise<TestResponse> {
    restate.useContext(this);

    return TestResponse.create({ greeting: `Hello` });
  }
}

describe("Greeter", () => {
  it("sends message to runtime", async () => {
    const result = await new TestDriver(new Greeter(), [
      startMessage(1),
      inputMessage(greetRequest("Pete")),
    ]).run();

    expect(result).toStrictEqual([outputMessage(greetResponse("Hello"))]);
  });

  it("handles replay of output message", async () => {
    const result = await new TestDriver(new Greeter(), [
      startMessage(2),
      inputMessage(greetRequest("Pete")),
      outputMessage(greetResponse("Hello")),
    ]).run();

    expect(result).toStrictEqual([]);
  });
});
