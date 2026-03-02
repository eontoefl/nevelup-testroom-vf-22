/**
 * ================================================
 * auto-save.js — 실전풀이 중간 자동저장/복원
 * ================================================
 * 
 * 역할:
 * 1) 컴포넌트 완료 시마다 진행 상태를 sessionStorage + Supabase에 자동저장
 * 2) 학생이 과제 클릭 시 미완료 중간저장 기록이 있으면 "이어하기" 팝업
 * 3) 이어하기 선택 시 저장된 시점부터 재개
 * 
 * 저장 구조 (Supabase: tr_progress_save):
 * - user_id, task_type, module_number, week, day
 * - attempt: 1 또는 2 (1차/2차)
 * - current_component_index: 다음에 풀어야 할 컴포넌트 번호
 * - completed_components: 완료된 컴포넌트 결과 배열 (JSON)
 * - all_answers: 지금까지의 전체 답안 (JSON)
 * - timer_remaining: 남은 타이머 (초, null이면 타이머 없음)
 * - first_attempt_result: 1차 결과 전체 (2차 진행 중일 때)
 * - status: 'in_progress' | 'completed' | 'abandoned'
 * 
 * 의존: supabase-client.js
 */

console.log('✅ auto-save.js 로드 시작');

const AutoSave = {
    // 현재 세션 정보
    _currentSaveId: null,  // Supabase 레코드 ID
    _isResuming: false,    // 복원 중 플래그
    _writingSessionActive: false,  // 라이팅 통합 세션 활성 여부
    _writingStepResults: {},       // 라이팅 Step별 결과 저장 { step1: {type, result}, ... }
    
    // ========================================
    // 1. 컴포넌트 완료 시 자동저장
    // ========================================
    async saveProgress(data) {
        try {
            const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
            if (!user || !user.id || user.id === 'dev-user-001') {
                console.log('💾 [AutoSave] 개발모드 — 저장 생략');
                return;
            }
            if (window._deadlinePassedMode || window._isReplayMode || window._isPracticeMode) {
                console.log('💾 [AutoSave] 마감/리플레이/연습 모드 — 저장 생략');
                return;
            }

            const ct = window.currentTest;
            const scheduleInfo = {
                week: ct ? ct.currentWeek : 1,
                day: ct ? ct.currentDay : '일'
            };
            
            const saveData = {
                user_id: user.id,
                task_type: data.sectionType,
                module_number: data.moduleNumber,
                week: scheduleInfo.week,
                day: scheduleInfo.day,
                attempt: data.attempt || 1,
                current_component_index: data.nextComponentIndex,
                total_components: data.totalComponents || null,
                completed_components: data.componentResults || [],
                all_answers: data.allAnswers || [],
                timer_remaining: data.timerRemaining,
                first_attempt_result: data.firstAttemptResult || null,
                status: 'in_progress',
                updated_at: new Date().toISOString()
            };
            
            // ✅ 모든 컴포넌트 완료 시 자동으로 completed 처리
            if (data.totalComponents && data.nextComponentIndex >= data.totalComponents) {
                saveData.status = 'completed';
                console.log('💾 [AutoSave] 모든 컴포넌트 완료 → status: completed');
            }
            
            // sessionStorage에도 백업 (즉시 복원용)
            if (saveData.status === 'completed') {
                sessionStorage.removeItem('autoSaveProgress');
            } else {
                sessionStorage.setItem('autoSaveProgress', JSON.stringify(saveData));
            }
            
            // ★ 라이팅 통합 세션 활성 시: WritingFlow가 관리하므로 개별 저장 스킵
            if (this._writingSessionActive && data.sectionType === 'writing') {
                console.log('💾 [AutoSave] 라이팅 통합 세션 활성 — 개별 저장 스킵 (WritingFlow가 관리)');
                return;
            }

            // Supabase 저장 (기존 레코드 있으면 UPDATE, 없으면 INSERT)
            if (this._currentSaveId) {
                await supabaseUpdate('tr_progress_save', 'id=eq.' + this._currentSaveId, saveData);
                console.log('💾 [AutoSave] 업데이트 완료 — 컴포넌트', data.nextComponentIndex, '/', data.totalComponents);
            } else {
                saveData.created_at = new Date().toISOString();
                const result = await supabaseInsert('tr_progress_save', saveData);
                if (result && result.id) {
                    this._currentSaveId = result.id;
                    console.log('💾 [AutoSave] 새 레코드 생성:', result.id);
                }
            }
        } catch (e) {
            console.warn('⚠️ [AutoSave] 저장 실패 (과제 진행에는 영향 없음):', e.message);
        }
    },
    
    // ========================================
    // 1-B. 라이팅 전용: 통합 세션 시작
    // WritingFlow.start() 에서 호출 → 레코드 1개 생성
    // 이후 각 Step의 ModuleController가 saveProgress() 호출 시 이 레코드를 UPDATE
    // ========================================
    async initWritingSession(moduleNumber) {
        try {
            const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
            if (!user || !user.id || user.id === 'dev-user-001') return;
            if (window._deadlinePassedMode || window._isReplayMode || window._isPracticeMode) return;

            this._writingSessionActive = true;
            this._writingStepResults = {};

            const ct = window.currentTest;
            const saveData = {
                user_id: user.id,
                task_type: 'writing',
                module_number: moduleNumber,
                week: ct ? ct.currentWeek : 1,
                day: ct ? ct.currentDay : '일',
                attempt: 1,
                current_component_index: 0,
                total_components: null,  // WritingFlow의 총 Step 수 (나중에 갱신)
                completed_components: [],
                all_answers: [],
                timer_remaining: null,
                first_attempt_result: null,
                status: 'in_progress',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            // 기존 in_progress 레코드가 있으면 재활용
            const query = `user_id=eq.${user.id}&task_type=eq.writing&module_number=eq.${moduleNumber}&status=eq.in_progress&order=updated_at.desc&limit=1`;
            const existing = await supabaseSelect('tr_progress_save', query);
            if (existing && existing.length > 0) {
                this._currentSaveId = existing[0].id;
                console.log('💾 [AutoSave] 라이팅 세션: 기존 레코드 재활용:', this._currentSaveId);
            } else {
                const result = await supabaseInsert('tr_progress_save', saveData);
                if (result && result.id) {
                    this._currentSaveId = result.id;
                    console.log('💾 [AutoSave] 라이팅 세션: 새 레코드 생성:', this._currentSaveId);
                }
            }
        } catch (e) {
            console.warn('⚠️ [AutoSave] 라이팅 세션 초기화 실패:', e.message);
        }
    },

    /**
     * 라이팅 전용: Step 결과 업데이트
     * WritingFlow의 각 Step 완료 시 호출
     */
    async updateWritingStep(stepInfo) {
        if (!this._writingSessionActive || !this._currentSaveId) return;

        try {
            // Step 결과 누적
            this._writingStepResults[stepInfo.stepName] = {
                type: stepInfo.componentType,
                completed: true,
                attempt: stepInfo.attempt || 1
            };

            const completedSteps = Object.keys(this._writingStepResults);

            await supabaseUpdate('tr_progress_save', 'id=eq.' + this._currentSaveId, {
                current_component_index: stepInfo.currentStep,
                total_components: stepInfo.totalSteps || 12,
                completed_components: Object.values(this._writingStepResults),
                attempt: stepInfo.attempt || 1,
                status: stepInfo.isComplete ? 'completed' : 'in_progress',
                updated_at: new Date().toISOString()
            });

            console.log(`💾 [AutoSave] 라이팅 Step ${stepInfo.currentStep} 업데이트 (${completedSteps.length}개 완료)`);

            if (stepInfo.isComplete) {
                this._writingSessionActive = false;
                sessionStorage.removeItem('autoSaveProgress');
                console.log('💾 [AutoSave] 라이팅 세션 완료');
            }
        } catch (e) {
            console.warn('⚠️ [AutoSave] 라이팅 Step 업데이트 실패:', e.message);
        }
    },

    /**
     * 라이팅 세션 종료
     */
    endWritingSession() {
        this._writingSessionActive = false;
        this._writingStepResults = {};
        console.log('💾 [AutoSave] 라이팅 세션 해제');
    },

    // ========================================
    // 2. 과제 완료 시 중간저장 정리
    // ========================================
    async markCompleted() {
        try {
            // sessionStorage 정리
            sessionStorage.removeItem('autoSaveProgress');
            
            if (this._currentSaveId) {
                // ID를 알고 있으면 직접 업데이트
                await supabaseUpdate('tr_progress_save', 'id=eq.' + this._currentSaveId, {
                    status: 'completed',
                    updated_at: new Date().toISOString()
                });
                console.log('💾 [AutoSave] 완료 처리 (ID):', this._currentSaveId);
                this._currentSaveId = null;
            } else {
                // ✅ ID가 없으면 user + task_type + module_number로 조회 후 정리
                const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
                const fc = window.FlowController;
                if (user && user.id && fc && fc.sectionType && fc.moduleNumber) {
                    const query = `user_id=eq.${user.id}&task_type=eq.${fc.sectionType}&module_number=eq.${fc.moduleNumber}&status=eq.in_progress`;
                    const records = await supabaseSelect('tr_progress_save', query);
                    if (records && records.length > 0) {
                        for (const record of records) {
                            await supabaseUpdate('tr_progress_save', 'id=eq.' + record.id, {
                                status: 'completed',
                                updated_at: new Date().toISOString()
                            });
                        }
                        console.log('💾 [AutoSave] 완료 처리 (조회):', records.length, '건');
                    }
                }
            }
        } catch (e) {
            console.warn('⚠️ [AutoSave] 완료 처리 실패:', e.message);
        }
    },
    
    // ========================================
    // 3. 미완료 기록 조회 (과제 시작 전 호출)
    // ========================================
    async checkPendingProgress(userId, taskType, moduleNumber) {
        try {
            // ✅ Supabase를 먼저 확인 (관리자 리셋 반영을 위해 DB가 최우선)
            const query = `user_id=eq.${userId}&task_type=eq.${taskType}&module_number=eq.${moduleNumber}&status=eq.in_progress&order=updated_at.desc&limit=1`;
            const records = await supabaseSelect('tr_progress_save', query);
            
            if (records && records.length > 0) {
                const record = records[0];
                this._currentSaveId = record.id;
                console.log('💾 [AutoSave] Supabase에서 미완료 기록 발견:', record.id);
                return record;
            }
            
            // Supabase에 없음 → sessionStorage 잔여 데이터 정리
            const local = sessionStorage.getItem('autoSaveProgress');
            if (local) {
                console.log('💾 [AutoSave] Supabase에 기록 없음 → sessionStorage 자동 정리');
                sessionStorage.removeItem('autoSaveProgress');
            }
            
            return null;
        } catch (e) {
            console.warn('⚠️ [AutoSave] Supabase 조회 실패, sessionStorage 폴백 시도:', e.message);
            // Supabase 연결 실패 시에만 sessionStorage 폴백
            const local = sessionStorage.getItem('autoSaveProgress');
            if (local) {
                const parsed = JSON.parse(local);
                if (parsed.user_id === userId && 
                    parsed.task_type === taskType && 
                    parsed.module_number === moduleNumber &&
                    parsed.status === 'in_progress') {
                    console.log('💾 [AutoSave] sessionStorage 폴백 — 미완료 기록 발견');
                    return parsed;
                }
            }
            return null;
        }
    },
    
    // ========================================
    // 4. 이어하기 팝업 표시
    // ========================================
    showResumePopup(pendingData, onResume, onRestart) {
        // 기존 팝업 제거
        const existing = document.getElementById('autoSaveResumePopup');
        if (existing) existing.remove();
        
        const attempt = pendingData.attempt === 2 ? '2차' : '1차';
        const completed = (pendingData.completed_components || []).length;
        const total = pendingData.total_components || '?';
        const timerText = pendingData.timer_remaining 
            ? `남은 시간: ${Math.floor(pendingData.timer_remaining / 60)}분 ${pendingData.timer_remaining % 60}초`
            : '';
        
        const overlay = document.createElement('div');
        overlay.id = 'autoSaveResumePopup';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:20px;animation:asFadeIn .25s ease;';
        
        overlay.innerHTML = `
            <style>
                @keyframes asFadeIn { from { opacity:0; } to { opacity:1; } }
                @keyframes asSlideUp { from { transform:translateY(20px);opacity:0; } to { transform:translateY(0);opacity:1; } }
            </style>
            <div style="background:#fff;border-radius:16px;max-width:400px;width:100%;padding:28px 24px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3);animation:asSlideUp .3s ease;">
                <div style="font-size:40px;margin-bottom:12px;">📋</div>
                <h3 style="margin:0 0 8px;font-size:17px;color:#1a1a1a;font-weight:700;">이전에 풀던 기록이 있습니다</h3>
                <div style="background:#f0f4ff;border-radius:10px;padding:14px;margin:16px 0;text-align:left;font-size:13px;line-height:1.7;color:#444;">
                    <div>📝 <b>${attempt} 풀이</b> 진행 중</div>
                    <div>✅ <b>${completed}개</b> 컴포넌트 완료</div>
                    ${timerText ? `<div>⏱️ ${timerText}</div>` : ''}
                </div>
                <div style="display:flex;gap:10px;margin-top:20px;">
                    <button id="asResumeBtn" style="flex:1;padding:12px;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;background:linear-gradient(135deg,#6c5ce7,#a29bfe);color:#fff;box-shadow:0 4px 12px rgba(108,92,231,.3);">
                        이어서 풀기
                    </button>
                    <button id="asRestartBtn" style="flex:1;padding:12px;border:1.5px solid #ddd;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;background:#fff;color:#666;">
                        처음부터
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        document.getElementById('asResumeBtn').onclick = () => {
            overlay.remove();
            if (onResume) onResume();
        };
        
        document.getElementById('asRestartBtn').onclick = () => {
            overlay.remove();
            // 기존 중간저장 정리
            this.abandonProgress();
            if (onRestart) onRestart();
        };
    },
    
    // ========================================
    // 5. 중간저장 포기 (처음부터 선택 시)
    // ========================================
    async abandonProgress() {
        try {
            sessionStorage.removeItem('autoSaveProgress');
            
            if (this._currentSaveId) {
                await supabaseUpdate('tr_progress_save', 'id=eq.' + this._currentSaveId, {
                    status: 'abandoned',
                    updated_at: new Date().toISOString()
                });
                console.log('💾 [AutoSave] 기존 기록 포기 처리');
                this._currentSaveId = null;
            }
        } catch (e) {
            console.warn('⚠️ [AutoSave] 포기 처리 실패:', e.message);
        }
    },
    
    // ========================================
    // 6. 정리
    // ========================================
    reset() {
        this._currentSaveId = null;
        this._isResuming = false;
        this._writingSessionActive = false;
        this._writingStepResults = {};
        sessionStorage.removeItem('autoSaveProgress');
    }
};

// 전역 노출
window.AutoSave = AutoSave;

console.log('✅ auto-save.js 로드 완료');
