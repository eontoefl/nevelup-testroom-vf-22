/**
 * ================================================
 * ResultController - 1차 채점 결과 화면 컨트롤러
 * ================================================
 */

class ResultController {
    constructor(moduleResult) {
        this.moduleResult = moduleResult;
        this.sectionType = moduleResult.sectionType; // 'reading', 'listening', etc.
        this.totalCorrect = 0;
        this.totalQuestions = moduleResult.totalQuestions;
        this.level = 0;
        this.isPerfect = false;
        this.componentScores = [];
        
        this.calculateScores();
    }
    
    /**
     * 점수 계산
     */
    calculateScores() {
        console.log('📊 [ResultController] 점수 계산 시작');
        
        // 컴포넌트별 점수 계산
        this.moduleResult.componentResults.forEach(comp => {
            let correct = 0;
            let total = 0;
            
            // ✅ 수정: answers 또는 results 필드 모두 지원
            const answerArray = comp.answers || comp.results;
            
            if (answerArray && Array.isArray(answerArray)) {
                total = answerArray.length;
                correct = answerArray.filter(a => a.isCorrect).length;
            }
            
            this.componentScores.push({
                type: comp.componentType,
                name: this.getComponentDisplayName(comp.componentType),
                correct: correct,
                total: total
            });
            
            this.totalCorrect += correct;
        });
        
        // 레벨 계산
        this.level = this.calculateLevel(this.totalCorrect);
        
        // 만점 여부
        this.isPerfect = (this.totalCorrect === this.totalQuestions);
        
        console.log(`✅ 총점: ${this.totalCorrect}/${this.totalQuestions}, 레벨: ${this.level}, 만점: ${this.isPerfect}`);
    }
    
    /**
     * 레벨 계산 (1.0 ~ 6.0)
     * 섹션별로 다른 구간표 적용
     */
    calculateLevel(correctCount) {
        if (this.sectionType === 'reading') {
            // Reading: 35문제 기준
            if (correctCount <= 3) return 1.0;
            if (correctCount <= 6) return 1.5;
            if (correctCount <= 10) return 2.0;
            if (correctCount <= 13) return 2.5;
            if (correctCount <= 17) return 3.0;
            if (correctCount <= 20) return 3.5;
            if (correctCount <= 24) return 4.0;
            if (correctCount <= 27) return 4.5;
            if (correctCount <= 30) return 5.0;
            if (correctCount <= 32) return 5.5;
            return 6.0; // 33~35개
        } else if (this.sectionType === 'listening') {
            // Listening: 32문제 기준
            if (correctCount <= 2) return 1.0;
            if (correctCount <= 5) return 1.5;
            if (correctCount <= 8) return 2.0;
            if (correctCount <= 11) return 2.5;
            if (correctCount <= 15) return 3.0;
            if (correctCount <= 18) return 3.5;
            if (correctCount <= 21) return 4.0;
            if (correctCount <= 24) return 4.5;
            if (correctCount <= 27) return 5.0;
            if (correctCount <= 29) return 5.5;
            return 6.0; // 30~32개
        } else {
            // 기타 섹션 (Writing, Speaking 등)
            // 나중에 추가 가능
            return 0;
        }
    }
    
    /**
     * 컴포넌트 표시 이름
     */
    getComponentDisplayName(type) {
        const names = {
            'fillblanks': '빈칸채우기',
            'daily1': '일상리딩 1',
            'daily2': '일상리딩 2',
            'academic': '아카데믹 리딩',
            'response': '응답',
            'conver': '대화',
            'announcement': '공지사항',
            'lecture': '강의'
        };
        return names[type] || type;
    }
    
    /**
     * 결과 화면 표시
     */
    show() {
        console.log('🎨 [ResultController] 결과 화면 표시');
        
        // 모든 다른 화면 숨기기
        this.hideAllScreens();
        
        // 결과 화면 요소
        const resultScreen = document.getElementById(`${this.sectionType}ResultScreen`);
        if (!resultScreen) {
            console.error(`❌ 결과 화면을 찾을 수 없습니다: ${this.sectionType}ResultScreen`);
            return;
        }
        
        // 데이터 표시
        this.displayScore(resultScreen);
        this.displayLevel(resultScreen);
        this.displayComponentScores(resultScreen);
        this.displayButtons(resultScreen);
        
        // 만점이면 폭죽 효과
        if (this.isPerfect) {
            this.showConfetti();
        }
        
        // 화면 표시
        resultScreen.style.display = 'block';
        
        // 결과 데이터 저장 (이중채점용)
        this.saveResultForRetake();
    }
    
    /**
     * 총점 표시
     */
    displayScore(container) {
        const scoreElement = container.querySelector('.result-total-score');
        if (scoreElement) {
            scoreElement.textContent = `${this.totalCorrect} / ${this.totalQuestions}`;
        }
        
        const percentElement = container.querySelector('.result-percentage');
        if (percentElement) {
            const percentage = Math.round((this.totalCorrect / this.totalQuestions) * 100);
            percentElement.textContent = `${percentage}%`;
        }
        
        // 만점이면 특별 클래스 추가
        const scoreCard = container.querySelector('.result-score-card');
        if (scoreCard && this.isPerfect) {
            scoreCard.classList.add('perfect');
        }
    }
    
