import {money} from '@/shared/utils/money.utils';
import {SBS_MAP} from '@/shared/constants/sbs-map.constants';
import {EconomyContext} from '../ts/economy-context.interface';
import {StatusRule} from '../ts/status-rule.type';
import {CustomStatus} from '../ts/custom-status.enum';
import {OzonStatus} from '../ts/ozon-status.enum';

const STATUS_RULES: Record<OzonStatus, StatusRule> = {
    [OzonStatus.Cancelled]: ({returnPVZ, totalServices, advertisingPerUnit}) => ({
        statusCustom: returnPVZ !== -1 ? CustomStatus.CancelPVZ : CustomStatus.InstantCancel,
        costPrice: money(0),
        margin: totalServices.minus(advertisingPerUnit),
    }),
    [OzonStatus.AwaitingDeliver]: ({totalServices}) => ({
        statusCustom: CustomStatus.AwaitingDelivery,
        costPrice: money(0),
        margin: totalServices,
    }),
    [OzonStatus.AwaitingPackaging]: ({totalServices}) => ({
        statusCustom: CustomStatus.AwaitingPackaging,
        costPrice: money(0),
        margin: totalServices,
    }),
    [OzonStatus.Delivering]: ({totalServices}) => ({
        statusCustom: CustomStatus.Delivering,
        costPrice: money(0),
        margin: totalServices,
    }),
    [OzonStatus.Delivered]: (
        {
            hasSalesCommission,
            salesCommissionSum,
            priceDecimal,
            totalServices,
            product,
            advertisingPerUnit,
        }) => {
        if (hasSalesCommission) {
            if (salesCommissionSum.isNegative()) {
                const costPrice = money(SBS_MAP[product]);
                const margin = priceDecimal.minus(costPrice).minus(advertisingPerUnit).minus(totalServices);
                return {statusCustom: CustomStatus.Delivered, costPrice, margin};
            }
            return {
                statusCustom: CustomStatus.Return,
                costPrice: money(0),
                margin: totalServices.minus(advertisingPerUnit),
            };
        }
        return {
            statusCustom: CustomStatus.AwaitingPayment,
            costPrice: money(0),
            margin: totalServices.minus(advertisingPerUnit),
        };
    },
};

const DEFAULT_RULE: StatusRule = ({status, totalServices}: EconomyContext) => ({
    statusCustom: (status as unknown as CustomStatus) || CustomStatus.Unknown,
    costPrice: money(0),
    margin: totalServices,
});

export {STATUS_RULES, DEFAULT_RULE};
