/**
 * ================================================
 * stage-selector.js (V2 플로우)
 * 과제 버튼 클릭 → 4개 단계 선택 화면 표시
 * ================================================
 * 
 * 기존 FlowController를 대체.
 * 1차풀이 / 2차풀이 / 채점결과 / 해설보기를 독립 버튼으로 분리.
 */

const StageSelector = {
    // 현재 선택된 과제 정보
    sectionType: null,   // 'reading', 'listening', 'writing', 'speaking'
    moduleNumber: null,  // 1, 2, 3, ...

    /**
     * 단계 선택 화면 표시
     * task-router.js에서 호출됨
     */
    async show(sectionType, moduleNumber) {
        // 1. 메모리 초기화
        this.sectionType = sectionType;
        this.moduleNumber = moduleNumber;
        this.firstAttemptResult = null;
        this.secondAttemptResult = null;

        // 2. UI 초기화 (화면을 빈 상태로 리셋)
        this._resetUI(sectionType, moduleNumber);

        // 3. DB에서 해당 모듈 데이터 읽기 → 있으면 채우기
        await this._loadFromDB();

        console.log(`✅ [StageSelector] ${sectionType} Module ${moduleNumber} 준비 완료`);
    },

    _resetUI(sectionType, moduleNumber) {
        // 제목
        var sectionLabel = { 'reading': '리딩', 'listening': '리스닝', 'writing': '라이팅', 'speaking': '스피킹' }[sectionType] || sectionType;
        var title = sectionLabel + ' 모듈 ' + moduleNumber;

        var titleEl = document.getElementById('stageSelectTitle');
        if (titleEl) titleEl.textContent = title;
        var moduleTitleEl = document.getElementById('stageModuleTitle');
        if (moduleTitleEl) moduleTitleEl.textContent = title;

        // 화면 전환
        document.querySelectorAll('.screen').forEach(function(s) { s.style.display = 'none'; });
        var screen = document.getElementById('stageSelectScreen');
        if (screen) screen.style.display = 'block';

        // 대시보드 점수/레벨 비우기
        ['1st', '2nd'].forEach(function(suffix) {
            var scoreEl = document.getElementById('stageScore' + suffix);
            if (scoreEl) scoreEl.innerHTML = '-';
            var levelEl = document.getElementById('stageLevel' + suffix);
            if (levelEl) levelEl.textContent = '-';
            var detailEl = document.getElementById('stageDetail' + suffix);
            if (detailEl) detailEl.innerHTML = '';
        });

        // 완료 상태 비우기
        var status1st = document.getElementById('stage1stStatus');
        if (status1st) { status1st.textContent = '미완료'; status1st.classList.remove('stage-status-done'); }
        var status2nd = document.getElementById('stage2ndStatus');
        if (status2nd) { status2nd.textContent = '미완료'; status2nd.classList.remove('stage-status-done'); }
    },

    async _loadFromDB() {
        if (!window.StudySave) return;

        var saved = await StudySave.loadSavedResults();
        if (!saved) return;

        // 1차 결과
        if (saved.firstResult) {
            this.firstAttemptResult = saved.firstResult;
            updateStageDashboard(saved.firstResult, '1st');
            var status1st = document.getElementById('stage1stStatus');
            if (status1st) { status1st.textContent = '✅ 완료'; status1st.classList.add('stage-status-done'); }
        }

        // 2차 결과
        if (saved.secondResult) {
            this.secondAttemptResult = saved.secondResult;
            updateStageDashboard(saved.secondResult, '2nd');
            var status2nd = document.getElementById('stage2ndStatus');
            if (status2nd) { status2nd.textContent = '✅ 완료'; status2nd.classList.add('stage-status-done'); }
        }
    }
};

// ========================================
// 4개 버튼 핸들러
// ========================================

