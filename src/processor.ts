// Only for local dev
import 'dotenv/config'

import {lookupArchive} from '@subsquid/archive-registry'
import {EvmBatchProcessor} from '@subsquid/evm-processor'
import {getTransactionResult} from '@subsquid/frontier'
import * as ss58 from '@subsquid/ss58'
import {SubstrateBatchProcessor} from '@subsquid/substrate-processor'
import {TypeormDatabase} from '@subsquid/typeorm-store'
import assert from 'assert'
import {Transaction} from './model'
import WORKER_ACCOUNTS from './workers.json'

const WORKER_ACCOUNTS_20 = WORKER_ACCOUNTS.filter((x) => x.length === 42)

export function findAccount(account: string, accounts: string[]) {
  return accounts.some(
    (x) => x.toLocaleLowerCase() === account.toLocaleLowerCase()
  )
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NETWORK: string
      TYPE: 'EVM' | 'Substrate'
      CHAIN: string
      FROM_BLOCK: number
      TO_BLOCK?: number
    }
  }
}

const network = process.env.NETWORK
const type = process.env.TYPE
const chain = process.env.CHAIN
const from = Number(process.env.FROM_BLOCK)
const to = Number(process.env.TO_BLOCK) || undefined

if (type === 'Substrate') {
  // WIP
  const processor = new SubstrateBatchProcessor()
    .setBlockRange({from, to})
    .setDataSource({
      archive: lookupArchive(network, {type}),
      chain,
    })
    .setFields({
      call: {success: true},
      extrinsic: {signature: true, success: true},
      block: {timestamp: true},
    })
    .addCall({extrinsic: true})
    .addEvent({call: true})
    .addEthereumTransaction({})
    .addEvmLog({})
    .includeAllBlocks()

  processor.run(new TypeormDatabase(), async (ctx) => {
    const transactions: Transaction[] = []

    for (const block of ctx.blocks) {
      const blockNumber = block.header.height
      // unix timestamp
      const timestamp = block.header.timestamp?.toString()
      assert(timestamp)

      // Parse tx sent from substrate side
      for (const call of block.calls) {
        const extrinsic = call.extrinsic
        if (extrinsic == null) continue
        const signature = extrinsic.signature
        // we only want signed extrinsics
        if (signature == null) continue
        // only handler addresses in the whitelist
        let account
        const address = signature.address as any
        if (type === 'Substrate') {
          if (address.__kind === 'Id') {
            account = address.value.toString()
          } else {
            // Try to decode
            account = ss58.decode(address.toString()).toString()
          }
        } else {
          account = address.toString()
        }
        if (findAccount(account, WORKER_ACCOUNTS)) {
          let nonce = (signature.signedExtensions as any).CheckNonce
          if (
            typeof nonce !== 'number' &&
            Object.prototype.hasOwnProperty.call(nonce, 'nonce')
          ) {
            nonce = nonce.nonce
          }
          const result = extrinsic.success
          ctx.log.info(
            `${timestamp}|${blockNumber}: ${account}'s nonce at block ${
              block.header.height
            }: ${nonce.toString()}: ${result}`
          )

          const id = extrinsic.id
          const tx = new Transaction({
            id,
            account: account.toLowerCase(),
            nonce,
            result,
            blockNumber,
            timestamp,
          })
          console.log(
            `Save a Substrate tx signed by worker: ${JSON.stringify(
              tx,
              null,
              2
            )}`
          )
          transactions.push(tx)
        }
      }

      // Parse tx sent from EVM side
      for (const event of block.events) {
        if (event.name === 'EVM.Log') {
          // TODO: parse contract execution result from EVM log
        } else if (event.name === 'Ethereum.Executed') {
          if (!findAccount(event.args.from, WORKER_ACCOUNTS_20)) {
            continue
          }
          // Get Transaction result
          const result = getTransactionResult(ctx as any, event)

          // Set tx result, TODO; statusReason
          const tx = new Transaction({
            id: result.transactionHash,
            account: event.args.from.toLowerCase(),
            nonce: Number(event.call?.args.transaction.value.nonce),
            result: result.status === 'Succeed',
            blockNumber,
            timestamp,
          })
          console.log(
            `Save an EVM tx signed by worker: ${JSON.stringify(tx, null, 2)}`
          )
          transactions.push(tx)
        }
      }
    }

    console.log(`${transactions.length} transactions has been inserted into db`)

    await ctx.store.insert(transactions)
  })
} else {
  const processor = new EvmBatchProcessor()
    .setDataSource({
      archive: lookupArchive(network, {type}),
      chain: {url: chain, maxBatchCallSize: 1},
    })
    .setFinalityConfirmation(1)
    .setFields({
      transaction: {
        from: true,
        value: true,
        hash: true,
        nonce: true,
        status: true,
      },
    })
    .setBlockRange({from, to})
    .addTransaction({from: WORKER_ACCOUNTS_20})

  processor.run(new TypeormDatabase(), async (ctx) => {
    const transactions: Transaction[] = []

    for (const block of ctx.blocks) {
      const blockNumber = block.header.height
      // unix timestamp
      const timestamp = block.header.timestamp.toString()

      for (const transaction of block.transactions) {
        if (!findAccount(transaction.from, WORKER_ACCOUNTS_20)) {
          continue
        }

        // Set tx result, TODO; statusReason
        const tx = new Transaction({
          id: transaction.hash,
          account: transaction.from.toLowerCase(),
          nonce: transaction.nonce,
          result: transaction.status === 1,
          blockNumber,
          timestamp,
        })
        console.log(
          `Save an EVM tx signed by worker: ${JSON.stringify(tx, null, 2)}`
        )
        transactions.push(tx)
      }
    }

    console.log(`${transactions.length} transactions has been inserted into db`)

    await ctx.store.insert(transactions)
  })
}
