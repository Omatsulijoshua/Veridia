import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ProcessPaymentDto } from './dto/payment.dto';
import { PaymentStatus, OrderStatus, PaymentProvider, TransactionType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
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

  async chargeOrder(userId: string, dto: ProcessPaymentDto) {
    const customerId = await this.getCustomerId(userId);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Fetch Order
      const order = await tx.order.findUnique({
        where: { id: dto.orderId },
        include: { store: true },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      if (order.customerId !== customerId) {
        throw new ForbiddenException('You do not own this order');
      }

      // 2. Validate Order Status
      if (order.status !== OrderStatus.PENDING) {
        throw new BadRequestException(`Only pending orders can be paid. Current status: ${order.status}`);
      }

      // Check existing payment status
      const existingPayment = await tx.payment.findUnique({
        where: { orderId: dto.orderId },
      });
      if (existingPayment && existingPayment.status === PaymentStatus.SUCCESSFUL) {
        throw new BadRequestException('Order is already paid');
      }

      // 3. Simulate Payment Gateway Charge
      const isSuccess = dto.paymentMethodId !== 'pm_card_fail';
      const paymentStatus = isSuccess ? PaymentStatus.SUCCESSFUL : PaymentStatus.FAILED;
      const reference = isSuccess ? `ch_stripe_${Date.now()}` : `fail_stripe_${Date.now()}`;

      // 4. Create or Update Payment record
      const payment = await tx.payment.upsert({
        where: { orderId: dto.orderId },
        update: {
          status: paymentStatus,
          reference,
          amount: order.totalAmount,
        },
        create: {
          orderId: dto.orderId,
          amount: order.totalAmount,
          status: paymentStatus,
          provider: PaymentProvider.STRIPE,
          reference,
        },
      });

      if (isSuccess) {
        // A. Update Order status to PAID
        await tx.order.update({
          where: { id: dto.orderId },
          data: { status: OrderStatus.PAID },
        });

        // B. Credit Store Wallet
        const sellerId = order.store.sellerId;
        
        // Find or create wallet for seller
        let wallet = await tx.wallet.findUnique({
          where: { sellerId },
        });
        if (!wallet) {
          wallet = await tx.wallet.create({
            data: { sellerId, balance: 0 },
          });
        }

        // Increment balance
        const updatedWallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: {
              increment: order.totalAmount,
            },
          },
        });

        // C. Write Transaction ledger log
        await tx.transaction.create({
          data: {
            walletId: updatedWallet.id,
            amount: order.totalAmount,
            type: TransactionType.CREDIT,
            description: `Payout credit for order checkout ${order.id}`,
            reference,
          },
        });
      }

      return {
        payment,
        orderStatus: isSuccess ? OrderStatus.PAID : OrderStatus.PENDING,
      };
    });

    // Send notifications after transaction commits successfully
    if (result.orderStatus === OrderStatus.PAID) {
      try {
        const order = await this.prisma.order.findUnique({
          where: { id: dto.orderId },
          include: { customer: true, store: { include: { seller: true } } },
        });
        if (order) {
          // Notify Customer
          await this.notifications.createNotification(
            order.customer.userId,
            'Order Payment Successful',
            `Payment of ${order.totalAmount} for your order ${order.id} has been received.`,
            'ORDER_STATUS'
          );
          // Notify Seller
          if (order.store.seller?.userId) {
            await this.notifications.createNotification(
              order.store.seller.userId,
              'Order Paid',
              `Payment for order ${order.id} has been confirmed. Please prepare for shipment.`,
              'ORDER_STATUS'
            );
          }
        }
      } catch (err) {
        console.error('Failed to trigger payment success notifications:', err);
      }
    }

    return result;
  }

  async getPaymentDetails(userId: string, orderId: string) {
    const customerId = await this.getCustomerId(userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { customerId: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.customerId !== customerId) {
      throw new ForbiddenException('You do not own this order');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    });
    if (!payment) {
      throw new NotFoundException('No payment details found for this order');
    }

    return payment;
  }

  async refundOrder(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch Order and Payment
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { 
          items: true,
          store: true,
          payment: true,
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (!order.payment || order.payment.status !== PaymentStatus.SUCCESSFUL) {
        throw new BadRequestException('No successful payment found for this order');
      }

      // 2. Update Order to CANCELLED (represents Refunded/Cancelled)
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
      });

      // 3. Restore Product stock levels
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });
      }

      // 4. Debit Store Wallet
      const sellerId = order.store.sellerId;
      const wallet = await tx.wallet.findUnique({
        where: { sellerId },
      });

      if (wallet) {
        const updatedWallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: {
              decrement: order.totalAmount,
            },
          },
        });

        // Write Transaction ledger debit log
        await tx.transaction.create({
          data: {
            walletId: updatedWallet.id,
            amount: order.totalAmount,
            type: TransactionType.DEBIT,
            description: `Order refund debit for order ${order.id}`,
            reference: `ref_${order.payment.reference}`,
          },
        });
      }

      return {
        payment: order.payment,
        order: updatedOrder,
      };
    });
  }
}
