// 내벨업보카 시험 로직 - 페이지 기반 시스템

// 전역 변수
let vocabTestData = [];
let vocabUserAnswers = {};
let currentPages = '';

// Google Sheets 설정
const VOCAB_SPREADSHEET_ID = '1I9R-yNiRrp12lDQ_pIk6_tUFO2KcxkG_akrwPj3zKws';
const VOCAB_SHEET_GID = '0';

// CSV 파싱 함수
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"' && inQuotes && nextChar === '"') {
            current += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

// 페이지 범위 파싱 (예: "5-6" → [5, 6])
function parsePageRange(pageRange) {
    if (!pageRange) return [];
    
    const parts = pageRange.split('-');
    if (parts.length === 2) {
        const start = parseInt(parts[0].trim());
        const end = parseInt(parts[1].trim());
        
        const pages = [];
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages; // [5, 6]
    }
    
    // 단일 페이지인 경우 (예: "5")
    const page = parseInt(pageRange.trim());
    if (!isNaN(page)) {
        return [page];
    }
    
    return [];
}

// 내벨업보카 데이터 로드 (페이지 범위 기반)
async function loadVocabData(pageRange) {
    console.log(`📚 내벨업보카 데이터 로드 시작 - 페이지: ${pageRange}`);
    
    currentPages = pageRange;
    const pages = parsePageRange(pageRange);
    console.log(`📖 시험 페이지: ${pages.join(', ')}`);
    
    const csvUrl = `https://docs.google.com/spreadsheets/d/${VOCAB_SPREADSHEET_ID}/export?format=csv&gid=${VOCAB_SHEET_GID}`;
    console.log('CSV URL:', csvUrl);
    
    try {
        // Google Sheets 로드 시도 (timeout 설정)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5초 타임아웃
        
        try {
            const response = await fetch(csvUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const csvText = await response.text();
            const lines = csvText.trim().split('\n');
            
            vocabTestData = [];
            
            // 첫 번째 줄은 헤더이므로 건너뛰기
            for (let i = 1; i < lines.length; i++) {
                const cols = parseCSVLine(lines[i]);
                if (cols.length >= 3) {
                    const page = parseInt(cols[0].trim());
                    const headword = cols[1].trim();
                    
                    // 현재 페이지 범위에 포함되는 단어만 로드
                    if (pages.includes(page) && headword) {
                        const synonyms = [];
                        
                        // C열(index 2)부터 최대 J열(index 9)까지 동의어 수집 (최대 8개)
                        for (let j = 2; j < Math.min(cols.length, 10); j++) {
                            const synonym = cols[j].trim();
                            if (synonym) {
                                synonyms.push(synonym);
                            }
                        }
                        
                        if (synonyms.length > 0) {
                            vocabTestData.push({ 
                                page,
                                headword, 
                                synonyms 
                            });
                        }
                    }
                }
            }
            
            console.log(`✅ ${vocabTestData.length}개의 단어 로드 완료 (Google Sheets)`);
            
        } catch (fetchError) {
            clearTimeout(timeoutId);
            console.warn('⚠️ Google Sheets 로드 실패, 테스트 데이터 사용:', fetchError.message);
            
            // 임시 테스트 데이터 사용
            const testData = [
                { page: 5, headword: 'coincide', synonyms: ['occur together', 'match'] },
                { page: 5, headword: 'collapse', synonyms: ['fall', 'break down'] },
                { page: 5, headword: 'colleague', synonyms: ['coworker', 'associate'] },
                { page: 5, headword: 'commence', synonyms: ['begin', 'start'] },
                { page: 5, headword: 'compensate', synonyms: ['pay', 'reimburse'] },
                { page: 5, headword: 'component', synonyms: ['part', 'element'] },
                { page: 5, headword: 'comprehensive', synonyms: ['complete', 'thorough', 'extensive'] },
                { page: 5, headword: 'comprise', synonyms: ['include', 'consist of'] },
                { page: 5, headword: 'conceive', synonyms: ['imagine', 'think of'] },
                { page: 5, headword: 'concentrate', synonyms: ['focus', 'center'] },
                { page: 6, headword: 'conduct', synonyms: ['carry out', 'perform'] },
                { page: 6, headword: 'confine', synonyms: ['limit', 'restrict'] },
                { page: 6, headword: 'confirm', synonyms: ['verify', 'validate'] },
                { page: 6, headword: 'conform', synonyms: ['comply', 'follow'] },
                { page: 6, headword: 'consecutive', synonyms: ['successive', 'sequential'] },
                { page: 6, headword: 'consequence', synonyms: ['result', 'outcome'] },
                { page: 6, headword: 'considerable', synonyms: ['substantial', 'significant'] },
                { page: 6, headword: 'consistent', synonyms: ['constant', 'regular'] },
                { page: 6, headword: 'constitute', synonyms: ['make up', 'form'] },
                { page: 6, headword: 'constrain', synonyms: ['limit', 'restrict'] }
            ];
            
            // 페이지 범위에 해당하는 단어만 필터링
            vocabTestData = testData.filter(item => pages.includes(item.page));
            
            console.log(`✅ ${vocabTestData.length}개의 단어 로드 완료 (테스트 데이터)`);
        }
        
    } catch (error) {
        console.error('❌ 데이터 로드 실패:', error);
        alert('데이터를 불러오는데 실패했습니다. 다시 시도해주세요.');
    }
}

// 내벨업보카 섹션 초기화 (페이지 범위 파라미터 추가)
async function initVocabTest(pageRange) {
    console.log(`📚 내벨업보카 섹션 초기화 - 페이지: ${pageRange}`);
    
    // 데이터 로드
    await loadVocabData(pageRange);
    
    // 화면 표시
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
    const vocabScreen = document.getElementById('vocabTestScreen');
    vocabScreen.classList.add('active');
    vocabScreen.style.display = 'block';
    
    console.log('✅ vocabTestScreen 화면 전환 완료');
    
    // 시험 제목 업데이트
    updateVocabTestTitle(pageRange);
    
    // 소개 화면 표시
    document.getElementById('vocabTestIntro').style.display = 'block';
    document.getElementById('vocabTestMain').style.display = 'none';
}

// 시험 제목 업데이트
function updateVocabTestTitle(pageRange) {
    const titleElement = document.querySelector('#vocabTestScreen .test-title span');
    if (titleElement) {
        titleElement.textContent = `내벨업보카 시험 (p.${pageRange})`;
    }
}

// 시험 시작
function startVocabTest() {
    console.log('✅ 내벨업보카 시험 시작');
    
    // 사용자 답안 초기화
    vocabUserAnswers = {};
    
    // 소개 화면 숨기고 시험 화면 표시
    document.getElementById('vocabTestIntro').style.display = 'none';
    document.getElementById('vocabTestMain').style.display = 'block';
    
    // 진행 상태 업데이트
    document.getElementById('vocabTestProgressText').textContent = 
        `총 ${vocabTestData.length}개 문제 (p.${currentPages})`;
    
    // 시험 문제 렌더링
    renderVocabTest();
}

// 시험 문제 렌더링
function renderVocabTest() {
    const container = document.getElementById('vocabTestContainer');
    container.innerHTML = '';
    
    vocabTestData.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'vocab-item';
        itemDiv.dataset.index = index;
        
        // 표제어 부분
        const headwordDiv = document.createElement('div');
        headwordDiv.className = 'vocab-headword';
        headwordDiv.innerHTML = `
            <div class="vocab-headword-label">표제어</div>
            <div class="vocab-headword-text">${item.headword}</div>
        `;
        
        // 동의어 입력 부분
        const synonymsDiv = document.createElement('div');
        synonymsDiv.className = 'vocab-synonyms';
        
        item.synonyms.forEach((_, synIndex) => {
            const inputWrapper = document.createElement('div');
            inputWrapper.className = 'vocab-synonym-input-wrapper';
            
            inputWrapper.innerHTML = `
                <div class="vocab-synonym-label">동의어 ${synIndex + 1}</div>
                <input 
                    type="text" 
                    class="vocab-synonym-input" 
                    data-word-index="${index}" 
                    data-synonym-index="${synIndex}"
                    placeholder="동의어를 입력하세요"
                    autocomplete="off"
                    spellcheck="false"
                >
            `;
            
            synonymsDiv.appendChild(inputWrapper);
        });
        
        itemDiv.appendChild(headwordDiv);
        itemDiv.appendChild(synonymsDiv);
        container.appendChild(itemDiv);
    });
    
    // 입력 이벤트 리스너 추가
    document.querySelectorAll('.vocab-synonym-input').forEach(input => {
        input.addEventListener('input', saveUserAnswer);
    });
}

