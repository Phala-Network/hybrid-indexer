import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"
import {Account} from "./account.model"

@Entity_()
export class BridgeReceiveEvent {
    constructor(props?: Partial<BridgeReceiveEvent>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Column_("text", {nullable: false})
    name!: string

    @Index_()
    @ManyToOne_(() => Account, {nullable: true})
    account!: Account

    @Column_("text", {nullable: false})
    amount!: string

    @Column_("bool", {nullable: false})
    result!: boolean

    @Index_()
    @Column_("int4", {nullable: false})
    indexInBlock!: number

    @Index_()
    @Column_("int4", {nullable: false})
    blockNumber!: number

    /**
     * Unix timestamp
     */
    @Index_()
    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    timestamp!: bigint
}
