import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // the secrets from SECRET_ID are in process.env from here on
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
