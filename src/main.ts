import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {OzonAxiosExceptionFilter} from "@/api/filters/ozon-exception.filter";

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.useGlobalFilters(new OzonAxiosExceptionFilter());

    await app.listen(3005);
}

bootstrap();