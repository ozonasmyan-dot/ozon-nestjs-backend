-- Alter Transaction.price from Int to Float
PRAGMA foreign_keys=OFF;

CREATE TABLE "Transaction_new" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "operationType" TEXT NOT NULL,
  "operationTypeName" TEXT NOT NULL,
  "operationServiceName" TEXT NOT NULL,
  "date" DATETIME NOT NULL,
  "type" TEXT NOT NULL,
  "postingNumber" TEXT NOT NULL,
  "price" REAL NOT NULL
);

INSERT INTO "Transaction_new" ("id", "operationType", "operationTypeName", "operationServiceName", "date", "type", "postingNumber", "price")
SELECT "id", "operationType", "operationTypeName", "operationServiceName", "date", "type", "postingNumber", "price"
FROM "Transaction";

DROP TABLE "Transaction";
ALTER TABLE "Transaction_new" RENAME TO "Transaction";

CREATE UNIQUE INDEX "Transaction_operationServiceName_postingNumber_key" ON "Transaction"("operationServiceName", "postingNumber");

PRAGMA foreign_keys=ON;
