import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Delete, 
  Body, 
  Query, 
  Param, 
  Req, 
  UseGuards, 
  BadRequestException 
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { UserRole } from '@veridia/types';

@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  async createProduct(@Req() req: any, @Body() dto: CreateProductDto) {
    return this.productsService.createProduct(req.user.id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  async updateProduct(
    @Req() req: any,
    @Param('id') productId: string,
    @Body() dto: UpdateProductDto
  ) {
    return this.productsService.updateProduct(req.user.id, productId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  async deleteProduct(@Req() req: any, @Param('id') productId: string) {
    return this.productsService.deleteProduct(req.user.id, productId);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async approveProduct(
    @Param('id') productId: string,
    @Body('isApproved') isApproved: boolean
  ) {
    if (isApproved === undefined) {
      throw new BadRequestException('isApproved body key is required');
    }
    return this.productsService.approveProduct(productId, isApproved);
  }

  @Get()
  async listProducts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('categoryId') categoryId?: string,
    @Query('storeId') storeId?: string,
    @Query('search') search?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Req() req?: any // optional request context (in case of JWT presence to show unapproved items to owners)
  ) {
    // Determine sorting order safely
    const order = sortOrder === 'asc' ? 'asc' : 'desc';
    
    return this.productsService.listProducts({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      categoryId,
      storeId,
      search,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      sortBy,
      sortOrder: order,
    });
  }

  @Get(':idOrSlug')
  async getProduct(@Param('idOrSlug') idOrSlug: string) {
    return this.productsService.getProductByIdOrSlug(idOrSlug);
  }
}
