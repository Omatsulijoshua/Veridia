import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CheckoutDto, UpdateOrderStatusDto } from './dto/order.dto';
import { OrderStatus, Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService
  ) {}

  private async getCustomerId(userId: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile not found');
    }
    return customer.id;
  }

  async checkout(userId: string, dto: CheckoutDto) {
    const customerId = await this.getCustomerId(userId);

    // Run checkout inside transaction
    const order = await this.prisma.$transaction(async (tx) => {
      // 1. Fetch Cart
      const cart = await tx.cart.findUnique({
        where: { customerId },
      });
      if (!cart) {
        throw new BadRequestException('Cart is empty');
      }

      const cartItems = await tx.cartItem.findMany({
        where: { cartId: cart.id },
        include: { product: true },
      });

      if (cartItems.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      // 2. Validate stock levels & calculate total
      let totalAmount = new Prisma.Decimal(0);
      for (const item of cartItems) {
        if (!item.product.isApproved) {
          throw new BadRequestException(`Product ${item.product.name} is no longer available`);
        }
        if (item.quantity > item.product.stock) {
          throw new BadRequestException(`Insufficient stock for product ${item.product.name}. Available: ${item.product.stock}`);
        }
        const price = new Prisma.Decimal(item.product.price);
        const qty = new Prisma.Decimal(item.quantity);
        totalAmount = totalAmount.add(price.mul(qty));
      }

      // 3. Create Order
      const storeId = cartItems[0].product.storeId;

      const orderCreated = await tx.order.create({
        data: {
          customerId,
          storeId,
          status: OrderStatus.PENDING,
          totalAmount: parseFloat(totalAmount.toString()),
          shippingAddress: dto.shippingAddress as any,
          items: {
            create: cartItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.product.price,
            })),
          },
        },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      // 4. Decrement Product Stock levels
      for (const item of cartItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      // 5. Clear Cart Items
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return orderCreated;
    });

    // Send notifications after transaction commits successfully
    try {
      await this.notifications.createNotification(
        userId,
        'Order Created',
        `Your order ${order.id} has been created successfully.`,
        'ORDER_STATUS'
      );

      const store = await this.prisma.store.findUnique({
        where: { id: order.storeId },
        include: { seller: true },
      });
      if (store?.seller?.userId) {
        await this.notifications.createNotification(
          store.seller.userId,
          'New Order Received',
          `You have received a new order ${order.id} for store ${store.name}.`,
          'ORDER_STATUS'
        );
      }
    } catch (err) {
      console.error('Failed to trigger checkout notifications:', err);
    }

    return order;
  }

  async getOrders(userId: string, status?: OrderStatus, page = 1, limit = 10) {
    const customerId = await this.getCustomerId(userId);
    const skip = (page - 1) * limit;

    const whereClause: Prisma.OrderWhereInput = { customerId };
    if (status) {
      whereClause.status = status;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: whereClause,
        include: {
          items: {
            include: { product: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where: whereClause }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOrderById(userId: string, orderId: string) {
    const customerId = await this.getCustomerId(userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException('You do not own this order');
    }

    return order;
  }

  async cancelOrder(userId: string, orderId: string) {
    const customerId = await this.getCustomerId(userId);

    const order = await this.prisma.$transaction(async (tx) => {
      const orderToCancel = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!orderToCancel) {
        throw new NotFoundException('Order not found');
      }

      if (orderToCancel.customerId !== customerId) {
        throw new ForbiddenException('You do not own this order');
      }

      if (orderToCancel.status !== OrderStatus.PENDING) {
        throw new BadRequestException(`Only pending orders can be cancelled. Current status: ${orderToCancel.status}`);
      }

      // Update Order Status to CANCELLED
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
        include: { items: { include: { product: true } } },
      });

      // Restore Product Stock levels
      for (const item of orderToCancel.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });
      }

      return updatedOrder;
    });

    // Trigger notifications after cancellation success
    try {
      await this.notifications.createNotification(
        userId,
        'Order Cancelled',
        `Your order ${order.id} has been cancelled.`,
        'ORDER_STATUS'
      );

      const store = await this.prisma.store.findUnique({
        where: { id: order.storeId },
        include: { seller: true },
      });
      if (store?.seller?.userId) {
        await this.notifications.createNotification(
          store.seller.userId,
          'Order Cancelled',
          `Order ${order.id} has been cancelled by the customer.`,
          'ORDER_STATUS'
        );
      }
    } catch (err) {
      console.error('Failed to trigger cancelOrder notifications:', err);
    }

    return order;
  }

  async updateOrderStatus(orderId: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.$transaction(async (tx) => {
      const orderToUpdate = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!orderToUpdate) {
        throw new NotFoundException('Order not found');
      }

      if (orderToUpdate.status === OrderStatus.CANCELLED || orderToUpdate.status === OrderStatus.DELIVERED) {
        throw new BadRequestException(`Cannot change status of a terminal order. Current status: ${orderToUpdate.status}`);
      }

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: dto.status },
        include: { items: { include: { product: true } } },
      });

      // Restore Product Stock levels if status changes to CANCELLED
      if (dto.status === OrderStatus.CANCELLED) {
        for (const item of orderToUpdate.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }
      }

      return updatedOrder;
    });

    // Trigger notifications based on admin status change
    try {
      const customer = await this.prisma.customer.findUnique({
        where: { id: order.customerId },
      });
      const store = await this.prisma.store.findUnique({
        where: { id: order.storeId },
        include: { seller: true },
      });

      if (customer) {
        let title = '';
        let body = '';

        if (dto.status === OrderStatus.SHIPPED) {
          title = 'Order Shipped';
          body = `Your order ${order.id} has been shipped.`;
        } else if (dto.status === OrderStatus.CANCELLED) {
          title = 'Order Cancelled';
          body = `Your order ${order.id} has been cancelled by the administrator.`;
        } else if (dto.status === OrderStatus.DELIVERED) {
          title = 'Order Delivered';
          body = `Your order ${order.id} has been delivered successfully. Thank you for shopping with Veridia!`;
        } else if (dto.status === OrderStatus.PAID) {
          title = 'Order Paid';
          body = `Payment for order ${order.id} has been confirmed.`;
        } else {
          title = 'Order Status Updated';
          body = `Your order ${order.id} status is now: ${dto.status}`;
        }

        await this.notifications.createNotification(customer.userId, title, body, 'ORDER_STATUS');
      }

      if (store?.seller?.userId) {
        let title = '';
        let body = '';

        if (dto.status === OrderStatus.CANCELLED) {
          title = 'Order Cancelled';
          body = `Order ${order.id} has been cancelled by the administrator.`;
        } else if (dto.status === OrderStatus.DELIVERED) {
          title = 'Order Delivered';
          body = `Order ${order.id} has been marked as delivered.`;
        } else if (dto.status === OrderStatus.PAID) {
          title = 'Order Paid';
          body = `Payment for order ${order.id} has been confirmed.`;
        } else {
          title = 'Order Status Updated';
          body = `Order ${order.id} status updated to: ${dto.status}`;
        }

        if (title && body) {
          await this.notifications.createNotification(store.seller.userId, title, body, 'ORDER_STATUS');
        }
      }
    } catch (err) {
      console.error('Failed to trigger updateOrderStatus notifications:', err);
    }

    return order;
  }
}
