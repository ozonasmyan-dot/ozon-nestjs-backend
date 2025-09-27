import dayjs from 'dayjs';
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(isSameOrBefore);
dayjs.extend(utc);
dayjs.extend(timezone);

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