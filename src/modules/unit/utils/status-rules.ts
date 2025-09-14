import {toDecimalUtils} from '@/shared/utils/to-decimal.utils';
import {SBS_MAP} from '@/shared/constants/sbs-map.constants';
import {EconomyContext} from '../ts/economy-context.interface';
import {StatusRule} from '../ts/status-rule.type';
import {CustomStatus} from '../ts/custom-status.enum';
import {OzonStatus} from '../ts/ozon-status.enum';

const STATUS_RULES: Record<OzonStatus, StatusRule> = {
    [OzonStatus.Cancelled]: ({returnPVZ, totalServices}) => ({
        status: returnPVZ !== -1 ? CustomStatus.CancelPVZ : CustomStatus.InstantCancel,
        costPrice: toDecimalUtils(0),
        margin: totalServices,
    }),
    [OzonStatus.AwaitingDeliver]: ({totalServices}) => ({
        status: CustomStatus.AwaitingDelivery,
        costPrice: toDecimalUtils(0),
        margin: totalServices,
    }),
    [OzonStatus.AwaitingPackaging]: ({totalServices}) => ({
        status: CustomStatus.AwaitingPackaging,
        costPrice: toDecimalUtils(0),
        margin: totalServices,
    }),
    [OzonStatus.Delivering]: ({totalServices}) => ({
        status: CustomStatus.Delivering,
        costPrice: toDecimalUtils(0),
        margin: totalServices,
    }),
    [OzonStatus.Delivered]: (
        {
            hasSalesCommission,
            salesCommissionSum,
            priceDecimal,
            totalServices,
            product,
        }) => {
        if (hasSalesCommission) {
            if (salesCommissionSum.isNegative()) {
                const costPrice = toDecimalUtils(SBS_MAP[product]);
                const margin = priceDecimal.minus(costPrice).plus(totalServices);
                return {status: CustomStatus.Delivered, costPrice, margin};
            }
            return {
                status: CustomStatus.Return,
                costPrice: toDecimalUtils(0),
                margin: totalServices,
            };
        }
        return {
            status: CustomStatus.AwaitingPayment,
            costPrice: toDecimalUtils(0),
            margin: totalServices,
        };
    },
};

const DEFAULT_RULE: StatusRule = ({statusOzon, totalServices}: EconomyContext) => ({
    status: (statusOzon as unknown as CustomStatus) || CustomStatus.Unknown,
    costPrice: toDecimalUtils(0),
    margin: totalServices,
});

export {STATUS_RULES, DEFAULT_RULE};
