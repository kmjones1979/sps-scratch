import { log, BigInt } from "@graphprotocol/graph-ts";
import * as assembly from "./pb/assembly"; // Import the generated assembly module
import { Contract } from "../generated/schema";

export function handleBlock(blockBytes: Uint8Array): void {
    log.info("Handling block", []);
}
