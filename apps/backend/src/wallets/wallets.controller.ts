import { 
  Controller, 
  Get, 
  Req, 
  UseGuards 
} from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { UserRole } from '@veridia/types';

@Controller('wallets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SELLER)
export class WalletsController {
  constructor(private walletsService: WalletsService) {}

  @Get('ledger')
  async getWalletLedger(@Req() req: any) {
    return this.walletsService.getWalletLedger(req.user.id);
  }
}
