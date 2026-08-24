// 初始化 VexFlow
const { Renderer, Stave, StaveNote, Formatter } = Vex.Flow;

// 定義你專屬嘅「彩虹音符」顏色對照表
const colorMap = {
    "c": "#FF0000", // 紅
    "d": "#FFA500", // 橙
    "e": "#FFFF00", // 黃 (如果太淺睇唔到，建議稍微調暗少少，例如 #E6E600)
    "f": "#00FF00", // 青/綠
    "g": "#ADD8E6", // 淺藍
    "a": "#0000FF", // 藍
    "b": "#800080"  // 紫
};

// 準備畫布
const div = document.getElementById("score-canvas");
const renderer = new Renderer(div, Renderer.Backends.SVG);
// 畫布大小：闊度先設為 500，高度 200
renderer.resize(500, 200);
const context = renderer.getContext();

// 畫一條五線譜 (Stave)
const stave = new Stave(10, 40, 400);
// 加入高音譜號同 4/4 拍
stave.addClef("treble").addTimeSignature("4/4");
stave.setContext(context).draw();

// 建立彩色音符嘅 Function
function createColoredNote(noteName, duration) {
    const note = new StaveNote({ keys: [noteName], duration: duration });
    
    // 擷取音符第一個英文字母 (例如 "c/4" -> "c")
    const keyLetter = noteName.charAt(0).toLowerCase(); 
    const color = colorMap[keyLetter] || "#000000"; // 如果搵唔到就用黑色

    // 設定音符頭同符桿顏色
    note.setStyle({ fillStyle: color, strokeStyle: color });
    return note;
}

// 建立一串測試音符 (C D E F G A B C)
const notes = [
    createColoredNote("c/4", "q"), // q = 4分音符
    createColoredNote("d/4", "q"),
    createColoredNote("e/4", "q"),
    createColoredNote("f/4", "q"),
    createColoredNote("g/4", "q"),
    createColoredNote("a/4", "q"),
    createColoredNote("b/4", "q"),
    createColoredNote("c/5", "q")
];

// 格式化並畫出音符
Formatter.FormatAndDraw(context, stave, notes);

// --- 音效準備 (Tone.js) ---
document.getElementById('play-btn').addEventListener('click', async () => {
    // 瀏覽器要求必須有 user interaction 先可以發聲
    await Tone.start(); 
    
    // 建立一個簡單嘅合成器
    const synth = new Tone.Synth().toDestination();
    
    // 簡單測試發聲：播放一個 C4 音，長度為 8分音符
    synth.triggerAttackRelease("C4", "8n");
    
    alert("Tone.js 已經啟動！呢度暫時播放一吓 C 音作為測試。後續可以將 Tone.js 同 VexFlow 嘅音符陣列連動。");
});
