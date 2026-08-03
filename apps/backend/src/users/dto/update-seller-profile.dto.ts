import { IsOptional, IsString } from 'class-validator';

export class UpdateSellerProfileDto {
  @IsString()
  @IsOptional()
  businessName?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  storeName?: string;

  @IsString()
  @IsOptional()
  storeDescription?: string;

  @IsString()
  @IsOptional()
  storeLogoUrl?: string;

  @IsString()
  @IsOptional()
  storeBannerUrl?: string;
}
