import test from 'node:test';
import assert from 'node:assert/strict';
import {canAdvanceQuiz, type AnswerFeedback} from '../src/client/quiz-feedback.js';

const feedback:AnswerFeedback={correct:true,correctText:'answer',attemptId:'attempt-1',submittedIndex:0,questionId:'question-1'};
test('answer ACK cannot expose the previous question before the next snapshot arrives',()=>{
  assert.equal(canAdvanceQuiz({attemptId:'attempt-1',index:0,completed:false},feedback),false);
  assert.equal(canAdvanceQuiz({attemptId:'attempt-1',index:1,completed:false},feedback),true);
});
test('a snapshot received before the answer ACK already permits the next question',()=>{
  assert.equal(canAdvanceQuiz({attemptId:'attempt-1',index:1,completed:false},feedback),true);
});
test('the tenth answer permits results only after the completed authoritative snapshot',()=>{
  const finalAnswer={...feedback,submittedIndex:9,questionId:'question-10'};
  assert.equal(canAdvanceQuiz({attemptId:'attempt-1',index:9,completed:false},finalAnswer),false);
  assert.equal(canAdvanceQuiz({attemptId:'attempt-1',index:10,completed:true},finalAnswer),true);
});
test('closed, absent, or replaced attempts cannot advance stale answer feedback',()=>{
  assert.equal(canAdvanceQuiz(null,feedback),false);
  assert.equal(canAdvanceQuiz({attemptId:'attempt-2',index:1,completed:false},feedback),false);
});