function startFirstAttemptV2() {
    const sectionType = StageSelector.sectionType;
    const moduleNumber = StageSelector.moduleNumber;
    
    console.log('📝 [V2] 1차 풀이 시작:', sectionType, 'Module', moduleNumber);
    
    // 1. 모듈 설정 가져오기
    const moduleConfig = getModule(sectionType, moduleNumber);
    if (!moduleConfig) {
        console.error('❌ [V2] 모듈 설정을 찾을 수 없습니다:', sectionType, moduleNumber);
        alert('모듈을 찾을 수 없습니다.');
        return;
    }
    
    // 2. ModuleController 생성
    const controller = new ModuleController(moduleConfig);
    window.moduleController = controller;
    
    // 3. 다 풀면 → 결과 화면 표시 → 과제 화면 복귀
    controller.setOnComplete(function(result) {
        console.log('✅ [V2] 1차 풀이 완료:', result);
        
        // 1차 결과 데이터를 StageSelector에 보관
        StageSelector.firstAttemptResult = result;
        
        // ✅ Supabase 저장 (비동기 — 화면 표시 차단 안 함)
        if (window.StudySave) {
            StudySave.saveFirstResult(result);
        }
        
        // ResultController로 1차 결과 화면 표시
        const resultController = new ResultController(result);
        
        // "틀린 문제 다시 풀기" / "해설 보기" 대신 "과제 화면으로" 버튼으로 교체
        resultController.startRetake = function() {
            returnToStageSelect(result);
        };
        resultController.showExplanations = function() {
            returnToStageSelect(result);
        };
        
        resultController.show();
        
        // 결과 화면의 버튼을 "과제 화면으로 돌아가기"로 교체
        setTimeout(function() {
            const resultScreen = document.getElementById(sectionType + 'ResultScreen');
            if (resultScreen) {
                const btnContainer = resultScreen.querySelector('.result-buttons');
                if (btnContainer) {
                    btnContainer.innerHTML = '';
                    const backBtn = document.createElement('button');
                    backBtn.className = 'btn btn-primary';
                    backBtn.textContent = '과제 화면으로 돌아가기';
                    backBtn.onclick = function() {
                        returnToStageSelect(result);
                    };
                    btnContainer.appendChild(backBtn);
                }
            }
        }, 100);
    });
    
    // 4. 풀이 시작
    controller.startModule();
}

/**
 * 1차 풀이 완료 후 stageSelectScreen으로 복귀
 * 오른쪽 대시보드에 점수 반영
 */
function returnToStageSelect(result) {
    console.log('🔙 [V2] 과제 화면으로 복귀');
    
    // 모든 화면 숨기고 stageSelectScreen 표시
    document.querySelectorAll('.screen').forEach(function(s) { s.style.display = 'none'; });
    // result-screen / test-screen도 숨기기
    document.querySelectorAll('.result-screen, .test-screen').forEach(function(s) { s.style.display = 'none'; });
    
    var screen = document.getElementById('stageSelectScreen');
    if (screen) screen.style.display = 'block';
    
    // 대시보드 업데이트
    if (result) {
        updateStageDashboard(result, '1st');
    }
    
    // 1차 풀이 상태 업데이트
    var status1st = document.getElementById('stage1stStatus');
    if (status1st) {
        status1st.textContent = '✅ 완료';
        status1st.classList.add('stage-status-done');
    }
}

/**
 * 오른쪽 채점 대시보드 업데이트
 */
