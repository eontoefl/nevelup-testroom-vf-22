// Writing - 토론형 로직

let currentDiscussionSet = 0;
let currentDiscussionQuestion = 0;
let discussionTimer = null;
let discussionAnswers = {};
let writingDiscussionData = null;
let discussionUndoStack = [];
let discussionRedoStack = [];
let discussionWordCountVisible = true;

const DISCUSSION_TIME_LIMIT = 540; // 9분 = 540초
const DISCUSSION_MAX_WORD_COUNT = 1000;

// 토론형 데이터 구조
const DISCUSSION_SHEET_CONFIG = {
    spreadsheetId: '1Na3AmaqNeE2a3gcq7koj0TF2jGZhS7m8PFuk2S8rRfo',
    sheetGid: '44517517'
};

// Google Sheets에서 데이터 로드
async function loadDiscussionData() {
    try {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${DISCUSSION_SHEET_CONFIG.spreadsheetId}/export?format=csv&gid=${DISCUSSION_SHEET_CONFIG.sheetGid}`;
        console.log('라이팅-토론형 CSV URL:', csvUrl);
        
        const response = await fetch(csvUrl);
        const csvText = await response.text();
        
        console.log('CSV 로드 성공, 길이:', csvText.length);
        
        return parseDiscussionCSV(csvText);
    } catch (error) {
        console.error('라이팅-토론형 데이터 로드 실패:', error);
        return getDiscussionDemoData();
    }
}

// CSV 파싱
function parseDiscussionCSV(csvText) {
    const lines = csvText.split('\n');
    const sets = [];
    
    // 헤더 제외하고 데이터 파싱
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const columns = line.split(',');
        if (columns.length < 10) continue;
        
        const set = {
            id: columns[0].trim(),
            classContext: columns[1].trim(),
            topic: columns[2].trim(),
            student1Name: columns[3].trim(),
            student1Opinion: columns[4].trim(),
            student1Image: columns[5].trim(),
            student2Name: columns[6].trim(),
            student2Opinion: columns[7].trim(),
            student2Image: columns[8].trim(),
            professorImage: columns[9].trim()
        };
        
        sets.push(set);
        console.log('라이팅-토론형 추가:', set.id);
    }
    
    console.log('라이팅-토론형 총 세트 개수:', sets.length);
    
    return {
        type: 'writing_discussion',
        timeLimit: DISCUSSION_TIME_LIMIT,
        sets: sets
    };
}

// 데모 데이터
function getDiscussionDemoData() {
    return {
        type: 'writing_discussion',
        timeLimit: DISCUSSION_TIME_LIMIT,
        sets: [
            {
                id: 'writing_discussion_1',
                classContext: 'Your professor is teaching a class on psychology. Write a post responding to the professor\'s question.',
                topic: 'Today we\'ll discuss the effects of exercise on mental health. Clearly, regular physical activity can improve mood and reduce stress. On the other hand, some people believe that mental health is primarily influenced by other factors such as genetics and the environment. Which do you believe plays a larger role in mental health? Why?',
                student1Name: 'Claire',
                student1Opinion: 'I think regular exercise has a significant positive impact on mental health. It can reduce stress, improve mood, and increase overall well-being by releasing endorphins and promoting a healthy lifestyle.',
                student1Image: 'https://i.pravatar.cc/150?img=5',
                student2Name: 'Andrew',
                student2Opinion: 'I believe that while exercise is important, other factors like genetics and environment play a larger role in mental health. A supportive environment and good mental health practices are crucial for overall well-being.',
                student2Image: 'https://i.pravatar.cc/150?img=12',
                professorImage: 'https://i.pravatar.cc/150?img=33'
            }
        ]
    };
}

// 초기화
async function initWritingDiscussion() {
    console.log('라이팅-토론형 초기화');
    
    writingDiscussionData = await loadDiscussionData();
    
    currentDiscussionSet = 0;
    currentDiscussionQuestion = 0;
    discussionAnswers = {};
    discussionUndoStack = [];
    discussionRedoStack = [];
    discussionWordCountVisible = true;
    
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none';
    });
    
    const discussionScreen = document.getElementById('writingDiscussionScreen');
    discussionScreen.classList.add('active');
    discussionScreen.style.display = 'block';
    
    console.log('writingDiscussionScreen 표시 완료');
    
    loadDiscussionQuestion(0);
}

// 문제 로드
function loadDiscussionQuestion(questionIndex) {
    const set = writingDiscussionData.sets[questionIndex];
    
    if (!set) {
        console.error('문제를 찾을 수 없습니다:', questionIndex);
        return;
    }
    
    currentDiscussionQuestion = questionIndex;
    
    stopDiscussionTimer();
    
    const totalQuestions = writingDiscussionData.sets.length;
    document.getElementById('discussionProgress').textContent = 
        `Question ${questionIndex + 1} of ${totalQuestions}`;
    
    renderDiscussionQuestion(set);
    
    startDiscussionTimer();
    
    updateDiscussionButtons();
}

// 문제 렌더링
function renderDiscussionQuestion(set) {
    // 왼쪽: 과제 설명
    document.getElementById('discussionClassContext').textContent = set.classContext;
    document.getElementById('discussionTopic').textContent = set.topic;
    document.getElementById('discussionProfessorImage').src = set.professorImage;
    
    // 학생 의견
    document.getElementById('discussionStudent1Image').src = set.student1Image;
    document.getElementById('discussionStudent1Name').textContent = set.student1Name;
    document.getElementById('discussionStudent1Opinion').textContent = set.student1Opinion;
    
    document.getElementById('discussionStudent2Image').src = set.student2Image;
    document.getElementById('discussionStudent2Name').textContent = set.student2Name;
    document.getElementById('discussionStudent2Opinion').textContent = set.student2Opinion;
    
    // 이전 답안 불러오기
    const savedAnswer = discussionAnswers[set.id] || '';
    
    const textarea = document.getElementById('discussionTextarea');
    if (textarea) {
        textarea.value = savedAnswer;
        
        // DOM이 완전히 렌더링된 후 단어수 업데이트
        setTimeout(() => {
            updateDiscussionWordCount();
            console.log('✅ renderDiscussionQuestion: 단어수 업데이트 완료');
        }, 100);
    } else {
        console.error('❌ discussionTextarea를 찾을 수 없습니다');
    }
    
    // Undo/Redo 스택 초기화
    discussionUndoStack = [savedAnswer];
    discussionRedoStack = [];
}

// 텍스트 입력 이벤트
function onDiscussionTextInput() {
    console.log('🔵 onDiscussionTextInput 호출됨!');
    
    const textarea = document.getElementById('discussionTextarea');
    if (!textarea) {
        console.error('❌ discussionTextarea를 찾을 수 없습니다');
        return;
    }
    
    console.log('📝 현재 텍스트:', textarea.value);
    
    // 데이터가 로드되었는지 확인
    if (!writingDiscussionData || !writingDiscussionData.sets || writingDiscussionData.sets.length === 0) {
        console.error('❌ writingDiscussionData가 없습니다');
        updateDiscussionWordCount();
        return;
    }
    
    const set = writingDiscussionData.sets[currentDiscussionQuestion];
    if (!set) {
        console.error('❌ set을 찾을 수 없습니다. currentDiscussionQuestion:', currentDiscussionQuestion);
        updateDiscussionWordCount();
        return;
    }
    
    // 답안 저장
    discussionAnswers[set.id] = textarea.value;
    
    // Undo 스택에 추가
    if (discussionUndoStack[discussionUndoStack.length - 1] !== textarea.value) {
        discussionUndoStack.push(textarea.value);
        discussionRedoStack = [];
    }
    
    updateDiscussionWordCount();
}

// 단어수 카운트
function updateDiscussionWordCount() {
    console.log('🔵 updateDiscussionWordCount 호출됨!');
    
    const textarea = document.getElementById('discussionTextarea');
    if (!textarea) {
        console.error('❌ discussionTextarea를 찾을 수 없습니다');
        return;
    }
    
    const text = textarea.value.trim();
    const words = text ? text.split(/\s+/).filter(word => word.length > 0).length : 0;
    
    console.log('📊 계산된 단어수:', words);
    
    const wordCountElement = document.getElementById('discussionWordCount');
    if (wordCountElement) {
        wordCountElement.textContent = words;
        console.log('✅ 단어수 업데이트 완료:', words);
    } else {
        console.error('❌ discussionWordCount 요소를 찾을 수 없습니다');
    }
    
    // 최대 단어수 체크
    if (words > DISCUSSION_MAX_WORD_COUNT) {
        const wordsArray = text.split(/\s+/).filter(word => word.length > 0);
        textarea.value = wordsArray.slice(0, DISCUSSION_MAX_WORD_COUNT).join(' ');
        updateDiscussionWordCount();
    }
}

// Cut
function cutDiscussionText() {
    const textarea = document.getElementById('discussionTextarea');
    const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
    
    if (selectedText) {
        navigator.clipboard.writeText(selectedText);
        
        const newValue = textarea.value.substring(0, textarea.selectionStart) + 
                        textarea.value.substring(textarea.selectionEnd);
        textarea.value = newValue;
        
        onDiscussionTextInput();
    }
}

// Paste
function pasteDiscussionText() {
    navigator.clipboard.readText().then(text => {
        const textarea = document.getElementById('discussionTextarea');
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        
        const newValue = textarea.value.substring(0, start) + text + textarea.value.substring(end);
        textarea.value = newValue;
        
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        
        onDiscussionTextInput();
    });
}

// Undo
function undoDiscussionText() {
    if (discussionUndoStack.length > 1) {
        const current = discussionUndoStack.pop();
        discussionRedoStack.push(current);
        
        const previous = discussionUndoStack[discussionUndoStack.length - 1];
        document.getElementById('discussionTextarea').value = previous;
        
        updateDiscussionWordCount();
    }
}

// Redo
function redoDiscussionText() {
    if (discussionRedoStack.length > 0) {
        const next = discussionRedoStack.pop();
        discussionUndoStack.push(next);
        
        document.getElementById('discussionTextarea').value = next;
        
        updateDiscussionWordCount();
    }
}

// 단어수 표시/숨김
function toggleDiscussionWordCount() {
    discussionWordCountVisible = !discussionWordCountVisible;
    const wordCountElement = document.getElementById('discussionWordCountDisplay');
    const toggleButton = document.getElementById('toggleDiscussionWordCountBtn');
    
    if (discussionWordCountVisible) {
        wordCountElement.style.display = 'inline';
        toggleButton.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Word Count';
    } else {
        wordCountElement.style.display = 'none';
        toggleButton.innerHTML = '<i class="fas fa-eye"></i> Show Word Count';
    }
}

// 답안 다운로드
function downloadDiscussion() {
    const set = writingDiscussionData.sets[currentDiscussionQuestion];
    const answer = discussionAnswers[set.id] || '';
    
    const content = `Discussion Topic:\n${set.topic}\n\nYour Response:\n${answer}`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `discussion_${set.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 타이머 시작
function startDiscussionTimer() {
    const timerElement = document.getElementById('discussionTimer');
    let timeLeft = DISCUSSION_TIME_LIMIT;
    
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    discussionTimer = setInterval(() => {
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            stopDiscussionTimer();
            submitWritingDiscussion();
        }
    }, 1000);
}

// 타이머 정지
function stopDiscussionTimer() {
    if (discussionTimer) {
        clearInterval(discussionTimer);
        discussionTimer = null;
    }
}

// 버튼 업데이트
function updateDiscussionButtons() {
    const submitBtn = document.getElementById('discussionSubmitBtn');
    
    if (!submitBtn) return;
    
    // 항상 Submit 버튼 표시 (토론형은 1문제만 있음)
    submitBtn.style.display = 'inline-block';
}

// 제출
function submitWritingDiscussion() {
    if (!writingDiscussionData || !writingDiscussionData.sets || writingDiscussionData.sets.length === 0) {
        return;
    }
    
    stopDiscussionTimer();
    
    writingDiscussionData = null;
    
    console.log('라이팅 - 토론형 완료!');
    
    alert('라이팅 - 토론형 완료!\n\n답안이 저장되었습니다.');
    
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.style.display = 'none';
    });
    
    backToSchedule();
}

// 초기화 실행
if (typeof window !== 'undefined') {
    loadDiscussionData();
}
