// Listening - 컨버 로직 v=133
// 
// ✅ 컴포넌트화 완료!
// - ConverComponent: 실제 문제 풀이 로직
// - 이 파일: 어댑터 + 결과 화면

console.log('✅ listening-conver-logic.js 로드 시작');

// ============================================
// 1. 어댑터 함수 (Component 사용)
// ============================================

let currentConverComponent = null;

async function initConverComponent(setId, onCompleteCallback) {
    console.log(`📦 [모듈] initConverComponent - setId: ${setId}`);
    currentConverComponent = new ConverComponent(setId, {
        onComplete: (results) => {
            console.log(`✅ [모듈] Conver Component 완료`);
            if (onCompleteCallback) onCompleteCallback(results);
        },
        onError: (error) => console.error(`❌ [모듈] Conver Component 오류:`, error),
        onTimerStart: () => {
            console.log(`⏰ [모듈] Conver 타이머 시작 (20초)`);
            if (window.moduleController) {
                window.moduleController.startQuestionTimer(20);
            }
        }
    });
    
    // 전역으로 노출 (HTML onclick에서 접근)
    window.currentConverComponent = currentConverComponent;
    console.log(`✅ [모듈] Conver Component 전역 노출 완료`);
    
    await currentConverComponent.init();
}

async function initListeningConver(setNumber = 1) {
    console.log(`📖 [어댑터] initListeningConver - setNumber: ${setNumber}`);
    
    // Component 생성
    currentConverComponent = new ConverComponent(setNumber);
    
    // 완료 콜백 설정
    currentConverComponent.onComplete = (results) => {
        console.log(`✅ [어댑터] Component 완료 콜백 받음`);
        
        // Module 콜백이 있으면 전달
        if (window.moduleCallback) {
            window.moduleCallback(results);
        } else {
            // 일반 모드: 결과 화면 표시
            showConverResults();
        }
    };
    
    // 타이머 시작 콜백 설정
    currentConverComponent.onTimerStart = () => {
        console.log(`⏰ [어댑터] 타이머 시작 요청`);
        // Module이 타이머를 시작해야 함
    };
    
    // 전역으로 노출 (HTML onclick에서 접근)
    window.currentConverComponent = currentConverComponent;
    
    // 초기화
    const success = await currentConverComponent.init();
    
    if (!success) {
        console.error('❌ [어댑터] Component 초기화 실패');
        alert('컨버를 시작할 수 없습니다.');
        backToSchedule();
    }
}

/**
 * 다음 문제 - Component 어댑터
 */
function nextConverQuestion() {
    if (currentConverComponent) {
        const hasNext = currentConverComponent.nextQuestion();
        if (hasNext) {
            // 다음 문제 → 타이머 리셋 (20초)
            if (window.moduleController && window.moduleController.startQuestionTimer) {
                window.moduleController.startQuestionTimer(20);
            }
        } else {
            // 마지막 문제 - 제출
            submitListeningConver();
        }
    }
}

/**
 * 제출 - Component 어댑터
 */
function submitListeningConver() {
    console.log(`📤 [어댑터] submitListeningConver 호출`);
    
    if (currentConverComponent) {
        currentConverComponent.submit();
    } else {
        console.error(`❌ Component가 초기화되지 않았습니다`);
    }
}

/**
 * 선택지 선택 - 전역 함수로 노출 (HTML에서 호출)
 */
function selectConverOption(optionIndex) {
    if (currentConverComponent) {
        currentConverComponent.selectOption(optionIndex);
    }
}

/**
 * Cleanup - Component 어댑터
 */
function cleanupListeningConver() {
    console.log('🧹 [어댑터] Cleanup 시작');
    
    if (currentConverComponent) {
        currentConverComponent.cleanup();
        currentConverComponent = null;
    }
    
    window.currentConverComponent = null;
    
    console.log('🧹 [어댑터] Cleanup 완료');
}

window.initConverComponent = initConverComponent;
window.initListeningConver = initListeningConver;

// ============================================
// 2. 결과 화면 (기존 유지)
// ============================================

// Google Drive URL 변환
function convertGoogleDriveUrl(url) {
    if (!url || url === 'PLACEHOLDER') return url;
    if (url.trim() === '') return '';
    if (url.startsWith('http') && !url.includes('drive.google.com')) {
        return url;
    }
    
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
        return `https://drive.google.com/uc?export=open&id=${match[1]}`;
    }
    
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
        return `https://drive.google.com/uc?export=open&id=${idMatch[1]}`;
    }
    
    return url;
}

