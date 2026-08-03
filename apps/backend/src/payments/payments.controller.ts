import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Req, 
  UseGuards 
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { ProcessPaymentDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { UserRole } from '@veridia/types';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('charge')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  async chargeOrder(@Req() req: any, @Body() dto: ProcessPaymentDto) {
    return this.paymentsService.chargeOrder(req.user.id, dto);
  }

  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  async getPaymentDetails(@Req() req: any, @Param('orderId') orderId: string) {
    return this.paymentsService.getPaymentDetails(req.user.id, orderId);
  }

  @Post('order/:orderId/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async refundOrder(@Param('orderId') orderId: string) {
    return this.paymentsService.refundOrder(orderId);
  }
}
