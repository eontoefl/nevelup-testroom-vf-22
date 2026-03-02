/**
 * Writing Simple Module (테스트 버전)
 * 단어배열 → 이메일 → 토론형 순차 실행
 */

console.log('✅ writing-simple-module.js 로드됨');

// 현재 진행 상태
let currentWritingStep = 0;
const writingSteps = ['arrange', 'email', 'discussion'];

// 타이머
let writingTimer = null;
let writingTimeRemaining = 0;

// 답안 저장
let writingAnswers = {
    arrange: null,
    email: null,
    discussion: null
};

// 현재 활성 컴포넌트
let currentArrangeData = null;
let currentEmailText = '';
let currentDiscussionText = '';

/**
 * Writing Module 시작
 */
async function startWritingSimpleModule() {
    console.log('🚀 [Writing Module] 시작');
    
    currentWritingStep = 0;
    
    // 1단계: 단어배열 시작
    await startArrangeStep();
}

/**
 * 1단계: 단어배열 (6분 50초)
 */
async function startArrangeStep() {
    console.log('📝 [Writing] 1/3 - 단어배열 시작');
    
    // 화면 전환
    showScreen('writingArrangeScreen');
    
    // 데이터 로드
    await loadArrangeData();
    
    // 타이머 시작 (6분 50초 = 410초)
    startWritingTimer(410, 'arrangeTimer');
    
    // 진행률 표시
    updateWritingProgress('단어배열', '1/3');
}

/**
 * 단어배열 데이터 로드
 */
async function loadArrangeData() {
    const SHEET_CONFIG = {
        spreadsheetId: '1srFVmFnRa8A73isTO_Vk3yfU1bQWVroHUui8XvYf9e0',
        gid: '1360903047'
    };
    
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_CONFIG.spreadsheetId}/export?format=csv&gid=${SHEET_CONFIG.gid}`;
    
    try {
        const response = await fetch(url);
        const csvText = await response.text();
        
        // CSV 파싱 (간단 버전)
        const lines = csvText.split('\n');
        const dataLine = lines[1]; // 첫 번째 데이터 (arrange_set_0001)
        const columns = dataLine.split(',');
        
        currentArrangeData = {
            setId: columns[0].trim(),
            words: []
        };
        
        // 10개 단어 파싱 (columns[1]~[10])
        for (let i = 1; i <= 10; i++) {
            if (columns[i] && columns[i].trim()) {
                const parts = columns[i].trim().split('::');
                currentArrangeData.words.push({
                    questionNum: i,
                    scrambled: parts[0] || '',
                    answer: parts[1] || '',
                    translation: parts[2] || ''
                });
            }
        }
        
        console.log('✅ [Arrange] 데이터 로드 완료:', currentArrangeData);
        
        // UI 렌더링
        renderArrangeUI();
        
    } catch (error) {
        console.error('❌ [Arrange] 데이터 로드 실패:', error);
        alert('단어배열 데이터를 불러올 수 없습니다.');
    }
}

/**
 * 단어배열 UI 렌더링
 */
function renderArrangeUI() {
    const container = document.getElementById('arrangeQuestionContent');
    if (!container) return;
    
    container.innerHTML = '';
    
    currentArrangeData.words.forEach((word, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'arrange-question-item';
        questionDiv.style.cssText = 'margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;';
        questionDiv.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">${index + 1}. ${word.scrambled}</div>
            <input type="text" 
                   class="arrange-answer-input" 
                   id="arrangeInput${index}"
                   placeholder="정답을 입력하세요"
                   data-index="${index}"
                   style="width: 100%; padding: 10px; font-size: 16px; border: 2px solid #ddd; border-radius: 4px;">
            <div style="margin-top: 5px; color: #666; font-size: 14px;">${word.translation}</div>
        `;
        container.appendChild(questionDiv);
    });
    
    // Submit 버튼 추가
    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn btn-success';
    submitBtn.textContent = 'Submit';
    submitBtn.onclick = submitArrangeStep;
    submitBtn.style.cssText = 'margin-top: 20px; padding: 12px 30px; font-size: 16px;';
    container.appendChild(submitBtn);
}