// 결과 화면 표시
function showConverResults() {
    console.log('📊 [컨버] 결과 화면 표시');
    
    const converResultsStr = sessionStorage.getItem('converResults');
    if (!converResultsStr) {
        console.error('❌ 결과 데이터가 없습니다');
        return;
    }
    
    const converResults = JSON.parse(converResultsStr);
    
    // 전체 정답/오답 계산
    let totalCorrect = 0;
    let totalQuestions = 0;
    
    converResults.forEach(setResult => {
        setResult.answers.forEach(answer => {
            totalQuestions++;
            if (answer.isCorrect) {
                totalCorrect++;
            }
        });
    });
    
    const totalIncorrect = totalQuestions - totalCorrect;
    const totalScore = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    
    console.log('📊 총 문제:', totalQuestions);
    console.log('✅ 정답:', totalCorrect);
    console.log('❌ 오답:', totalIncorrect);
    console.log('💯 점수:', totalScore + '%');
    
    // 결과 UI 업데이트
    document.getElementById('converResultScoreValue').textContent = totalScore + '%';
    document.getElementById('converResultCorrectCount').textContent = totalCorrect;
    document.getElementById('converResultIncorrectCount').textContent = totalIncorrect;
    document.getElementById('converResultTotalCount').textContent = totalQuestions;
    
    // Week/Day 정보
    const currentTest = JSON.parse(sessionStorage.getItem('currentTest') || '{"week":"Week 1","day":"월"}');
    const dayTitle = `${currentTest.week || 'Week 1'}, ${currentTest.day || '월'}요일 - 컨버`;
    document.getElementById('converResultDayTitle').textContent = dayTitle;
    
    // 세부 결과 렌더링
    const detailsContainer = document.getElementById('converResultDetails');
    let detailsHTML = '';
    
    converResults.forEach((setResult, setIdx) => {
        detailsHTML += renderConverSetResult(setResult, setIdx);
    });
    
    detailsContainer.innerHTML = detailsHTML;
    
    // 결과 화면 표시
    showScreen('listeningConverResultScreen');
    
    // 오디오 리스너 초기화 (DOM 렌더링 후)
    setTimeout(() => {
        console.log('🔧 오디오 리스너 초기화 시작...');
        initConverResultAudioListeners();
        console.log('✅ 오디오 리스너 초기화 완료');
        
        // 툴팁 이벤트 리스너 추가
        const highlightedWords = document.querySelectorAll('.conver-keyword');
        highlightedWords.forEach(word => {
            word.addEventListener('mouseenter', showConverTooltip);
            word.addEventListener('mouseleave', hideConverTooltip);
        });
        console.log(`✅ 툴팁 이벤트 리스너 추가 완료: ${highlightedWords.length}개`);
        
        // 초기화 후 결과 데이터 정리
        sessionStorage.removeItem('converResults');
    }, 300);
}

