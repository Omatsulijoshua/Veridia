import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { CategoriesController } from './categories.controller';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../redis.service';

@Module({
  controllers: [ProductsController, CategoriesController],
  providers: [ProductsService, PrismaService, RedisService],
  exports: [ProductsService],
})
export class ProductsModule {}
