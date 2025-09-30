import {money} from '@/shared/utils/money.utils';
import {SBS_MAP} from '@/shared/constants/sbs-map.constants';
import {EconomyContext} from '../ts/economy-context.interface';
import {StatusRule} from '../ts/status-rule.type';
import {CustomStatus} from '../ts/custom-status.enum';
import {OzonStatus} from '../ts/ozon-status.enum';
import Decimal from "decimal.js";

const STATUS_RULES: Record<OzonStatus, StatusRule> = {
    [OzonStatus.Cancelled]: ({returnPVZ, totalServices, advertisingPerUnit}) => {
        return {
            statusCustom: returnPVZ !== -1 ? CustomStatus.CancelPVZ : CustomStatus.InstantCancel,
            costPrice: money(0),
            margin: Decimal(totalServices).minus(Decimal(advertisingPerUnit).abs()),
        }
    },
    [OzonStatus.AwaitingDeliver]: ({totalServices, advertisingPerUnit}) => {
        return {
            statusCustom: CustomStatus.AwaitingDelivery,
            costPrice: money(0),
            margin: Decimal(totalServices).minus(Decimal(advertisingPerUnit).abs()),
        }
    },
    [OzonStatus.AwaitingPackaging]: ({totalServices, advertisingPerUnit}) => {
        return {
            statusCustom: CustomStatus.AwaitingPackaging,
            costPrice: money(0),
            margin: Decimal(totalServices).minus(Decimal(advertisingPerUnit).abs())
        }
    },
    [OzonStatus.Delivering]: ({totalServices, advertisingPerUnit}) => ({
        statusCustom: CustomStatus.Delivering,
        costPrice: money(0),
        margin: Decimal(totalServices).minus(Decimal(advertisingPerUnit).abs()),
    }),
    [OzonStatus.Delivered]: (
        {
            hasSalesCommission,
            salesCommissionSum,
            price,
            totalServices,
            product,
            advertisingPerUnit,
        }) => {
        if (hasSalesCommission) {
            if (Decimal(salesCommissionSum).isNegative()) {
                const costPrice = money(SBS_MAP[product]).neg();
                const margin = Decimal(price).minus(Decimal(costPrice).abs()).minus(Decimal(advertisingPerUnit).abs()).minus(Decimal(totalServices).abs());

                return {
                    statusCustom: CustomStatus.Delivered,
                    costPrice,
                    margin
                };
            }
            return {
                statusCustom: CustomStatus.Return,
                costPrice: money(0),
                margin: Decimal(totalServices).minus(Decimal(advertisingPerUnit).abs()),
            };
        }
        return {
            statusCustom: CustomStatus.AwaitingPayment,
            costPrice: money(0),
            margin: Decimal(totalServices).minus(Decimal(advertisingPerUnit).abs()),
        };
    },
};

const DEFAULT_RULE: StatusRule = ({status, totalServices}: EconomyContext) => ({
    statusCustom: (status as unknown as CustomStatus) || CustomStatus.Unknown,
    costPrice: money(0),
    margin: Decimal(totalServices),
});

export {STATUS_RULES, DEFAULT_RULE};
