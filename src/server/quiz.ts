import { randomUUID } from 'node:crypto';
import { shuffle } from '../shared/random.js';
import type { PublicQuiz } from '../shared/types.js';
export interface Question { id: string; text: string; answers: string[] }
export interface QuizItem { questionId: string; id: string; text: string; options: { id: string; text: string }[]; correctOptionId: string }
export interface QuizAttempt { attemptId: string; kind: 'OPENING' | 'BATTLE'; items: QuizItem[]; index: number; completed: boolean; lastAnswer: PublicQuiz['lastAnswer'] }
const pairs = [
  ['be in charge of','~을 담당하다'],['calm','진정시키다'],['environment','환경'],['opportunity','기회'],['prepare','준비하다'],['protect','보호하다'],['discover','발견하다'],['improve','향상시키다'],['remember','기억하다'],['difference','차이'],
  ['honest','정직한'],['patient','참을성 있는'],['healthy','건강한'],['careful','조심스러운'],['dangerous','위험한'],['important','중요한'],['possible','가능한'],['beautiful','아름다운'],['comfortable','편안한'],['curious','호기심 많은'],
  ['I am looking for my book.','나는 내 책을 찾고 있다.'],['She takes care of her dog.','그녀는 개를 돌본다.'],['We should save water.','우리는 물을 아껴야 한다.'],['He is good at swimming.','그는 수영을 잘한다.'],['Please turn off the light.','불을 꺼 주세요.'],['The train is on time.','기차는 정시에 온다.'],['I agree with you.','나는 네 의견에 동의한다.'],['Let us work together.','함께 일하자.'],['You can do it.','너는 할 수 있다.'],['It is raining outside.','밖에 비가 오고 있다.'],
  ['borrow','빌리다'],['return','돌려주다'],['invite','초대하다'],['explain','설명하다'],['believe','믿다'],['choose','선택하다'],['practice','연습하다'],['understand','이해하다'],['promise','약속하다'],['travel','여행하다'],['library','도서관'],['neighbor','이웃'],['future','미래'],['journey','여정'],['knowledge','지식'],['courage','용기'],['effort','노력'],['success','성공'],['reason','이유'],['habit','습관']
];
export const DEFAULT_BANK: Question[] = pairs.map(([text, answer], i) => ({ id: `default-${i + 1}`, text, answers: [answer, ...[1, 3, 7].map(n => pairs[(i + n) % pairs.length][1])] }));
export function parseQuizBank(text: string): Question[] {
  const errors: string[] = [], result: Question[] = [];
  text.replace(/^\uFEFF/, '').split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const fields = line.split('|').map(s => s.trim());
    if (fields.length !== 5 || fields.some(s => !s)) errors.push(`${i + 1}행: 문제와 보기 4개, 총 5칸이 필요합니다.`);
    else if (fields[0].length > 200 || fields.slice(1).some(s => s.length > 80)) errors.push(`${i + 1}행: 문제 200자·보기 80자 제한을 확인하세요.`);
    else if (new Set(fields.slice(1)).size !== 4) errors.push(`${i + 1}행: 중복된 보기가 있습니다.`);
    else result.push({ id: `custom-${i + 1}`, text: fields[0], answers: fields.slice(1) });
  });
  if (result.length < 20 || result.length > 1000) errors.push('문제를 20~1000개 입력하세요.');
  if (errors.length) throw new Error(errors.join('\n'));
  return result;
}
export function newAttempt(bank: Question[], kind: 'OPENING' | 'BATTLE', seen: string[], random: () => number): QuizAttempt {
  const count = kind === 'OPENING' ? 20 : 10;
  const candidates = [...shuffle(bank.filter(q => !seen.includes(q.id)), random), ...shuffle(bank.filter(q => seen.includes(q.id)), random)];
  const selected = candidates.slice(0, count);
  if (seen.length + count >= bank.length) seen.splice(0);
  seen.push(...selected.map(q => q.id));
  return { attemptId: `quiz-${randomUUID()}`, kind, index: 0, completed: false, lastAnswer: null, items: selected.map(q => {
    const options = q.answers.map((text, i) => ({ id: `option-${randomUUID()}`, text, correct: i === 0 }));
    return { questionId: q.id, id: `question-${randomUUID()}`, text: q.text, correctOptionId: options[0].id, options: shuffle(options, random).map(({id,text})=>({id,text})) };
  }) };
}
export function publicQuiz(a: QuizAttempt | null): PublicQuiz | null {
  if (!a) return null;
  const q = a.items[a.index];
  return { attemptId: a.attemptId, kind: a.kind, index: a.index, total: a.items.length, completed: a.completed, lastAnswer: a.lastAnswer, question: !a.completed && q ? {id:q.id,text:q.text,options:q.options} : null };
}
export function simulatedOption(item: QuizItem, correct: boolean, random: () => number): string {
  const options = item.options.filter(o => correct ? o.id === item.correctOptionId : o.id !== item.correctOptionId);
  return options[Math.floor(random() * options.length)].id;
}
