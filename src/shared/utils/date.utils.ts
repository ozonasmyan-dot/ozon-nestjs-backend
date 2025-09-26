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

    // фиксируем часовой пояс UTC+3 (например, Europe/Moscow)
    const tz = 'Europe/Moscow';

    // парсим дату начала в нужном поясе и приводим к началу дня
    let current = dayjs.tz(startDate, tz).startOf('day');

    // сегодняшняя дата в том же поясе, без времени
    const today = dayjs().tz(tz).startOf('day');

    // добавляем все даты до сегодняшней включительно
    while (current.isSameOrBefore(today, 'day')) {
        dates.push(current.format('YYYY-MM-DD'));
        current = current.add(1, 'day');
    }

    return dates;
}

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