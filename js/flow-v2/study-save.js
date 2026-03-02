/**
 * ================================================
 * study-save.js — V2 공통 학습 결과 저장 모듈
 * ================================================
 * 테이블: study_results_v2
 * 
 * 저장 시점:
 *   1차 결과 화면 표시 시 → saveFirstResult()
 *   2차 결과 화면 표시 시 → saveSecondResult()
 *   오답노트 제출 시 → saveErrorNoteSubmitted()
 * 
 * 의존: supabase-client.js (supabaseUpsert, supabaseSelect)
 *       auth.js (getCurrentUser)
 */

const StudySave = (function() {
    'use strict';
    
    const TABLE = 'study_results_v2';
    
    /**
     * 현재 학습 세션의 고유 키 생성
     * user_id + section_type + module_number + week + day 조합
     */
    function _getSessionKey() {
        const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
        if (!user || !user.id) {
            console.warn('⚠️ [StudySave] 유저 정보 없음');
            return null;
        }
        
        const ct = window.currentTest || {};
        return {
            user_id: user.id,
            section_type: StageSelector.sectionType || '',
            module_number: StageSelector.moduleNumber || 1,
            week: ct.currentWeek || 'Week 1',
            day: ct.currentDay || '일'
        };
    }
    
    /**
     * 기존 레코드 조회 (upsert용)
     */
    async function _findExisting(key) {
        try {
            const query = `user_id=eq.${key.user_id}&section_type=eq.${key.section_type}&module_number=eq.${key.module_number}&week=eq.${encodeURIComponent(key.week)}&day=eq.${encodeURIComponent(key.day)}&limit=1`;
            const records = await supabaseSelect(TABLE, query);
            return (records && records.length > 0) ? records[0] : null;
        } catch (e) {
            console.error('❌ [StudySave] 기존 레코드 조회 실패:', e);
            return null;
        }
    }
    
    /**
     * 1차 결과 저장
     * @param {object} moduleResult - ModuleController가 반환한 결과
     */
    async function saveFirstResult(moduleResult) {
        console.log('💾 [StudySave] 1차 결과 저장 시작');
        
        const key = _getSessionKey();
        if (!key) {
            console.error('❌ [StudySave] 세션 키 없음 — 저장 실패');
            return null;
        }
        
        // 점수 계산
        let totalCorrect = 0;
        if (moduleResult.componentResults) {
            moduleResult.componentResults.forEach(function(comp) {
                const answers = comp.answers || comp.results || [];
                totalCorrect += answers.filter(function(a) { return a.isCorrect; }).length;
            });
        }
        
        // 기존 레코드 확인
        const existing = await _findExisting(key);
        
        const data = {
            ...key,
            first_result_json: JSON.stringify({
                ...moduleResult,
                totalCorrect: totalCorrect,
                totalQuestions: moduleResult.totalQuestions,
                percentage: Math.round((totalCorrect / moduleResult.totalQuestions) * 100)
            }),
            completed_at: new Date().toISOString()
        };
        
        // 기존 레코드가 있으면 id 포함 (upsert)
        if (existing) {
            data.id = existing.id;
        }
        
        try {
            const result = await supabaseUpsert(TABLE, data, 'id');
            console.log('✅ [StudySave] 1차 결과 저장 완료:', totalCorrect + '/' + moduleResult.totalQuestions);
            return result;
        } catch (e) {
            console.error('❌ [StudySave] 1차 결과 저장 실패:', e);
            return null;
        }
    }
    
    /**
     * 2차 결과 저장
     * @param {object} secondResults - RetakeController.gradeSecondAttempt() 결과
     */
    async function saveSecondResult(secondResults) {
        console.log('💾 [StudySave] 2차 결과 저장 시작');
        
        const key = _getSessionKey();
        if (!key) {
            console.error('❌ [StudySave] 세션 키 없음 — 저장 실패');
            return null;
        }
        
        // 기존 레코드 확인 (1차 저장 시 생성된 row)
        const existing = await _findExisting(key);
        if (!existing) {
            console.error('❌ [StudySave] 1차 결과 레코드 없음 — 2차 저장 불가');
            return null;
        }
        
        try {
            const result = await supabaseUpdate(TABLE, `id=eq.${existing.id}`, {
                second_result_json: JSON.stringify(secondResults)
            });
            console.log('✅ [StudySave] 2차 결과 저장 완료');
            return result;
        } catch (e) {
            console.error('❌ [StudySave] 2차 결과 저장 실패:', e);
            return null;
        }
    }
    
    /**
     * 오답노트 제출 상태 + 내용 저장
     */
    async function saveErrorNoteSubmitted(noteText) {
        console.log('💾 [StudySave] 오답노트 제출 저장 시작');
        
        const key = _getSessionKey();
        if (!key) {
            console.error('❌ [StudySave] 세션 키 없음 — 저장 실패');
            return null;
        }
        
        const existing = await _findExisting(key);
        if (!existing) {
            console.error('❌ [StudySave] 기존 레코드 없음 — 오답노트 저장 불가');
            return null;
        }
        
        try {
            var updateData = {
                error_note_submitted: true
            };
            if (noteText) {
                updateData.error_note_text = noteText;
            }
            const result = await supabaseUpdate(TABLE, `id=eq.${existing.id}`, updateData);
            console.log('✅ [StudySave] 오답노트 제출 저장 완료' + (noteText ? ' (내용 ' + noteText.length + '자)' : ''));
            return result;
        } catch (e) {
            console.error('❌ [StudySave] 오답노트 저장 실패:', e);
            return null;
        }
    }
    
    /**
     * 인증률 계산 (boolean 3개 체크)
     * @returns {object} { total: 3, completed: N, percentage: N }
     */
    async function getAuthRate() {
        const key = _getSessionKey();
        if (!key) return { total: 3, completed: 0, percentage: 0 };
        
        const existing = await _findExisting(key);
        if (!existing) return { total: 3, completed: 0, percentage: 0 };
        
        let completed = 0;
        if (existing.first_result_json) completed++;
        if (existing.second_result_json) completed++;
        if (existing.error_note_submitted) completed++;
        
        return {
            total: 3,
            completed: completed,
            percentage: Math.round((completed / 3) * 100)
        };
    }
    
    /**
     * 현재 세션의 저장된 결과 불러오기 (페이지 새로고침 시 복원용)
     */
    async function loadSavedResults() {
        const key = _getSessionKey();
        if (!key) return null;
        
        const existing = await _findExisting(key);
        if (!existing) return null;
        
        return {
            firstResult: existing.first_result_json ? JSON.parse(existing.first_result_json) : null,
            secondResult: existing.second_result_json ? JSON.parse(existing.second_result_json) : null,
            errorNoteSubmitted: existing.error_note_submitted || false,
            errorNoteText: existing.error_note_text || null
        };
    }
    
    // 공개 API
    return {
        saveFirstResult: saveFirstResult,
        saveSecondResult: saveSecondResult,
        saveErrorNoteSubmitted: saveErrorNoteSubmitted,
        getAuthRate: getAuthRate,
        loadSavedResults: loadSavedResults
    };
})();

// 전역 노출
window.StudySave = StudySave;

console.log('✅ [V2] study-save.js 로드 완료');
console.log('   - StudySave.saveFirstResult()');
console.log('   - StudySave.saveSecondResult()');
console.log('   - StudySave.saveErrorNoteSubmitted()');
console.log('   - StudySave.getAuthRate()');
console.log('   - StudySave.loadSavedResults()');
