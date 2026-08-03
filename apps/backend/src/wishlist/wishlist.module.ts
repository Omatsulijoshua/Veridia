import { Module } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { WishlistController } from './wishlist.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [WishlistController],
  providers: [WishlistService, PrismaService],
  exports: [WishlistService],
})
export class WishlistModule {}