// 사용자 답안 저장
function saveUserAnswer(event) {
    const input = event.target;
    const wordIndex = parseInt(input.dataset.wordIndex);
    const synonymIndex = parseInt(input.dataset.synonymIndex);
    const value = input.value.trim();
    
    if (!vocabUserAnswers[wordIndex]) {
        vocabUserAnswers[wordIndex] = {};
    }
    
    vocabUserAnswers[wordIndex][synonymIndex] = value;
}

// 시험 제출
function submitVocabTest() {
    console.log('📝 시험 제출');
    
    // 모든 답안이 입력되었는지 확인
    let allAnswered = true;
    vocabTestData.forEach((item, index) => {
        if (!vocabUserAnswers[index]) {
            allAnswered = false;
            return;
        }
        
        for (let i = 0; i < item.synonyms.length; i++) {
            if (!vocabUserAnswers[index][i] || !vocabUserAnswers[index][i].trim()) {
                allAnswered = false;
                return;
            }
        }
    });
    
    if (!allAnswered) {
        alert('모든 문제를 풀어주세요!');
        return;
    }
    
    // 확인 메시지
    if (!confirm('제출하시겠습니까?')) {
        return;
    }
    
    // 채점 화면으로 이동
    showVocabTestResult();
}

// 채점 결과 화면 표시
async function showVocabTestResult() {
    console.log('📊 채점 결과 표시');
    
    // 채점
    const results = [];
    let correctCount = 0;
    let totalCount = vocabTestData.length;
    
    vocabTestData.forEach((item, index) => {
        const userAnswer = vocabUserAnswers[index] || {};
        const synonymResults = [];
        let allCorrect = true;
        
        // 학생 답안을 배열로 수집
        const userAnswers = [];
        for (let i = 0; i < item.synonyms.length; i++) {
            userAnswers.push((userAnswer[i] || '').trim().toLowerCase());
        }
        
        // 정답 배열 (소문자)
        const correctAnswers = item.synonyms.map(s => s.toLowerCase());
        
        // 결과 생성: 순서 무관 채점 (중복 방지)
        const usedCorrectIndices = new Set();
        
        item.synonyms.forEach((correctSynonym, synIndex) => {
            const userSynonym = (userAnswer[synIndex] || '').trim();
            const userLower = userSynonym.toLowerCase();
            
            // 이 칸의 답이 아직 매칭 안 된 정답 중 하나와 일치하는지 확인
            let isCorrect = false;
            for (let cIdx = 0; cIdx < correctAnswers.length; cIdx++) {
                if (!usedCorrectIndices.has(cIdx) && userLower === correctAnswers[cIdx]) {
                    usedCorrectIndices.add(cIdx);
                    isCorrect = true;
                    break;
                }
            }
            
            if (!isCorrect) {
                allCorrect = false;
            }
            
            synonymResults.push({
                userAnswer: userAnswer[synIndex] || '',
                correctAnswer: correctSynonym,
                isCorrect: isCorrect
            });
        });
        
        if (allCorrect) {
            correctCount++;
        }
        
        results.push({
            headword: item.headword,
            synonyms: synonymResults,
            allCorrect: allCorrect
        });
    });
    
    const percentage = Math.round((correctCount / totalCount) * 100);
    
    // ── Supabase에 보카 학습 기록 저장 ──
    try {
        await saveVocabRecord(correctCount, totalCount, percentage);
    } catch(e) {
        console.error('📝 [Vocab] 저장 에러:', e);
    }
    
    // 결과 렌더링
    renderVocabResult(results, correctCount, totalCount, percentage);
    
    // 결과 화면으로 전환
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('vocabResultScreen').classList.add('active');
}

