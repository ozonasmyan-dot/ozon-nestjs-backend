import {Injectable} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

@Injectable()
export class ParserService {
    private readonly folderPath = path.join(process.cwd(), 'ads');

    async parseCPO(): Promise<any[]> {
        const allRows: any[] = [];

        const files = await fs.promises.readdir(this.folderPath);
        const excelFiles = files.filter(
            f => !f.startsWith('~$') && f.toLowerCase().endsWith('.xlsx')
        );

        for (const file of excelFiles) {
            const workbook = XLSX.readFile(path.join(this.folderPath, file));
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, {defval: null, range: 2});
            allRows.push(...rows);
        }

        const aggregated = Object.values(
            allRows.reduce((acc, row) => {
                const date = row['Дата'];
                const sku = row['SKU продвигаемого товара'];
                const key = `${date}_${sku}`;

                const spend = Number(row['Расход, ₽'] || 0);

                if (!acc[key]) {
                    acc[key] = {...row, 'Расход, ₽': spend};
                } else {
                    acc[key]['Расход, ₽'] += spend;
                }
                return acc;
            }, {} as Record<string, any>)
        );

        return aggregated as any[];
    }
}