/**
 * 단어배열 제출
 */
function submitArrangeStep() {
    console.log('📤 [Arrange] 제출');
    
    // 타이머 정지
    stopWritingTimer();
    
    // 답안 수집
    const userAnswers = [];
    currentArrangeData.words.forEach((word, index) => {
        const input = document.getElementById(`arrangeInput${index}`);
        userAnswers.push({
            questionNum: index + 1,
            userAnswer: input ? input.value.trim() : '',
            correctAnswer: word.answer,
            scrambled: word.scrambled
        });
    });
    
    writingAnswers.arrange = {
        setId: currentArrangeData.setId,
        answers: userAnswers
    };
    
    console.log('✅ [Arrange] 답안 저장:', writingAnswers.arrange);
    
    // 다음 단계로
    startEmailStep();
}

/**
 * 2단계: 이메일 작성 (7분)
 */
async function startEmailStep() {
    console.log('📝 [Writing] 2/3 - 이메일 시작');
    
    // 화면 전환
    showScreen('writingEmailScreen');
    
    // 데이터 로드
    await loadEmailData();
    
    // 타이머 시작 (7분 = 420초)
    startWritingTimer(420, 'emailTimer');
    
    // 진행률 표시
    updateWritingProgress('이메일 작성', '2/3');
}

/**
 * 이메일 데이터 로드
 */
