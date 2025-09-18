import dayjs, {Dayjs} from 'dayjs';
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(isSameOrBefore);
dayjs.extend(utc);
dayjs.extend(timezone);

export function getDatesUntilToday(startDate: string): string[] {
    const dates: string[] = [];
    const tz = 'Europe/Moscow'; // для UTC+3

    let current = dayjs.tz(startDate, tz).startOf('day');
    const today = dayjs().tz(tz).startOf('day');

    while (current.isSameOrBefore(today, 'day')) {
        dates.push(current.format('YYYY-MM-DD'));
        current = current.add(1, 'day');
    }

    return dates;
}