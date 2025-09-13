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

const sbsMap: Record<string, number> = {
  "1828048543": 771,
  "1828048513": 771,
  "1828048540": 771,
  "1927603466": 524,
  "1763835247": 151,
  "2586085325": 151,
  "2586059276": 151,
};

const D = (v: any) => new Decimal(v ?? 0);

export const economy = (unit: EconomyUnit) => {
  const price = D(unit.price);
  let costPrice = D(0);
  let status = unit.statusOzon;

  const totalServices = (unit.services ?? []).reduce(
    (sum: Decimal, s: any) =>
      sum.plus(D(String(s?.price ?? 0).replace(",", "."))),
    D(0),
  );

  let margin = D(totalServices);

  const hasSalesCommission = (unit.services ?? []).some(
    (t: any) => String(t?.name).trim() === "SalesCommission",
  );
  const salesCommissionSum = (unit.services ?? [])
    .filter((s: any) => s.name === "SalesCommission")
    .reduce((sum: Decimal, s: any) => sum.plus(D(s?.price ?? 0)), D(0));

  const returnPVZ = (unit.services ?? []).findIndex(
    (t: any) =>
      t.name === "MarketplaceServiceItemRedistributionReturnsPVZ" ||
      t.name === "MarketplaceServiceItemReturnFlowLogistic",
  );

  switch (unit.statusOzon) {
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
          costPrice = D(sbsMap[unit.product]);
          margin = price.minus(costPrice).plus(totalServices);
        } else {
          status = "Возврат";
        }
      } else {
        status = "Ожидаем оплаты";
      }

      break;
    default:
      status = unit.statusOzon || "Неизвестный статус";
  }

  return {
    status,
    costPrice: costPrice.toDecimalPlaces(2).toNumber(),
    totalServices: totalServices.toDecimalPlaces(2).toNumber(),
    margin: margin.toDecimalPlaces(2).toNumber(),
  };
};
