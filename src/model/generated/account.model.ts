import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, OneToMany as OneToMany_} from "typeorm"
import {Transaction} from "./transaction.model"
import {BridgeReceiveEvent} from "./bridgeReceiveEvent.model"

@Entity_()
export class Account {
    constructor(props?: Partial<Account>) {
        Object.assign(this, props)
    }

    /**
     * Account address
     */
    @PrimaryColumn_()
    id!: string

    @OneToMany_(() => Transaction, e => e.account)
    transactions!: Transaction[]

    @OneToMany_(() => BridgeReceiveEvent, e => e.account)
    bridgeReceiveEvents!: BridgeReceiveEvent[]
}
