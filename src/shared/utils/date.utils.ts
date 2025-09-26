import dayjs, {Dayjs} from 'dayjs';
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(isSameOrBefore);
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Возвращает массив всех дат по дням до текущей даты (UTC+3).
 * @param startDate Строка даты начала в формате YYYY-MM-DD
 */
export function getDatesUntilTodayUTC3(startDate: string): string[] {
    const dates: string[] = [];

    let current = dayjs(startDate).startOf('day');

    const today = dayjs().startOf('day');

    while (current.isSameOrBefore(today, 'day')) {
        dates.push(current.format('YYYY-MM-DD'));
        current = current.add(1, 'day');
    }

    return dates;
}