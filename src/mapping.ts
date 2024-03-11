import { log, BigInt } from "@graphprotocol/graph-ts";
import * as assembly from "./pb/assembly"; // Import the generated assembly module
import { Contract } from "../generated/schema";

export function handleBlock(blockBytes: Uint8Array): void {
    log.info("Handling block", []);
    let decoded = assembly.sf.ethereum.v2.Call.decode(blockBytes.buffer); // Decode the block

    // Check if the call type is CREATE
    if (decoded.call_type.toString() === "CREATE") {
        // If the call type is CREATE, handle the block as required
        log.info("Handling CREATE call", []);

        // Add your logic for handling CREATE call here
    } else {
        // If the call type is not CREATE, log and skip
        log.info("Skipping non-CREATE call", []);
    }
}
