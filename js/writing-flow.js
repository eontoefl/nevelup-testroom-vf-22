/**
 * ================================================
 * writing-flow.js (v=006)
 * 라이팅 전용 플로우 컨트롤러 (콜백 체인 방식)
 * ================================================
 * 
 * Step 1:  arrange 1차 (10문제, 6:50 제한시간)
 * Step 2:  email 1차 작성 (7:00 제한시간)
 * Step 3:  discussion 1차 작성 (10:00 제한시간)
 * Step 4:  arrange 1차 결과 (X/10 점수만 표시, 해설 없음)
 * Step 5:  arrange 2차 (틀린 문제만 다시풀기)
 * Step 6:  arrange 2차 해설 (단순 점수 비교 + 기존 해설)
 * Step 7:  email 한글 번역 보기 (참고용)
 * Step 8:  email 2차 작성 (시간제한 없음)
 * Step 9:  discussion 한글 번역 보기 (참고용)
 * Step 10: discussion 2차 작성 (시간제한 없음)
 * Step 11: 최종 해설 (email결과화면 → discussion결과화면) ★ 단어배열은 Step 6에서 완결
 * Step 12: 학습 일정 복귀
 * 
 * v003 변경사항:
 * - Step 4: 자체 스크린 사용 (writingArrangeScoreScreen), 기존 결과화면 미사용
 * - Step 6: 문제별 비교 제거, 단순 점수 비교(카드) + 하단에 기존 해설 렌더링
 * - Step 7/9: escapeHtml 대신 raw newline 유지 (white-space:pre-wrap)
 * - Step 11: 기존 showEmailResult() / showDiscussionResult() 사용
 */

console.log('✅ writing-flow.js 로드 시작');

