// 初始化 VexFlow
const { Renderer, Stave, StaveNote, Formatter } = Vex.Flow;

// 定義彩虹顏色對照表
const colorMap = {
    "c": "#FF0000", "d": "#FFA500", "e": "#E6E600",
    "f": "#00FF00", "g": "#ADD8E6", "a": "#0000FF", "b": "#800080"
};

// 【核心改變】用一個 Array 儲存用家輸入嘅音符
let currentNotes = [];
const div = document.getElementById("score-canvas");

// 建立彩色音符 Function
function createColoredNote(noteName, duration) {
    const note = new StaveNote({ keys: [noteName], duration: duration });
    const keyLetter = noteName.charAt(0).toLowerCase(); 
    const color = colorMap[keyLetter] || "#000000";
    note.setStyle({ fillStyle: color, strokeStyle: color });
    return note;
}

// 重新繪製樂譜 Function
function renderScore() {
    // 1. 清除舊畫面
    div.innerHTML = "";
    
    // 2. 重新設定畫布 (根據音符數量拉長畫布)
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    const canvasWidth = Math.max(500, currentNotes.length * 50 + 150);
    renderer.resize(canvasWidth, 200); 
    const context = renderer.getContext();
    
    // 3. 畫五線譜
    const stave = new Stave(10, 40, canvasWidth - 20);
    stave.addClef("treble").addTimeSignature("4/4");
    stave.setContext(context).draw();

    // 4. 如果陣列入面有音符，就畫出嚟
    if (currentNotes.length > 0) {
        Formatter.FormatAndDraw(context, stave, currentNotes);
    }
}

// --- 互動邏輯 ---

// 綁定底部音符按鈕 (撳掣加音符 + 發聲)
document.querySelectorAll('.note-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        const noteValue = e.target.getAttribute('data-note');
        
        // 1. 加音符入五線譜
        const newNote = createColoredNote(noteValue, "q"); // 暫時預設全部為 4分音符 (q)
        currentNotes.push(newNote);
        renderScore();

        // 2. 用 Tone.js 播放該音符
        await Tone.start(); // 解鎖瀏覽器音效
        const synth = new Tone.Synth().toDestination();
        // 將 "c/4" 轉換為 "C4" 畀 Tone.js 讀取
        const toneNote = noteValue.replace('/', '').toUpperCase(); 
        synth.triggerAttackRelease(toneNote, "8n");
    });
});

// 綁定清除按鈕
document.getElementById('clear-btn').addEventListener('click', () => {
    currentNotes = [];
    renderScore();
});

// 網頁一打開，先畫一條空嘅五線譜
renderScore();
