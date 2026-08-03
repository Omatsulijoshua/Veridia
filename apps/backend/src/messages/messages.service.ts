import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SendMessageDto } from './dto/message.dto';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async sendMessage(senderId: string, dto: SendMessageDto) {
    if (senderId === dto.receiverId) {
      throw new BadRequestException('You cannot message yourself');
    }

    const receiver = await this.prisma.user.findUnique({
      where: { id: dto.receiverId },
    });
    if (!receiver) {
      throw new NotFoundException('Receiver user not found');
    }

    const message = await this.prisma.message.create({
      data: {
        senderId,
        receiverId: dto.receiverId,
        content: dto.content,
      },
    });

    console.log(`[Realtime Dispatch Mock] Dispatching real-time message payload to user ${dto.receiverId} from sender ${senderId}`);
    return message;
  }

  async getThreads(userId: string) {
    const messages = await this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { id: true, email: true, role: true },
        },
        receiver: {
          select: { id: true, email: true, role: true },
        },
      },
    });

    const threadsMap = new Map<string, any>();
    for (const msg of messages) {
      const otherUser = msg.senderId === userId ? msg.receiver : msg.sender;
      if (!threadsMap.has(otherUser.id)) {
        threadsMap.set(otherUser.id, {
          contact: otherUser,
          lastMessage: {
            id: msg.id,
            content: msg.content,
            createdAt: msg.createdAt,
            senderId: msg.senderId,
          },
        });
      }
    }
    return Array.from(threadsMap.values());
  }

  async getThreadMessages(userId: string, otherUserId: string) {
    const otherUser = await this.prisma.user.findUnique({
      where: { id: otherUserId },
    });
    if (!otherUser) {
      throw new NotFoundException('Contact user not found');
    }

    return this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
