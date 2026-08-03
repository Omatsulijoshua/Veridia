import { 
  Controller, 
  Get, 
  Req, 
  UseGuards 
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { UserRole } from '@veridia/types';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('admin/summary')
  @Roles(UserRole.ADMIN)
  async getAdminSummary() {
    return this.analyticsService.getAdminSummary();
  }

  @Get('seller/summary')
  @Roles(UserRole.SELLER)
  async getSellerSummary(@Req() req: any) {
    return this.analyticsService.getSellerSummary(req.user.id);
  }
}
