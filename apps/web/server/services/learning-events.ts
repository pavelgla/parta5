import { prisma, Prisma } from '@parta5/db';

export type LogEventInput = {
  schoolId: string;
  actorId: string;
  verb: string;
  objectType: string;
  objectId: string;
  result?: Record<string, unknown>;
  context?: Record<string, unknown>;
};

export async function logEvent(input: LogEventInput): Promise<void> {
  try {
    await prisma.learningEvent.create({
      data: {
        ...input,
        result: input.result as Prisma.InputJsonValue | undefined,
        context: input.context as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (e) {
    // fire-and-forget: do not block main flow on analytics failure
    console.error('[learning-events] failed to log', {
      verb: input.verb,
      objectType: input.objectType,
      error: e,
    });
  }
}
