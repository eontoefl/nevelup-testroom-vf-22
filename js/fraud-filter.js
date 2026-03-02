/**
 * ================================================
 * fraud-filter.js
 * 부정행위 필터 — 빠른 제출 / 글자수 미달 경고
 * ================================================
 * 
 * 필터 규칙:
 *   - Reading: 모듈 전체 2분(120초) 미만 → 경고
 *   - Writing(단어배열): 세트 전체 41초 미만 → 경고
 *   - Writing(이메일/토론): 20단어 이하 → 경고
 *   - Speaking: 필터 없음
 *   - Listening: 보류 (향후 추가 가능)
 * 
 * 경고 팝업:
 *   "수정하기" → 돌아감
 *   "그래도 제출" → fraud_flag: true, 해당 단계 0%
 * 
 * 비공개 원칙: 구체적 수치는 학생에게 노출 안 함
 */

var FraudFilter = {
    // 1차/2차 풀이 시작 시각 기록
    _attemptStartTime: null,

    // ========================================
    // 시작 시간 기록
    // ========================================
    recordStart: function() {
        this._attemptStartTime = Date.now();
    },

    // ========================================
    // 경과 시간(초)
    // ========================================
    getElapsedSeconds: function() {
        if (!this._attemptStartTime) return 9999;
        return Math.floor((Date.now() - this._attemptStartTime) / 1000);
    },

    // ========================================
    // 빠른 제출 체크 (Reading)
    // 2분(120초) 미만이면 경고
    // ========================================
    checkReadingSpeed: function() {
        var elapsed = this.getElapsedSeconds();
        if (elapsed < 120) {
            return { warn: true, elapsed: elapsed };
        }
        return { warn: false };
    },

    // ========================================
    // 빠른 제출 체크 (Writing 단어배열)
    // 41초 미만이면 경고
    // ========================================
    checkArrangeSpeed: function() {
        var elapsed = this.getElapsedSeconds();
        if (elapsed < 41) {
            return { warn: true, elapsed: elapsed };
        }
        return { warn: false };
    },

    // ========================================
    // 글자수 체크 (Writing 이메일/토론)
    // 20단어 이하면 경고
    // ========================================
    checkWritingWordCount: function(text) {
        if (!text || !text.trim()) return { warn: true, wordCount: 0 };
        var wordCount = text.trim().split(/\s+/).length;
        if (wordCount <= 20) {
            return { warn: true, wordCount: wordCount };
        }
        return { warn: false, wordCount: wordCount };
    },

    // ========================================
    // 경고 팝업 표시
    // ========================================
    showWarning: function(message, onModify, onForceSubmit) {
        // 기존 팝업 제거
        var existing = document.getElementById('fraudWarningPopup');
        if (existing) existing.remove();
        var existingOverlay = document.getElementById('fraudWarningOverlay');
        if (existingOverlay) existingOverlay.remove();

        // 오버레이
        var overlay = document.createElement('div');
        overlay.id = 'fraudWarningOverlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;';
        document.body.appendChild(overlay);

        // 팝업
        var popup = document.createElement('div');
        popup.id = 'fraudWarningPopup';
        popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;border-radius:16px;padding:32px;max-width:400px;width:90%;z-index:10001;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);';
        popup.innerHTML = 
            '<div style="font-size:48px;margin-bottom:16px;">⚠️</div>' +
            '<h3 style="margin:0 0 12px;font-size:18px;color:#333;">제출 확인</h3>' +
            '<p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.6;">' + message + '</p>' +
            '<div style="display:flex;gap:12px;justify-content:center;">' +
                '<button id="fraudBtnModify" style="flex:1;padding:12px 20px;border:2px solid #4A90D9;background:white;color:#4A90D9;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">수정하기</button>' +
                '<button id="fraudBtnForce" style="flex:1;padding:12px 20px;border:none;background:#e74c3c;color:white;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">그래도 제출</button>' +
            '</div>';

        document.body.appendChild(popup);

        // 이벤트
        document.getElementById('fraudBtnModify').onclick = function() {
            overlay.remove();
            popup.remove();
            if (typeof onModify === 'function') onModify();
        };

        document.getElementById('fraudBtnForce').onclick = function() {
            overlay.remove();
            popup.remove();
            // fraud_flag 마킹
            if (window.AuthMonitor) {
                AuthMonitor._fraudFlag = true;
            }
            if (typeof onForceSubmit === 'function') onForceSubmit();
        };
    },

    // ========================================
    // 팝업 닫기 (외부 호출용)
    // ========================================
    closeWarning: function() {
        var popup = document.getElementById('fraudWarningPopup');
        if (popup) popup.remove();
        var overlay = document.getElementById('fraudWarningOverlay');
        if (overlay) overlay.remove();
    }
};

