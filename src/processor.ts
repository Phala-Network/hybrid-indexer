// Only for local dev
import * as dotenv from 'dotenv'
dotenv.config()


import { BatchContext, BatchProcessorItem, SubstrateBatchProcessor } from '@subsquid/substrate-processor'
import { Store, TypeormDatabase} from '@subsquid/typeorm-store'
import { getTransactionResult } from '@subsquid/frontier'
import * as ss58 from '@subsquid/ss58'
import { Transaction } from './model/generated/transaction.model';
import { findAccount } from './utils'

type Item = BatchProcessorItem<typeof processor>
type Ctx = BatchContext<Store, Item>

const processor = new SubstrateBatchProcessor()
    .setBlockRange({
        from: Number(process.env.FROM_BLOCK),
        to: Number(process.env.TO_BLOCK)
    })
    .setDataSource({
        archive: String(process.env.DATA_SOURCE)
    })
    .addCall('*')
    .addEvent('*')
    .addEthereumTransaction('*', {
        data: {
          call: true,
        }
      })
    .addEvmLog('*', {
        data: {
          event: true
        }
    })

processor.run(new TypeormDatabase(), async ctx => {
    let transactions: Transaction[] = [];

    for (const block of ctx.blocks) {
        let blockNumber = block.header.height;
        // unix timestamp
        let timestamp = block.header.timestamp.toString();

        // Parse tx sent from substrate side
        for (let item of block.items) {
            if (item.kind === "call") {
                let extrinsic_item: any = item;
                const extrinsic = extrinsic_item.extrinsic;
                const signature = extrinsic.signature;
                // we only want signed extrinsics
                if (signature) {
                    // only handler addresses in the whitelist
                    let account;
                    if (String(process.env.CHAIN_TYPE) === 'substrate') {
                        if (signature.address.__kind === 'Id') {
                            account = signature.address.value.toString();
                        } else {
                            // Try to decode
                            account = ss58.codec(String(process.env.CHAIN)).decode(signature.address.toString()).toString();
                        }
                    } else {
                        account = signature.address.toString();
                    }
                    if (findAccount(account)) {
                        let nonce = signature.signedExtensions.CheckNonce;
                        let result = extrinsic.success;
                        ctx.log.info(`${timestamp}|${blockNumber}: ${account}'s nonce at block ${block.header.height}: ${nonce.toString()}: ${result}`)

                        let id = extrinsic_item.extrinsic.id;
                        let tx = new Transaction({
                            id,
                            account,
                            nonce,
                            result,
                            blockNumber,
                            timestamp,
                        });
                        console.log(`Save a Substrate tx signed by worker: ${JSON.stringify(tx, null, 2)}`);
                        transactions.push(tx);
                    }
                }
            }
        }

        // Parse tx sent from EVM side
        for (let item of block.items) {
            if (item.kind === 'event') {    // event
                if (item.event.name === "EVM.Log") {
                    // TODO: parse contract execution result from EVM log
                } else if (item.event.name === String("Ethereum.Executed")) {
                    if (!findAccount(item.event.args.from)) {
                        continue;
                    }
                    // Get Transaction result
                    const result = getTransactionResult(ctx, item.event);

                    // Set tx result, TODO; statusReason
                    let tx = new Transaction({
                        id: result.transactionHash,
                        account: item.event.args.from,
                        nonce: Number(item.event.extrinsic?.call.args.transaction.value.nonce),
                        result: result.status === "Succeed",
                        blockNumber,
                        timestamp,
                    });
                    console.log(`Save an EVM tx signed by worker: ${JSON.stringify(tx, null, 2)}`);
                    transactions.push(tx);
                }
            }
        }
    }

    console.log(`${transactions.length} transactions has been inserted into db`);

    await ctx.store.insert(transactions);
})
