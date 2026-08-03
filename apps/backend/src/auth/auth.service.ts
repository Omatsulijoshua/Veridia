import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../redis.service';
import { CustomerSignupDto } from './dto/customer-signup.dto';
import { SellerSignupDto } from './dto/seller-signup.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole, JwtPayload } from '@veridia/types';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private jwtService: JwtService,
  ) {}

  async signupCustomer(dto: CustomerSignupDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: UserRole.CUSTOMER,
        customerProfile: {
          create: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            phoneNumber: dto.phoneNumber,
          },
        },
      },
      include: {
        customerProfile: true,
      },
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.customerProfile?.firstName,
      lastName: user.customerProfile?.lastName,
    };
  }

  async signupSeller(dto: SellerSignupDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: UserRole.SELLER,
        sellerProfile: {
          create: {
            businessName: dto.businessName,
            phoneNumber: dto.phoneNumber,
            store: {
              create: {
                name: `${dto.businessName} Store`,
              },
            },
            wallet: {
              create: {
                balance: 0.0,
              },
            },
          },
        },
      },
      include: {
        sellerProfile: {
          include: {
            store: true,
            wallet: true,
          },
        },
      },
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      businessName: user.sellerProfile?.businessName,
      storeName: user.sellerProfile?.store?.name,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = uuidv4();

    // Store refresh token in Redis with 7-day expiration (604800 seconds)
    await this.redis.set(`refresh_token:${refreshToken}`, user.id, 604800);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role as UserRole,
      },
    };
  }

  async refresh(refreshToken: string) {
    const userId = await this.redis.get(`refresh_token:${refreshToken}`);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
    };

    const accessToken = this.jwtService.sign(payload);
    const newRefreshToken = uuidv4();

    // Remove old token and save new token in Redis
    await this.redis.del(`refresh_token:${refreshToken}`);
    await this.redis.set(`refresh_token:${newRefreshToken}`, user.id, 604800);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string) {
    await this.redis.del(`refresh_token:${refreshToken}`);
  }

  async validateUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        customerProfile: true,
        sellerProfile: {
          include: {
            store: true,
          },
        },
      },
    });
  }
}
