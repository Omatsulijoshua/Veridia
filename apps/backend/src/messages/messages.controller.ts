import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Req, 
  UseGuards 
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Post()
  async sendMessage(@Req() req: any, @Body() dto: SendMessageDto) {
    return this.messagesService.sendMessage(req.user.id, dto);
  }

  @Get('threads')
  async getThreads(@Req() req: any) {
    return this.messagesService.getThreads(req.user.id);
  }

  @Get('thread/:otherUserId')
  async getThreadMessages(@Req() req: any, @Param('otherUserId') otherUserId: string) {
    return this.messagesService.getThreadMessages(req.user.id, otherUserId);
  }
}
