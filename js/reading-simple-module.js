/**
 * Reading Simple Module (단순 버전)
 * 컴포넌트는 사용하되 연결 로직을 최대한 단순하게
 */

console.log('✅ reading-simple-module.js 로드됨');

// 현재 진행 상태
let currentStep = 0;
const totalSteps = 4; // FillBlanks → Daily1 → Daily2 → Academic

// 각 단계별 컴포넌트 인스턴스
let fillBlanksComponent = null;
let daily1Component = null;
let daily2Component = null;
let academicComponent = null;

// 전체 답안 저장
let allAnswers = {
    fillblanks: null,
    daily1: null,
    daily2: null,
    academic: null
};

/**
 * 리딩 모듈 시작
 */
async function startReadingSimpleModule() {
    console.log('🚀 [Simple Module] 리딩 모듈 시작');
    
    currentStep = 0;
    
    // 1단계: FillBlanks 시작
    await startFillBlanks();
}

/**
 * 1단계: FillBlanks
 */
async function startFillBlanks() {
    console.log('📝 [Simple Module] 1/4 - FillBlanks 시작');
    
    // FillBlanks 컴포넌트 생성
    fillBlanksComponent = new window.FillBlanksComponent(1); // setNumber = 1
    
    // 완료 콜백 설정
    fillBlanksComponent.onComplete = (results) => {
        console.log('✅ [Simple Module] FillBlanks 완료');
        allAnswers.fillblanks = results;
        
        // 다음 단계로
        startDaily1();
    };
    
    // 초기화
    await fillBlanksComponent.init();
}

/**
 * 2단계: Daily1
 */
async function startDaily1() {
    console.log('📝 [Simple Module] 2/4 - Daily1 시작');
    
    // Daily1 컴포넌트 생성
    daily1Component = new window.Daily1Component(1); // setNumber = 1
    
    // 완료 콜백 설정
    daily1Component.onComplete = (results) => {
        console.log('✅ [Simple Module] Daily1 완료');
        allAnswers.daily1 = results;
        
        // 다음 단계로
        startDaily2();
    };
    
    // 초기화
    await daily1Component.init();
}

/**
 * 3단계: Daily2
 */
async function startDaily2() {
    console.log('📝 [Simple Module] 3/4 - Daily2 시작');
    
    // Daily2 컴포넌트 생성
    daily2Component = new window.Daily2Component(1); // setNumber = 1
    
    // 완료 콜백 설정
    daily2Component.onComplete = (results) => {
        console.log('✅ [Simple Module] Daily2 완료');
        allAnswers.daily2 = results;
        
        // 다음 단계로
        startAcademic();
    };
    
    // 초기화
    await daily2Component.init();
}

/**
 * 4단계: Academic
 */
async function startAcademic() {
    console.log('📝 [Simple Module] 4/4 - Academic 시작');
    
    // Academic 컴포넌트 생성
    academicComponent = new window.AcademicComponent(1); // setNumber = 1
    
    // 완료 콜백 설정
    academicComponent.onComplete = (results) => {
        console.log('✅ [Simple Module] Academic 완료');
        allAnswers.academic = results;
        
        // 전체 완료
        completeModule();
    };
    
    // 초기화
    await academicComponent.init();
}

/**
 * 모듈 완료 - 채점 화면
 */
function completeModule() {
    console.log('🎉 [Simple Module] 리딩 모듈 전체 완료');
    console.log('📊 전체 답안:', allAnswers);
    
    // 채점 결과 계산
    let totalCorrect = 0;
    let totalQuestions = 0;
    
    if (allAnswers.fillblanks) {
        totalCorrect += allAnswers.fillblanks.correctCount || 0;
        totalQuestions += allAnswers.fillblanks.totalQuestions || 0;
    }
    
    if (allAnswers.daily1) {
        totalCorrect += allAnswers.daily1.correctCount || 0;
        totalQuestions += allAnswers.daily1.totalQuestions || 0;
    }
    
    if (allAnswers.daily2) {
        totalCorrect += allAnswers.daily2.correctCount || 0;
        totalQuestions += allAnswers.daily2.totalQuestions || 0;
    }
    
    if (allAnswers.academic) {
        totalCorrect += allAnswers.academic.correctCount || 0;
        totalQuestions += allAnswers.academic.totalQuestions || 0;
    }
    
    const score = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    
    console.log(`📊 최종 점수: ${totalCorrect}/${totalQuestions} (${score}%)`);
    
    // 간단한 채점 화면 표시
    alert(`리딩 모듈 완료!\n\n정답: ${totalCorrect}/${totalQuestions}\n점수: ${score}%`);
    
    // 스케줄로 돌아가기
    if (typeof backToSchedule === 'function') {
        backToSchedule();
    }
}

// 전역으로 노출
window.startReadingSimpleModule = startReadingSimpleModule;

console.log('✅ reading-simple-module.js 로드 완료');