// 결과 렌더링
function renderVocabResult(results, correctCount, totalCount, percentage) {
    const container = document.getElementById('vocabResultContainer');
    
    // 점수 카드
    const scoreCard = `
        <div class="vocab-score-card">
            <div class="vocab-score-title">시험 결과 (p.${currentPages})</div>
            <div class="vocab-score-percentage">${percentage}%</div>
            <div class="vocab-score-stats">
                <div class="vocab-stat-item">
                    <div class="vocab-stat-label">정답</div>
                    <div class="vocab-stat-value vocab-stat-correct">${correctCount}</div>
                </div>
                <div class="vocab-stat-item">
                    <div class="vocab-stat-label">오답</div>
                    <div class="vocab-stat-value vocab-stat-wrong">${totalCount - correctCount}</div>
                </div>
                <div class="vocab-stat-item">
                    <div class="vocab-stat-label">총 문제</div>
                    <div class="vocab-stat-value">${totalCount}</div>
                </div>
            </div>
        </div>
    `;
    
    // 결과 리스트
    let resultsList = '<div class="vocab-results-list">';
    resultsList += '<div class="vocab-results-header">문제별 결과</div>';
    
    results.forEach((result, index) => {
        const statusClass = result.allCorrect ? 'correct' : 'wrong';
        const statusIcon = result.allCorrect ? '✅' : '❌';
        const statusText = result.allCorrect ? '정답' : '오답';
        
        resultsList += `
            <div class="vocab-result-item ${statusClass}">
                <div class="vocab-result-header">
                    <div class="vocab-result-headword">
                        <div class="vocab-result-icon">${statusIcon}</div>
                        <div class="vocab-result-headword-text">${result.headword}</div>
                    </div>
                    <div class="vocab-result-status ${statusClass}">${statusText}</div>
                </div>
                <div class="vocab-result-synonyms">
        `;
        
        result.synonyms.forEach((syn, synIndex) => {
            const userAnswerClass = syn.isCorrect ? 'correct' : (syn.userAnswer ? 'wrong' : 'empty');
            const userAnswerText = syn.userAnswer || '(입력하지 않음)';
            
            resultsList += `
                <div class="vocab-synonym-comparison">
                    <div class="vocab-synonym-number">동의어 ${synIndex + 1}</div>
                    <div class="vocab-your-answer">
                        <div class="vocab-your-answer-label">내 답안</div>
                        <div class="vocab-your-answer-text ${userAnswerClass}">${userAnswerText}</div>
                    </div>
                    <div class="vocab-correct-answer">
                        <div class="vocab-correct-answer-label">정답</div>
                        <div class="vocab-correct-answer-text">${syn.correctAnswer}</div>
                    </div>
                </div>
            `;
        });
        
        resultsList += `
                </div>
            </div>
        `;
    });
    
    resultsList += '</div>';
    
    // 액션 버튼
    const actions = `
        <div class="vocab-result-actions">
            <button class="btn-retry-vocab-test" onclick="retryVocabTest()">
                <i class="fas fa-redo"></i> 다시 시도하기
            </button>
            <button class="btn-back-to-schedule-result" onclick="backToSchedule()">
                <i class="fas fa-home"></i> 학습 일정으로
            </button>
        </div>
    `;
    
    container.innerHTML = scoreCard + resultsList + actions;
}