// 세트별 결과 렌더링
function renderConverSetResult(setResult, setIdx) {
    const audioId = `conver-main-audio-${setIdx}`;
    
    const setNumber = setIdx + 1;
    const questionCount = setResult.answers.length;
    // 세트 메타 정보: setResult.setDescription이 있으면 사용
    const setMeta = setResult.setDescription || `대화 듣기 · ${questionCount}문제`;
    
    let html = `
        <div class="conver-set">
            <!-- 세트 헤더 -->
            <div class="conver-set-header">
                <span class="conver-set-badge">
                    <i class="fas fa-comments"></i>
                    Conversation Set ${setNumber}
                </span>
                <span class="conver-set-meta">${setMeta}</span>
            </div>
            
            <!-- 전체 대화 오디오 -->
            ${setResult.answers[0].audioUrl ? `
            <div class="conver-audio-section">
                <div class="conver-audio-title">
                    <i class="fas fa-volume-up"></i>
                    <span>전체 대화 다시 듣기</span>
                </div>
                <div class="conver-audio-player">
                    <button class="conver-play-btn" onclick="toggleConverAudio('${audioId}')">
                        <i class="fas fa-play" id="${audioId}-icon"></i>
                    </button>
                    <div class="conver-seek-container">
                        <div class="conver-seek-bar" id="${audioId}-seek" onclick="seekConverAudio('${audioId}', event)">
                            <div class="conver-seek-progress" id="${audioId}-progress" style="width: 0%">
                                <div class="conver-seek-handle"></div>
                            </div>
                        </div>
                        <div class="conver-audio-time">
                            <span id="${audioId}-current">0:00</span> <span id="${audioId}-duration">0:00</span>
                        </div>
                    </div>
                    <audio id="${audioId}" src="${convertGoogleDriveUrl(setResult.answers[0].audioUrl)}"></audio>
                </div>
            </div>
            ` : ''}
            
            <!-- 전체 스크립트 -->
            ${setResult.answers[0].script ? `
            <div class="conver-script-section">
                <button class="conver-script-toggle" onclick="toggleConverScriptSection('conver-script-${setIdx}')">
                    <i class="fas fa-file-alt"></i>
                    <span class="toggle-text">전체 대화 스크립트 보기</span>
                    <i class="fas fa-chevron-down" id="conver-script-${setIdx}-icon"></i>
                </button>
                <div id="conver-script-${setIdx}" class="conver-script-body" style="display: none;">
                    ${renderConverScript(setResult.answers[0].script, setResult.answers[0].scriptTrans, setResult.answers[0].scriptHighlights || [])}
                </div>
            </div>
            ` : ''}
            
            <!-- 구분선: 문제 영역 -->
            <div class="conver-questions-divider">
                <span>문제 해설</span>
            </div>
    `;
    
    // 각 문제 렌더링
    setResult.answers.forEach((answer, qIdx) => {
        html += renderConverAnswer(answer, qIdx, setIdx);
    });
    
    // 대화 요약 (데이터에 summaryText가 있는 경우)
    if (setResult.summaryText) {
        html += `
            <div class="conver-summary-section">
                <div class="conver-summary-title">
                    <i class="fas fa-lightbulb"></i>
                    <span>대화 핵심 포인트</span>
                </div>
                <div class="conver-summary-text">${setResult.summaryText}</div>
                ${setResult.keyPoints ? `
                <div class="conver-key-points">
                    ${setResult.keyPoints.map(point => `<div class="conver-key-point">${point}</div>`).join('')}
                </div>
                ` : ''}
            </div>
        `;
    }
    
    html += `
        </div>
    `;
    
    return html;
}

// 스크립트 렌더링 (화자별)
function renderConverScript(script, scriptTrans, scriptHighlights = []) {
    if (!script) return '';
    
    const speakerPattern = /(Man:|Woman:)/g;
    const scriptParts = script.split(speakerPattern).filter(part => part.trim());
    const transParts = scriptTrans ? scriptTrans.split(/(남자:|여자:)/g).filter(part => part.trim()) : [];
    
    let html = '';
    let transIndex = 0;
    
    for (let i = 0; i < scriptParts.length; i += 2) {
        if (i + 1 >= scriptParts.length) break;
        
        const speaker = scriptParts[i].trim();
        const text = scriptParts[i + 1].trim();
        
        let translation = '';
        const koreanSpeaker = speaker === 'Man:' ? '남자:' : '여자:';
        
        for (let j = transIndex; j < transParts.length; j += 2) {
            if (transParts[j] === koreanSpeaker && j + 1 < transParts.length) {
                translation = transParts[j + 1].trim();
                transIndex = j + 2;
                break;
            }
        }
        
        // 화자명 매핑 (Man: → Student 등, 기본값)
        const speakerName = speaker.replace(':', '').trim();
        const speakerBClass = speaker === 'Woman:' ? ' speaker-b' : '';
        
        html += `
            <div class="script-line">
                <span class="script-speaker${speakerBClass}">${speakerName}</span>
                <div class="script-text">
                    ${highlightConverScript(text, scriptHighlights)}
                    ${translation ? `<span class="translation">${translation}</span>` : ''}
                </div>
            </div>
        `;
    }
    
    return html;
}

// 스크립트 하이라이트
function highlightConverScript(scriptText, highlights) {
    if (!highlights || highlights.length === 0) {
        return escapeHtml(scriptText);
    }
    
    let highlightedText = escapeHtml(scriptText);
    
    highlights.forEach(highlight => {
        const word = highlight.word || '';
        const translation = highlight.translation || '';
        const explanation = highlight.explanation || '';
        
        if (!word) return;
        
        const regex = new RegExp(`\\b(${escapeRegex(word)})\\b`, 'gi');
        highlightedText = highlightedText.replace(regex, (match) => {
            return `<span class="conver-keyword" data-translation="${escapeHtml(translation)}" data-explanation="${escapeHtml(explanation)}">${match}</span>`;
        });
    });
    
    return highlightedText;
}

