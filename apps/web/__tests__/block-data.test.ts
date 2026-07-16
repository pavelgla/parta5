import { describe, it, expect } from 'vitest';
import { TRPCError } from '@trpc/server';
import { parseBlockData } from '../server/schemas/block-data';

describe('parseBlockData', () => {
  it('parses valid data for the given type', () => {
    const result = parseBlockData('HEADING', { level: 2, text: 'Hello' });
    expect(result).toEqual({ level: 2, text: 'Hello' });
  });

  it('parses valid data for a type with an empty data shape', () => {
    const result = parseBlockData('DIVIDER', {});
    expect(result).toEqual({});
  });

  it('throws BAD_REQUEST when required fields are missing', () => {
    expect(() => parseBlockData('HEADING', { level: 2 })).toThrow(TRPCError);
    try {
      parseBlockData('HEADING', { level: 2 });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe('BAD_REQUEST');
    }
  });

  it('throws BAD_REQUEST when data does not match the schema for the given type', () => {
    expect(() => parseBlockData('CALLOUT', { variant: 'not-a-real-variant', text: 'x' })).toThrow(
      TRPCError,
    );
  });

  it('throws BAD_REQUEST for data shaped for a different block type', () => {
    expect(() => parseBlockData('LIST', { html: '<p>x</p>', text: 'x' })).toThrow(TRPCError);
  });

  it('parses valid data for QUIZ', () => {
    const quizId = '11111111-1111-4111-8111-111111111111';
    const result = parseBlockData('QUIZ', { quizId, title: 'Chapter 1 quiz' });
    expect(result).toEqual({ quizId, title: 'Chapter 1 quiz' });
  });

  it('throws BAD_REQUEST when QUIZ quizId is not a uuid', () => {
    expect(() => parseBlockData('QUIZ', { quizId: 'not-a-uuid', title: 'x' })).toThrow(TRPCError);
  });
});
