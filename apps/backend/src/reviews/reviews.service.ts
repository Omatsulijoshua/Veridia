import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewsService {
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

  async addReview(userId: string, dto: CreateReviewDto) {
    const customerId = await this.getCustomerId(userId);

    // 1. Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // 2. Enforce rating limits
    if (dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    try {
      return await this.prisma.review.create({
        data: {
          customerId,
          productId: dto.productId,
          rating: dto.rating,
          comment: dto.comment,
        },
        include: {
          customer: { select: { firstName: true, lastName: true, avatarUrl: true } },
        },
      });
    } catch (error) {
      // Handle PostgreSQL unique constraint violation P2002 (one review per customer+product)
      if (error.code === 'P2002') {
        throw new ConflictException('You have already reviewed this product');
      }
      throw error;
    }
  }

  async getProductReviews(productId: string) {
    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.review.findMany({
      where: { productId },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
