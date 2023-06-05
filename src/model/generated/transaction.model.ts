import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_} from "typeorm"

@Entity_()
export class Transaction {
    constructor(props?: Partial<Transaction>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @Column_("text", {nullable: false})
    account!: string

    @Index_()
    @Column_("int4", {nullable: false})
    nonce!: number

    @Column_("bool", {nullable: false})
    result!: boolean

    @Column_("int4", {nullable: false})
    blockNumber!: number

    /**
     * Unix timestamp
     */
    @Column_("text", {nullable: false})
    timestamp!: string
}
