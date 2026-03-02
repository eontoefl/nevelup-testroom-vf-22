// Listening - 렉쳐 로직 (어댑터)
// LectureComponent를 사용하는 어댑터
// v=006

console.log('✅ listening-lecture-logic.js 로드 시작 (LectureComponent 어댑터)');

// 컴포넌트 인스턴스
let currentLectureComponent = null;

async function initLectureComponent(setId, onCompleteCallback) {
    console.log(`📦 [모듈] initLectureComponent - setId: ${setId}`);
    currentLectureComponent = new LectureComponent(setId, {
        onComplete: (results) => {
            console.log(`✅ [모듈] Lecture Component 완료`);
            if (onCompleteCallback) onCompleteCallback(results);
        },
        onError: (error) => console.error(`❌ [모듈] Lecture Component 오류:`, error),
        onTimerStart: () => {
            console.log(`⏰ [모듈] Lecture 타이머 시작 (30초)`);
            if (window.moduleController) {
                window.moduleController.startQuestionTimer(30);
            }
        }
    });
    
    // 전역으로 노출 (ModuleController에서 접근)
    window.currentLectureComponent = currentLectureComponent;
    
    await currentLectureComponent.init();
}

/**
 * 렉쳐 초기화
 * Module에서 호출됨 (화면 전환 후)
 */
async function initListeningLecture(setNumber = 1) {
    console.log(`[어댑터] initListeningLecture 호출 - setNumber: ${setNumber}`);
    
    try {
        // LectureComponent 생성
        currentLectureComponent = new LectureComponent(setNumber, function(resultData) {
            console.log('[어댑터] LectureComponent 완료 콜백 호출됨');
            console.log('[어댑터] resultData:', resultData);
            
            // 결과 화면 표시
            showLectureResults();
        });
        
        // 초기화
        await currentLectureComponent.init();
        
    } catch (error) {
        console.error('[어댑터] initListeningLecture 실패:', error);
        alert('렉쳐 듣기를 시작할 수 없습니다.');
    }
}

/**
 * 제출 (Module에서 버튼 클릭 시 호출)
 */
function submitListeningLecture() {
    console.log('[어댑터] submitListeningLecture 호출됨');
    
    if (!currentLectureComponent) {
        console.error('[어댑터] currentLectureComponent가 없습니다');
        return;
    }
    
    // 컴포넌트의 submit() 호출
    currentLectureComponent.submit();
}

/**
 * 다음 문제 - Component 어댑터
 */
function nextLectureQuestion() {
    if (currentLectureComponent) {
        const hasNext = currentLectureComponent.nextQuestion();
        if (hasNext) {
            // 다음 문제 → 타이머 리셋 (30초 - 렉쳐는 30초)
            if (window.moduleController && window.moduleController.startQuestionTimer) {
                window.moduleController.startQuestionTimer(30);
            }
        } else {
            // 마지막 문제면 자동 제출
            submitListeningLecture();
        }
    }
}

window.initLectureComponent = initLectureComponent;
window.initListeningLecture = initListeningLecture;
window.submitListeningLecture = submitListeningLecture;
window.nextLectureQuestion = nextLectureQuestion;

// ========================================
// 🎯 결과 화면 함수는 listening-lecture-logic-fixed.js에서 관리
// (showLectureResults, renderLectureSetResult, renderLectureScript,
//  renderLectureAnswer, renderLectureOptionsExplanation 등)
// ========================================

console.log('✅ listening-lecture-logic.js 로드 완료 (LectureComponent 어댑터)');
console.log('✅ initListeningLecture 함수:', typeof initListeningLecture);
console.log('✅ submitListeningLecture 함수:', typeof submitListeningLecture);
