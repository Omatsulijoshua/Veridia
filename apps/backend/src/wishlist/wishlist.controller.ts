import { 
  Controller, 
  Get, 
  Post, 
  Delete, 
  Body, 
  Param, 
  Req, 
  UseGuards 
} from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { AddToWishlistDto } from './dto/wishlist.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private wishlistService: WishlistService) {}

  @Post()
  async addToWishlist(@Req() req: any, @Body() dto: AddToWishlistDto) {
    return this.wishlistService.addToWishlist(req.user.id, dto);
  }

  @Delete(':productId')
  async removeFromWishlist(@Req() req: any, @Param('productId') productId: string) {
    return this.wishlistService.removeFromWishlist(req.user.id, productId);
  }

  @Get()
  async getWishlist(@Req() req: any) {
    return this.wishlistService.getWishlist(req.user.id);
  }
}
