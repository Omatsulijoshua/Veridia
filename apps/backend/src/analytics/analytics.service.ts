import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  private async getSellerId(userId: string): Promise<string> {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }
    return seller.id;
  }

  async getAdminSummary() {
    const activeStates = [
      OrderStatus.PAID,
      OrderStatus.PROCESSING,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ];

    const [gmvAggregate, totalOrders, activeProducts, registeredUsers] = await Promise.all([
      this.prisma.order.aggregate({
        where: {
          status: { in: activeStates },
        },
        _sum: {
          totalAmount: true,
        },
      }),
      this.prisma.order.count(),
      this.prisma.product.count({
        where: { isApproved: true },
      }),
      this.prisma.user.count(),
    ]);

    return {
      totalGmv: parseFloat(gmvAggregate._sum.totalAmount?.toString() || '0'),
      totalOrders,
      activeProducts,
      registeredUsers,
    };
  }

  async getSellerSummary(userId: string) {
    const sellerId = await this.getSellerId(userId);
    const store = await this.prisma.store.findUnique({
      where: { sellerId },
    });
    if (!store) {
      throw new NotFoundException('Store not found for this seller');
    }

    const activeStates = [
      OrderStatus.PAID,
      OrderStatus.PROCESSING,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ];

    // Get revenue and orders count
    const [revenueAggregate, totalOrders] = await Promise.all([
      this.prisma.order.aggregate({
        where: {
          storeId: store.id,
          status: { in: activeStates },
        },
        _sum: {
          totalAmount: true,
        },
      }),
      this.prisma.order.count({
        where: { storeId: store.id },
      }),
    ]);

    const totalRevenue = parseFloat(revenueAggregate._sum.totalAmount?.toString() || '0');
    const averageOrderSize = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Get top products by volume sold
    const topItemGroups = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          storeId: store.id,
          status: { in: activeStates },
        },
      },
      _sum: {
        quantity: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: 5,
    });

    const topProducts = await Promise.all(
      topItemGroups.map(async (group) => {
        const product = await this.prisma.product.findUnique({
          where: { id: group.productId },
          select: { name: true, price: true },
        });
        return {
          id: group.productId,
          name: product?.name || 'Unknown Product',
          price: parseFloat(product?.price?.toString() || '0'),
          quantitySold: group._sum.quantity || 0,
        };
      })
    );

    return {
      totalRevenue,
      totalOrders,
      averageOrderSize,
      topProducts,
    };
  }
}
