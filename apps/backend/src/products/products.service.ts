import { 
  Injectable, 
  NotFoundException, 
  BadRequestException, 
  ForbiddenException 
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { Prisma } from '@prisma/client';
import { RedisService } from '../redis.service';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService
  ) {}

  // --- Slugify Helper ---
  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-') // Replace spaces with -
      .replace(/[^\w\-]+/g, '') // Remove all non-word chars
      .replace(/\-\-+/g, '-'); // Replace multiple - with single -
  }

  // --- Cache Invalidation Helper ---
  private async invalidateCache(productId?: string, productSlug?: string) {
    try {
      if (productId) {
        await this.redis.del(`products:detail:${productId}`);
      }
      if (productSlug) {
        await this.redis.del(`products:detail:${productSlug}`);
      }
      await this.redis.delPattern('products:list:*');
      console.log(`[Cache Invalidation] Cleared lists pattern and details for ID: ${productId}`);
    } catch (err) {
      console.error('Redis cache invalidation error:', err);
    }
  }

  // --- Category Methods ---

  async createCategory(dto: CreateCategoryDto) {
    const slug = this.slugify(dto.name);
    
    // Check uniqueness
    const existing = await this.prisma.category.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new BadRequestException('Category name/slug already exists');
    }

    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        parentId: dto.parentId,
      },
    });
  }

  async getCategoriesTree() {
    const allCategories = await this.prisma.category.findMany();
    
    // Build tree in memory
    const buildTree = (parentId: string | null): any[] => {
      return allCategories
        .filter((cat) => cat.parentId === parentId)
        .map((cat) => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          children: buildTree(cat.id),
        }));
    };

    return buildTree(null);
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const data: Prisma.CategoryUpdateInput = {
      description: dto.description,
    };

    if (dto.parentId !== undefined) {
      if (dto.parentId === null || dto.parentId === '') {
        data.parent = { disconnect: true };
      } else {
        data.parent = { connect: { id: dto.parentId } };
      }
    }

    if (dto.name) {
      data.name = dto.name;
      data.slug = this.slugify(dto.name);
    }

    return this.prisma.category.update({
      where: { id },
      data,
    });
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.prisma.category.delete({
      where: { id },
    });
  }

  // --- Product Methods ---

  async createProduct(sellerUserId: string, dto: CreateProductDto) {
    // 1. Fetch seller store, verify status
    const seller = await this.prisma.seller.findUnique({
      where: { userId: sellerUserId },
      include: { store: true },
    });
    if (!seller || !seller.store) {
      throw new NotFoundException('Seller store not found');
    }

    // Restrict product creation to verified stores
    if (!seller.isVerified) {
      throw new BadRequestException('Seller KYC status must be verified to create products');
    }

    const slug = this.slugify(dto.name) + '-' + Date.now().toString().slice(-6);

    const product = await this.prisma.product.create({
      data: {
        storeId: seller.store.id,
        categoryId: dto.categoryId,
        name: dto.name,
        slug,
        description: dto.description,
        price: new Prisma.Decimal(dto.price),
        compareAtPrice: dto.compareAtPrice ? new Prisma.Decimal(dto.compareAtPrice) : null,
        stock: dto.stock,
        images: dto.images || [],
        attributes: dto.attributes || {},
        isApproved: false, // default unapproved
        isActive: true,
      },
    });

    await this.invalidateCache();
    return product;
  }

  async updateProduct(sellerUserId: string, productId: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { store: { include: { seller: true } } },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Verify ownership
    if (product.store.seller.userId !== sellerUserId) {
      throw new ForbiddenException('You do not own this product');
    }

    const data: Prisma.ProductUpdateInput = {
      description: dto.description,
      stock: dto.stock,
      images: dto.images,
      attributes: dto.attributes,
    };

    if (dto.categoryId) {
      data.category = { connect: { id: dto.categoryId } };
    }

    if (dto.price !== undefined) {
      data.price = new Prisma.Decimal(dto.price);
    }

    if (dto.compareAtPrice !== undefined) {
      data.compareAtPrice = dto.compareAtPrice ? new Prisma.Decimal(dto.compareAtPrice) : null;
    }

    if (dto.name) {
      data.name = dto.name;
      data.slug = this.slugify(dto.name) + '-' + Date.now().toString().slice(-6);
    }

    const updatedProduct = await this.prisma.product.update({
      where: { id: productId },
      data,
    });

    await this.invalidateCache(productId, product.slug);
    if (updatedProduct.slug !== product.slug) {
      await this.invalidateCache(productId, updatedProduct.slug);
    }

    return updatedProduct;
  }

  async deleteProduct(sellerUserId: string, productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { store: { include: { seller: true } } },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Verify ownership
    if (product.store.seller.userId !== sellerUserId) {
      throw new ForbiddenException('You do not own this product');
    }

    const deletedProduct = await this.prisma.product.delete({
      where: { id: productId },
    });

    await this.invalidateCache(productId, product.slug);
    return deletedProduct;
  }

  async approveProduct(productId: string, isApproved: boolean) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const updatedProduct = await this.prisma.product.update({
      where: { id: productId },
      data: { isApproved },
    });

    await this.invalidateCache(productId, product.slug);
    return updatedProduct;
  }

  async getProductByIdOrSlug(idOrSlug: string) {
    const cacheKey = `products:detail:${idOrSlug}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.error('Redis cache get error:', err);
    }

    const product = await this.prisma.product.findFirst({
      where: {
        OR: [
          { id: idOrSlug },
          { slug: idOrSlug },
        ],
      },
      include: {
        category: true,
        store: true,
        reviews: {
          include: {
            customer: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const totalReviews = product.reviews.length;
    const averageRating = totalReviews > 0 
      ? Math.round((product.reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10) / 10
      : 0;

    const result = {
      ...product,
      averageRating,
      totalReviews,
    };

    try {
      const serialized = JSON.stringify(result);
      await this.redis.set(`products:detail:${product.id}`, serialized, 300);
      await this.redis.set(`products:detail:${product.slug}`, serialized, 300);
    } catch (err) {
      console.error('Redis cache set error:', err);
    }

    return result;
  }

  // Helper to recursively fetch child categories
  private async getCategoryIdsRecursive(categoryId: string): Promise<string[]> {
    const ids: string[] = [categoryId];
    const fetchChildren = async (parentId: string) => {
      const children = await this.prisma.category.findMany({
        where: { parentId },
        select: { id: true },
      });
      for (const child of children) {
        ids.push(child.id);
        await fetchChildren(child.id);
      }
    };
    await fetchChildren(categoryId);
    return ids;
  }

  async listProducts(query: {
    page?: number;
    limit?: number;
    categoryId?: string;
    storeId?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    includeUnapprovedForSellerId?: string;
  }) {
    const isPublicQuery = !query.includeUnapprovedForSellerId;
    const cacheKey = `products:list:${JSON.stringify(query)}`;

    if (isPublicQuery) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        console.error('Redis cache get error:', err);
      }
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    // 1. Category filter (including child categories)
    if (query.categoryId) {
      const categoryIds = await this.getCategoryIdsRecursive(query.categoryId);
      where.categoryId = { in: categoryIds };
    }

    // 2. Store filter
    if (query.storeId) {
      where.storeId = query.storeId;
    }

    // 3. Search filter
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // 4. Price range filter
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {};
      if (query.minPrice !== undefined) {
        where.price.gte = new Prisma.Decimal(query.minPrice);
      }
      if (query.maxPrice !== undefined) {
        where.price.lte = new Prisma.Decimal(query.maxPrice);
      }
    }

    // 5. Visibility constraints
    if (query.includeUnapprovedForSellerId) {
      where.OR = [
        { isApproved: true, isActive: true },
        {
          isApproved: false,
          store: { seller: { userId: query.includeUnapprovedForSellerId } },
        },
      ];
    } else {
      where.isApproved = true;
      where.isActive = true;
    }

    // 6. Sorting
    const orderBy: Prisma.ProductOrderByWithRelationInput = {};
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    if (sortBy === 'price') {
      orderBy.price = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          category: true,
          store: { select: { id: true, name: true, logoUrl: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const result = {
      products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    if (isPublicQuery) {
      try {
        await this.redis.set(cacheKey, JSON.stringify(result), 300);
      } catch (err) {
        console.error('Redis cache set error:', err);
      }
    }

    return result;
  }
}
