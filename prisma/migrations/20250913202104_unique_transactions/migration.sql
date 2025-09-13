-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operationType" TEXT NOT NULL,
    "operationTypeName" TEXT NOT NULL,
    "operationServiceName" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "postingNumber" TEXT NOT NULL,
    "price" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "product" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "postingNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "inProcessAt" DATETIME NOT NULL,
    "sku" TEXT NOT NULL,
    "oldPrice" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_operationServiceName_postingNumber_key" ON "Transaction"("operationServiceName", "postingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Order_postingNumber_key" ON "Order"("postingNumber");
