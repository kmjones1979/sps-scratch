import { log, BigInt } from "@graphprotocol/graph-ts";
import * as assembly from "./pb/assembly"; // Import the generated assembly module
import { Contract } from "../generated/schema";

export function handleBlock(blockBytes: Uint8Array): void {
    log.info("Handling block", []);
    let decoded = assembly.eth.v1.Transactions.decode(blockBytes.buffer);
    const transactions = decoded.transactions;
    log.info("Transactions: {}", [transactions.length.toString()]);
}
