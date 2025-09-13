import Decimal from "decimal.js";

interface Service {
  name: string;
  price: number;
}

interface EconomyUnit {
  price: number;
  services?: Service[];
  statusOzon: string;
  product: string;
}

export interface EconomyResult {
  status: string;
  costPrice: number;
  totalServices: number;
  margin: number;
}

const sbsMap: Record<string, number> = {
  "1828048543": 771,
  "1828048513": 771,
  "1828048540": 771,
  "1927603466": 524,
  "1763835247": 151,
  "2586085325": 151,
  "2586059276": 151,
};

const toDecimal = (value: number | string | undefined) =>
  new Decimal(value ?? 0);

export const economy = ({
  price,
  services = [],
  statusOzon,
  product,
}: EconomyUnit): EconomyResult => {
  const priceDecimal = toDecimal(price);
  const totalServices = services.reduce(
    (sum, { price }) => sum.plus(toDecimal(price)),
    new Decimal(0),
  );

  const hasSalesCommission = services.some(
    (s) => s.name.trim() === "SaleCommission",
  );
  const salesCommissionSum = services
    .filter((s) => s.name === "SaleCommission")
    .reduce((sum, s) => sum.plus(toDecimal(s.price)), new Decimal(0));

  const returnPVZ = services.findIndex(
    (s) =>
      s.name === "MarketplaceServiceItemRedistributionReturnsPVZ" ||
      s.name === "MarketplaceServiceItemReturnFlowLogistic",
  );

  let status = statusOzon || "Неизвестный статус";
  let costPrice = new Decimal(0);
  let margin = new Decimal(totalServices);

  switch (statusOzon) {
    case "cancelled":
      status = returnPVZ !== -1 ? "Отмена ПВЗ" : "Моментальная отмена";
      break;
    case "awaiting_deliver":
      status = "Ожидает доставки";
      break;
    case "awaiting_packaging":
      status = "Ожидает сборки";
      break;
    case "delivering":
      status = "Доставляется";
      break;
    case "delivered":
      if (hasSalesCommission) {
        if (salesCommissionSum.isNegative()) {
          status = "Доставлен";
          costPrice = toDecimal(sbsMap[product]);
          margin = priceDecimal.minus(costPrice).plus(totalServices);
        } else {
          status = "Возврат";
        }
      } else {
        status = "Ожидаем оплаты";
      }
      break;
  }

  return {
    status,
    costPrice: costPrice.toDecimalPlaces(2).toNumber(),
    totalServices: totalServices.toDecimalPlaces(2).toNumber(),
    margin: margin.toDecimalPlaces(2).toNumber(),
  };
};