// 다시 시도하기
function retryVocabTest() {
    console.log('🔄 다시 시도하기');
    initVocabTest(currentPages);
    setTimeout(() => {
        startVocabTest();
    }, 100);
}

// 정리 함수
function cleanupVocabTest() {
    console.log('🧹 내벨업보카 정리');
    vocabTestData = [];
    vocabUserAnswers = {};
    currentPages = '';
}

// ========================================
// Supabase 보카 기록 저장
// ========================================
async function saveVocabRecord(correctCount, totalCount, percentage) {
    if (window._deadlinePassedMode) {
        console.log('📝 [Vocab] 마감 지난 과제 — 저장 생략');
        return;
    }
    console.log('📝 [Vocab] saveVocabRecord 시작:', correctCount, '/', totalCount, '=', percentage + '%');
    
    var user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
    if (!user || !user.id) {
        console.log('📝 [Vocab] 사용자 없음 — 저장 생략');
        return;
    }
    
    if (user.id === 'dev-user-001') {
        console.log('📝 [Vocab] 개발 모드 — 저장 생략');
        return;
    }

    var scheduleInfo = { week: 1, day: '월' };
    var ct = window.currentTest;
    if (ct && ct.currentWeek) {
        scheduleInfo = { week: ct.currentWeek, day: ct.currentDay || '월' };
    }

    var accuracyRate = percentage / 100;  // 0~1 float

    // 인증률 결정: 정답률 30% 미만 → 0%, 그 외 → 100%
    var authRate = (percentage < 30) ? 0 : 100;

    try {
        // tr_study_records 저장
        var studyRecord = await saveStudyRecord({
            user_id: user.id,
            week: scheduleInfo.week,
            day: scheduleInfo.day,
            task_type: 'vocab',
            module_number: 1,
            attempt: 1,
            score: correctCount,
            total: totalCount,
            time_spent: 0,
            detail: { pages: currentPages, accuracy: percentage },
            vocab_accuracy_rate: accuracyRate,
            completed_at: new Date().toISOString()
        });

        if (studyRecord && studyRecord.id) {
            // tr_auth_records 저장
            await saveAuthRecord({
                user_id: user.id,
                study_record_id: studyRecord.id,
                auth_rate: authRate,
                step1_completed: true,
                step2_completed: false,
                explanation_completed: false,
                fraud_flag: (percentage < 30)
            });
            console.log('📝 [Vocab] 기록 저장 완료, 인증률:', authRate + '%');

            // ProgressTracker 캐시 갱신
            if (window.ProgressTracker) {
                ProgressTracker.markCompleted('vocab', 1);
            }

            // 학생 통계 갱신 (tr_student_stats UPSERT)
            if (window.AuthMonitor && typeof AuthMonitor.updateStudentStats === 'function') {
                AuthMonitor.updateStudentStats();
                console.log('📊 [Vocab] 학생 통계 갱신 요청');
            }
        }
    } catch (e) {
        console.error('📝 [Vocab] 저장 실패:', e);
    }

    // 정답률 30% 미만 안내 문구
    if (percentage < 30) {
        setTimeout(function() {
            var container = document.getElementById('vocabResultContainer');
            if (container) {
                var notice = document.createElement('div');
                notice.style.cssText = 'background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:16px;margin:16px 0;text-align:center;color:#856404;font-size:14px;';
                notice.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 정답률이 30% 미만이므로 미인정 처리되었습니다.';
                container.insertBefore(notice, container.firstChild.nextSibling);
            }
        }, 100);
    }
}

console.log('✅ vocab-test-logic.js 로드 완료');
