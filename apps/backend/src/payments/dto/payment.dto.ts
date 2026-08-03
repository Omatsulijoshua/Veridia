import { IsNotEmpty, IsString } from 'class-validator';

export class ProcessPaymentDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  paymentMethodId: string;
}
