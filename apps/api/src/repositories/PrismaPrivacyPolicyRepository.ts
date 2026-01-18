import { PrismaClient, PrivacyPolicyVersion, UserPrivacyPolicyAcceptance } from 'database';
import { inject, injectable } from 'tsyringe';
import {
  AcceptPrivacyPolicyData,
  CreatePrivacyPolicyVersionData,
  IPrivacyPolicyRepository,
  UserPrivacyPolicyAcceptanceWithVersion,
} from '../interfaces';

/**
 * Prisma implementation of IPrivacyPolicyRepository
 */
@injectable()
export class PrismaPrivacyPolicyRepository implements IPrivacyPolicyRepository {
  constructor(@inject('PrismaClient') private prisma: PrismaClient) {}

  async findLatestVersion(language: string): Promise<PrivacyPolicyVersion | null> {
    return this.prisma.privacyPolicyVersion.findFirst({
      where: { language },
      orderBy: { effectiveAt: 'desc' },
    });
  }

  async findByVersion(version: string, language: string): Promise<PrivacyPolicyVersion | null> {
    return this.prisma.privacyPolicyVersion.findUnique({
      where: {
        version_language: {
          version,
          language,
        },
      },
    });
  }

  async findAllVersions(language: string): Promise<PrivacyPolicyVersion[]> {
    return this.prisma.privacyPolicyVersion.findMany({
      where: { language },
      orderBy: { effectiveAt: 'desc' },
    });
  }

  async createVersion(data: CreatePrivacyPolicyVersionData): Promise<PrivacyPolicyVersion> {
    return this.prisma.privacyPolicyVersion.create({
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
    privacyPolicyVersionId: string,
  ): Promise<UserPrivacyPolicyAcceptance | null> {
    return this.prisma.userPrivacyPolicyAcceptance.findUnique({
      where: {
        userId_privacyPolicyVersionId: {
          userId,
          privacyPolicyVersionId,
        },
      },
    });
  }

  async getUserLatestAcceptance(
    userId: string,
    language: string,
  ): Promise<UserPrivacyPolicyAcceptanceWithVersion | null> {
    return this.prisma.userPrivacyPolicyAcceptance.findFirst({
      where: {
        userId,
        privacyPolicy: {
          language,
        },
      },
      orderBy: {
        acceptedAt: 'desc',
      },
      include: {
        privacyPolicy: true,
      },
    });
  }

  async createAcceptance(data: AcceptPrivacyPolicyData): Promise<UserPrivacyPolicyAcceptance> {
    return this.prisma.userPrivacyPolicyAcceptance.create({
      data: {
        userId: data.userId,
        privacyPolicyVersionId: data.privacyPolicyVersionId,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
      },
    });
  }

  async hasUserAcceptedVersion(userId: string, privacyPolicyVersionId: string): Promise<boolean> {
    const acceptance = await this.getUserAcceptance(userId, privacyPolicyVersionId);
    return acceptance !== null;
  }
}
