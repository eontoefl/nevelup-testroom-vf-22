/**
 * ================================================
 * auth-monitor.js v3 — auth_record 선행 INSERT 수정
 * 인증시스템 — 체크리스트 방식 (30/30/40)
 * ================================================
 * 
 * 체크리스트:
 *   1차 제출 완료 → 30%
 *   2차 제출 완료 → 30%
 *   Raw Point 제도: 과제당 0 or 100 (오답노트 20단어↑ 기준)
 * 
 * 호출 시점:
 *   FlowController/WritingFlow wrap을 통해 자동 감지
 *   오답노트 제출 이벤트(errorNoteSubmitted)로 최종 인증 판정
 */

var AuthMonitor = {
    // ========================================
    // 상태
    // ========================================
    isActive: false,
    sectionType: null,
    moduleNumber: null,
    _lastSectionType: null,
    _lastModuleNumber: null,
    _snapshot: null,

    // 체크리스트 상태
    _step1Done: false,      // 1차 제출 완료
    _step2Done: false,      // 2차 제출 완료
    _explanationDone: false, // 해설+오답노트 완료
    _fraudFlag: false,      // 부정행위 플래그 (경고 무시 제출)
    _errorNoteWordCount: 0,  // 오답노트 단어수
    _speakingFileCount: 0,   // 스피킹 녹음파일 수
    _studyRecordId: null,   // 저장된 study_record ID
    _authRecordCreated: false, // auth_record가 이미 INSERT 되었는지

    // ========================================
    // 시작 — 과제 진입 시
    // ========================================
    start: function(sectionType, moduleNumber) {
        console.log('🔒 [Auth] 시작:', sectionType, moduleNumber);

        this.isActive = true;
        this.sectionType = sectionType;
        this.moduleNumber = moduleNumber;
        this._lastSectionType = sectionType;
        this._lastModuleNumber = moduleNumber;

        // 체크리스트 초기화
        this._step1Done = false;
        this._step2Done = false;
        this._explanationDone = false;
        this._fraudFlag = false;
        this._errorNoteWordCount = 0;    // 오답노트 단어수
        this._speakingFileCount = 0;     // 스피킹 녹음파일 수
        this._studyRecordId = null;
        this._authRecordCreated = false;
    },

    // ========================================
    // 종료
    // ========================================
    stop: function() {
        // 종료 (silent)
        this.isActive = false;
        this.sectionType = null;
        this.moduleNumber = null;
    },

    // ========================================
    // 단계 완료 마킹
    // ========================================
    markStep1: function() {
        this._step1Done = true;
        console.log('🔒 [Auth] 1차 ✅');
    },

    markStep2: function() {
        this._step2Done = true;
        console.log('🔒 [Auth] 2차 ✅');
    },

    markExplanation: function(isFraud) {
        if (isFraud) {
            this._fraudFlag = true;
            this._explanationDone = false;
            console.log('🔒 [Auth] 해설 ❌ (fraud)');
        } else {
            this._explanationDone = true;
            console.log('🔒 [Auth] 해설 ✅');
        }
    },

    // ========================================
    // 인증률 계산 (Raw Point: 0 or 100)
    // ========================================
    calculateAuthRate: function() {
        var sectionType = this.sectionType || this._lastSectionType;
        var rate = 0;

        if (sectionType === 'reading' || sectionType === 'listening') {
            // 오답노트 20단어 이상 제출 → 100
            if (this._errorNoteWordCount >= 20) rate = 100;
        } else if (sectionType === 'speaking') {
            // 오답노트 20단어 이상 + 녹음파일 2개 첨부 → 100
            if (this._errorNoteWordCount >= 20 && this._speakingFileCount >= 2) rate = 100;
        } else if (sectionType === 'writing') {
            // 이메일 1차/2차 + 토론 1차/2차 submit + 오답노트 20단어 → 100
            var wf = window.WritingFlow;
            var allDone = wf && wf.email1stData && wf.discussion1stData && wf.email2ndData && wf.discussion2ndData;
            if (allDone && this._errorNoteWordCount >= 20) rate = 100;
        }

        console.log('🔒 [Auth] 인증률:', rate + '% (type:', sectionType, 'words:', this._errorNoteWordCount, ')');

        return rate;
    },

    // ========================================
    // 현재 스케줄 정보 (스케줄 데이터 기반 역조회)
    // ========================================
    getCurrentScheduleInfo: function() {
        var sectionType = this.sectionType || this._lastSectionType;
        var moduleNumber = this.moduleNumber || this._lastModuleNumber;

        // 스케줄 데이터에서 정확한 week/day 역조회 시도
        if (sectionType && moduleNumber && typeof SCHEDULE_DATA !== 'undefined' && typeof parseTaskName === 'function') {
            var user = (typeof getCurrentUser === 'function') ? getCurrentUser() : window.currentUser;
            var programType = 'fast';
            if (user) {
                programType = user.programType || (user.program === '내벨업챌린지 - Standard' ? 'standard' : 'fast');
            }

            var programData = SCHEDULE_DATA[programType];
            if (programData) {
                var dayToKr = { sunday: '일', monday: '월', tuesday: '화', wednesday: '수', thursday: '목', friday: '금' };
                var days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
                var totalWeeks = programType === 'standard' ? 8 : 4;

                for (var w = 1; w <= totalWeeks; w++) {
                    var weekData = programData['week' + w];
                    if (!weekData) continue;

                    for (var di = 0; di < days.length; di++) {
                        var dayEn = days[di];
                        var tasks = weekData[dayEn] || [];

                        for (var ti = 0; ti < tasks.length; ti++) {
                            var parsed = parseTaskName(tasks[ti]);
                            if (!parsed || parsed.type === 'unknown') continue;

                            var matchType = parsed.type;
                            var matchNum = null;

                            if (matchType === 'reading' || matchType === 'listening') {
                                matchNum = parsed.params.module;
                            } else if (matchType === 'writing' || matchType === 'speaking') {
                                matchNum = parsed.params.number;
                            } else if (matchType === 'vocab' || matchType === 'intro-book') {
                                // vocab/intro-book: week+day만으로 매칭
                                if (matchType === sectionType) {
                                    console.log('🔒 [Auth] 스케줄 역조회 성공:', sectionType, moduleNumber, '→ week' + w, dayToKr[dayEn]);
                                    return { week: w, day: dayToKr[dayEn] };
                                }
                                continue;
                            }

                            if (matchType === sectionType && matchNum === parseInt(moduleNumber)) {
                                console.log('🔒 [Auth] 스케줄 역조회 성공:', sectionType, moduleNumber, '→ week' + w, dayToKr[dayEn]);
                                return { week: w, day: dayToKr[dayEn] };
                            }
                        }
                    }
                }
                console.warn('🔒 [Auth] 스케줄 역조회 실패 — 폴백 사용:', sectionType, moduleNumber);
            }
        }

        // 폴백: 기존 방식 (currentTest에서 가져오기)
        var ct = window.currentTest;
        if (ct && ct.currentWeek) {
            return { week: ct.currentWeek, day: ct.currentDay || '월' };
        }
        return { week: 1, day: '월' };
    },

    // ========================================
    // Writing 결과 조합 헬퍼
    // ========================================
    _buildWritingFirstResult: function(wf) {
        if (!wf) return null;
        var componentResults = [];
        
        // arrange (단어 배열) - sessionStorage에서 가져오기
        var arrangeData = wf.arrange1stResult;
        if (arrangeData) {
            componentResults.push({
                componentType: 'arrange',
                setId: 1,
                answers: arrangeData.results || [],
                correct: arrangeData.correct || 0,
                total: arrangeData.total || 10,
                accuracy: arrangeData.accuracy || 0
            });
        }
        
        // email 1차
        if (wf.email1stData) {
            componentResults.push(wf.email1stData);
        }
        
        // discussion 1차
        if (wf.discussion1stData) {
            componentResults.push(wf.discussion1stData);
        }
        
        if (componentResults.length === 0) return null;
        
        return {
            sectionType: 'writing',
            componentResults: componentResults,
            totalQuestions: componentResults.length,
            totalCorrect: componentResults.reduce(function(sum, c) {
                var arr = c.answers || c.results || [];
                return sum + (Array.isArray(arr) ? arr.filter(function(a) { return a.isCorrect; }).length : (c.correctCount || c.correct || 0));
            }, 0)
        };
    },
    
    _buildWritingRetakeResult: function(wf) {
        if (!wf) return null;
        var componentResults = [];
        
        // arrange 2차
        var arrange2nd = wf.arrange2ndResult;
        if (arrange2nd) {
            componentResults.push({
                componentType: 'arrange',
                setId: 1,
                answers: arrange2nd.results || [],
                correct: arrange2nd.correct || 0,
                total: arrange2nd.total || 10,
                accuracy: arrange2nd.accuracy || 0
            });
        }
        
        // email 2차
        if (wf.email2ndData) {
            componentResults.push(wf.email2ndData);
        }
        
        // discussion 2차
        if (wf.discussion2ndData) {
            componentResults.push(wf.discussion2ndData);
        }
        
        if (componentResults.length === 0) return null;
        
        return {
            sectionType: 'writing',
            componentResults: componentResults,
            totalQuestions: componentResults.length,
            totalCorrect: componentResults.reduce(function(sum, c) {
                var arr = c.answers || c.results || [];
                return sum + (Array.isArray(arr) ? arr.filter(function(a) { return a.isCorrect; }).length : (c.correctCount || c.correct || 0));
            }, 0)
        };
    },

    // ========================================
    // 1차 제출 완료 시: study_record INSERT + _studyRecordId 확보
    // ========================================
    saveFirstAttempt: async function() {
        if (window._deadlinePassedMode) {
            console.log('🔒 [Auth] 마감 지난 과제 — 저장 생략');
            return;
        }
        var user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
        if (!user || !user.id || user.id === 'dev-user-001') {
            console.log('🔒 [Auth] 개발 모드 — 저장 생략');
            return;
        }

        var sectionType = this.sectionType || this._lastSectionType;
        var moduleNumber = this.moduleNumber || this._lastModuleNumber;

        if (!sectionType || !moduleNumber) {
            console.warn('🔒 [Auth] 섹션/모듈 정보 없음 — 저장 생략');
            return;
        }

        // 1차 결과 데이터 추출
        var fc = window.FlowController;
        var wf = window.WritingFlow;
        var firstResult = null;

        // ★ Writing인 경우 WritingFlow에서 componentResults를 조합
        if (sectionType === 'writing' && wf) {
            firstResult = this._buildWritingFirstResult(wf);
            console.log('💾 [Auth] Writing 1차 결과 조합:', firstResult ? firstResult.componentResults.length + '개 컴포넌트' : 'null');
        } else if (fc && fc.firstAttemptResult) {
            firstResult = fc.firstAttemptResult;
        }

        var score = 0, total = 0, timeSpent = 0, detail = {};
        if (firstResult) {
            total = firstResult.totalQuestions || 0;
            timeSpent = firstResult.totalTimeSpent || firstResult.timeSpent || 0;

            if (firstResult.componentResults) {
                var totalCorrect = 0;
                firstResult.componentResults.forEach(function(comp) {
                    var key = comp.componentType + '_' + (comp.setId || '1');
                    var answerArray = comp.answers || comp.results || [];
                    var compTotal = answerArray.length || comp.totalQuestions || comp.questionsPerSet || 0;
                    var compCorrect = 0;
                    if (Array.isArray(answerArray)) {
                        compCorrect = answerArray.filter(function(a) { return a.isCorrect; }).length;
                    }
                    if (compCorrect === 0 && comp.correctCount) {
                        compCorrect = comp.correctCount;
                    }
                    detail[key] = compCorrect + '/' + compTotal;
                    totalCorrect += compCorrect;
                });
                score = totalCorrect;
            } else {
                score = firstResult.correctCount || 0;
            }
        }

        // result_json (1차 결과)
        var resultJson = null;
        if (firstResult && firstResult.componentResults) {
            try {
                resultJson = { firstAttemptResult: JSON.parse(JSON.stringify(firstResult)) };
                console.log('💾 [Auth] result_json 준비 완료 - componentResults:', firstResult.componentResults.length, '개');
            } catch (e) {
                console.warn('⚠️ [Auth] result_json 직렬화 실패:', e);
            }
        }

        var scheduleInfo = this.getCurrentScheduleInfo();

        var studyRecordData = {
            user_id: user.id,
            week: scheduleInfo.week,
            day: scheduleInfo.day,
            task_type: sectionType,
            module_number: moduleNumber,
            attempt: 1,
            score: score,
            total: total,
            time_spent: timeSpent,
            detail: detail,
            result_json: resultJson,
            completed_at: new Date().toISOString()
        };

        console.log('💾 [Auth] 1차 결과 저장...');
        var studyRecord = await saveStudyRecord(studyRecordData);

        if (studyRecord && studyRecord.id) {
            this._studyRecordId = studyRecord.id;
            console.log('💾 [Auth] study_record 생성 완료:', studyRecord.id);
        } else {
            console.warn('🔒 [Auth] study_record 저장 실패');
        }
    },

    // ========================================
    // 오답노트 저장: _studyRecordId로 UPDATE
    // ========================================
    saveErrorNote: async function(text, wordCount, speakingFile1, speakingFile2) {
        if (!this._studyRecordId) {
            console.warn('📝 [Auth] studyRecordId 없음 — 오답노트 저장 실패');
            return false;
        }

        try {
            var updateData = {
                error_note_text: text,
                error_note_word_count: wordCount
            };
            if (speakingFile1) updateData.speaking_file_1 = speakingFile1;
            if (speakingFile2) updateData.speaking_file_2 = speakingFile2;

            try {
                await supabaseUpdate('tr_study_records', 'id=eq.' + this._studyRecordId, updateData);
            } catch (colErr) {
                // speaking_file 컬럼이 없을 수 있음 — 오답노트만 저장 재시도
                console.warn('📝 [Auth] 전체 UPDATE 실패, 오답노트만 재시도:', colErr.message || colErr);
                var fallbackData = {
                    error_note_text: text,
                    error_note_word_count: wordCount
                };
                await supabaseUpdate('tr_study_records', 'id=eq.' + this._studyRecordId, fallbackData);
            }
            console.log('📝 [Auth] 오답노트 저장 완료:', this._studyRecordId);

            // ★ 학생 통계 갱신
            this.updateStudentStats();

            return true;
        } catch (e) {
            console.error('📝 [Auth] 오답노트 저장 실패:', e);
            return false;
        }
    },

    // ========================================
    // finish() 시점: 최종 인증률 + auth_record 저장
    // ========================================
    saveFinalRecords: async function() {
        if (window._deadlinePassedMode) {
            console.log('🔒 [Auth] 마감 지난 과제 — 저장 생략');
            return;
        }
        var user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
        if (!user || !user.id || user.id === 'dev-user-001') {
            console.log('🔒 [Auth] 개발 모드 — 저장 생략');
            return;
        }

        // study_record가 아직 없으면 (예외: 1차 저장 실패 등) 기존 방식으로 INSERT
        if (!this._studyRecordId) {
            console.log('🔒 [Auth] studyRecordId 없음 — 풀 INSERT 폴백');
            await this._fallbackSaveRecords(user);
            return;
        }

        // 2차 결과 업데이트 (retakeResult가 있으면)
        var fc = window.FlowController;
        var wf = window.WritingFlow;
        var snap = this._snapshot || {};
        var sectionType = this.sectionType || this._lastSectionType;

        // ★ Writing인 경우 WritingFlow에서 전체 결과 조합
        if (sectionType === 'writing' && wf) {
            try {
                var firstResult = this._buildWritingFirstResult(wf);
                var retakeResult = this._buildWritingRetakeResult(wf);
                if (firstResult) {
                    var updatedJson = {
                        firstAttemptResult: JSON.parse(JSON.stringify(firstResult))
                    };
                    if (retakeResult) {
                        updatedJson.retakeResult = JSON.parse(JSON.stringify(retakeResult));
                    }
                    await supabaseUpdate('tr_study_records', 'id=eq.' + this._studyRecordId, {
                        result_json: updatedJson
                    });
                    console.log('💾 [Auth] Writing result_json 최종 업데이트 완료');
                } else {
                    console.warn('⚠️ [Auth] Writing firstResult 조합 실패');
                }
            } catch (e) {
                console.warn('⚠️ [Auth] Writing result_json 업데이트 실패:', e);
            }
        } else if (fc && fc.firstAttemptResult) {
            try {
                var updatedJson = {
                    firstAttemptResult: JSON.parse(JSON.stringify(fc.firstAttemptResult))
                };
                if (snap.retakeResult) {
                    updatedJson.retakeResult = JSON.parse(JSON.stringify(snap.retakeResult));
                }
                await supabaseUpdate('tr_study_records', 'id=eq.' + this._studyRecordId, {
                    result_json: updatedJson
                });
                console.log('💾 [Auth] result_json 최종 업데이트 완료');
            } catch (e) {
                console.warn('⚠️ [Auth] result_json 업데이트 실패:', e);
            }
        }

        // auth_record 최종 저장 (이미 있으면 UPDATE, 없으면 INSERT)
        var authRate = this.calculateAuthRate();
        var authRecordData = {
            auth_rate: authRate,
            step1_completed: this._step1Done,
            step2_completed: this._step2Done,
            explanation_completed: this._explanationDone,
            fraud_flag: this._fraudFlag,
            focus_lost_count: 0
        };

        if (this._authRecordCreated) {
            // 이미 showExplain에서 INSERT됨 → UPDATE
            try {
                await supabaseUpdate(
                    'tr_auth_records',
                    'study_record_id=eq.' + this._studyRecordId,
                    authRecordData
                );
                console.log('🔒 [Auth] 최종 UPDATE 완료:', authRate + '%');
            } catch (e) {
                console.error('🔒 [Auth] 최종 UPDATE 실패:', e);
            }
        } else {
            // 아직 INSERT 안 됨 (showExplain을 거치지 않은 예외 케이스)
            authRecordData.user_id = user.id;
            authRecordData.study_record_id = this._studyRecordId;
            await saveAuthRecord(authRecordData);
            this._authRecordCreated = true;
            console.log('🔒 [Auth] 최종 INSERT 완료:', authRate + '%');
        }

        // ★ 학생 통계 갱신
        this.updateStudentStats();
    },

    // ========================================
    // 폴백: study_record가 없을 때 기존 방식으로 한번에 INSERT
    // ========================================
    _fallbackSaveRecords: async function(user) {
        var snap = this._snapshot || {};
        var sectionType = this.sectionType || snap.sectionType || this._lastSectionType;
        var moduleNumber = this.moduleNumber || snap.moduleNumber || this._lastModuleNumber;

        if (!sectionType || !moduleNumber) {
            console.warn('🔒 [Auth] 폴백 — 섹션/모듈 정보 없음');
            return;
        }

        var fc = window.FlowController;
        var wf = window.WritingFlow;
        var firstResult = null;

        // ★ Writing인 경우 WritingFlow에서 componentResults를 조합
        if (sectionType === 'writing' && wf) {
            firstResult = this._buildWritingFirstResult(wf);
        } else if (fc && fc.firstAttemptResult) {
            firstResult = fc.firstAttemptResult;
        } else if (snap.firstAttemptResult) {
            firstResult = snap.firstAttemptResult;
        }

        var score = 0, total = 0, timeSpent = 0, detail = {};
        if (firstResult) {
            total = firstResult.totalQuestions || 0;
            timeSpent = firstResult.totalTimeSpent || firstResult.timeSpent || 0;
            if (firstResult.componentResults) {
                var totalCorrect = 0;
                firstResult.componentResults.forEach(function(comp) {
                    var key = comp.componentType + '_' + (comp.setId || '1');
                    var answerArray = comp.answers || comp.results || [];
                    var compTotal = answerArray.length || comp.totalQuestions || comp.questionsPerSet || 0;
                    var compCorrect = 0;
                    if (Array.isArray(answerArray)) {
                        compCorrect = answerArray.filter(function(a) { return a.isCorrect; }).length;
                    }
                    if (compCorrect === 0 && comp.correctCount) compCorrect = comp.correctCount;
                    detail[key] = compCorrect + '/' + compTotal;
                    totalCorrect += compCorrect;
                });
                score = totalCorrect;
            } else {
                score = firstResult.correctCount || 0;
            }
        }

        var resultJson = null;
        if (firstResult && firstResult.componentResults) {
            try {
                resultJson = { firstAttemptResult: JSON.parse(JSON.stringify(firstResult)) };
                // Writing인 경우 retakeResult도 추가
                if (sectionType === 'writing' && wf) {
                    var retakeResult = this._buildWritingRetakeResult(wf);
                    if (retakeResult) resultJson.retakeResult = JSON.parse(JSON.stringify(retakeResult));
                }
            } catch (e) {
                console.warn('⚠️ [Auth] 폴백 result_json 직렬화 실패:', e);
            }
        }

        var scheduleInfo = this.getCurrentScheduleInfo();
        var studyRecordData = {
            user_id: user.id,
            week: scheduleInfo.week,
            day: scheduleInfo.day,
            task_type: sectionType,
            module_number: moduleNumber,
            attempt: 1,
            score: score,
            total: total,
            time_spent: timeSpent,
            detail: detail,
            result_json: resultJson,
            completed_at: new Date().toISOString()
        };

        console.log('💾 [Auth] 폴백 INSERT...');
        var studyRecord = await saveStudyRecord(studyRecordData);

        if (studyRecord && studyRecord.id) {
            this._studyRecordId = studyRecord.id;
            var authRate = this.calculateAuthRate();
            var authRecordData = {
                user_id: user.id,
                study_record_id: studyRecord.id,
                auth_rate: authRate,
                step1_completed: this._step1Done,
                step2_completed: this._step2Done,
                explanation_completed: this._explanationDone,
                fraud_flag: this._fraudFlag,
                focus_lost_count: 0
            };
            await saveAuthRecord(authRecordData);
            console.log('🔒 [Auth] 폴백 저장 완료:', authRate + '%');
        }
    },

    // ========================================
    // 오답노트 제출 후 auth_records 업데이트
    // ========================================
    updateExplanationStatus: async function() {
        if (!this._studyRecordId) {
            console.warn('🔒 [Auth] studyRecordId 없음');
            return;
        }

        // auth_record가 아직 없으면 먼저 생성
        if (!this._authRecordCreated) {
            await this._ensureAuthRecordExists();
        }

        var authRate = this.calculateAuthRate();

        try {
            await supabaseUpdate(
                'tr_auth_records',
                'study_record_id=eq.' + this._studyRecordId,
                {
                    auth_rate: authRate,
                    explanation_completed: this._explanationDone,
                    fraud_flag: this._fraudFlag
                }
            );
            console.log('🔒 [Auth] 인증률 업데이트:', authRate + '%');
        } catch (e) {
            console.error('🔒 [Auth] 업데이트 실패:', e);
        }

        // ★ 학생 통계 갱신
        this.updateStudentStats();
    },

    // ========================================
    // auth_record 선행 INSERT (해설 진입 시점)
    // ========================================
    _ensureAuthRecordExists: async function() {
        if (this._authRecordCreated) return; // 이미 생성됨
        if (!this._studyRecordId) {
            console.warn('🔒 [Auth] _ensureAuthRecord — studyRecordId 없음');
            return;
        }

        var user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
        if (!user || !user.id || user.id === 'dev-user-001') return;

        if (window._deadlinePassedMode || window._isPracticeMode) {
            console.log('🔒 [Auth] 마감/연습 모드 — auth_record 생성 생략');
            return;
        }

        var authRate = this.calculateAuthRate();
        var authRecordData = {
            user_id: user.id,
            study_record_id: this._studyRecordId,
            auth_rate: authRate,
            step1_completed: this._step1Done,
            step2_completed: this._step2Done,
            explanation_completed: this._explanationDone,
            fraud_flag: this._fraudFlag,
            focus_lost_count: 0
        };

        try {
            await saveAuthRecord(authRecordData);
            this._authRecordCreated = true;
            console.log('🔒 [Auth] auth_record 선행 INSERT 완료:', authRate + '%');
        } catch (e) {
            console.error('🔒 [Auth] auth_record 선행 INSERT 실패:', e);
        }
    },

    // ========================================
    // 학생 통계 갱신 (tr_student_stats UPSERT)
    // 1차 제출, 해설 완료, 오답노트 제출 시 호출
    // ========================================
    updateStudentStats: async function() {
        var user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
        if (!user || !user.id || user.id === 'dev-user-001') return;

        try {
            // 1) study_records 조회 (과제별 중복 제거용)
            var studyRecords = await supabaseSelect(
                'tr_study_records',
                'user_id=eq.' + user.id + '&select=id,task_type,module_number,week,day,completed_at'
            );

            // 과제별 최신 record만 남기기 (task_type + module_number + week + day 기준)
            var uniqueMap = {};
            if (studyRecords) {
                studyRecords.forEach(function(rec) {
                    // vocab, intro-book은 week+day 구분, 나머지는 task_type+module_number
                    var key;
                    if (rec.task_type === 'vocab' || rec.task_type === 'intro-book') {
                        key = rec.task_type + '_' + rec.module_number + '_w' + rec.week + '_' + rec.day;
                    } else {
                        key = rec.task_type + '_' + rec.module_number;
                    }
                    var existing = uniqueMap[key];
                    if (!existing || new Date(rec.completed_at) > new Date(existing.completed_at)) {
                        uniqueMap[key] = rec;
                    }
                });
            }
            var uniqueRecords = Object.values(uniqueMap);
            var uniqueRecordIds = {};
            uniqueRecords.forEach(function(r) { uniqueRecordIds[r.id] = true; });
            var tasksSubmitted = uniqueRecords.length;

            // 2) auth_records에서 auth_rate 합계 (중복 제거된 study_record에 매칭되는 것만)
            var authRecords = await supabaseSelect(
                'tr_auth_records',
                'user_id=eq.' + user.id + '&select=auth_rate,study_record_id'
            );
            var authSum = 0;
            if (authRecords) {
                authRecords.forEach(function(r) {
                    if (uniqueRecordIds[r.study_record_id]) {
                        authSum += (r.auth_rate || 0);
                    }
                });
            }

            // 3) 오늘까지 할당 과제 수 (분모) + 도래 과제 중 완료된 수 (분자)
            var tasksDue = 0;
            var tasksDueCompleted = 0;
            var tasksDueAuthSum = 0;
            if (typeof getDayTasks === 'function' && typeof parseTaskName === 'function' && user.startDate) {
                var programType = user.programType || (user.program === '내벨업챌린지 - Standard' ? 'standard' : 'fast');
                var totalWeeks = programType === 'standard' ? 8 : 4;
                var dayOrder = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
                var dayEnToKr = { sunday: '일', monday: '월', tuesday: '화', wednesday: '수', thursday: '목', friday: '금' };
                var startDate = new Date(user.startDate + 'T00:00:00');

                if (!isNaN(startDate.getTime())) {
                    var now = new Date();
                    var effectiveToday = new Date(now);
                    if (now.getHours() < 4) {
                        effectiveToday.setDate(effectiveToday.getDate() - 1);
                    }
                    effectiveToday.setHours(0, 0, 0, 0);

                    for (var w = 1; w <= totalWeeks; w++) {
                        for (var d = 0; d < dayOrder.length; d++) {
                            var taskDate = new Date(startDate);
                            taskDate.setDate(taskDate.getDate() + (w - 1) * 7 + d);
                            taskDate.setHours(0, 0, 0, 0);
                            if (taskDate <= effectiveToday) {
                                var dayEn = dayOrder[d];
                                var dayKr = dayEnToKr[dayEn];
                                var tasks = getDayTasks(programType, w, dayEn);
                                tasks.forEach(function(taskName) {
                                    var parsed = parseTaskName(taskName);
                                    if (!parsed || parsed.type === 'unknown') return;
                                    tasksDue++;
                                    // 도래 과제 중 완료 여부 확인
                                    var matchedRecord = null;
                                    if (parsed.type === 'vocab' || parsed.type === 'intro-book') {
                                        matchedRecord = uniqueRecords.find(function(r) {
                                            return r.task_type === parsed.type && r.week == w && r.day === dayKr;
                                        });
                                    } else {
                                        var modNum = parsed.params && (parsed.params.module || parsed.params.number) ? (parsed.params.module || parsed.params.number) : parsed.moduleNumber;
                                        matchedRecord = uniqueRecords.find(function(r) {
                                            return r.task_type === parsed.type && r.module_number == modNum;
                                        });
                                    }
                                    if (matchedRecord) {
                                        tasksDueCompleted++;
                                        // 매칭된 auth_rate도 합산
                                        if (authRecords) {
                                            var ar = authRecords.find(function(a) { return a.study_record_id === matchedRecord.id; });
                                            if (ar) tasksDueAuthSum += (ar.auth_rate || 0);
                                        }
                                    }
                                });
                            }
                        }
                    }
                }
            }

            // 4) 인증률 계산 (도래 과제 기준)
            var authRateCalc = tasksDue > 0 ? tasksDueAuthSum : authSum;
            var authDenominator = tasksDue > 0 ? tasksDue : tasksSubmitted;
            var authRate = authDenominator > 0 ? Math.round(authRateCalc / authDenominator) : 0;

            // 5) 제출률 계산 (도래 과제 중 완료된 것 기준)
            var submitRate = tasksDue > 0 ? Math.round((tasksDueCompleted / tasksDue) * 100) : 0;

            // 6) 등급 & 환급 (tr_grade_rules 또는 하드코딩 폴백)
            var grade = 'F';
            var refundRate = 0;
            var deposit = 100000;

            if (typeof getGradeFromRules === 'function') {
                var gradeInfo = getGradeFromRules(authRate);
                grade = gradeInfo.letter;
                refundRate = gradeInfo.refundRate;
                deposit = gradeInfo.deposit || 100000;
            } else {
                // 폴백
                if (authRate >= 95) { grade = 'A'; refundRate = 1.0; }
                else if (authRate >= 90) { grade = 'B'; refundRate = 0.9; }
                else if (authRate >= 80) { grade = 'C'; refundRate = 0.8; }
                else if (authRate >= 70) { grade = 'D'; refundRate = 0.7; }
                else { grade = 'F'; refundRate = 0; }
            }

            var refundAmount = Math.round(deposit * refundRate);

            // 7) UPSERT
            var statsData = {
                user_id: user.id,
                calc_auth_rate: authRate,
                calc_grade: grade,
                calc_submit_rate: submitRate,
                calc_refund_amount: refundAmount,
                calc_tasks_due: tasksDue,
                calc_tasks_submitted: tasksDue > 0 ? tasksDueCompleted : tasksSubmitted,
                calc_auth_sum: tasksDue > 0 ? tasksDueAuthSum : authSum,
                calc_updated_at: new Date().toISOString()
            };

            await supabaseUpsert('tr_student_stats', statsData, 'user_id');
            console.log('📊 [Auth] 학생 통계 갱신:', grade, authRate + '%', (tasksDue > 0 ? tasksDueCompleted : tasksSubmitted) + '/' + tasksDue);

        } catch (e) {
            console.error('📊 [Auth] 학생 통계 갱신 실패:', e);
        }
    }
};

