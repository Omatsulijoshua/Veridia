import { Module } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { WalletsController } from './wallets.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [WalletsController],
  providers: [WalletsService, PrismaService],
  exports: [WalletsService],
})
export class WalletsModule {}
