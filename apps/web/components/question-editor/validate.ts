import type { QuestionData } from './types';

export interface ValidationErrors {
  name?: string;
  prompt?: string;
  choices?: string;
  acceptedAnswers?: string;
}

export function validateQuestion(name: string, data: QuestionData): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!name.trim()) {
    errors.name = 'Введите название вопроса';
  }
  if (!data.prompt.trim()) {
    errors.prompt = 'Введите текст вопроса';
  }

  if (data.type === 'MULTICHOICE') {
    if (data.choices.length < 2) {
      errors.choices = 'Нужно минимум 2 варианта';
    } else if (data.choices.some((c) => !c.text.trim())) {
      errors.choices = 'Все варианты должны содержать текст';
    } else {
      const correctCount = data.choices.filter((c) => c.correct).length;
      if (correctCount < 1) {
        errors.choices = 'Отметьте хотя бы один верный вариант';
      } else if (data.single && correctCount > 1) {
        errors.choices = 'При одном правильном ответе можно отметить только один вариант';
      }
    }
  }

  if (data.type === 'SHORTANSWER') {
    const filled = data.acceptedAnswers.filter((a) => a.trim());
    if (filled.length < 1) {
      errors.acceptedAnswers = 'Нужен минимум один принимаемый ответ';
    }
  }

  return errors;
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.values(errors).some(Boolean);
}
