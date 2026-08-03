import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AddToCartDto, UpdateCartItemDto, MergeCartDto } from './dto/cart.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

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

  private async getOrCreateCart(customerId: string) {
    let cart = await this.prisma.cart.findUnique({
      where: { customerId },
    });
    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { customerId },
      });
    }
    return cart;
  }

  async getCart(userId: string) {
    const customerId = await this.getCustomerId(userId);
    const cart = await this.getOrCreateCart(customerId);

    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
      include: {
        product: {
          include: {
            store: { select: { id: true, name: true, logoUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    let subtotal = new Prisma.Decimal(0);
    let discountTotal = new Prisma.Decimal(0);

    for (const item of items) {
      const price = new Prisma.Decimal(item.product.price);
      const qty = new Prisma.Decimal(item.quantity);
      subtotal = subtotal.add(price.mul(qty));

      if (item.product.compareAtPrice) {
        const comparePrice = new Prisma.Decimal(item.product.compareAtPrice);
        if (comparePrice.greaterThan(price)) {
          const discountDiff = comparePrice.sub(price);
          discountTotal = discountTotal.add(discountDiff.mul(qty));
        }
      }
    }

    return {
      id: cart.id,
      customerId: cart.customerId,
      items,
      subtotal: parseFloat(subtotal.toString()),
      discountTotal: parseFloat(discountTotal.toString()),
      total: parseFloat(subtotal.toString()),
    };
  }

  async addToCart(userId: string, dto: AddToCartDto) {
    const customerId = await this.getCustomerId(userId);
    const cart = await this.getOrCreateCart(customerId);

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product || !product.isApproved) {
      throw new NotFoundException('Product not found or not approved');
    }

    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: { cartId: cart.id, productId: dto.productId },
      },
    });

    const targetQuantity = existingItem 
      ? existingItem.quantity + dto.quantity 
      : dto.quantity;

    if (targetQuantity > product.stock) {
      throw new BadRequestException(`Requested quantity (${targetQuantity}) exceeds available stock (${product.stock})`);
    }

    if (existingItem) {
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: targetQuantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: dto.productId,
          quantity: dto.quantity,
        },
      });
    }

    return this.getCart(userId);
  }

  async updateCartItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const customerId = await this.getCustomerId(userId);

    const cartItem = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: {
        cart: true,
        product: true,
      },
    });
    if (!cartItem || cartItem.cart.customerId !== customerId) {
      throw new NotFoundException('Cart item not found');
    }

    if (dto.quantity > cartItem.product.stock) {
      throw new BadRequestException(`Requested quantity (${dto.quantity}) exceeds available stock (${cartItem.product.stock})`);
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
    });

    return this.getCart(userId);
  }

  async removeCartItem(userId: string, itemId: string) {
    const customerId = await this.getCustomerId(userId);

    const cartItem = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });
    if (!cartItem || cartItem.cart.customerId !== customerId) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });

    return this.getCart(userId);
  }

  async mergeCart(userId: string, dto: MergeCartDto) {
    const customerId = await this.getCustomerId(userId);
    const cart = await this.getOrCreateCart(customerId);

    for (const guestItem of dto.items) {
      const product = await this.prisma.product.findUnique({
        where: { id: guestItem.productId },
      });
      // Skip if product doesn't exist, is unapproved, or has no stock
      if (!product || !product.isApproved || product.stock <= 0) {
        continue;
      }

      const existingItem = await this.prisma.cartItem.findUnique({
        where: {
          cartId_productId: { cartId: cart.id, productId: guestItem.productId },
        },
      });

      // Sum quantities and cap to product stock limit
      let targetQty = guestItem.quantity;
      if (existingItem) {
        targetQty += existingItem.quantity;
      }
      if (targetQty > product.stock) {
        targetQty = product.stock;
      }

      if (existingItem) {
        await this.prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: targetQty },
        });
      } else {
        await this.prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId: guestItem.productId,
            quantity: targetQty,
          },
        });
      }
    }

    return this.getCart(userId);
  }
}