async function loadEmailData() {
    const SHEET_CONFIG = {
        spreadsheetId: '1srFVmFnRa8A73isTO_Vk3yfU1bQWVroHUui8XvYf9e0',
        gid: '455472006'
    };
    
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_CONFIG.spreadsheetId}/export?format=csv&gid=${SHEET_CONFIG.gid}`;
    
    try {
        const response = await fetch(url);
        const csvText = await response.text();
        
        // CSV 파싱
        const lines = csvText.split('\n');
        const dataLine = lines[1]; // 첫 번째 데이터
        const columns = parseCSVLine(dataLine);
        
        const emailData = {
            setId: columns[0].trim(),
            situation: columns[1].trim(),
            situationTrans: columns[2].trim(),
            direction1: columns[3].trim(),
            direction1Trans: columns[4].trim(),
            direction2: columns[5].trim(),
            direction2Trans: columns[6].trim(),
            direction3: columns[7].trim(),
            direction3Trans: columns[8].trim()
        };
        
        console.log('✅ [Email] 데이터 로드 완료:', emailData);
        
        // UI 렌더링
        renderEmailUI(emailData);
        
    } catch (error) {
        console.error('❌ [Email] 데이터 로드 실패:', error);
        alert('이메일 데이터를 불러올 수 없습니다.');
    }
}

/**
 * 이메일 UI 렌더링
 */
function renderEmailUI(data) {
    const situationDiv = document.getElementById('emailSituation');
    const directionsDiv = document.getElementById('emailDirections');
    const textareaDiv = document.getElementById('emailTextarea');
    
    if (situationDiv) {
        situationDiv.innerHTML = `
            <h3>Situation</h3>
            <p>${data.situation}</p>
            <p class="translation">${data.situationTrans}</p>
        `;
    }
    
    if (directionsDiv) {
        directionsDiv.innerHTML = `
            <h3>Directions</h3>
            <ul>
                <li>${data.direction1} <span class="translation">(${data.direction1Trans})</span></li>
                <li>${data.direction2} <span class="translation">(${data.direction2Trans})</span></li>
                <li>${data.direction3} <span class="translation">(${data.direction3Trans})</span></li>
            </ul>
        `;
    }
    
    if (textareaDiv) {
        textareaDiv.innerHTML = `
            <textarea id="emailTextInput" 
                      placeholder="Write your email here..." 
                      style="width: 100%; height: 400px; font-size: 16px; padding: 15px;"></textarea>
            <div style="margin-top: 10px;">
                <span>단어 수: <strong id="emailWordCount">0</strong></span>
            </div>
        `;
        
        // 단어 수 카운트
        const textarea = document.getElementById('emailTextInput');
        if (textarea) {
            textarea.addEventListener('input', () => {
                const text = textarea.value.trim();
                const wordCount = text ? text.split(/\s+/).length : 0;
                document.getElementById('emailWordCount').textContent = wordCount;
            });
        }
    }
}

/**
 * 이메일 제출
 */
function submitEmailStep() {
    console.log('📤 [Email] 제출');
    
    // 타이머 정지
    stopWritingTimer();
    
    // 답안 수집
    const textarea = document.getElementById('emailTextInput');
    currentEmailText = textarea ? textarea.value.trim() : '';
    
    writingAnswers.email = {
        text: currentEmailText,
        wordCount: currentEmailText ? currentEmailText.split(/\s+/).length : 0
    };
    
    console.log('✅ [Email] 답안 저장:', writingAnswers.email);
    
    // 다음 단계로
    startDiscussionStep();
}

/**
 * 3단계: 토론형 글쓰기 (10분)
 */
async function startDiscussionStep() {
    console.log('📝 [Writing] 3/3 - 토론형 시작');
    
    // 화면 전환
    showScreen('writingDiscussionScreen');
    
    // 데이터 로드
    await loadDiscussionData();
    
    // 타이머 시작 (10분 = 600초)
    startWritingTimer(600, 'discussionTimer');
    
    // 진행률 표시
    updateWritingProgress('토론형 글쓰기', '3/3');
}

/**
 * 토론형 데이터 로드
 */
async function loadDiscussionData() {
    const SHEET_CONFIG = {
        spreadsheetId: '1srFVmFnRa8A73isTO_Vk3yfU1bQWVroHUui8XvYf9e0',
        gid: '303084366'
    };
    
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_CONFIG.spreadsheetId}/export?format=csv&gid=${SHEET_CONFIG.gid}`;
    
    try {
        const response = await fetch(url);
        const csvText = await response.text();
        
        // CSV 파싱
        const lines = csvText.split('\n');
        const dataLine = lines[1];
        const columns = parseCSVLine(dataLine);
        
        const discussionData = {
            setId: columns[0].trim(),
            question: columns[1].trim(),
            questionTrans: columns[2].trim(),
            direction: columns[3].trim(),
            directionTrans: columns[4].trim()
        };
        
        console.log('✅ [Discussion] 데이터 로드 완료:', discussionData);
        
        // UI 렌더링
        renderDiscussionUI(discussionData);
        
    } catch (error) {
        console.error('❌ [Discussion] 데이터 로드 실패:', error);
        alert('토론형 데이터를 불러올 수 없습니다.');
    }
}

/**
 * 토론형 UI 렌더링
 */
function renderDiscussionUI(data) {
    const questionDiv = document.getElementById('discussionQuestion');
    const textareaDiv = document.getElementById('discussionTextarea');
    
    if (questionDiv) {
        questionDiv.innerHTML = `
            <h3>${data.question}</h3>
            <p class="translation">${data.questionTrans}</p>
            <div class="direction">
                <strong>Direction:</strong> ${data.direction}
                <p class="translation">${data.directionTrans}</p>
            </div>
        `;
    }
    
    if (textareaDiv) {
        textareaDiv.innerHTML = `
            <textarea id="discussionTextInput" 
                      placeholder="Write your essay here..." 
                      style="width: 100%; height: 500px; font-size: 16px; padding: 15px;"></textarea>
            <div style="margin-top: 10px;">
                <span>단어 수: <strong id="discussionWordCount">0</strong></span>
            </div>
        `;
        
        // 단어 수 카운트
        const textarea = document.getElementById('discussionTextInput');
        if (textarea) {
            textarea.addEventListener('input', () => {
                const text = textarea.value.trim();
                const wordCount = text ? text.split(/\s+/).length : 0;
                document.getElementById('discussionWordCount').textContent = wordCount;
            });
        }
    }
}

