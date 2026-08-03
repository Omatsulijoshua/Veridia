import { 
  Controller, 
  Get, 
  Patch, 
  Post, 
  Delete, 
  Body, 
  Req, 
  Param, 
  UseGuards, 
  UseInterceptors, 
  UploadedFile, 
  BadRequestException 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { UserRole } from '@veridia/types';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { UpdateSellerProfileDto } from './dto/update-seller-profile.dto';
import { AddAddressDto, UpdateAddressDto } from './dto/address.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  // --- Customer Endpoints ---

  @Get('customer/profile')
  async getCustomerProfile(@Req() req: any) {
    return this.usersService.getCustomerProfile(req.user.id);
  }

  @Patch('customer/profile')
  async updateCustomerProfile(
    @Req() req: any,
    @Body() dto: UpdateCustomerProfileDto
  ) {
    return this.usersService.updateCustomerProfile(req.user.id, dto);
  }

  @Get('customer/addresses')
  async getAddresses(@Req() req: any) {
    return this.usersService.getAddresses(req.user.id);
  }

  @Post('customer/addresses')
  async addAddress(
    @Req() req: any,
    @Body() dto: AddAddressDto
  ) {
    return this.usersService.addAddress(req.user.id, dto);
  }

  @Patch('customer/addresses/:id')
  async updateAddress(
    @Req() req: any,
    @Param('id') addressId: string,
    @Body() dto: UpdateAddressDto
  ) {
    return this.usersService.updateAddress(req.user.id, addressId, dto);
  }

  @Delete('customer/addresses/:id')
  async deleteAddress(
    @Req() req: any,
    @Param('id') addressId: string
  ) {
    return this.usersService.deleteAddress(req.user.id, addressId);
  }

  // --- Seller Endpoints ---

  @Get('seller/profile')
  async getSellerProfile(@Req() req: any) {
    return this.usersService.getSellerProfile(req.user.id);
  }

  @Patch('seller/profile')
  async updateSellerProfile(
    @Req() req: any,
    @Body() dto: UpdateSellerProfileDto
  ) {
    return this.usersService.updateSellerProfile(req.user.id, dto);
  }

  @Post('seller/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: any) {
    const filename = file?.originalname || `upload_${Date.now()}.png`;
    return {
      url: `https://s3.veridia.com/uploads/${Date.now()}_${filename}`,
      originalName: filename,
      sizeBytes: file?.size || 2048,
    };
  }

  // --- Admin Endpoints ---

  @Patch('sellers/:id/verify')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async verifySeller(
    @Param('id') sellerId: string,
    @Body('isVerified') isVerified: boolean
  ) {
    if (isVerified === undefined) {
      throw new BadRequestException('isVerified parameter is required in request body');
    }
    return this.usersService.toggleSellerVerification(sellerId, isVerified);
  }
}
