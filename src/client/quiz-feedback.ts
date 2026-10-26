export interface AnswerFeedback {
  correct: boolean;
  correctText: string;
  attemptId: string;
  submittedIndex: number;
  questionId: string;
}

/** An answer ACK does not include the next question. Wait for its authoritative snapshot. */
export function canAdvanceQuiz(
  quiz: {attemptId: string; index: number; completed: boolean} | null | undefined,
  feedback: AnswerFeedback,
): boolean {
  return Boolean(quiz && quiz.attemptId === feedback.attemptId && quiz.index > feedback.submittedIndex);
}