function updateStageDashboard(result, attempt) {
    var totalCorrect = 0;
    var totalQuestions = 0;
    var level = 0;
    var componentScores = [];
    var suffix = attempt === '1st' ? '1st' : '2nd';
    
    // 2차 데이터: 이미 계산된 점수가 들어있음
    if (attempt === '2nd' && result.secondAttempt) {
        var sa = result.secondAttempt;
        totalCorrect = sa.score || 0;
        totalQuestions = StageSelector.firstAttemptResult ? StageSelector.firstAttemptResult.totalQuestions : 35;
        level = sa.level || 0;
        
        // 개선량 표시
        var detailEl = document.getElementById('stageDetail2nd');
        if (detailEl) {
            var improvement = result.improvement || {};
            var html = '';
            html += '<div style="display:flex; justify-content:space-between; font-size:12px; padding:3px 0;">';
            html += '<span style="color:var(--text-secondary);">점수 변화</span>';
            html += '<span style="font-weight:600; color:' + (improvement.scoreDiff > 0 ? '#10b981' : 'var(--text-primary)') + ';">';
            html += (improvement.scoreDiff > 0 ? '+' : '') + (improvement.scoreDiff || 0) + '문제';
            html += '</span></div>';
            html += '<div style="display:flex; justify-content:space-between; font-size:12px; padding:3px 0;">';
            html += '<span style="color:var(--text-secondary);">레벨 변화</span>';
            html += '<span style="font-weight:600; color:' + (improvement.levelDiff > 0 ? '#10b981' : 'var(--text-primary)') + ';">';
            html += (improvement.levelDiff > 0 ? '+' : '') + (improvement.levelDiff || 0).toFixed(1);
            html += '</span></div>';
            detailEl.innerHTML = html;
        }
    }
    // 1차 데이터: 답안 목록에서 점수 계산
    else {
        totalQuestions = result.totalQuestions || 0;
        if (result.componentResults) {
            var nameMap = {
                'fillblanks': '빈칸채우기', 'daily1': '일상리딩 1', 'daily2': '일상리딩 2',
                'academic': '아카데믹', 'response': '응답', 'conver': '대화',
                'announcement': '공지사항', 'lecture': '강의'
            };
            result.componentResults.forEach(function(comp) {
                var answers = comp.answers || comp.results || [];
                var correct = answers.filter(function(a) { return a.isCorrect; }).length;
                totalCorrect += correct;
                componentScores.push({ name: nameMap[comp.componentType] || comp.componentType, correct: correct, total: answers.length });
            });
        }
        
        // 레벨 계산
        var sectionType = StageSelector.sectionType;
        if (sectionType === 'reading') {
            if (totalCorrect <= 3) level = 1.0;
            else if (totalCorrect <= 6) level = 1.5;
            else if (totalCorrect <= 10) level = 2.0;
            else if (totalCorrect <= 13) level = 2.5;
            else if (totalCorrect <= 17) level = 3.0;
            else if (totalCorrect <= 20) level = 3.5;
            else if (totalCorrect <= 24) level = 4.0;
            else if (totalCorrect <= 27) level = 4.5;
            else if (totalCorrect <= 30) level = 5.0;
            else if (totalCorrect <= 32) level = 5.5;
            else level = 6.0;
        } else if (sectionType === 'listening') {
            if (totalCorrect <= 2) level = 1.0;
            else if (totalCorrect <= 5) level = 1.5;
            else if (totalCorrect <= 8) level = 2.0;
            else if (totalCorrect <= 11) level = 2.5;
            else if (totalCorrect <= 15) level = 3.0;
            else if (totalCorrect <= 18) level = 3.5;
            else if (totalCorrect <= 21) level = 4.0;
            else if (totalCorrect <= 24) level = 4.5;
            else if (totalCorrect <= 27) level = 5.0;
            else if (totalCorrect <= 29) level = 5.5;
            else level = 6.0;
        }
        
        // 파트별 점수
        var detailEl = document.getElementById('stageDetail' + suffix);
        if (detailEl) {
            var html = '';
            componentScores.forEach(function(comp) {
                html += '<div style="display:flex; justify-content:space-between; font-size:12px; padding:3px 0;">';
                html += '<span style="color:var(--text-secondary);">' + comp.name + '</span>';
                html += '<span style="font-weight:600; color:var(--text-primary);">' + comp.correct + '/' + comp.total + '</span>';
                html += '</div>';
            });
            detailEl.innerHTML = html;
        }
    }
    
    // 공통 DOM 업데이트
    var scoreEl = document.getElementById('stageScore' + suffix);
    if (scoreEl) {
        scoreEl.innerHTML = totalCorrect + '<span style="font-size:14px; font-weight:400; color:var(--text-secondary);">/' + totalQuestions + '</span>';
    }
    var levelEl = document.getElementById('stageLevel' + suffix);
    if (levelEl) {
        levelEl.textContent = '레벨 ' + level.toFixed(1);
    }
    
    console.log('📊 [V2] 대시보드 업데이트:', attempt, totalCorrect + '/' + totalQuestions, '레벨', level.toFixed(1));
}

