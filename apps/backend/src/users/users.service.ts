import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { UpdateSellerProfileDto } from './dto/update-seller-profile.dto';
import { AddAddressDto, UpdateAddressDto } from './dto/address.dto';
import { v4 as uuidv4 } from 'uuid';

export interface SavedAddress {
  id: string;
  title: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  isDefault: boolean;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getCustomerProfile(userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      include: { user: { select: { email: true, role: true, isActive: true } } },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile not found');
    }
    return customer;
  }

  async updateCustomerProfile(userId: string, dto: UpdateCustomerProfileDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile not found');
    }

    return this.prisma.customer.update({
      where: { userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: dto.phoneNumber,
        avatarUrl: dto.avatarUrl,
      },
    });
  }

  async getAddresses(userId: string): Promise<SavedAddress[]> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      select: { addresses: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile not found');
    }
    return (customer.addresses as unknown as SavedAddress[]) || [];
  }

  async addAddress(userId: string, dto: AddAddressDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile not found');
    }

    let addresses = (customer.addresses as unknown as SavedAddress[]) || [];
    
    // Create new address object with UUID
    const newAddress: SavedAddress = {
      id: uuidv4(),
      title: dto.title,
      street: dto.street,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      postalCode: dto.postalCode,
      isDefault: dto.isDefault ?? false,
    };

    // Handle isDefault logic (only one address can be default)
    if (newAddress.isDefault) {
      addresses = addresses.map((addr) => ({ ...addr, isDefault: false }));
    } else if (addresses.length === 0) {
      // First address becomes default
      newAddress.isDefault = true;
    }

    addresses.push(newAddress);

    return this.prisma.customer.update({
      where: { userId },
      data: {
        addresses: addresses as any,
      },
      select: { addresses: true },
    });
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile not found');
    }

    let addresses = (customer.addresses as unknown as SavedAddress[]) || [];
    const addressIndex = addresses.findIndex((addr) => addr.id === addressId);
    if (addressIndex === -1) {
      throw new NotFoundException('Address not found');
    }

    const updatedAddress = {
      ...addresses[addressIndex],
      ...dto,
    } as SavedAddress;

    // Handle isDefault logic
    if (dto.isDefault) {
      addresses = addresses.map((addr) => ({ ...addr, isDefault: false }));
    }

    addresses[addressIndex] = updatedAddress;

    return this.prisma.customer.update({
      where: { userId },
      data: {
        addresses: addresses as any,
      },
      select: { addresses: true },
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile not found');
    }

    let addresses = (customer.addresses as unknown as SavedAddress[]) || [];
    const filteredAddresses = addresses.filter((addr) => addr.id !== addressId);

    // If we deleted the default address, and we still have other addresses, make the first one default
    const wasDefault = addresses.find((addr) => addr.id === addressId)?.isDefault;
    if (wasDefault && filteredAddresses.length > 0) {
      filteredAddresses[0].isDefault = true;
    }

    return this.prisma.customer.update({
      where: { userId },
      data: {
        addresses: filteredAddresses as any,
      },
      select: { addresses: true },
    });
  }

  async getSellerProfile(userId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      include: {
        store: true,
        wallet: true,
        user: { select: { email: true, role: true, isActive: true } },
      },
    });
    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }
    return seller;
  }

  async updateSellerProfile(userId: string, dto: UpdateSellerProfileDto) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      include: { store: true },
    });
    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }

    // Run updates sequentially or nested
    return this.prisma.$transaction(async (tx) => {
      // 1. Update Seller Profile Business info
      await tx.seller.update({
        where: { userId },
        data: {
          businessName: dto.businessName,
          phoneNumber: dto.phoneNumber,
        },
      });

      // 2. Update Store Details
      if (seller.store && (dto.storeName || dto.storeDescription || dto.storeLogoUrl || dto.storeBannerUrl)) {
        await tx.store.update({
          where: { sellerId: seller.id },
          data: {
            name: dto.storeName,
            description: dto.storeDescription,
            logoUrl: dto.storeLogoUrl,
            bannerUrl: dto.storeBannerUrl,
          },
        });
      }

      return tx.seller.findUnique({
        where: { userId },
        include: { store: true },
      });
    });
  }

  async toggleSellerVerification(sellerId: string, isVerified: boolean) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });
    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    return this.prisma.seller.update({
      where: { id: sellerId },
      data: { isVerified },
    });
  }
}
