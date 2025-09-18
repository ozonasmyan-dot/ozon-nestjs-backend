import dayjs from 'dayjs';

interface Period {
    from: string; // ISO-строка
    to: string;
}

/**
 * Делит диапазон от startDate до сегодня на интервалы по 60 дней
 */
export const buildPeriods = (startDate: string | Date): any => {
    const start = dayjs(startDate);
    const today = dayjs();
    const periods: Period[] = [];

    let currentFrom = start;

    while (currentFrom.isBefore(today)) {
        const currentTo = currentFrom.add(60, 'day');
        periods.push({
            from: currentFrom.format('YYYY-MM-DD'),
            to: (currentTo.isAfter(today) ? today : currentTo).format('YYYY-MM-DD'),
        });

        // +1 день от предыдущего конца, чтобы не пересекались
        currentFrom = currentTo.add(1, 'day');
    }

    return periods;
}