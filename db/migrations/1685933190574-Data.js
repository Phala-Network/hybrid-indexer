module.exports = class Data1685933190574 {
    name = 'Data1685933190574'

    async up(db) {
        await db.query(`CREATE TABLE "transaction" ("id" character varying NOT NULL, "account" text NOT NULL, "nonce" integer NOT NULL, "result" boolean NOT NULL, "block_number" integer NOT NULL, "timestamp" text NOT NULL, CONSTRAINT "PK_89eadb93a89810556e1cbcd6ab9" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_1c21a3ac702e7b779cebcd9fd6" ON "transaction" ("account") `)
        await db.query(`CREATE INDEX "IDX_b9bc09c9b4ab20a5f3150bf82d" ON "transaction" ("nonce") `)
    }

    async down(db) {
        await db.query(`DROP TABLE "transaction"`)
        await db.query(`DROP INDEX "public"."IDX_1c21a3ac702e7b779cebcd9fd6"`)
        await db.query(`DROP INDEX "public"."IDX_b9bc09c9b4ab20a5f3150bf82d"`)
    }
}
