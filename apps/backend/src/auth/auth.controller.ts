import { 
  Controller, 
  Post, 
  Body, 
  Req, 
  Res, 
  Get, 
  UseGuards, 
  UnauthorizedException 
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { CustomerSignupDto } from './dto/customer-signup.dto';
import { SellerSignupDto } from './dto/seller-signup.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './guards/roles.decorator';
import { UserRole } from '@veridia/types';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup/customer')
  async signupCustomer(@Body() dto: CustomerSignupDto) {
    return this.authService.signupCustomer(dto);
  }

  @Post('signup/seller')
  async signupSeller(@Body() dto: SellerSignupDto) {
    return this.authService.signupSeller(dto);
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.login(dto);
    
    // Set refreshToken cookie: secure, HttpOnly, SameSite=Lax
    response.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const token = request.cookies?.refreshToken;
    if (!token) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const result = await this.authService.refresh(token);

    response.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      accessToken: result.accessToken,
    };
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const token = request.cookies?.refreshToken;
    if (token) {
      await this.authService.logout(token);
    }
    response.clearCookie('refreshToken');
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: any) {
    return this.authService.validateUserById(req.user.id);
  }

  // Test routes for Role-Based Access Control verification
  @Get('test-seller')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  async testSellerRoute() {
    return { message: 'Success: Access granted to Seller route' };
  }

  @Get('test-admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async testAdminRoute() {
    return { message: 'Success: Access granted to Admin route' };
  }
}
