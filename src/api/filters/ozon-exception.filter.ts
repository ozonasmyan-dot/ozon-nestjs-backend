import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
} from '@nestjs/common';
import { Response } from 'express';
import { AxiosError } from 'axios';

@Catch(AxiosError)
export class OzonAxiosExceptionFilter implements ExceptionFilter {
    catch(exception: AxiosError, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        if (exception.response?.data) {
            // ✅ Отдаём клиенту ровно то, что прислал Ozon
            return response
                .status(exception.response.status || 500)
                .json(exception.response.data);
        }

        // fallback если у axios нет response
        return response.status(500).json({
            result: null,
            error: {
                code: 'INTERNAL_ERROR',
                message: exception.message,
            },
        });
    }
}
