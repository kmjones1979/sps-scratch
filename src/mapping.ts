import { log, BigInt, Bytes } from "@graphprotocol/graph-ts";
import * as assembly from "./pb/assembly"; // Import the generated assembly module
import { Contract, Block, Transaction } from "../generated/schema";

export function handleBlock(blockBytes: Uint8Array): void {
    log.info("Handling block", []);

    let blockDecoded = assembly.sf.v2.Block.decode(blockBytes.buffer);

    let blockNumber = blockDecoded.number.toString();
    log.info("Block number: {}", [blockNumber]);

    // mappings for Block
    let block = Block.load(blockNumber); // Load the block from the store
    if (block == null) {
        block = new Block(blockNumber); // If the block does not exist, create a new one
        block.blockNumber = BigInt.fromU64(blockDecoded.number); // Set the block number
    }
    block.save();

    // Check if transaction_traces exist and iterate through them
    if (
        blockDecoded.transaction_traces &&
        blockDecoded.transaction_traces.length > 0
    ) {
        log.info("Transaction traces found in the block", []);
        for (let i = 0; i < blockDecoded.transaction_traces.length; i++) {
            // Iterate through the transaction traces
            let transaction = new Transaction(i.toString()); // Create a new transaction entity
            log.info("Creating transaction: {}", [transaction.id]);
            let transactionTrace = blockDecoded.transaction_traces[i]; // Get the transaction trace
            let transactionType = transactionTrace.type.toString(); // Get the transaction type
            log.info("Transaction type: {}", [transactionType]);

            if (blockDecoded.transaction_traces[i].calls[0].call_type) {
                let callType =
                    blockDecoded.transaction_traces[i].calls[0].call_type; // Get the call type
                log.info("Transaction call type: {}", [callType.toString()]);
                transaction.callType = callType.toString(); // Set the callType field to the call type
            } else {
                transaction.callType = "NONE"; // Set the callType field to "CALL" if the call type is not found
            }

            // mappings for Transaction
            transaction.type = transactionType; // Set the type field to the transaction type
            transaction.block = blockNumber; // Set the block field to the current block number
            transaction.save(); // Save the transaction entity
        }
    } else {
        log.info("No transaction traces found in the block", []);
    }
}