// 정규식 이스케이프
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// HTML 이스케이프
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 툴팁 표시
function showConverTooltip(event) {
    const word = event.target;
    const translation = word.getAttribute('data-translation');
    const explanation = word.getAttribute('data-explanation');
    
    const existingTooltip = document.querySelector('.conver-tooltip');
    if (existingTooltip) {
        existingTooltip.remove();
    }
    
    const tooltip = document.createElement('div');
    tooltip.className = 'conver-tooltip';
    tooltip.innerHTML = `
        <div class="tooltip-translation">${translation}</div>
        ${explanation ? `<div class="tooltip-explanation">${explanation}</div>` : ''}
    `;
    
    document.body.appendChild(tooltip);
    
    const rect = word.getBoundingClientRect();
    tooltip.style.left = `${rect.left + window.scrollX}px`;
    tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
}

// 툴팁 숨기기
function hideConverTooltip() {
    const tooltip = document.querySelector('.conver-tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

// 문제별 결과 렌더링
function renderConverAnswer(answer, qIdx, setIdx) {
    const isCorrect = answer.isCorrect;
    const correctIcon = isCorrect 
        ? '<i class="fas fa-check-circle" style="color: var(--success-color);"></i>' 
        : '<i class="fas fa-times-circle" style="color: var(--danger-color);"></i>';
    
    let html = `
        <div class="conver-question">
            <div class="conver-question-header">
                <span class="conver-q-number">Question ${answer.questionNum}</span>
                <span class="conver-q-status">${correctIcon}</span>
            </div>
            <div class="conver-q-text">${answer.question}</div>
            ${answer.questionTrans ? `<div class="conver-q-translation">${answer.questionTrans}</div>` : ''}
            
            <div class="conver-answer-summary">
                <div class="conver-answer-row">
                    <span class="conver-answer-label">내 답변:</span>
                    <span class="conver-answer-value ${isCorrect ? 'correct' : 'incorrect'}">
                        ${answer.userAnswer ? `${answer.options[answer.userAnswer - 1]}` : '미응답'}
                    </span>
                </div>
                <div class="conver-answer-row">
                    <span class="conver-answer-label">정답:</span>
                    <span class="conver-answer-value correct">
                        ${answer.options[answer.correctAnswer - 1]}
                    </span>
                </div>
            </div>
            
            ${renderConverOptionsExplanation(answer, qIdx, setIdx)}
        </div>
    `;
    
    return html;
}

// 보기 해설 렌더링
function renderConverOptionsExplanation(answer, qIdx, setIdx) {
    if (!answer.optionExplanations || answer.optionExplanations.length === 0) {
        return '';
    }
    
    const hasExplanations = answer.optionExplanations.some(exp => exp && exp.trim());
    if (!hasExplanations) {
        return '';
    }
    
    const toggleId = `conver-toggle-q${setIdx}-${qIdx}`;
    
    let html = `
            <button class="conver-toggle-btn" onclick="toggleConverExplanation('${toggleId}')">
                <span class="toggle-text">보기 상세 해설 펼치기</span>
                <i class="fas fa-chevron-down" id="${toggleId}-icon"></i>
            </button>
            <div id="${toggleId}" class="conver-options-details" style="display: none;">
    `;
    
    answer.options.forEach((option, idx) => {
        const optionLetter = String.fromCharCode(65 + idx);
        const isCorrectOption = (idx + 1) === answer.correctAnswer;
        const translation = answer.optionTranslations && answer.optionTranslations[idx] ? answer.optionTranslations[idx] : '';
        const explanation = answer.optionExplanations && answer.optionExplanations[idx] ? answer.optionExplanations[idx] : '';
        
        html += `
            <div class="conver-option ${isCorrectOption ? 'correct' : ''}">
                <div class="conver-option-text"><span class="conver-option-marker">${optionLetter}</span>${option}</div>
                ${translation ? `<div class="conver-option-translation">${translation}</div>` : ''}
                ${explanation ? `
                <div class="conver-option-explanation ${isCorrectOption ? 'correct' : 'incorrect'}">
                    <strong>${isCorrectOption ? '정답 이유:' : '오답 이유:'}</strong> ${explanation}
                </div>
                ` : ''}
            </div>
        `;
    });
    
    html += `
            </div>
    `;
    
    return html;
}

// 스크립트 토글
function toggleConverScriptSection(scriptId) {
    const content = document.getElementById(scriptId);
    const icon = document.getElementById(scriptId + '-icon');
    const btn = content.previousElementSibling;
    const text = btn.querySelector('.toggle-text');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
        text.textContent = '전체 대화 스크립트 접기';
    } else {
        content.style.display = 'none';
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
        text.textContent = '전체 대화 스크립트 보기';
    }
}

// 해설 토글
function toggleConverExplanation(toggleId) {
    const content = document.getElementById(toggleId);
    const btn = content.previousElementSibling;
    const icon = btn.querySelector('i');
    const text = btn.querySelector('.toggle-text');
    
    if (content.style.display === 'none') {
        content.style.display = 'flex';
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
        text.textContent = '보기 상세 해설 접기';
    } else {
        content.style.display = 'none';
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
        text.textContent = '보기 상세 해설 펼치기';
    }
}

// 오디오 재생/정지
function toggleConverAudio(audioId) {
    const audio = document.getElementById(audioId);
    const icon = document.getElementById(audioId + '-icon');
    
    if (!audio) {
        console.error('❌ 오디오 요소를 찾을 수 없음:', audioId);
        return;
    }
    
    if (audio.paused) {
        // 다른 모든 오디오 정지
        document.querySelectorAll('audio').forEach(a => {
            if (a.id !== audioId && !a.paused) {
                a.pause();
            }
        });
        
        // 모든 재생 버튼 초기화
        document.querySelectorAll('.audio-play-btn').forEach(btn => {
            const btnIcon = btn.querySelector('i');
            if (btnIcon) {
                btnIcon.classList.remove('fa-pause');
                btnIcon.classList.add('fa-play');
            }
        });
        
        audio.play();
        icon.classList.remove('fa-play');
        icon.classList.add('fa-pause');
    } else {
        audio.pause();
        icon.classList.remove('fa-pause');
        icon.classList.add('fa-play');
    }
}

// 시간 포맷
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 오디오 시크바
function seekConverAudio(audioId, event) {
    const audio = document.getElementById(audioId);
    const seekBar = document.getElementById(audioId + '-seek');
    
    if (!audio || !seekBar) return;
    
    const rect = seekBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    
    audio.currentTime = audio.duration * percentage;
}

// 오디오 리스너 설정
const setupConverAudioListeners = (() => {
    const setupFlags = {};
    
    return function(audioId) {
        const audio = document.getElementById(audioId);
        const progress = document.getElementById(audioId + '-progress');
        const currentTimeEl = document.getElementById(audioId + '-current');
        const durationEl = document.getElementById(audioId + '-duration');
        const icon = document.getElementById(audioId + '-icon');
        
        if (!audio) return;
        if (setupFlags[audioId]) return;
        
        audio.addEventListener('loadedmetadata', () => {
            if (durationEl) {
                durationEl.textContent = formatTime(audio.duration);
            }
        });
        
        audio.addEventListener('canplay', () => {
            if (durationEl && audio.duration) {
                durationEl.textContent = formatTime(audio.duration);
            }
        });
        
        audio.addEventListener('timeupdate', () => {
            if (currentTimeEl) {
                currentTimeEl.textContent = formatTime(audio.currentTime);
            }
            if (progress && audio.duration) {
                const percentage = (audio.currentTime / audio.duration) * 100;
                progress.style.width = percentage + '%';
            }
        });
        
        audio.addEventListener('ended', () => {
            if (icon) {
                icon.classList.remove('fa-pause');
                icon.classList.add('fa-play');
            }
            if (progress) {
                progress.style.width = '0%';
            }
            if (currentTimeEl) {
                currentTimeEl.textContent = '0:00';
            }
        });
        
        setupFlags[audioId] = true;
    };
})();

// 모든 오디오 리스너 초기화
function initConverResultAudioListeners() {
    document.querySelectorAll('audio[id^="conver-main-audio-"]').forEach(audio => {
        setupConverAudioListeners(audio.id);
    });
}

// 학습 일정으로 돌아가기
function backToScheduleFromConverResult() {
    sessionStorage.removeItem('converResults');
    backToScheduleFromResult();
}
