import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { WalletsModule } from './wallets/wallets.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MessagesModule } from './messages/messages.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    NotificationsModule, // Global module first
    AuthModule, 
    UsersModule, 
    ProductsModule,
    WishlistModule,
    ReviewsModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    WalletsModule,
    MessagesModule,
    AnalyticsModule
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService, RedisService],
  exports: [PrismaService, RedisService],
})
export class AppModule {}
