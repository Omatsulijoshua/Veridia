import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Delete, 
  Body, 
  Param, 
  Req, 
  UseGuards 
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto, UpdateCartItemDto, MergeCartDto } from './dto/cart.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { UserRole } from '@veridia/types';

@Controller('cart')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
export class CartController {
  constructor(private cartService: CartService) {}

  @Get()
  async getCart(@Req() req: any) {
    return this.cartService.getCart(req.user.id);
  }

  @Post()
  async addToCart(@Req() req: any, @Body() dto: AddToCartDto) {
    return this.cartService.addToCart(req.user.id, dto);
  }

  @Patch('items/:itemId')
  async updateCartItem(
    @Req() req: any, 
    @Param('itemId') itemId: string, 
    @Body() dto: UpdateCartItemDto
  ) {
    return this.cartService.updateCartItem(req.user.id, itemId, dto);
  }

  @Delete('items/:itemId')
  async removeCartItem(@Req() req: any, @Param('itemId') itemId: string) {
    return this.cartService.removeCartItem(req.user.id, itemId);
  }

  @Post('merge')
  async mergeCart(@Req() req: any, @Body() dto: MergeCartDto) {
    return this.cartService.mergeCart(req.user.id, dto);
  }
}
