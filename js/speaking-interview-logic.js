// ================================================
// Speaking - 인터뷰 어댑터 (v=20250212-001)
// ================================================
// Module 책임: 화면 전환, 진행률, 초기화 시 화면 설정, 채점 완료 후 이동

// ============================================
// 전역 컴포넌트 인스턴스
// ============================================
let currentInterviewComponent = null;

// ============================================
// 테스트 함수: 인터뷰 채점 화면 바로 보기
// ============================================
async function testInterviewResultScreen() {
    console.log('🧪 [테스트] 인터뷰 채점 화면 테스트 시작');
    
    // 컴포넌트 생성
    currentInterviewComponent = new InterviewComponent();
    window.currentInterviewComponent = currentInterviewComponent;
    
    // 데이터 로드
    await currentInterviewComponent.loadInterviewData();
    
    // 모든 화면 숨기기
    document.querySelectorAll('.screen').forEach(screen => {
        screen.style.display = 'none';
    });
    
    // 채점 화면 표시
    const interviewResultScreen = document.getElementById('speakingInterviewResultScreen');
    interviewResultScreen.style.display = 'block';
    
    // 첫 번째 세트의 데이터로 채점 화면 표시
    const set = currentInterviewComponent.speakingInterviewData.sets[0];
    currentInterviewComponent.showInterviewResult({ set: set });
    
    console.log('✅ [테스트] 인터뷰 채점 화면 표시 완료');
}

// ============================================
// 모듈 시스템용 초기화
// ============================================
async function initInterviewComponent(setId, onCompleteCallback) {
    console.log(`📦 [모듈] initInterviewComponent - setId: ${setId}`);
    currentInterviewComponent = new InterviewComponent();
    window.currentInterviewComponent = currentInterviewComponent;
    
    currentInterviewComponent.onComplete = function(results) {
        console.log(`✅ [모듈] Interview Component 완료`);
        if (onCompleteCallback) onCompleteCallback(results);
    };
    
    await currentInterviewComponent.init(setId);
}

// ============================================
// 초기화
// ============================================
async function initSpeakingInterview() {
    console.log('🎤 [Interview] 초기화 시작...');
    
    // 컴포넌트 생성
    currentInterviewComponent = new InterviewComponent();
    window.currentInterviewComponent = currentInterviewComponent;
    
    // 데이터 로드
    await currentInterviewComponent.loadInterviewData();
    
    // 화면 전환 (Module 책임)
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none';
    });
    
    const interviewScreen = document.getElementById('speakingInterviewScreen');
    interviewScreen.classList.add('active');
    interviewScreen.style.display = 'block';
    
    console.log('speakingInterviewScreen 표시 완료');
    
    // 인트로 화면 표시 (Component 책임)
    currentInterviewComponent.showInterviewIntroScreen();
    
    // 볼륨 슬라이더 외부 클릭 이벤트 등록
    currentInterviewComponent.setupVolumeSliderCloseOnOutsideClick();
    
    console.log('✅ [Interview] 초기화 완료');
}

// ============================================
// 완료 (Module 책임: 화면 전환)
// ============================================
function completeSpeakingInterview() {
    console.log('📤 [Interview Module] 완료 시작...');
    
    if (!currentInterviewComponent) {
        console.error('❌ 컴포넌트가 초기화되지 않았습니다.');
        return;
    }
    
    // 컴포넌트 완료 실행
    const resultData = currentInterviewComponent.completeSpeakingInterview();
    
    // 화면 전환 (Module 책임)
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none';
    });
    
    const resultScreen = document.getElementById('speakingInterviewResultScreen');
    if (resultScreen) {
        resultScreen.classList.add('active');
        resultScreen.style.display = 'block';
        
        // 채점 화면 표시 (Component 책임)
        currentInterviewComponent.showInterviewResult(resultData);
    }
    
    console.log('✅ [Interview Module] 완료');
}

// ============================================
// 채점 완료 (Module 책임: backToSchedule 호출)
// ============================================
function backToScheduleFromInterviewResult() {
    console.log('✅ [채점 화면] 채점 완료');
    
    if (!currentInterviewComponent) {
        console.error('❌ 컴포넌트가 초기화되지 않았습니다.');
        return;
    }
    
    // 컴포넌트 채점 완료 실행
    const completed = currentInterviewComponent.completeInterviewResult();
    
    if (completed) {
        // 학습 일정으로 돌아가기 (Module 책임)
        document.getElementById('speakingInterviewResultScreen').style.display = 'none';
        document.getElementById('scheduleScreen').style.display = 'block';
        document.getElementById('scheduleScreen').classList.add('active');
    }
}

// ============================================
// 볼륨 조절 어댑터 함수
// ============================================
function toggleVolumeSlider() {
    if (currentInterviewComponent) {
        currentInterviewComponent.toggleVolumeSlider();
    }
}

function updateInterviewVolume(value) {
    if (currentInterviewComponent) {
        currentInterviewComponent.updateInterviewVolume(value);
    }
}

// ============================================
// Cleanup (Module 책임: 화면 전환 시 호출)
// ============================================
function cleanupSpeakingInterview() {
    console.log('🧹 [Interview Module] Cleanup...');
    
    if (currentInterviewComponent) {
        currentInterviewComponent.cleanup();
        currentInterviewComponent = null;
        window.currentInterviewComponent = null;
    }
}

window.initInterviewComponent = initInterviewComponent;
window.initSpeakingInterview = initSpeakingInterview;
window.completeSpeakingInterview = completeSpeakingInterview;
window.backToScheduleFromInterviewResult = backToScheduleFromInterviewResult;
window.toggleVolumeSlider = toggleVolumeSlider;
window.updateInterviewVolume = updateInterviewVolume;
window.cleanupSpeakingInterview = cleanupSpeakingInterview;

console.log('✅ Speaking-Interview 어댑터 로드 완료 (v=20250212-001)');
