/**
 * Google Sheets 데이터를 JSON 파일로 변환하는 유틸리티
 * 
 * 사용법:
 * 1. 브라우저 콘솔에서 이 파일 로드
 * 2. exportAllToJSON() 실행
 * 3. 콘솔에 출력된 JSON을 복사해서 파일로 저장
 */

async function exportAllToJSON() {
    console.log('📦 데이터 변환 시작...\n');
    
    const exports = {};
    
    // 1. 빈칸채우기
    console.log('1️⃣ 빈칸채우기 변환 중...');
    try {
        const fillblanksData = await fetchFillBlanksFromSheet();
        exports.fillblanks = fillblanksData;
        console.log('✅ 빈칸채우기 완료:', fillblanksData.sets.length, '개 세트\n');
    } catch (e) {
        console.error('❌ 빈칸채우기 실패:', e);
    }
    
    // 2. 일상리딩1
    console.log('2️⃣ 일상리딩1 변환 중...');
    try {
        const daily1Data = await fetchDaily1FromSheet();
        exports.daily1 = daily1Data;
        console.log('✅ 일상리딩1 완료:', daily1Data.sets.length, '개 세트\n');
    } catch (e) {
        console.error('❌ 일상리딩1 실패:', e);
    }
    
    // 3. 일상리딩2
    console.log('3️⃣ 일상리딩2 변환 중...');
    try {
        const daily2Data = await fetchDaily2FromSheet();
        exports.daily2 = daily2Data;
        console.log('✅ 일상리딩2 완료:', daily2Data.sets.length, '개 세트\n');
    } catch (e) {
        console.error('❌ 일상리딩2 실패:', e);
    }
    
    // 4. 아카데믹리딩
    console.log('4️⃣ 아카데믹리딩 변환 중...');
    try {
        const academicData = await fetchAcademicFromSheet();
        exports.academic = academicData;
        console.log('✅ 아카데믹리딩 완료:', academicData.sets.length, '개 세트\n');
    } catch (e) {
        console.error('❌ 아카데믹리딩 실패:', e);
    }
    
    console.log('\n🎉 변환 완료!\n');
    console.log('📋 아래 JSON을 복사해서 파일로 저장하세요:\n');
    console.log('='.repeat(80));
    console.log(JSON.stringify(exports, null, 2));
    console.log('='.repeat(80));
    
    return exports;
}

// 개별 변환 함수들
async function exportFillblanks() {
    const data = await fetchFillBlanksFromSheet();
    console.log('fillblanks.json:');
    console.log(JSON.stringify(data, null, 2));
    return data;
}

async function exportDaily1() {
    const data = await fetchDaily1FromSheet();
    console.log('daily1.json:');
    console.log(JSON.stringify(data, null, 2));
    return data;
}

async function exportDaily2() {
    const data = await fetchDaily2FromSheet();
    console.log('daily2.json:');
    console.log(JSON.stringify(data, null, 2));
    return data;
}

async function exportAcademic() {
    const data = await fetchAcademicFromSheet();
    console.log('academic.json:');
    console.log(JSON.stringify(data, null, 2));
    return data;
}

console.log('✅ Export 스크립트 로드 완료!');
console.log('사용법:');
console.log('  - exportAllToJSON()     : 전체 변환');
console.log('  - exportFillblanks()    : 빈칸채우기만');
console.log('  - exportDaily1()        : 일상리딩1만');
console.log('  - exportDaily2()        : 일상리딩2만');
console.log('  - exportAcademic()      : 아카데믹리딩만');
