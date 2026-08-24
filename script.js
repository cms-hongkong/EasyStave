const { Renderer, Stave, StaveNote, Formatter, Accidental, Dot, BarNote, Barline } = Vex.Flow;

// --- 全局狀態 ---
let scoreData = []; // 儲存每一個輸入的音符數據
const colorMap = { "c": "#FF0000", "d": "#FFA500", "e": "#E6E600", "f": "#00FF00", "g": "#ADD8E6", "a": "#0000FF", "b": "#800080" };
const div = document.getElementById("score-canvas");

let isColorMode = true;
document.getElementById("toggle-color").addEventListener("click", function() {
    isColorMode = !isColorMode;
    this.classList.toggle("active");
    renderScore();
});

// --- 渲染樂譜核心 ---
function renderScore() {
    div.innerHTML = ""; // 清除舊畫布
    const clef = document.getElementById("clef-select").value;
    const timeSig = document.getElementById("time-select").value;
    const timeBeats = parseInt(timeSig.split('/')[0]); // 例如 4/4 拍，一小節有 4 拍

    const renderer = new Renderer(div, Renderer.Backends.SVG);
    // 根據音符數量動態調整畫布寬度
    const canvasWidth = Math.max(600, scoreData.length * 60 + 150);
    renderer.resize(canvasWidth, 200);
    const context = renderer.getContext();

    // 建立五線譜
    const stave = new Stave(10, 40, canvasWidth - 20);
    stave.addClef(clef).addTimeSignature(timeSig);
    stave.setContext(context).draw();

    if (scoreData.length === 0) return;

    let vexNotes = [];
    let currentBeats = 0;

    // 將資料轉換為 VexFlow 音符並計算小節線
    scoreData.forEach((data) => {
        // VexFlow 格式轉換 (處理附點)
        let vexDuration = data.duration === "hd" ? "h" : data.duration;
        if (data.isRest) vexDuration += "r";
        
        let keys = data.isRest ? [(clef === "bass" ? "d/3" : "b/4")] : [data.pitch];
        
        const note = new StaveNote({ keys: keys, duration: vexDuration, clef: clef });

        // 加入附點
        if (data.duration === "hd") note.addModifier(new Dot());
        // 加入升降號
        if (data.acc && !data.isRest) note.addModifier(new Accidental(data.acc));
        
        // 加入顏色
        if (isColorMode && !data.isRest) {
            const keyLetter = data.pitch.charAt(0).toLowerCase();
            const color = colorMap[keyLetter] || "#000000";
            note.setStyle({ fillStyle: color, strokeStyle: color });
        }
        
        vexNotes.push(note);

        // 節拍計算 (自動小節線)
        let beatValue = 0;
        if (data.duration === 'w') beatValue = 4;
        else if (data.duration === 'h') beatValue = 2;
        else if (data.duration === 'hd') beatValue = 3;
        else if (data.duration === 'q') beatValue = 1;
        else if (data.duration === '8') beatValue = 0.5;

        currentBeats += beatValue;
        if (currentBeats >= timeBeats) {
            vexNotes.push(new BarNote(Barline.type.SINGLE));
            currentBeats = 0; // 重置下一小節
        }
    });

    Formatter.FormatAndDraw(context, stave, vexNotes);
}

// --- 輸入音符與單音播放 ---
document.querySelectorAll('.note-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        let basePitch = e.target.getAttribute('data-note'); // 例如 c/4
        const clef = document.getElementById("clef-select").value;
        
        // 低音譜號自動將輸入音高降兩個八度，方便鍵盤輸入
        if (clef === "bass") {
            const parts = basePitch.split('/');
            basePitch = `${parts[0]}/${parseInt(parts[1]) - 2}`;
        }

        const duration = document.querySelector('input[name="duration"]:checked').value;
        const isRest = document.getElementById('is-rest').checked;
        const acc = document.querySelector('input[name="accidental"]:checked').value;

        // 組合實際音高 (加上升降號)
        let finalPitch = basePitch;
        let tonePitch = basePitch.replace('/', '').toUpperCase();
        if (acc === '#' || acc === 'b') {
            const parts = basePitch.split('/');
            finalPitch = `${parts[0]}${acc}/${parts[1]}`;
            tonePitch = `${parts[0].toUpperCase()}${acc}${parts[1]}`;
        }

        // 儲存數據
        scoreData.push({ pitch: finalPitch, duration: duration, isRest: isRest, acc: acc });
        renderScore();

        // 播放單音 (大幅調高音量至 15)
        if (!isRest) {
            await Tone.start();
            const synth = new Tone.Synth({ volume: 15 }).toDestination();
            synth.triggerAttackRelease(tonePitch, "8n");
        }
    });
});

// --- 控制按鈕邏輯 ---
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
        // 假設 BPM = 120 (4分音符 = 0.5秒)
        
        if (!data.isRest) {
            let tonePitch = data.pitch.replace('/', '').toUpperCase();
            synth.triggerAttackRelease(tonePitch, toneDur, now);
        }
        now += addTime;
    });
});

// --- 匯出圖片 (PNG) ---
document.getElementById('export-btn').addEventListener('click', () => {
    const svgElement = document.querySelector("#score-canvas svg");
    if (!svgElement) { alert("沒有可匯出的樂譜！"); return; }
    
    // 獲取歌名與作者
    const title = document.getElementById("song-title").value;
    const composer = document.getElementById("song-composer").value;

    // 將 SVG 轉換為圖片格式
    const xml = new XMLSerializer().serializeToString(svgElement);
    const svg64 = btoa(unescape(encodeURIComponent(xml)));
    const b64Start = 'data:image/svg+xml;base64,';
    const image64 = b64Start + svg64;

    const img = new Image();
    img.onload = function() {
        const canvas = document.createElement("canvas");
        // 增加畫布高度以容納標題
        canvas.width = img.width;
        canvas.height = img.height + 80;
        const ctx = canvas.getContext("2d");
        
        // 填滿白底
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 寫入標題與作者
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.font = "bold 24px system-ui";
        ctx.fillText(title, canvas.width / 2, 40);
        ctx.font = "16px system-ui";
        ctx.textAlign = "right";
        ctx.fillText(composer, canvas.width - 20, 70);

        // 畫上樂譜
        ctx.drawImage(img, 0, 80);

        // 觸發下載
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = `${title || '我的樂譜'}.png`;
        a.click();
    };
    img.src = image64;
});

// 初始渲染
renderScore();