// ========================================
// FlowController / WritingFlow 연동
// ========================================
(function() {
    var setupDone = false;

    function setupFraudFilter() {
        if (setupDone) return;

        var fc = window.FlowController;
        if (!fc) return;

        // ── 1차 풀이 시작 시 타이머 기록 ──
        var origStartFirst = fc.startFirstAttempt.bind(fc);
        fc.startFirstAttempt = function() {
            FraudFilter.recordStart();
            return origStartFirst();
        };

        // ── 2차 풀이 시작 시 타이머 리셋 ──
        if (fc.startRetake) {
            var origStartRetake = fc.startRetake.bind(fc);
            fc.startRetake = function() {
                FraudFilter.recordStart();
                return origStartRetake();
            };
        }
        if (fc.startSecondAttempt) {
            var origStartSecond = fc.startSecondAttempt.bind(fc);
            fc.startSecondAttempt = function() {
                FraudFilter.recordStart();
                return origStartSecond();
            };
        }

        // ── 1차 완료 시점에 빠른 제출 체크 (Reading) ──
        var origAfterFirst = fc.afterFirstAttempt.bind(fc);
        fc.afterFirstAttempt = function() {
            var sectionType = fc.sectionType;

            // Reading: 빠른 제출 필터
            if (sectionType === 'reading') {
                var check = FraudFilter.checkReadingSpeed();
                if (check.warn) {
                    FraudFilter.showWarning(
                        '풀이 시간이 매우 짧습니다.<br>제출하시겠습니까?',
                        function() { /* 수정하기: 아무것도 안 함 (이미 결과 처리 전) */ },
                        function() { origAfterFirst(); }
                    );
                    return;
                }
            }

            return origAfterFirst();
        };

        // ── 이메일 제출 시 글자수 체크 ──
        if (typeof window.submitWritingEmail === 'function') {
            var origSubmitEmail = window.submitWritingEmail;
            window.submitWritingEmail = function() {
                var textarea = document.getElementById('emailTextarea');
                if (textarea) {
                    var check = FraudFilter.checkWritingWordCount(textarea.value);
                    if (check.warn) {
                        FraudFilter.showWarning(
                            '작성된 내용이 매우 짧습니다.<br>이대로 제출하시겠습니까?',
                            function() {
                                // 수정하기 — textarea에 포커스
                                textarea.focus();
                            },
                            function() {
                                // 그래도 제출
                                origSubmitEmail();
                            }
                        );
                        return;
                    }
                }
                origSubmitEmail();
            };
        }

        // ── 토론 제출 시 글자수 체크 ──
        if (typeof window.submitWritingDiscussion === 'function') {
            var origSubmitDiscussion = window.submitWritingDiscussion;
            window.submitWritingDiscussion = function() {
                var textarea = document.getElementById('discussionTextarea');
                if (textarea) {
                    var check = FraudFilter.checkWritingWordCount(textarea.value);
                    if (check.warn) {
                        FraudFilter.showWarning(
                            '작성된 내용이 매우 짧습니다.<br>이대로 제출하시겠습니까?',
                            function() {
                                textarea.focus();
                            },
                            function() {
                                origSubmitDiscussion();
                            }
                        );
                        return;
                    }
                }
                origSubmitDiscussion();
            };
        }

        console.log('✅ [FraudFilter] 연동 완료');
        setupDone = true;
    }

    // 페이지 로드 후 연결 (auth-monitor보다 나중에)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(setupFraudFilter, 600);
        });
    } else {
        setTimeout(setupFraudFilter, 600);
    }

    var checkCount = 0;
    var checkInterval = setInterval(function() {
        if (setupDone || checkCount > 20) {
            clearInterval(checkInterval);
            return;
        }
        setupFraudFilter();
        checkCount++;
    }, 1000);
})();

console.log('✅ fraud-filter.js 로드');