/**
 * 토론형 제출 (최종 완료)
 */
function submitDiscussionStep() {
    console.log('📤 [Discussion] 제출');
    
    // 타이머 정지
    stopWritingTimer();
    
    // 답안 수집
    const textarea = document.getElementById('discussionTextInput');
    currentDiscussionText = textarea ? textarea.value.trim() : '';
    
    writingAnswers.discussion = {
        text: currentDiscussionText,
        wordCount: currentDiscussionText ? currentDiscussionText.split(/\s+/).length : 0
    };
    
    console.log('✅ [Discussion] 답안 저장:', writingAnswers.discussion);
    
    // 전체 완료
    completeWritingModule();
}

/**
 * Writing Module 완료
 */
function completeWritingModule() {
    console.log('🎉 [Writing Module] 전체 완료');
    console.log('📊 전체 답안:', writingAnswers);
    
    // 간단한 결과 표시
    let resultText = 'Writing Module 완료!\n\n';
    resultText += `단어배열: ${writingAnswers.arrange?.answers.length || 0}개 답변\n`;
    resultText += `이메일: ${writingAnswers.email?.wordCount || 0} 단어\n`;
    resultText += `토론형: ${writingAnswers.discussion?.wordCount || 0} 단어`;
    
    alert(resultText);
    
    // 스케줄로 돌아가기
    if (typeof backToSchedule === 'function') {
        backToSchedule();
    }
}

/**
 * 타이머 시작
 */
function startWritingTimer(seconds, timerElementId) {
    writingTimeRemaining = seconds;
    updateTimerDisplay(timerElementId);
    
    writingTimer = setInterval(() => {
        writingTimeRemaining--;
        updateTimerDisplay(timerElementId);
        
        if (writingTimeRemaining <= 0) {
            stopWritingTimer();
            handleTimerEnd();
        }
    }, 1000);
}

/**
 * 타이머 표시 업데이트
 */
function updateTimerDisplay(timerElementId) {
    const element = document.getElementById(timerElementId);
    if (!element) return;
    
    const minutes = Math.floor(writingTimeRemaining / 60);
    const seconds = writingTimeRemaining % 60;
    element.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * 타이머 정지
 */
function stopWritingTimer() {
    if (writingTimer) {
        clearInterval(writingTimer);
        writingTimer = null;
    }
}

/**
 * 타이머 종료 처리
 */
function handleTimerEnd() {
    console.log('⏰ [Writing] 타이머 종료 - 자동 제출');
    
    if (currentWritingStep === 0) {
        submitArrangeStep();
    } else if (currentWritingStep === 1) {
        submitEmailStep();
    } else if (currentWritingStep === 2) {
        submitDiscussionStep();
    }
}

/**
 * 진행률 표시
 */
function updateWritingProgress(stepName, progress) {
    const progressElement = document.getElementById('writingModuleProgress');
    if (progressElement) {
        progressElement.textContent = `${stepName} (${progress})`;
    }
}

/**
 * CSV 라인 파싱 (따옴표 처리)
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

/**
 * 화면 전환
 */
function showScreen(screenId) {
    // 모든 화면 숨기기
    document.querySelectorAll('.screen').forEach(screen => {
        screen.style.display = 'none';
    });
    
    // 선택한 화면만 표시
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.style.display = 'block';
    }
}

// 전역으로 노출
window.startWritingSimpleModule = startWritingSimpleModule;
window.submitArrangeStep = submitArrangeStep;
window.submitEmailStep = submitEmailStep;
window.submitDiscussionStep = submitDiscussionStep;

console.log('✅ writing-simple-module.js 로드 완료');
