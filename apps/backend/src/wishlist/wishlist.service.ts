import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AddToWishlistDto } from './dto/wishlist.dto';

@Injectable()
export class WishlistService {
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

  async addToWishlist(userId: string, dto: AddToWishlistDto) {
    const customerId = await this.getCustomerId(userId);

    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    try {
      return await this.prisma.wishlist.create({
        data: {
          customerId,
          productId: dto.productId,
        },
        include: { product: true },
      });
    } catch (error) {
      // Handle PostgreSQL unique constraint violation P2002
      if (error.code === 'P2002') {
        // Return existing wishlist item gracefully
        return this.prisma.wishlist.findUnique({
          where: {
            customerId_productId: { customerId, productId: dto.productId },
          },
          include: { product: true },
        });
      }
      throw error;
    }
  }

  async removeFromWishlist(userId: string, productId: string) {
    const customerId = await this.getCustomerId(userId);

    const wishlistEntry = await this.prisma.wishlist.findUnique({
      where: {
        customerId_productId: { customerId, productId },
      },
    });
    if (!wishlistEntry) {
      throw new NotFoundException('Product is not in your wishlist');
    }

    return this.prisma.wishlist.delete({
      where: {
        customerId_productId: { customerId, productId },
      },
    });
  }

  async getWishlist(userId: string) {
    const customerId = await this.getCustomerId(userId);
    return this.prisma.wishlist.findMany({
      where: { customerId },
      include: {
        product: {
          include: {
            category: true,
            store: { select: { id: true, name: true, logoUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
