import { config } from 'dotenv';
import { resolve } from 'path';

// .env.local 파일 명시적으로 로드
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const casesDataPath = path.join(process.cwd(), 'src', 'data', 'cases.json');
const casesData = JSON.parse(fs.readFileSync(casesDataPath, 'utf-8'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateCases() {
  console.log('🚀 케이스 데이터 마이그레이션 시작...\n');

  for (const caseItem of casesData.cases) {
    try {
      console.log(`📝 케이스 ${caseItem.id}: ${caseItem.title} 처리 중...`);

      // 1. 케이스 삽입
      const { data: caseData, error: caseError } = await supabase
        .from('detective_puzzle_cases')
        .insert({
          id: caseItem.id,
          title: caseItem.title,
          image_url: caseItem.image,
          status: 'approved',
        })
        .select()
        .single();

      if (caseError) {
        // 이미 존재하는 경우 업데이트
        if (caseError.code === '23505') {
          console.log(`   ⚠️  케이스 ${caseItem.id} 이미 존재함. 업데이트 중...`);
          const { data: updatedCase } = await supabase
            .from('detective_puzzle_cases')
            .update({
              title: caseItem.title,
              image_url: caseItem.image,
            })
            .eq('id', caseItem.id)
            .select()
            .single();
          console.log(`   ✅ 케이스 업데이트 완료`);
        } else {
          console.error(`   ❌ 케이스 삽입 실패:`, caseError);
          continue;
        }
      } else {
        console.log(`   ✅ 케이스 삽입 완료`);
      }

      // 2. 질문들 삽입
      for (let i = 0; i < caseItem.questions.length; i++) {
        const question = caseItem.questions[i];
        const questionNumber = i + 1;

        const { data: questionData, error: questionError } = await supabase
          .from('detective_puzzle_questions')
          .insert({
            case_id: caseItem.id,
            question_number: questionNumber,
            text: question.text,
            explanation: question.explanation,
          })
          .select()
          .single();

        if (questionError) {
          if (questionError.code === '23505') {
            // 이미 존재하는 경우 업데이트
            const { data: updatedQuestion } = await supabase
              .from('detective_puzzle_questions')
              .update({
                text: question.text,
                explanation: question.explanation,
              })
              .eq('case_id', caseItem.id)
              .eq('question_number', questionNumber)
              .select()
              .single();
            
            if (updatedQuestion) {
              // 정답 영역 삽입
              await insertAnswerRegions(updatedQuestion.id, question.answerRegions);
            }
          } else {
            console.error(`   ❌ 질문 ${questionNumber} 삽입 실패:`, questionError);
            continue;
          }
        } else {
          console.log(`   ✅ 질문 ${questionNumber} 삽입 완료`);
          
          // 3. 정답 영역들 삽입
          await insertAnswerRegions(questionData.id, question.answerRegions);
        }
      }

      console.log(`✅ 케이스 ${caseItem.id} 완료!\n`);
    } catch (error) {
      console.error(`❌ 케이스 ${caseItem.id} 처리 중 오류:`, error);
    }
  }

  console.log('🎉 모든 케이스 마이그레이션 완료!');
}

async function insertAnswerRegions(questionId: number, answerRegions: any[]) {
  // 기존 정답 영역 삭제
  await supabase
    .from('detective_puzzle_answer_regions')
    .delete()
    .eq('question_id', questionId);

  // 새 정답 영역 삽입
  const regionsToInsert = answerRegions.map((region) => ({
    question_id: questionId,
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
    description: region.description,
  }));

  const { error: regionsError } = await supabase
    .from('detective_puzzle_answer_regions')
    .insert(regionsToInsert);

  if (regionsError) {
    console.error(`   ❌ 정답 영역 삽입 실패:`, regionsError);
  } else {
    console.log(`   ✅ 정답 영역 ${answerRegions.length}개 삽입 완료`);
  }
}

migrateCases().catch(console.error);