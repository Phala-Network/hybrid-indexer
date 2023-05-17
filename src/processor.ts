import { BatchBlock, BatchContext, BatchProcessorItem, SubstrateBatchProcessor } from "@subsquid/substrate-processor"
import { Store, TypeormDatabase } from "@subsquid/typeorm-store"
import { Transaction } from './model/generated/transaction.model';
import { getChainConfig, WHITELIST_CONFIG } from './config/index';
import { Account } from './model/generated/account.model';
import { BridgeReceiveEvent } from "./model";

const CHAIN_CONFIGS = getChainConfig();

const processor = new SubstrateBatchProcessor()
    .setBlockRange(CHAIN_CONFIGS.blockRange)
    .setDataSource(CHAIN_CONFIGS.dataSource)
    .addCall('*')
    .addEvent('*')
    .addEthereumTransaction('*')
    .addEvmLog('*')

type Item = BatchProcessorItem<typeof processor>

function get_or_create_account(map: Map<string, Account>, addr: string): Account {
    let account = map.get(addr);
    if (account === undefined) {
        account = new Account();
        account.id = addr;
    }
    return account;
}

processor.run(new TypeormDatabase(), async ctx => {
    let knownAccounts = await ctx.store.find(Account).then(accounts => {
        return new Map(accounts.map(a => [a.id, a]))
    })

    let transactions: Transaction[] = [];
    let bridgeEvents: BridgeReceiveEvent[] = [];

    for (const block of ctx.blocks) {
        let blockNumber = block.header.height;
        // unix timestamp
        let timestamp = BigInt(block.header.timestamp);
        for (let item of block.items) {
            if (item.kind === "call") {
                // console.log(item);
                //if (item.name === 'Ethereum.transact') {
                //    // ethereum transaction
                //    console.log(item);
                //} else {
                const extrinsic = item.extrinsic;
                const signature = extrinsic.signature;
                // we only want signed extrinsics
                if (signature) {
                    // only handler addresses in the whitelist
                    let addr = signature.address.value as string;
                    if (WHITELIST_CONFIG.Accounts.includes(addr)) {
                        let nonce = signature.signedExtensions.CheckNonce.nonce;
                        let result = extrinsic.success;
                        ctx.log.info(`${timestamp}|${blockNumber}: ${addr}'s nonce at block ${block.header.height}: ${nonce.toString()}: ${result}`)

                        let account = get_or_create_account(knownAccounts, addr);
                        knownAccounts.set(account.id, account);

                        let id = item.extrinsic.id;
                        transactions.push(new Transaction({
                            id,
                            account,
                            nonce,
                            result,
                            blockNumber,
                            timestamp,
                        }));
                    }

                }
                // }
            }
            else if (item.kind === "event") {
                if (item.name === "EVM.Log") {
                    /// EVM log
                    // console.log(item);
                } else {
                    //console.log(item);
                    if (WHITELIST_CONFIG.Events.includes(item.event.name)) {

                        let recipient = item.event.args.who;
                        if (!WHITELIST_CONFIG.Accounts.includes(recipient)) {
                            continue;
                        }
                        let id = item.event.id;
                        let name = item.event.name;
                        // it might be large
                        let amount = item.event.args.amount as string;
                        let indexInBlock = item.event.indexInBlock;
                        let result = item.event.extrinsic?.success;

                        let account = get_or_create_account(knownAccounts, recipient);
                        knownAccounts.set(account.id, account);

                        bridgeEvents.push(new BridgeReceiveEvent({
                            id,
                            name,
                            account,
                            amount,
                            indexInBlock,
                            blockNumber,
                            timestamp,
                            result,
                        }));
                    }
                }
            }
        }
    }

    console.log(knownAccounts);
    console.log(transactions);
    console.log(bridgeEvents);

    await ctx.store.save([...knownAccounts.values()]);
    await ctx.store.insert(transactions);
    await ctx.store.insert(bridgeEvents);
})
