import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {OzonAxiosExceptionFilter} from "@/api/filters/ozon-exception.filter";
import {getDatesUntilTodayUTC3} from "@/shared/utils/date.utils";

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.useGlobalFilters(new OzonAxiosExceptionFilter());

    await app.listen(3004);

    console.log(getDatesUntilTodayUTC3('2025-05-01'));


}

bootstrap();