    /**
     * 레벨 표시
     */
    displayLevel(container) {
        const levelElement = container.querySelector('.result-level');
        if (levelElement) {
            levelElement.textContent = this.level.toFixed(1);
        }
    }
    
    /**
     * 섹션별 점수 표시
     */
    displayComponentScores(container) {
        const listElement = container.querySelector('.result-component-list');
        if (!listElement) return;
        
        listElement.innerHTML = '';
        
        this.componentScores.forEach(comp => {
            const item = document.createElement('div');
            item.className = 'result-component-item';
            item.innerHTML = `
                <span class="component-name">${comp.name}</span>
                <span class="component-score">${comp.correct}/${comp.total}</span>
            `;
            listElement.appendChild(item);
        });
    }
    
    /**
     * 버튼 표시
     */
    displayButtons(container) {
        const buttonContainer = container.querySelector('.result-buttons');
        if (!buttonContainer) return;
        
        buttonContainer.innerHTML = '';
        
        if (this.isPerfect) {
            // 만점: 해설 보기만
            const explanationBtn = document.createElement('button');
            explanationBtn.className = 'btn btn-primary';
            explanationBtn.textContent = '해설 보기';
            explanationBtn.onclick = () => this.showExplanations();
            buttonContainer.appendChild(explanationBtn);
        } else {
            // 틀린 문제 다시 풀기
            const retakeBtn = document.createElement('button');
            retakeBtn.className = 'btn btn-primary';
            retakeBtn.textContent = '틀린 문제 다시 풀기';
            retakeBtn.onclick = () => this.startRetake();
            buttonContainer.appendChild(retakeBtn);
        }
    }
    
    /**
     * 이중채점용 결과 저장
     */
    saveResultForRetake() {
        const retakeData = {
            sectionType: this.sectionType,
            moduleId: this.moduleResult.moduleId,
            totalCorrect: this.totalCorrect,
            totalQuestions: this.totalQuestions,
            level: this.level,
            isPerfect: this.isPerfect,
            componentResults: this.moduleResult.componentResults,
            timestamp: Date.now()
        };
        
        sessionStorage.setItem(`${this.sectionType}_firstAttempt`, JSON.stringify(retakeData));
        console.log('💾 1차 결과 저장 완료 (이중채점용)');
    }
    
    /**
     * 틀린 문제 다시 풀기 시작
     */
    startRetake() {
        console.log('🔄 [ResultController] 이중채점 시작');
        
        // RetakeController로 전달
        if (window.RetakeController) {
            const retakeController = new window.RetakeController(this.sectionType, this.moduleResult);
            window.retakeController = retakeController; // 전역 참조 저장
            retakeController.start();
        } else {
            console.error('❌ RetakeController가 로드되지 않았습니다');
            alert('이중채점 시스템을 불러올 수 없습니다.');
        }
    }
    
    /**
     * 해설 보기 (만점인 경우)
     */
    showExplanations() {
        console.log('📖 [ResultController] 해설 화면으로 이동');
        
        // 해설 화면으로 이동 (추후 구현)
        alert('해설 화면이 준비 중입니다.');
    }
    
    /**
     * 만점 폭죽 효과
     */
    showConfetti() {
        console.log('🎉 만점 폭죽 효과 시작!');
        
        // 폭죽 컨테이너 생성
        const container = document.createElement('div');
        container.className = 'confetti-container';
        document.body.appendChild(container);
        
        // 50개의 폭죽 조각 생성
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = Math.random() * 100 + '%';
                confetti.style.animationDelay = Math.random() * 0.5 + 's';
                confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
                container.appendChild(confetti);
                
                // 애니메이션 끝나면 제거
                setTimeout(() => {
                    confetti.remove();
                }, 4000);
            }, i * 30);
        }
        
        // 전체 컨테이너 5초 후 제거
        setTimeout(() => {
            container.remove();
        }, 5000);
    }
    
    /**
     * 모든 화면 숨기기
     */
    hideAllScreens() {
        // 모든 screen 클래스 숨기기
        document.querySelectorAll('.screen').forEach(screen => {
            screen.style.display = 'none';
        });
        
        // test-screen 클래스도 숨기기
        document.querySelectorAll('.test-screen').forEach(screen => {
            screen.style.display = 'none';
        });
        
        console.log('🔒 모든 화면 숨김 처리 완료');
    }
}

// 전역으로 노출
if (typeof window !== 'undefined') {
    window.ResultController = ResultController;
    
    /**
     * 헬퍼 함수: 모듈 완료 시 결과 화면 표시
     */
    window.showModuleResult = function(moduleResult) {
        console.log('📊 결과 화면 표시 요청:', moduleResult);
        
        const resultController = new ResultController(moduleResult);
        resultController.show();
    };
}