function startSecondAttemptV2() {
    const sectionType = StageSelector.sectionType;
    const moduleNumber = StageSelector.moduleNumber;
    
    console.log('🔄 [V2] 2차 풀이 시작:', sectionType, 'Module', moduleNumber);
    
    // 1차 결과 확인
    const firstResult = StageSelector.firstAttemptResult;
    if (!firstResult) {
        alert('1차 풀이를 먼저 완료해주세요.');
        console.warn('⚠️ [V2] 1차 결과 없음 — 2차 풀이 불가');
        return;
    }
    
    // RetakeController 존재 확인
    if (typeof RetakeController === 'undefined') {
        alert('2차 풀이 모듈을 불러올 수 없습니다.');
        console.error('❌ [V2] RetakeController not loaded');
        return;
    }
    
    // RetakeController 생성 및 시작
    const retakeCtrl = new RetakeController(sectionType, firstResult);
    window.retakeController = retakeCtrl;
    
    // showSecondResultScreen 오버라이드 — 2차 결과 표시 후 "과제 화면으로" 버튼 추가
    const originalShowResult = retakeCtrl.showSecondResultScreen.bind(retakeCtrl);
    retakeCtrl.showSecondResultScreen = function(secondResults) {
        console.log('📊 [V2] 2차 결과 화면 (오버라이드)');
        
        // 2차 결과를 StageSelector에 보관
        StageSelector.secondAttemptResult = secondResults;
        
        // ✅ Supabase 저장 (비동기 — 화면 표시 차단 안 함)
        if (window.StudySave) {
            StudySave.saveSecondResult(secondResults);
        }
        
        // 기존 결과 화면 표시 (reading-retake-result.js의 showReadingRetakeResult 등)
        originalShowResult(secondResults);
        
        // "과제 화면으로 돌아가기" 버튼 추가
        setTimeout(function() {
            addReturnButtonToRetakeResult(secondResults);
        }, 300);
    };
    
    // 2차 풀이 시작
    retakeCtrl.start();
}

/**
 * 2차 결과 화면에 "과제 화면으로 돌아가기" 버튼 추가
 */
function addReturnButtonToRetakeResult(secondResults) {
    var sectionType = StageSelector.sectionType || 'reading';
    var retakeScreen = document.getElementById(sectionType + 'RetakeResultScreen');
    if (!retakeScreen) return;
    
    // 이미 추가된 버튼이 있으면 제거
    const existing = retakeScreen.querySelector('.v2-return-btn');
    if (existing) existing.remove();
    
    // 버튼 추가 (화면 하단에 직접 삽입)
    const returnBtn = document.createElement('button');
    returnBtn.className = 'btn btn-secondary btn-large v2-return-btn';
    returnBtn.style.cssText = 'margin:20px auto; display:block; width:90%; max-width:400px; background:#9480c5; color:#fff; border:none; padding:14px 24px; border-radius:12px; font-size:16px; font-weight:600; cursor:pointer;';
    returnBtn.textContent = '📋 과제 화면으로 돌아가기';
    returnBtn.onclick = function() {
        returnToStageSelectAfterRetake(secondResults);
    };
    retakeScreen.appendChild(returnBtn);
    
    console.log('✅ [V2] "과제 화면으로 돌아가기" 버튼 추가 완료');
}

/**
 * 2차 풀이 완료 후 stageSelectScreen으로 복귀
 * 대시보드에 2차 점수 반영
 */
function returnToStageSelectAfterRetake(secondResults) {
    console.log('🔙 [V2] 2차 풀이 후 과제 화면으로 복귀');
    
    // 모든 화면 숨기기
    document.querySelectorAll('.screen').forEach(function(s) { s.style.display = 'none'; });
    document.querySelectorAll('.result-screen, .test-screen').forEach(function(s) { s.style.display = 'none'; });
    
    var screen = document.getElementById('stageSelectScreen');
    if (screen) screen.style.display = 'block';
    
    // 대시보드에 2차 점수 업데이트
    if (secondResults) {
        updateStageDashboard(secondResults, '2nd');
    }
    
    // 2차 풀이 상태 업데이트
    var status2nd = document.getElementById('stage2ndStatus');
    if (status2nd) {
        status2nd.textContent = '✅ 완료';
        status2nd.classList.add('stage-status-done');
    }
}

