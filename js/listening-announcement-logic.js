// Listening - 공지사항 로직 (어댑터)
// AnnouncementComponent를 사용하는 어댑터
// v=007

console.log('✅ listening-announcement-logic.js 로드 시작 (AnnouncementComponent 어댑터)');

// 컴포넌트 인스턴스
let currentAnnouncementComponent = null;

async function initAnnouncementComponent(setId, onCompleteCallback) {
    console.log(`📦 [모듈] initAnnouncementComponent - setId: ${setId}`);
    currentAnnouncementComponent = new AnnouncementComponent(setId, {
        onComplete: (results) => {
            console.log(`✅ [모듈] Announcement Component 완료`);
            if (onCompleteCallback) onCompleteCallback(results);
        },
        onError: (error) => console.error(`❌ [모듈] Announcement Component 오류:`, error),
        onTimerStart: () => {
            console.log(`⏰ [모듈] Announcement 타이머 시작 (20초)`);
            if (window.moduleController) {
                window.moduleController.startQuestionTimer(20);
            }
        }
    });
    
    // 전역으로 노출 (ModuleController에서 접근)
    window.currentAnnouncementComponent = currentAnnouncementComponent;
    
    await currentAnnouncementComponent.init();
}

/**
 * 공지사항 초기화
 * Module에서 호출됨 (화면 전환 후)
 */
async function initListeningAnnouncement(setNumber = 1) {
    console.log(`[어댑터] initListeningAnnouncement 호출 - setNumber: ${setNumber}`);
    
    try {
        // AnnouncementComponent 생성
        currentAnnouncementComponent = new AnnouncementComponent(setNumber, function(resultData) {
            console.log('[어댑터] AnnouncementComponent 완료 콜백 호출됨');
            console.log('[어댑터] resultData:', resultData);
            
            // 결과 화면 표시
            showAnnouncementResults();
        });
        
        // 초기화
        await currentAnnouncementComponent.init();
        
    } catch (error) {
        console.error('[어댑터] initListeningAnnouncement 실패:', error);
        alert('공지사항 듣기를 시작할 수 없습니다.');
    }
}

/**
 * 제출 (Module에서 버튼 클릭 시 호출)
 */
function submitListeningAnnouncement() {
    console.log('[어댑터] submitListeningAnnouncement 호출됨');
    
    if (!currentAnnouncementComponent) {
        console.error('[어댑터] currentAnnouncementComponent가 없습니다');
        return;
    }
    
    // 컴포넌트의 submit() 호출
    currentAnnouncementComponent.submit();
}

/**
 * 다음 문제 - Component 어댑터
 */
function nextAnnouncementQuestion() {
    if (currentAnnouncementComponent) {
        const hasNext = currentAnnouncementComponent.nextQuestion();
        if (hasNext) {
            // 다음 문제 → 타이머 리셋 (20초)
            if (window.moduleController && window.moduleController.startQuestionTimer) {
                window.moduleController.startQuestionTimer(20);
            }
        } else {
            // 마지막 문제면 자동 제출
            submitListeningAnnouncement();
        }
    }
}

window.initAnnouncementComponent = initAnnouncementComponent;
window.initListeningAnnouncement = initListeningAnnouncement;
window.submitListeningAnnouncement = submitListeningAnnouncement;
window.nextAnnouncementQuestion = nextAnnouncementQuestion;

// ========================================
// 🎯 결과 화면 함수는 listening-announcement-result.js에서 관리
// (showAnnouncementResults, renderAnnouncementSetResult, renderAnnouncementScript,
//  renderAnnouncementAnswer, renderAnnouncementOptionsExplanation 등)
// ========================================

console.log('✅ listening-announcement-logic.js 로드 완료 (어댑터 전용 - 결과 함수는 listening-announcement-result.js로 이관)');
console.log('✅ initListeningAnnouncement 함수:', typeof initListeningAnnouncement);
console.log('✅ submitListeningAnnouncement 함수:', typeof submitListeningAnnouncement);
