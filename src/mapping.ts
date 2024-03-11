import { log, BigInt } from "@graphprotocol/graph-ts"; // install with yarn add @graphprotocol/graph-ts
import * as assembly from "./pb/assembly"; // import the generated assembly module
import { Contract } from "../generated/schema";

export function handleBlock(blockBytes: Uint8Array): void {
    log.info("Handling block", []);
}