const WritingFlow = {
    // 상태
    currentStep: 0,
    moduleNumber: null,
    moduleConfig: null,
    
    // 데이터 저장
    arrange1stResult: null,
    arrange2ndResult: null,
    email1stText: '',
    email1stData: null,    // email 1차 결과 데이터 전체
    email2ndText: '',
    email2ndData: null,
    discussion1stText: '',
    discussion1stData: null,
    discussion2ndText: '',
    discussion2ndData: null,
    koData: null,
    
    activeController: null,
    
    // ========================================
    // 진입점
    // ========================================
    async start(moduleNumber, moduleConfig) {
        console.log('='.repeat(80));
        console.log(`✏️ [WritingFlow] Writing ${moduleNumber} 시작`);
        console.log('='.repeat(80));
        
        this.cleanup();
        this.moduleNumber = moduleNumber;
        this.moduleConfig = moduleConfig;
        this.currentStep = 1;
        
        // ★ AutoSave 라이팅 통합 세션 시작 (레코드 1개만 생성)
        if (window.AutoSave) {
            await window.AutoSave.initWritingSession(moduleNumber);
        }
        
        // 한글 번역 데이터 미리 로드
        try {
            if (window.WritingKoData) {
                this.koData = await WritingKoData.load();
                console.log('📦 [WritingFlow] 한글 번역 데이터 로드 완료');
                console.log('📦 [WritingFlow] email 키:', JSON.stringify(Object.keys(this.koData?.email || {})));
                console.log('📦 [WritingFlow] discussion 키:', JSON.stringify(Object.keys(this.koData?.discussion || {})));
            } else {
                console.warn('⚠️ [WritingFlow] WritingKoData 객체가 없음');
            }
        } catch (e) {
            console.warn('⚠️ [WritingFlow] 한글 번역 데이터 로드 실패:', e);
            this.koData = { email: {}, discussion: {} };
        }
        
        this.runStep1();
    },
    
    // ========================================
    // 유틸리티
    // ========================================
    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    },
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    /**
     * 동적 스크린 생성/가져오기 (Step 4용)
     */
    getOrCreateScreen(id, headerHtml) {
        let screen = document.getElementById(id);
        if (!screen) {
            screen = document.createElement('div');
            screen.id = id;
            screen.className = 'screen';
            screen.style.display = 'none';
            screen.innerHTML = `
                <div class="test-header">
                    <div class="test-title">${headerHtml}</div>
                </div>
                <div class="test-content" style="overflow-y:auto; height:calc(100vh - 60px); padding:20px;">
                </div>
            `;
            document.body.appendChild(screen);
        }
        return screen;
    },
    
    // ========================================
    // Step 1: arrange 1차 (10문제)
    // ========================================
    runStep1() {
        this.currentStep = 1;
        console.log('📝 [WritingFlow] Step 1: arrange 1차 시작');
        
        const arrangeConfig = {
            moduleId: this.moduleConfig.moduleId,
            moduleName: this.moduleConfig.moduleName,
            sectionType: 'writing',
            totalQuestions: 10,
            timeLimit: null,
            components: [this.moduleConfig.components.find(c => c.type === 'arrange')]
        };
        
        const controller = new ModuleController(arrangeConfig);
        this.activeController = controller;
        
        controller.setOnComplete((result) => {
            console.log('✅ [WritingFlow] Step 1 완료: arrange 1차');
            this.arrange1stResult = JSON.parse(sessionStorage.getItem('arrangeResults') || 'null');
            // ★ 라이팅 통합 저장
            if (window.AutoSave) {
                window.AutoSave.updateWritingStep({ currentStep: 1, totalSteps: 12, stepName: 'arrange_1st', componentType: 'arrange', attempt: 1 });
            }
            this.runStep2();
        });
        
        controller.startModule();
    },
    
    // ========================================
    // Step 2: email 1차 작성
    // ========================================
    runStep2() {
        this.currentStep = 2;
        console.log('📧 [WritingFlow] Step 2: email 1차 시작');
        
        const emailConfig = {
            moduleId: this.moduleConfig.moduleId,
            moduleName: this.moduleConfig.moduleName,
            sectionType: 'writing',
            totalQuestions: 1,
            timeLimit: null,
            components: [this.moduleConfig.components.find(c => c.type === 'email')]
        };
        
        const controller = new ModuleController(emailConfig);
        this.activeController = controller;
        
        controller.setOnComplete((result) => {
            console.log('✅ [WritingFlow] Step 2 완료: email 1차');
            if (result && result.componentResults) {
                const emailResult = result.componentResults.find(c => c.componentType === 'email');
                if (emailResult) {
                    this.email1stData = emailResult;
                    this.email1stText = emailResult.userAnswer || emailResult.responseText || '';
                    console.log('📧 [WritingFlow] email1stData 저장:', !!this.email1stData, 'text길이:', this.email1stText.length);
                }
            }
            // ★ 라이팅 통합 저장
            if (window.AutoSave) {
                window.AutoSave.updateWritingStep({ currentStep: 2, totalSteps: 12, stepName: 'email_1st', componentType: 'email', attempt: 1 });
            }
            this.runStep3();
        });
        
        controller.startModule();
    },
    
    // ========================================
    // Step 3: discussion 1차 작성
    // ========================================
    runStep3() {
        this.currentStep = 3;
        console.log('💬 [WritingFlow] Step 3: discussion 1차 시작');
        
        const discussionConfig = {
            moduleId: this.moduleConfig.moduleId,
            moduleName: this.moduleConfig.moduleName,
            sectionType: 'writing',
            totalQuestions: 1,
            timeLimit: null,
            components: [this.moduleConfig.components.find(c => c.type === 'discussion')]
        };
        
        const controller = new ModuleController(discussionConfig);
        this.activeController = controller;
        
        controller.setOnComplete((result) => {
            console.log('✅ [WritingFlow] Step 3 완료: discussion 1차');
            if (result && result.componentResults) {
                const discResult = result.componentResults.find(c => c.componentType === 'discussion');
                if (discResult) {
                    this.discussion1stData = discResult;
                    this.discussion1stText = discResult.userAnswer || discResult.responseText || '';
                    console.log('💬 [WritingFlow] discussion1stData 저장:', !!this.discussion1stData, 'text길이:', this.discussion1stText.length);
                }
            }
            // ★ 라이팅 통합 저장
            if (window.AutoSave) {
                window.AutoSave.updateWritingStep({ currentStep: 3, totalSteps: 12, stepName: 'discussion_1st', componentType: 'discussion', attempt: 1 });
            }
            this.runStep4();
        });
        
        controller.startModule();
    },
    
    // ========================================
    // Step 4: arrange 1차 결과 (X/10 점수만, 해설 없음)
    // ★ 기존 writingArrangeResultScreen 대신 자체 동적 화면 사용
    // ========================================
    runStep4() {
        this.currentStep = 4;
        console.log('📊 [WritingFlow] Step 4: arrange 1차 결과 화면 (점수만)');
        
        this.hideAllScreens();
        
        const screen = this.getOrCreateScreen(
            'writingArrangeScoreScreen',
            '<i class="fas fa-check-circle"></i> <span>Build a Sentence - 1차 결과</span>'
        );
        
        const r = this.arrange1stResult;
        const correct = r ? r.correct : 0;
        const total = r ? r.total : 10;
        const incorrect = total - correct;
        const accuracy = r ? r.accuracy : 0;
        
        const content = screen.querySelector('.test-content');
        content.innerHTML = `
            <div style="max-width:500px; margin:40px auto; text-align:center;">
                <!-- 점수 카드 -->
                <div style="background:#fff; border-radius:16px; padding:40px 32px; box-shadow:0 4px 20px rgba(0,0,0,0.08); margin-bottom:24px;">
                    <div style="display:inline-block; background:#e3f2fd; color:#1565c0; font-size:13px; font-weight:600; padding:4px 14px; border-radius:20px; margin-bottom:16px;">
                        <i class="fas fa-puzzle-piece"></i> 단어배열 (Build a Sentence)
                    </div>
                    <div style="font-size:15px; color:#888; margin-bottom:12px;">1차 채점 결과</div>
                    <div style="font-size:64px; font-weight:bold; color:#333; line-height:1.2;">${correct}<span style="font-size:32px; color:#999;">/${total}</span></div>
                    <div style="font-size:18px; color:#666; margin-top:8px;">${accuracy}%</div>
                    
                    <div style="display:flex; justify-content:center; gap:40px; margin-top:24px;">
                        <div style="text-align:center;">
                            <div style="font-size:28px; font-weight:bold; color:#28a745;">✅ ${correct}</div>
                            <div style="font-size:13px; color:#888;">정답</div>
                        </div>
                        <div style="text-align:center;">
                            <div style="font-size:28px; font-weight:bold; color:#dc3545;">❌ ${incorrect}</div>
                            <div style="font-size:13px; color:#888;">오답</div>
                        </div>
                    </div>
                </div>
                
                <!-- 안내 -->
                <div style="background:#f0f4ff; border-radius:10px; padding:14px 20px; margin-bottom:24px;">
                    <p style="font-size:13px; color:#555; margin:0; line-height:1.7; text-align:center;">
                        단어배열은 <b>2차 풀이</b>를 진행하고,<br>
                        이메일·토론형은 <b>모범답안을 참고</b>하여 재작성합니다.
                    </p>
                </div>
                
                ${incorrect > 0 ? `
                    <button class="btn btn-primary btn-large" onclick="WritingFlow.runStep5()" 
                        style="padding:14px 40px; font-size:16px; background:#4A90D9; color:white; border:none; border-radius:8px; cursor:pointer; width:100%; max-width:360px;">
                        <i class="fas fa-redo"></i> 단어배열 2차 풀이 시작 (틀린 ${incorrect}문제)
                    </button>
                ` : `
                    <p style="color:#28a745; font-size:16px; margin-bottom:16px;">🎉 모든 문제를 맞혔습니다!</p>
                    <button class="btn btn-primary btn-large" onclick="WritingFlow.runStep6()"
                        style="padding:14px 40px; font-size:16px; background:#4A90D9; color:white; border:none; border-radius:8px; cursor:pointer; width:100%; max-width:360px;">
                        <i class="fas fa-arrow-right"></i> 단어배열 해설 보기
                    </button>
                `}
            </div>
        `;
        
        screen.style.display = 'block';
    },
    
    // ========================================
    // Step 5: arrange 2차 (전체 순회, 맞은 문제 readonly)
    // ========================================
    runStep5() {
        this.currentStep = 5;
        console.log('🔄 [WritingFlow] Step 5: arrange 2차 시작 (전체 순회)');
        
        if (!this.arrange1stResult) {
            console.warn('⚠️ [WritingFlow] 1차 결과 없음, 건너뜀');
            this.runStep6();
            return;
        }
        
        const wrongIndices = [];
        this.arrange1stResult.results.forEach((r, i) => {
            if (!r.isCorrect) wrongIndices.push(i);
        });
        
        if (wrongIndices.length === 0) {
            console.log('🎉 [WritingFlow] 틀린 문제 없음, Step 6으로');
            this.runStep6();
            return;
        }
        
        const total = this.arrange1stResult.total || 10;
        console.log(`🔄 [WritingFlow] 전체 ${total}문제 순회 (틀린 ${wrongIndices.length}개: ${wrongIndices.join(', ')})`);
        
        const arrangeComp = this.moduleConfig.components.find(c => c.type === 'arrange');
        
        window.isArrangeRetake = true;
        window.arrangeRetakeWrongIndices = wrongIndices;
        
        const retakeConfig = {
            moduleId: this.moduleConfig.moduleId,
            moduleName: this.moduleConfig.moduleName,
            sectionType: 'writing',
            totalQuestions: total,  // ★ 전체 문제 수
            timeLimit: null,
            components: [{
                type: 'arrange',
                setId: arrangeComp.setId,
                questionsPerSet: total,  // ★ 전체
                isRetake: true,
                wrongIndices: wrongIndices
            }]
        };
        
        const controller = new ModuleController(retakeConfig);
        this.activeController = controller;
        
        controller.setOnComplete((result) => {
            console.log('✅ [WritingFlow] Step 5 완료: arrange 2차');
            window.isArrangeRetake = false;
            window.arrangeRetakeWrongIndices = null;
            
            // ★ Floating UI 정리
            const floatingUI = document.getElementById('arrangeRetakeFloating');
            if (floatingUI) floatingUI.remove();
            
            this.arrange2ndResult = JSON.parse(sessionStorage.getItem('arrangeResults') || 'null');
            // ★ 라이팅 통합 저장
            if (window.AutoSave) {
                window.AutoSave.updateWritingStep({ currentStep: 5, totalSteps: 12, stepName: 'arrange_2nd', componentType: 'arrange', attempt: 2 });
            }
            this.runStep6();
        });
        
        controller.startModule();
    },
    
    // ========================================
    // Step 6: arrange 해설 (단순 점수 비교 + 기존 해설)
    // ★ 문제별 OX 비교 제거 → 단순 점수 카드 비교 + 하단 해설
    // ========================================
    runStep6() {
        this.currentStep = 6;
        console.log('📖 [WritingFlow] Step 6: arrange 해설 화면');
        
        this.hideAllScreens();
        
        const screen = document.getElementById('writingArrangeCompareScreen');
        if (screen) {
            screen.style.display = 'block';
            this.renderArrangeCompare(screen);
        }
    },
    
    renderArrangeCompare(screen) {
        const r1 = this.arrange1stResult;
        const r2 = this.arrange2ndResult;
        const content = screen.querySelector('.test-content') || screen;
        
        const total = r1 ? r1.total : 10;
        const first1stCorrect = r1 ? r1.correct : 0;
        
        // 2차 결과에서 정답 수 계산 (전체 순회 모드이므로 틀렸던 문제 중 맞은 것만 카운트)
        let retakeCorrect = 0;
        if (r2 && r2.results && r1 && r1.results) {
            r1.results.forEach((q1, idx) => {
                if (!q1.isCorrect) {
                    // 1차에서 틀린 문제 → 2차 결과에서 확인
                    const q2 = r2.results[idx];
                    if (q2 && q2.isCorrect) retakeCorrect++;
                }
            });
        }
        const combinedCorrect = first1stCorrect + retakeCorrect;
        
        // OX 테이블 행 생성
        let thCells = '';
        let row1stCells = '';
        let row2ndCells = '';
        
        for (let i = 0; i < total; i++) {
            const q1Correct = r1 && r1.results && r1.results[i] ? r1.results[i].isCorrect : false;
            let q2Correct = null; // null = 2차 불필요 (1차에서 맞음)
            
            if (!q1Correct && r2 && r2.results && r2.results[i]) {
                q2Correct = r2.results[i].isCorrect;
            }
            
            thCells += `<th style="padding:8px 6px; font-size:12px; color:#666; font-weight:600; min-width:36px;">${i + 1}</th>`;
            
            // 1차 OX
            row1stCells += `<td style="padding:8px 6px; text-align:center; font-size:18px;">
                ${q1Correct ? '<span style="color:#4CAF50;">O</span>' : '<span style="color:#F44336;">X</span>'}
            </td>`;
            
            // 2차 OX
            if (q1Correct) {
                // 1차에서 맞았으면 2차도 자동 O
                row2ndCells += `<td style="padding:8px 6px; text-align:center; font-size:18px;">
                    <span style="color:#4CAF50;">O</span>
                </td>`;
            } else if (q2Correct === true) {
                row2ndCells += `<td style="padding:8px 6px; text-align:center; font-size:18px;">
                    <span style="color:#2196F3;">O</span>
                </td>`;
            } else if (q2Correct === false) {
                row2ndCells += `<td style="padding:8px 6px; text-align:center; font-size:18px;">
                    <span style="color:#F44336;">X</span>
                </td>`;
            } else {
                row2ndCells += `<td style="padding:8px 6px; text-align:center; font-size:14px; color:#ccc;">-</td>`;
            }
        }
        
        let html = `
            <div style="max-width:800px; margin:0 auto; padding:20px;">
                <h2 style="text-align:center; margin-bottom:24px; color:#333;">
                    <i class="fas fa-chart-bar"></i> 단어배열 - 1차 vs 2차 비교
                </h2>
                
                <!-- 점수 비교 카드 -->
                <div style="display:flex; gap:16px; margin-bottom:24px; justify-content:center; flex-wrap:wrap;">
                    <div style="flex:1; min-width:160px; max-width:200px; background:#f8f9fa; border-radius:12px; padding:16px; text-align:center; border:2px solid #dee2e6;">
                        <div style="font-size:13px; color:#666; margin-bottom:6px;">1차</div>
                        <div style="font-size:32px; font-weight:bold; color:#333;">${first1stCorrect}/${total}</div>
                    </div>
                    <div style="display:flex; align-items:center; font-size:24px; color:#999;">→</div>
                    <div style="flex:1; min-width:160px; max-width:200px; background:#e8f5e9; border-radius:12px; padding:16px; text-align:center; border:2px solid #81c784;">
                        <div style="font-size:13px; color:#2e7d32; margin-bottom:6px;">최종</div>
                        <div style="font-size:32px; font-weight:bold; color:#2e7d32;">${combinedCorrect}/${total}</div>
                    </div>
                </div>
                
                <!-- OX 비교 테이블 -->
                <div style="overflow-x:auto; margin-bottom:32px;">
                    <table style="width:100%; border-collapse:collapse; text-align:center; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.06);">
                        <thead>
                            <tr style="background:#f8f9fa; border-bottom:2px solid #dee2e6;">
                                <th style="padding:10px 12px; font-size:13px; color:#666; font-weight:600; text-align:left; min-width:50px;"></th>
                                ${thCells}
                            </tr>
                        </thead>
                        <tbody>
                            <tr style="border-bottom:1px solid #eee;">
                                <td style="padding:10px 12px; font-size:13px; font-weight:600; color:#333; text-align:left; white-space:nowrap;">1차</td>
                                ${row1stCells}
                            </tr>
                            <tr>
                                <td style="padding:10px 12px; font-size:13px; font-weight:600; color:#333; text-align:left; white-space:nowrap;">2차</td>
                                ${row2ndCells}
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <hr style="border:none; border-top:2px solid #eee; margin:32px 0;">
                
                <!-- ★ 전체 문제 해설 (result-container 스타일 적용) -->
                <h3 style="margin-bottom:16px; color:#555;">
                    <i class="fas fa-lightbulb"></i> 전체 문제 해설
                </h3>
                <div class="result-container">
                    <div class="result-details" id="arrangeCompareDetails">
                        <!-- renderArrangeResultItem으로 채워짐 -->
                    </div>
                </div>
                
                <div style="text-align:center; margin-top:32px;">
                    <button class="btn btn-primary btn-large" onclick="WritingFlow.runStep7()" 
                        style="padding:14px 40px; font-size:16px; background:#4A90D9; color:white; border:none; border-radius:8px; cursor:pointer;">
                        <i class="fas fa-arrow-right"></i> 다음: 이메일 해설
                    </button>
                </div>
            </div>
        `;
        
        content.innerHTML = html;
        
        // ★ 해설 렌더링 (renderArrangeResultItem 사용 - Step 11-A와 동일)
        const detailsContainer = document.getElementById('arrangeCompareDetails');
        if (detailsContainer && r1 && r1.results) {
            let detailHtml = '';
            r1.results.forEach((result, index) => {
                if (typeof window.renderArrangeResultItem === 'function') {
                    detailHtml += window.renderArrangeResultItem(result, index);
                } else if (typeof renderArrangeResultItem === 'function') {
                    detailHtml += renderArrangeResultItem(result, index);
                }
            });
            detailsContainer.innerHTML = detailHtml;
        }
    },
    
    // ========================================
    // Step 7: email 한글 번역 보기
    // ========================================
    runStep7() {
        this.currentStep = 7;
        console.log('📖 [WritingFlow] Step 7: email 한글 번역 보기');
        
        this.hideAllScreens();
        
        const screen = document.getElementById('writingEmailExplainScreen');
        if (screen) {
            screen.style.display = 'block';
            this.renderEmailExplain(screen);
        }
    },
    
    renderEmailExplain(screen) {
        const content = screen.querySelector('.test-content') || screen;
        const emailComp = this.moduleConfig.components.find(c => c.type === 'email');
        const setId = emailComp ? `email_set_${String(emailComp.setId).padStart(4, '0')}` : 'email_set_0001';
        
        // ★ 디버깅: koData 상태 확인
        console.log('🔍 [EmailExplain] setId:', setId);
        console.log('🔍 [EmailExplain] koData 존재:', !!this.koData);
        console.log('🔍 [EmailExplain] koData.email 키:', this.koData ? JSON.stringify(Object.keys(this.koData.email || {})) : 'null');
        console.log('🔍 [EmailExplain] koData.email[setId]:', this.koData?.email?.[setId] ? `${this.koData.email[setId].substring(0, 100)}...` : 'NOT FOUND');
        
        const koText = this.koData?.email?.[setId] || '(한글 번역 데이터가 아직 준비되지 않았습니다)';
        
        const question = this.email1stData?.question || {};
        
        // ★ 줄바꿈을 보존하기 위해 white-space:pre-wrap 사용
        // escapeHtml은 <, >, & 등만 이스케이프하고 \n은 그대로 유지
        content.innerHTML = `
            <div style="max-width:800px; margin:0 auto; padding:20px;">
                <h2 style="text-align:center; margin-bottom:8px; color:#333;">
                    <i class="fas fa-envelope"></i> 이메일 작성 - 모범답안 번역
                </h2>
                <p style="text-align:center; color:#888; font-size:14px; margin-bottom:12px;">
                    아래 한글 번역을 참고하여 2차 작성에서 영작해보세요
                </p>
                <div style="background:#e8f4fd; border-radius:8px; padding:14px 16px; margin-bottom:24px; font-size:13px; color:#1565c0; line-height:1.7;">
                    <i class="fas fa-info-circle"></i>
                    직접 작성한 모범답안을 <b>한글로 번역</b>했습니다.
                    영어로 그대로 보여주면 따라하게 될 수 있어서, 머릿속에서 영작하고 프로세싱할 수 있도록 일부러 한국어로 준비했습니다.
                </div>
                
                ${question.scenario ? `
                <div style="background:#f0f4ff; border-radius:8px; padding:16px; margin-bottom:16px;">
                    <div style="font-size:13px; color:#666; margin-bottom:4px;">📋 상황</div>
                    <div style="color:#333;">${this.escapeHtml(question.scenario)}</div>
                </div>` : ''}
                
                ${question.task ? `
                <div style="background:#f0f4ff; border-radius:8px; padding:16px; margin-bottom:16px;">
                    <div style="font-size:13px; color:#666; margin-bottom:4px;">📝 과제</div>
                    <div style="color:#333;">${this.escapeHtml(question.task)}</div>
                    ${question.instructions && question.instructions.length > 0 ? `
                    <ul style="margin:8px 0 0 0; padding-left:20px; color:#444;">
                        ${question.instructions.map(inst => inst ? `<li style="margin-bottom:4px;">${this.escapeHtml(inst)}</li>` : '').join('')}
                    </ul>` : ''}
                </div>` : ''}
                
                <div style="background:#fff8e1; border:2px solid #ffc107; border-radius:12px; padding:24px; margin-bottom:24px;">
                    <div style="font-size:14px; color:#f57f17; font-weight:bold; margin-bottom:12px;">
                        📌 모범답안 한글 번역
                    </div>
                    <div style="color:#333; font-size:15px; line-height:1.8; white-space:pre-wrap;">${this.escapeHtml(koText)}</div>
                </div>
                
                ${this.email1stText ? `
                <div style="background:#f5f5f5; border-radius:8px; padding:16px; margin-bottom:24px;">
                    <div style="font-size:13px; color:#666; margin-bottom:8px;">📝 나의 1차 작성</div>
                    <div style="color:#555; font-size:14px; line-height:1.6; white-space:pre-wrap;">${this.escapeHtml(this.email1stText)}</div>
                </div>` : ''}
                
                <div style="text-align:center; margin-top:32px;">
                    <button class="btn btn-primary btn-large" onclick="WritingFlow.runStep8()"
                        style="padding:14px 40px; font-size:16px; background:#4A90D9; color:white; border:none; border-radius:8px; cursor:pointer;">
                        <i class="fas fa-pen"></i> 이메일 2차 작성하기
                    </button>
                </div>
            </div>
        `;
    },
    
    // ========================================
    // Step 8: email 2차 작성 (시간제한 없음)
    // ========================================
    async runStep8() {
        this.currentStep = 8;
        console.log('📧 [WritingFlow] Step 8: email 2차 시작 (시간제한 없음)');
        
        // ★ 가이드 팝업: 이메일 2차 작성 안내
        if (typeof showGuidePopup === 'function' && !window._isReplayMode && !window._isPracticeMode) {
            await showGuidePopup({
                icon: '✍️',
                title: '이메일 2차 작성',
                desc: '지금부터 실전 풀이 때 봤던 <b>동일한 화면</b>이 나옵니다.<br>시간제한은 없습니다.',
                notice: '방금 읽은 모범답안은 참고만 하세요.<br>일부러 돌아갈 수 없게 해두었습니다.<br>보고 따라쓰는 것이 아닌, <b>자신의 말과 내용</b>으로 다시 써보세요.',
                btn: '시작하기',
                theme: 'theme-blue'
            });
        }
        
        window.isSecondAttempt = true;
        window.currentAttemptNumber = 2;
        window.writingFlowNoTimer = true;
        
        const emailConfig = {
            moduleId: this.moduleConfig.moduleId,
            moduleName: this.moduleConfig.moduleName,
            sectionType: 'writing',
            totalQuestions: 1,
            timeLimit: null,
            isSecondAttempt: true,
            components: [{
                ...this.moduleConfig.components.find(c => c.type === 'email'),
                noTimeLimit: true
            }]
        };
        
        const controller = new ModuleController(emailConfig);
        this.activeController = controller;
        
        controller.setOnComplete((result) => {
            console.log('✅ [WritingFlow] Step 8 완료: email 2차');
            window.isSecondAttempt = false;
            window.currentAttemptNumber = 1;
            window.writingFlowNoTimer = false;
            
            if (result && result.componentResults) {
                const emailResult = result.componentResults.find(c => c.componentType === 'email');
                if (emailResult) {
                    this.email2ndData = emailResult;
                    this.email2ndText = emailResult.userAnswer || emailResult.responseText || '';
                }
            }
            // ★ 라이팅 통합 저장
            if (window.AutoSave) {
                window.AutoSave.updateWritingStep({ currentStep: 8, totalSteps: 12, stepName: 'email_2nd', componentType: 'email', attempt: 2 });
            }
            this.runStep9();
        });
        
        controller.startModule();
    },
    
    // ========================================
    // Step 9: discussion 한글 번역 보기
    // ========================================
    runStep9() {
        this.currentStep = 9;
        console.log('📖 [WritingFlow] Step 9: discussion 한글 번역 보기');
        
        this.hideAllScreens();
        
        const screen = document.getElementById('writingDiscussionExplainScreen');
        if (screen) {
            screen.style.display = 'block';
            this.renderDiscussionExplain(screen);
        }
    },
    
    renderDiscussionExplain(screen) {
        const content = screen.querySelector('.test-content') || screen;
        const discComp = this.moduleConfig.components.find(c => c.type === 'discussion');
        const setId = discComp ? `discussion_set_${String(discComp.setId).padStart(4, '0')}` : 'discussion_set_0001';
        
        // ★ 디버깅: koData 상태 확인
        console.log('🔍 [DiscussionExplain] setId:', setId);
        console.log('🔍 [DiscussionExplain] koData 존재:', !!this.koData);
        console.log('🔍 [DiscussionExplain] koData.discussion 키:', this.koData ? JSON.stringify(Object.keys(this.koData.discussion || {})) : 'null');
        console.log('🔍 [DiscussionExplain] koData.discussion[setId]:', this.koData?.discussion?.[setId] ? `${this.koData.discussion[setId].substring(0, 100)}...` : 'NOT FOUND');
        
        let koText = this.koData?.discussion?.[setId] || '(한글 번역 데이터가 아직 준비되지 않았습니다)';
        
        const question = this.discussion1stData?.question || {};
        
        // ★ {name1}/{name2} 치환을 위한 프로필 정보 (sessionStorage 우선 → window 폴백)
        let profiles = null;
        const savedProfiles = sessionStorage.getItem('discussionProfiles');
        if (savedProfiles) {
            try { 
                profiles = JSON.parse(savedProfiles);
                console.log('📝 [ko-모범답안] sessionStorage에서 프로필 복원:', profiles.student1?.name, profiles.student2?.name);
            } catch(e) {}
        }
        if (!profiles) {
            profiles = window.currentDiscussionProfiles;
        }
        if (!profiles) {
            profiles = { student1: { name: 'Student 1' }, student2: { name: 'Student 2' } };
        }
        const replaceName = (text) => {
            if (!text) return text;
            return text.replace(/\{name1\}/g, profiles.student1.name).replace(/\{name2\}/g, profiles.student2.name);
        };
        
        // 한글 번역에도 이름 치환 적용
        koText = replaceName(koText);
        
        const topicText = replaceName(question.topic || '');
        const student1Text = replaceName(question.student1Opinion || '');
        const student2Text = replaceName(question.student2Opinion || '');
        
        content.innerHTML = `
            <div style="max-width:800px; margin:0 auto; padding:20px;">
                <h2 style="text-align:center; margin-bottom:8px; color:#333;">
                    <i class="fas fa-comments"></i> 토론형 글쓰기 - 모범답안 번역
                </h2>
                <p style="text-align:center; color:#888; font-size:14px; margin-bottom:24px;">
                    아래 한글 번역을 참고하여 2차 작성에서 영작해보세요
                </p>
                
                ${topicText ? `
                <div style="background:#f0f4ff; border-radius:8px; padding:16px; margin-bottom:16px;">
                    <div style="font-size:13px; color:#666; margin-bottom:4px;">💬 토론 주제</div>
                    <div style="color:#333; margin-bottom:12px;">${this.escapeHtml(topicText)}</div>
                    ${student1Text ? `
                    <div style="background:#fff; border-radius:6px; padding:10px 12px; margin-bottom:8px; border-left:3px solid #42a5f5;">
                        <div style="font-size:12px; color:#1976d2; font-weight:600; margin-bottom:4px;">🙋 ${this.escapeHtml(profiles.student1.name)}</div>
                        <div style="color:#444; font-size:14px; line-height:1.5;">${this.escapeHtml(student1Text)}</div>
                    </div>` : ''}
                    ${student2Text ? `
                    <div style="background:#fff; border-radius:6px; padding:10px 12px; border-left:3px solid #ef5350;">
                        <div style="font-size:12px; color:#c62828; font-weight:600; margin-bottom:4px;">🙋 ${this.escapeHtml(profiles.student2.name)}</div>
                        <div style="color:#444; font-size:14px; line-height:1.5;">${this.escapeHtml(student2Text)}</div>
                    </div>` : ''}
                </div>` : ''}
                
                <div style="background:#fff8e1; border:2px solid #ffc107; border-radius:12px; padding:24px; margin-bottom:24px;">
                    <div style="font-size:14px; color:#f57f17; font-weight:bold; margin-bottom:12px;">
                        📌 모범답안 한글 번역
                    </div>
                    <div style="color:#333; font-size:15px; line-height:1.8; white-space:pre-wrap;">${this.escapeHtml(koText)}</div>
                </div>
                
                ${this.discussion1stText ? `
                <div style="background:#f5f5f5; border-radius:8px; padding:16px; margin-bottom:24px;">
                    <div style="font-size:13px; color:#666; margin-bottom:8px;">📝 나의 1차 작성</div>
                    <div style="color:#555; font-size:14px; line-height:1.6; white-space:pre-wrap;">${this.escapeHtml(this.discussion1stText)}</div>
                </div>` : ''}
                
                <div style="text-align:center; margin-top:32px;">
                    <button class="btn btn-primary btn-large" onclick="WritingFlow.runStep10()"
                        style="padding:14px 40px; font-size:16px; background:#4A90D9; color:white; border:none; border-radius:8px; cursor:pointer;">
                        <i class="fas fa-pen"></i> 토론 2차 작성하기
                    </button>
                </div>
            </div>
        `;
    },
    
    // ========================================
    // Step 10: discussion 2차 작성 (시간제한 없음)
    // ========================================
    runStep10() {
        this.currentStep = 10;
        console.log('💬 [WritingFlow] Step 10: discussion 2차 시작 (시간제한 없음)');
        
        window.isSecondAttempt = true;
        window.currentAttemptNumber = 2;
        window.writingFlowNoTimer = true;
        
        const discussionConfig = {
            moduleId: this.moduleConfig.moduleId,
            moduleName: this.moduleConfig.moduleName,
            sectionType: 'writing',
            totalQuestions: 1,
            timeLimit: null,
            isSecondAttempt: true,
            components: [{
                ...this.moduleConfig.components.find(c => c.type === 'discussion'),
                noTimeLimit: true
            }]
        };
        
        const controller = new ModuleController(discussionConfig);
        this.activeController = controller;
        
        controller.setOnComplete((result) => {
            console.log('✅ [WritingFlow] Step 10 완료: discussion 2차');
            window.isSecondAttempt = false;
            window.currentAttemptNumber = 1;
            window.writingFlowNoTimer = false;
            
            if (result && result.componentResults) {
                const discResult = result.componentResults.find(c => c.componentType === 'discussion');
                if (discResult) {
                    this.discussion2ndData = discResult;
                    this.discussion2ndText = discResult.userAnswer || discResult.responseText || '';
                }
            }
            // ★ 라이팅 통합 저장
            if (window.AutoSave) {
                window.AutoSave.updateWritingStep({ currentStep: 10, totalSteps: 12, stepName: 'discussion_2nd', componentType: 'discussion', attempt: 2 });
            }
            // ★ Step 11-A 제거됨 → 단어배열 해설은 Step 6에서 완결
            // 바로 이메일 해설로 이동
            this.runStep11_email();
        });
        
        controller.startModule();
    },
    
    // ========================================
    // Step 11: 최종 해설 (2단계: email → discussion)
    // ★ 단어배열 해설은 Step 6에서 이미 표시됨 (중복 제거)
    // ========================================
    
    // Step 11-B: email 해설 (기존 writingEmailResultScreen + showEmailResult 사용)
    runStep11_email() {
        console.log('📖 [WritingFlow] Step 11-B: email 최종 해설');
        
        // ★ 오답노트 플로팅 UI 표시
        if (typeof ErrorNote !== 'undefined') {
            ErrorNote.show('writing', this.moduleNumber || 1);
        } else {
            console.error('❌ [WritingFlow] ErrorNote가 로드되지 않았습니다. 오답노트 기능 사용 불가.');
        }
        
        this.hideAllScreens();
        
        // ★ 기존 showEmailResult 함수 호출 (기존 해설 화면 그대로 렌더링)
        const emailData = this.email2ndData || this.email1stData;
        
        if (typeof window.showEmailResult === 'function' && emailData) {
            console.log('📧 [WritingFlow] showEmailResult 호출, 데이터:', emailData);
            window.showEmailResult(emailData);
        } else {
            console.warn('⚠️ [WritingFlow] showEmailResult 함수 또는 이메일 데이터 없음');
            const screen = document.getElementById('writingEmailResultScreen');
            if (screen) screen.style.display = 'block';
        }
        
        // 기존 backToSchedule 버튼을 "다음: 토론 해설"로 변경
        setTimeout(() => {
            const screen = document.getElementById('writingEmailResultScreen');
            if (!screen) return;
            
            // 헤더의 backToSchedule 버튼 변경
            const headerBackBtn = screen.querySelector('.test-header .btn-back-to-schedule');
            if (headerBackBtn) {
                headerBackBtn.onclick = (e) => {
                    e.preventDefault();
                    WritingFlow.runStep11_discussion();
                };
                headerBackBtn.innerHTML = '<i class="fas fa-arrow-right"></i> 토론 해설';
            }
            
            // ★ 1차/2차 답안을 '내 답안' 섹션 안에 통합
            if (this.email1stText && this.email2ndText) {
                const userAnswerEl = document.getElementById('emailResultUserAnswer');
                if (userAnswerEl) {
                    // '내 답안' 프리태그를 1차+2차 비교 레이아웃으로 교체
                    const parentBox = userAnswerEl.closest('.email-result-answer-box');
                    if (parentBox) {
                        // 기존 pre 태그를 1차/2차 비교로 교체
                        const metaHtml = parentBox.querySelector('.email-result-meta')?.outerHTML || '';
                        parentBox.innerHTML = `
                            ${metaHtml}
                            <div style="margin-bottom:16px;">
                                <div style="font-size:13px; color:#666; font-weight:600; margin-bottom:6px;">📝 1차 작성</div>
                                <pre style="white-space:pre-wrap; font-family:inherit; background:#f8f9fa; padding:12px; border-radius:6px; border-left:3px solid #6c757d;">${this.escapeHtml(this.email1stText)}</pre>
                            </div>
                            <div>
                                <div style="font-size:13px; color:#2e7d32; font-weight:600; margin-bottom:6px;">✏️ 2차 작성</div>
                                <pre style="white-space:pre-wrap; font-family:inherit; background:#f1f8e9; padding:12px; border-radius:6px; border-left:3px solid #4caf50;">${this.escapeHtml(this.email2ndText)}</pre>
                            </div>
                        `;
                    }
                }
            }
            
            // 하단에 "다음: 토론 해설" 버튼 추가
            let nextBtn = document.getElementById('emailToDiscussionBtn');
            if (!nextBtn) {
                const resultContainer = screen.querySelector('.result-container');
                if (resultContainer) {
                    nextBtn = document.createElement('div');
                    nextBtn.id = 'emailToDiscussionBtn';
                    nextBtn.style.cssText = 'text-align:center; padding:24px 0;';
                    nextBtn.innerHTML = `
                        <button class="btn btn-primary btn-large" onclick="WritingFlow.runStep11_discussion()"
                            style="padding:14px 40px; font-size:16px; background:#4A90D9; color:white; border:none; border-radius:8px; cursor:pointer;">
                            <i class="fas fa-arrow-right"></i> 다음: 토론 해설
                        </button>
                    `;
                    resultContainer.appendChild(nextBtn);
                }
            }
        }, 500);
    },
    
    // Step 11-C: discussion 해설 (기존 writingDiscussionResultScreen + showDiscussionResult 사용)
    runStep11_discussion() {
        console.log('📖 [WritingFlow] Step 11-C: discussion 최종 해설');
        
        this.hideAllScreens();
        
        // ★ 기존 showDiscussionResult 함수 호출 (기존 해설 화면 그대로 렌더링)
        const discData = this.discussion2ndData || this.discussion1stData;
        
        if (typeof window.showDiscussionResult === 'function' && discData) {
            console.log('💬 [WritingFlow] showDiscussionResult 호출, 데이터:', discData);
            window.showDiscussionResult(discData);
        } else {
            console.warn('⚠️ [WritingFlow] showDiscussionResult 함수 또는 토론 데이터 없음');
            const screen = document.getElementById('writingDiscussionResultScreen');
            if (screen) screen.style.display = 'block';
        }
        
        // 기존 backToSchedule 버튼을 "학습 일정으로 돌아가기"로 변경
        setTimeout(() => {
            const screen = document.getElementById('writingDiscussionResultScreen');
            if (!screen) return;
            
            // 헤더의 backToSchedule 버튼 변경
            const headerBackBtn = screen.querySelector('.test-header .btn-back-to-schedule');
            if (headerBackBtn) {
                headerBackBtn.onclick = (e) => {
                    e.preventDefault();
                    WritingFlow.runStep12();
                };
                headerBackBtn.innerHTML = '<i class="fas fa-calendar"></i> 학습 일정';
            }
            
            // ★ 1차/2차 답안을 '내 답안' 섹션 안에 통합
            if (this.discussion1stText && this.discussion2ndText) {
                const userAnswerEl = document.getElementById('discussionResultUserAnswer');
                if (userAnswerEl) {
                    const parentBox = userAnswerEl.closest('.discussion-result-answer-box');
                    if (parentBox) {
                        parentBox.innerHTML = `
                            <div style="margin-bottom:16px;">
                                <div style="font-size:13px; color:#666; font-weight:600; margin-bottom:6px;">📝 1차 작성</div>
                                <pre style="white-space:pre-wrap; font-family:inherit; background:#f8f9fa; padding:12px; border-radius:6px; border-left:3px solid #6c757d;">${this.escapeHtml(this.discussion1stText)}</pre>
                            </div>
                            <div>
                                <div style="font-size:13px; color:#2e7d32; font-weight:600; margin-bottom:6px;">✏️ 2차 작성</div>
                                <pre style="white-space:pre-wrap; font-family:inherit; background:#f1f8e9; padding:12px; border-radius:6px; border-left:3px solid #4caf50;">${this.escapeHtml(this.discussion2ndText)}</pre>
                            </div>
                        `;
                    }
                }
            }
            
            // 하단에 "학습 일정으로 돌아가기" 버튼 추가
            let finishBtn = document.getElementById('discussionFinishBtn');
            if (!finishBtn) {
                const resultContainer = screen.querySelector('.result-container');
                if (resultContainer) {
                    finishBtn = document.createElement('div');
                    finishBtn.id = 'discussionFinishBtn';
                    finishBtn.style.cssText = 'text-align:center; padding:24px 0;';
                    finishBtn.innerHTML = `
                        <button class="btn btn-primary btn-large" onclick="WritingFlow.runStep12()"
                            style="padding:14px 40px; font-size:16px; background:#28a745; color:white; border:none; border-radius:8px; cursor:pointer;">
                            <i class="fas fa-calendar"></i> 학습 일정으로 돌아가기
                        </button>
                    `;
                    resultContainer.appendChild(finishBtn);
                }
            }
        }, 500);
    },
    
    // ========================================
    // Step 12: 학습 일정 복귀
    // ========================================
    runStep12() {
        this.currentStep = 12;
        console.log('🏠 [WritingFlow] Step 12: 학습 일정 복귀');
        
        // ★ 오답노트 패널 정리
        if (typeof ErrorNote !== 'undefined') {
            ErrorNote.hide();
        }
        
        // ★ 라이팅 통합 세션 완료 (status: completed)
        if (window.AutoSave) {
            window.AutoSave.updateWritingStep({ currentStep: 12, totalSteps: 12, stepName: 'completed', componentType: 'all', attempt: 1, isComplete: true });
        }
        
        this.cleanup();
        
        if (typeof backToSchedule === 'function') {
            backToSchedule();
        }
    },
    
    // ========================================
    // 정리
    // ========================================
    cleanup() {
        console.log('🧹 [WritingFlow] 정리');
        
        if (this.activeController && this.activeController.cleanup) {
            this.activeController.cleanup();
        }
        
        // ★ 라이팅 통합 세션 해제
        if (window.AutoSave) {
            window.AutoSave.endWritingSession();
        }
        
        this.currentStep = 0;
        this.arrange1stResult = null;
        this.arrange2ndResult = null;
        this.email1stText = '';
        this.email1stData = null;
        this.email2ndText = '';
        this.email2ndData = null;
        this.discussion1stText = '';
        this.discussion1stData = null;
        this.discussion2ndText = '';
        this.discussion2ndData = null;
        this.activeController = null;
        
        window.isSecondAttempt = false;
        window.currentAttemptNumber = 1;
        window.writingFlowNoTimer = false;
        window.isArrangeRetake = false;
        window.arrangeRetakeWrongIndices = null;
        
        // ★ 타이머 정리
        if (window._arrangeTimerInterval) {
            clearInterval(window._arrangeTimerInterval);
            window._arrangeTimerInterval = null;
        }
        if (window._emailTimerInterval) {
            clearInterval(window._emailTimerInterval);
            window._emailTimerInterval = null;
        }
        if (window.currentDiscussionComponent) {
            window.currentDiscussionComponent.stopDiscussionTimer();
        }
        
        // ★ discussion 프로필 정리 (다음 모듈에서 이전 프로필이 남지 않도록)
        sessionStorage.removeItem('discussionProfiles');
        window.currentDiscussionProfiles = null;
        console.log('🧹 [WritingFlow] discussionProfiles 정리 완료');
        
        // 동적으로 추가한 요소들 정리
        const dynamicIds = ['emailCompareSection', 'discussionCompareSection', 'emailToDiscussionBtn', 'discussionFinishBtn', 'arrangeRetakeFloating'];
        dynamicIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
        
        // 동적 스크린 정리
        const dynScreen = document.getElementById('writingArrangeScoreScreen');
        if (dynScreen) dynScreen.remove();
    },
    
    getStatus() {
        return {
            currentStep: this.currentStep,
            moduleNumber: this.moduleNumber,
            hasArrange1st: !!this.arrange1stResult,
            hasArrange2nd: !!this.arrange2ndResult,
            hasEmail1st: !!this.email1stText,
            hasEmail2nd: !!this.email2ndText,
            hasDiscussion1st: !!this.discussion1stText,
            hasDiscussion2nd: !!this.discussion2ndText,
            hasKoData: !!this.koData
        };
    }
};

window.WritingFlow = WritingFlow;

console.log('✅ writing-flow.js v006 로드 완료');
