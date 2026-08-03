import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class WalletsService {
  constructor(private prisma: PrismaService) {}

  private async getSellerId(userId: string): Promise<string> {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!seller) {
      throw new NotFoundException('Seller profile not found');
    }
    return seller.id;
  }

  async getWalletLedger(userId: string) {
    const sellerId = await this.getSellerId(userId);

    const wallet = await this.prisma.wallet.findUnique({
      where: { sellerId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!wallet) {
      // Return empty wallet mock representation if seller doesn't have wallet yet
      return {
        balance: 0,
        transactions: [],
      };
    }

    return {
      id: wallet.id,
      balance: parseFloat(wallet.balance.toString()),
      transactions: wallet.transactions.map((tx) => ({
        id: tx.id,
        amount: parseFloat(tx.amount.toString()),
        type: tx.type,
        description: tx.description,
        reference: tx.reference,
        createdAt: tx.createdAt,
      })),
    };
  }
}
