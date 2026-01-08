import { config } from 'dotenv';
import { resolve } from 'path';

// .env.local 파일 명시적으로 로드
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// JSON 파일 직접 읽기 (경로 문제 해결)
const casesDataPath = path.join(process.cwd(), 'src', 'data', 'cases.json');
const casesData = JSON.parse(fs.readFileSync(casesDataPath, 'utf-8'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 없습니다:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  console.error('\n💡 .env.local 파일 위치:', resolve(process.cwd(), '.env.local'));
  console.error('💡 파일 내용 확인:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL=...');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=...');
  throw new Error('Missing Supabase environment variables');
}

// 서비스 역할로 클라이언트 생성 (RLS 우회)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET_NAME = 'detective_puzzle_images';
const IMAGES_DIR = path.join(process.cwd(), 'public', 'images');

// 파일 확장자에 따른 Content-Type 결정
function getContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return contentTypes[ext] || 'image/jpeg';
}

async function uploadImages() {
  console.log('🚀 이미지 업로드 시작...\n');

  const updatedCases = casesData.cases.map((caseItem: any) => {
    const imagePath = caseItem.image.replace('/images/', '');
    const localFilePath = path.join(IMAGES_DIR, imagePath);

    if (!fs.existsSync(localFilePath)) {
      console.error(`❌ 파일을 찾을 수 없습니다: ${localFilePath}`);
      return caseItem;
    }

    // Storage에 업로드할 경로 (관리자용이므로 'admin' 폴더 사용)
    const storagePath = `admin/${imagePath}`;

    return { ...caseItem, localFilePath, storagePath };
  });

  const uploadResults: Array<{ caseId: number; oldPath: string; newUrl: string }> = [];

  for (const caseItem of updatedCases) {
    if (!caseItem.localFilePath) continue;

    try {
      const fileBuffer = fs.readFileSync(caseItem.localFilePath);
      const fileName = path.basename(caseItem.localFilePath);
      const contentType = getContentType(fileName);

      console.log(`📤 업로드 중: ${fileName}...`);

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(caseItem.storagePath, fileBuffer, {
          contentType,
          upsert: true,
        });

      if (error) {
        console.error(`❌ 업로드 실패: ${fileName}`, error);
        continue;
      }

      // Public URL 가져오기
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(caseItem.storagePath);

      const publicUrl = urlData.publicUrl;
      uploadResults.push({
        caseId: caseItem.id,
        oldPath: caseItem.image,
        newUrl: publicUrl,
      });

      console.log(`✅ 업로드 완료: ${fileName}`);
      console.log(`   URL: ${publicUrl}\n`);
    } catch (error) {
      console.error(`❌ 오류 발생: ${caseItem.image}`, error);
    }
  }

  // cases.json 업데이트
  console.log('\n📝 cases.json 업데이트 중...');
  const updatedCasesData = {
    cases: casesData.cases.map((caseItem: any) => {
      const result = uploadResults.find((r) => r.caseId === caseItem.id);
      if (result) {
        return {
          ...caseItem,
          image: result.newUrl,
        };
      }
      return caseItem;
    }),
  };

  const outputPath = path.join(process.cwd(), 'src', 'data', 'cases.json');
  fs.writeFileSync(outputPath, JSON.stringify(updatedCasesData, null, 2));
  console.log('✅ cases.json 업데이트 완료!\n');

  console.log('🎉 모든 작업 완료!');
  console.log(`\n총 ${uploadResults.length}개 이미지 업로드됨`);
}

uploadImages().catch(console.error);