function showResultV2() {
    console.log('📊 [V2] 채점 결과 표시 예정:', StageSelector.sectionType, StageSelector.moduleNumber);
    alert('채점 결과 — 아직 구현 전입니다.');
}

function showExplainV2() {
    var sectionType = StageSelector.sectionType;
    console.log('📖 [V2] 해설 보기:', sectionType, StageSelector.moduleNumber);

    if (!StageSelector.firstAttemptResult) {
        alert('1차 풀이를 먼저 완료해주세요.');
        return;
    }

    // 오답노트 플로팅 표시
    if (window.ErrorNote) {
        ErrorNote.show(sectionType, StageSelector.moduleNumber);
    }

    if (sectionType === 'reading' && typeof showReadingExplainV2 === 'function') {
        showReadingExplainV2();
    } else if (sectionType === 'listening' && typeof showListeningExplainV2 === 'function') {
        showListeningExplainV2();
    } else {
        alert('해설 보기 — 아직 구현 전입니다 (' + sectionType + ')');
    }
}

// ========================================
// 오답노트 제출 → study_results_v2 업데이트
// ========================================
window.addEventListener('errorNoteSubmitted', function(e) {
    if (window.StudySave) {
        var noteText = (e.detail && e.detail.text) || '';
        StudySave.saveErrorNoteSubmitted(noteText);
        console.log('📝 [V2] 오답노트 제출 → DB 업데이트 (내용 ' + noteText.length + '자)');
    }
});

// ========================================
// 기존 진입점 함수를 StageSelector로 대체
// ========================================
window.startReadingModule = function(moduleNum) {
    StageSelector.show('reading', moduleNum);
};

window.startListeningModule = function(moduleNum) {
    StageSelector.show('listening', moduleNum);
};

window.startWriting = function(number) {
    StageSelector.show('writing', number);
};

window.startSpeaking = function(number) {
    StageSelector.show('speaking', number);
};

// 전역 노출
window.StageSelector = StageSelector;

// ========================================
// [V2] executeTask 오버라이드
// 기존: 시작 확인 팝업 → 마감 체크 → FlowController.start()
// V2:   팝업 없이 바로 → StageSelector.show()
// ========================================
window.executeTask = function(taskName) {
    console.log(`📝 [V2] 과제 실행 (팝업 스킵): ${taskName}`);
    
    // parseTaskName은 task-router.js에서 이미 정의됨
    const parsed = parseTaskName(taskName);
    console.log('  파싱 결과:', parsed);
    
    switch (parsed.type) {
        case 'reading':
            StageSelector.show('reading', parsed.params.module);
            break;
        case 'listening':
            StageSelector.show('listening', parsed.params.module);
            break;
        case 'writing':
            StageSelector.show('writing', parsed.params.number);
            break;
        case 'speaking':
            StageSelector.show('speaking', parsed.params.number);
            break;
        case 'vocab':
            // 보카는 기존 플로우 그대로 (리팩토링 대상 아님)
            if (typeof _launchVocabModule === 'function') {
                _launchVocabModule(parsed.params.pages);
            }
            break;
        case 'intro-book':
            // 입문서도 기존 그대로
            if (typeof openIntroBookModal === 'function') {
                openIntroBookModal(taskName);
            }
            break;
        default:
            console.error('  ❌ 알 수 없는 과제 타입:', parsed.type);
            alert('알 수 없는 과제 타입입니다.');
    }
};

console.log('✅ [V2] stage-selector.js 로드 완료');
console.log('   - startReadingModule() → StageSelector.show()');
console.log('   - startListeningModule() → StageSelector.show()');
console.log('   - startWriting() → StageSelector.show()');
console.log('   - startSpeaking() → StageSelector.show()');