// ========================================
// FlowController + WritingFlow 통합 (함수 감싸기)
// ========================================
(function() {
    var setupDone = false;

    function setupIntegration() {
        if (setupDone) return;

        var fc = window.FlowController;
        if (!fc) return;

        // ── FlowController.start → AuthMonitor 시작 ──
        var originalStart = fc.start.bind(fc);
        fc.start = function(sectionType, moduleNumber) {
            AuthMonitor.start(sectionType, moduleNumber);
            AuthMonitor._snapshot = {
                sectionType: sectionType,
                moduleNumber: moduleNumber,
                firstAttemptResult: null
            };
            return originalStart(sectionType, moduleNumber);
        };

        // ── FlowController.afterFirstAttempt → 1차 완료 + study_record INSERT ──
        var originalAfterFirst = fc.afterFirstAttempt.bind(fc);
        fc.afterFirstAttempt = async function() {
            AuthMonitor.markStep1();
            if (AuthMonitor._snapshot && fc.firstAttemptResult) {
                AuthMonitor._snapshot.firstAttemptResult = fc.firstAttemptResult;
            }
            // ★ 1차 결과를 즉시 DB에 저장하여 _studyRecordId 확보
            await AuthMonitor.saveFirstAttempt();
            return originalAfterFirst();
        };

        // ── FlowController.showRetakeResult → 2차 완료 (R/L) ──
        var originalShowRetake = fc.showRetakeResult.bind(fc);
        fc.showRetakeResult = function(secondResults) {
            AuthMonitor.markStep2();
            
            // ★ 2차 결과를 result_json에 추가 저장 (_studyRecordId가 확보된 상태)
            if (AuthMonitor._studyRecordId && secondResults) {
                AuthMonitor._snapshot = AuthMonitor._snapshot || {};
                AuthMonitor._snapshot.retakeResult = secondResults;
                try {
                    var updatedJson = {
                        firstAttemptResult: fc.firstAttemptResult ? JSON.parse(JSON.stringify(fc.firstAttemptResult)) : null,
                        retakeResult: JSON.parse(JSON.stringify(secondResults))
                    };
                    supabaseUpdate('tr_study_records', 'id=eq.' + AuthMonitor._studyRecordId, {
                        result_json: updatedJson
                    });
                    console.log('💾 [Auth] result_json 업데이트 — 1차+2차 결과 저장 완료');
                } catch (e) {
                    console.warn('⚠️ [Auth] 2차 결과 저장 실패:', e);
                }
            }
            
            return originalShowRetake(secondResults);
        };

        // ── FlowController.showExplain → 2차 완료 + auth_record 선행 INSERT ──
        // 스피킹은 retakeResult를 거치지 않고 바로 explain으로 가는 경우가 있음
        // showExplain 진입 시 step2가 아직 안 됐으면 마킹
        // ★ 해설 진입 시점에 auth_record를 미리 INSERT (60%) → 오답노트 제출 시 UPDATE 가능
        var originalShowExplain = fc.showExplain.bind(fc);
        fc.showExplain = async function() {
            if (!AuthMonitor._step2Done) {
                AuthMonitor.markStep2();
            }
            // ★ auth_record 선행 INSERT (explanation 전이므로 60%)
            await AuthMonitor._ensureAuthRecordExists();
            return originalShowExplain();
        };

        // ── FlowController.finish → 최종 인증률 + auth_record 최종 UPDATE ──
        var originalFinish = fc.finish.bind(fc);
        fc.finish = async function() {
            if (fc.sectionType) {
                AuthMonitor._snapshot = AuthMonitor._snapshot || {};
                AuthMonitor._snapshot.sectionType = fc.sectionType;
                AuthMonitor._snapshot.moduleNumber = fc.moduleNumber;
                AuthMonitor._snapshot.firstAttemptResult = fc.firstAttemptResult;
            }
            // ★ 최종 저장: result_json 업데이트 + auth_record 최종 UPDATE
            // (result-screen, test-screen 숨기기는 backToSchedule()에서 처리)
            await AuthMonitor.saveFinalRecords();
            originalFinish();
            AuthMonitor.stop();
            AuthMonitor._snapshot = null;
        };

        console.log('✅ [Auth] FlowController 연동');

        // ── WritingFlow 통합 ──
        var wf = window.WritingFlow;
        if (wf) {
            // WritingFlow.start → AuthMonitor 시작
            if (wf.start) {
                var originalWFStart = wf.start.bind(wf);
                wf.start = function(moduleNumber, moduleConfig) {
                    AuthMonitor.start('writing', moduleNumber);
                    return originalWFStart(moduleNumber, moduleConfig);
                };
            }

            // WritingFlow 1차 완료 감지 — arrange 1차 결과 후
            // Step 4 (arrange 1차 결과)에 진입하면 1차 완료
            if (wf.runStep4) {
                var originalStep4 = wf.runStep4.bind(wf);
                wf.runStep4 = async function() {
                    AuthMonitor.markStep1();
                    // ★ 1차 결과를 즉시 DB에 저장하여 _studyRecordId 확보
                    await AuthMonitor.saveFirstAttempt();
                    return originalStep4();
                };
            }

            // WritingFlow 2차 완료 감지 — Step 10 완료 후 Step 11 진입 시
            if (wf.runStep11_email) {
                var originalStep11 = wf.runStep11_email.bind(wf);
                wf.runStep11_email = function() {
                    AuthMonitor.markStep2();
                    return originalStep11();
                };
            }

            // WritingFlow.runStep12 → 최종 기록 저장
            if (wf.runStep12) {
                var originalStep12 = wf.runStep12.bind(wf);
                wf.runStep12 = async function() {
                    if (!AuthMonitor.isActive) {
                        AuthMonitor.start('writing', wf.moduleNumber || 0);
                    }
                    await AuthMonitor.saveFinalRecords();
                    AuthMonitor.stop();
                    return originalStep12();
                };
            }

            console.log('✅ [Auth] WritingFlow 연동');
        }

        // ── 오답노트 제출 이벤트 감지 ──
        window.addEventListener('errorNoteSubmitted', function(e) {
            var detail = e.detail || {};
            // Raw Point용 데이터 저장
            AuthMonitor._errorNoteWordCount = detail.wordCount || 0;
            AuthMonitor._speakingFileCount = detail.speakingFileCount || 0;
            // 기존 호환성 유지
            AuthMonitor.markExplanation(detail.isFraud);
            AuthMonitor.updateExplanationStatus();
            console.log('📝 [Auth] 오답노트 데이터:', 'words:', AuthMonitor._errorNoteWordCount, 'files:', AuthMonitor._speakingFileCount);
        });

        // 오답노트 이벤트 연동 완료

        setupDone = true;
    }

    // 페이지 로드 후 연결
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(setupIntegration, 500);
        });
    } else {
        setTimeout(setupIntegration, 500);
    }

    // 반복 체크
    var checkCount = 0;
    var checkInterval = setInterval(function() {
        if (setupDone || checkCount > 20) {
            clearInterval(checkInterval);
            return;
        }
        setupIntegration();
        checkCount++;
    }, 1000);
})();

console.log('✅ auth-monitor.js v3 로드');
