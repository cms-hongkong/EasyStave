const { Renderer, Stave, StaveNote, Formatter, Dot, BarNote, Barline } = Vex.Flow;

let scoreData = [];
const colorMap = { "c": "#FF0000", "d": "#FFA500", "e": "#E6E600", "f": "#00FF00", "g": "#ADD8E6", "a": "#0000FF", "b": "#800080" };
const div = document.getElementById("score-canvas");

// --- 介面狀態 ---
let isColorMode = true;
let selectedDuration = "q"; // 預設 4分音符
let isRestMode = false;

// 綁定音符長度按鈕
document.querySelectorAll('.dur-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        selectedDuration = e.target.getAttribute('data-dur');
    });
});

// 綁定休止符按鈕
document.getElementById('rest-btn').addEventListener('click', (e) => {
    isRestMode = !isRestMode;
    e.target.classList.toggle('active');
    e.target.innerText = isRestMode ? "✔️ 休止符: 開" : "❌ 休止符: 關";
});

document.getElementById("toggle-color").addEventListener("click", function() {
    isColorMode = !isColorMode;
    this.innerText = isColorMode ? "🎨 彩色模式：開" : "🎨 彩色模式：關";
    this.classList.toggle("highlight");
    renderScore();
});

// --- 渲染樂譜核心 ---
function renderScore() {
    div.innerHTML = "";
    const clef = document.getElementById("clef-select").value;
    const timeSig = document.getElementById("time-select").value;
    const timeBeats = parseInt(timeSig.split('/')[0]); 

    const renderer = new Renderer(div, Renderer.Backends.SVG);
    const canvasWidth = Math.max(600, scoreData.length * 65 + 150);
    renderer.resize(canvasWidth, 200);
    const context = renderer.getContext();

    const stave = new Stave(10, 40, canvasWidth - 20);
    stave.addClef(clef).addTimeSignature(timeSig);
    stave.setContext(context).draw();

    if (scoreData.length === 0) return;

    let vexNotes = [];
    let currentBeats = 0;

    scoreData.forEach((data) => {
        let vexDuration = data.duration === "hd" ? "h" : data.duration;
        if (data.isRest) vexDuration += "r";
        
        let keys = data.isRest ? [(clef === "bass" ? "d/3" : "b/4")] : [data.pitch];
        
        // auto_stem: true 自動處理符桿上下！
        const note = new StaveNote({ keys: keys, duration: vexDuration, clef: clef, auto_stem: true });

        if (data.duration === "hd") note.addModifier(new Dot());
        
        if (isColorMode && !data.isRest) {
            const keyLetter = data.pitch.charAt(0).toLowerCase();
            const color = colorMap[keyLetter] || "#000000";
            note.setStyle({ fillStyle: color, strokeStyle: color });
        }
        
        vexNotes.push(note);

        // 準確計算小節線
        let beatValue = 0;
        if (data.duration === 'w') beatValue = 4;
        else if (data.duration === 'h') beatValue = 2;
        else if (data.duration === 'hd') beatValue = 3;
        else if (data.duration === 'q') beatValue = 1;
        else if (data.duration === '8') beatValue = 0.5;

        currentBeats = Math.round((currentBeats + beatValue) * 100) / 100;
        if (currentBeats >= timeBeats) {
            vexNotes.push(new BarNote(Barline.type.SINGLE));
            currentBeats = 0;
        }
    });

    Formatter.FormatAndDraw(context, stave, vexNotes);
}

// --- 輸入音符與播放 ---
document.querySelectorAll('.note-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        let basePitch = e.target.getAttribute('data-note'); 
        const clef = document.getElementById("clef-select").value;
        
        if (clef === "bass") {
            const parts = basePitch.split('/');
            basePitch = `${parts[0]}/${parseInt(parts[1]) - 2}`;
        }

        scoreData.push({ pitch: basePitch, duration: selectedDuration, isRest: isRestMode });
        renderScore();

        if (!isRestMode) {
            await Tone.start();
            const synth = new Tone.Synth({ volume: 15 }).toDestination();
            const tonePitch = basePitch.replace('/', '').toUpperCase();
            synth.triggerAttackRelease(tonePitch, "8n");
        }
    });
});

document.getElementById('clef-select').addEventListener('change', renderScore);
document.getElementById('time-select').addEventListener('change', renderScore);
document.getElementById('undo-btn').addEventListener('click', () => { scoreData.pop(); renderScore(); });
document.getElementById('clear-btn').addEventListener('click', () => { scoreData = []; renderScore(); });

// --- 播放全曲 ---
document.getElementById('play-all-btn').addEventListener('click', async () => {
    await Tone.start();
    const synth = new Tone.Synth({ volume: 15 }).toDestination();
    let now = Tone.now();
    
    scoreData.forEach(data => {
        let toneDur = data.duration === "w" ? "1n" : data.duration === "hd" ? "2n." : data.duration === "h" ? "2n" : data.duration === "q" ? "4n" : "8n";
        let addTime = data.duration === "w" ? 2 : data.duration === "hd" ? 1.5 : data.duration === "h" ? 1 : data.duration === "8" ? 0.25 : 0.5;
        
        if (!data.isRest) {
            let tonePitch = data.pitch.replace('/', '').toUpperCase();
            synth.triggerAttackRelease(tonePitch, toneDur, now);
        }
        now += addTime;
    });
});

renderScore();
