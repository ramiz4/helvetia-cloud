import { PrismaClient, TermsVersion, UserTermsAcceptance } from 'database';
import { inject, injectable } from 'tsyringe';
import {
  AcceptTermsData,
  CreateTermsVersionData,
  ITermsRepository,
  UserTermsAcceptanceWithVersion,
} from '../interfaces/index.js';

/**
 * Prisma implementation of ITermsRepository
 */
@injectable()
export class PrismaTermsRepository implements ITermsRepository {
  constructor(@inject('PrismaClient') private prisma: PrismaClient) {}

  async findLatestVersion(language: string): Promise<TermsVersion | null> {
    return this.prisma.termsVersion.findFirst({
      where: { language },
      orderBy: { effectiveAt: 'desc' },
    });
  }

  async findByVersion(version: string, language: string): Promise<TermsVersion | null> {
    return this.prisma.termsVersion.findUnique({
      where: {
        version_language: {
          version,
          language,
        },
      },
    });
  }

  async findAllVersions(language: string): Promise<TermsVersion[]> {
    return this.prisma.termsVersion.findMany({
      where: { language },
      orderBy: { effectiveAt: 'desc' },
    });
  }

  async createVersion(data: CreateTermsVersionData): Promise<TermsVersion> {
    return this.prisma.termsVersion.create({
      data: {
        version: data.version,
        content: data.content,
        language: data.language,
        effectiveAt: data.effectiveAt,
      },
    });
  }

  async getUserAcceptance(
    userId: string,
    termsVersionId: string,
  ): Promise<UserTermsAcceptance | null> {
    return this.prisma.userTermsAcceptance.findUnique({
      where: {
        userId_termsVersionId: {
          userId,
          termsVersionId,
        },
      },
    });
  }

  async getUserLatestAcceptance(
    userId: string,
    language: string,
  ): Promise<UserTermsAcceptanceWithVersion | null> {
    return this.prisma.userTermsAcceptance.findFirst({
      where: {
        userId,
        termsVersion: {
          language,
        },
      },
      orderBy: {
        acceptedAt: 'desc',
      },
      include: {
        termsVersion: true,
      },
    });
  }

  async createAcceptance(data: AcceptTermsData): Promise<UserTermsAcceptance> {
    return this.prisma.userTermsAcceptance.create({
      data: {
        userId: data.userId,
        termsVersionId: data.termsVersionId,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
      },
    });
  }

  async hasUserAcceptedVersion(userId: string, termsVersionId: string): Promise<boolean> {
    const acceptance = await this.getUserAcceptance(userId, termsVersionId);
    return acceptance !== null;
  }
}
