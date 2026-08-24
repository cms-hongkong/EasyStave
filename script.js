const { Renderer, Stave, StaveNote, Formatter, Dot, Annotation, StaveConnector, Voice, Beam } = Vex.Flow;

let scoreData = [];
const colorMap = { "c": "#FF0000", "d": "#FFA500", "e": "#E6E600", "f": "#00FF00", "g": "#ADD8E6", "a": "#0000FF", "b": "#800080" };
const div = document.getElementById("score-canvas");

let isColorMode = true;
let selectedDuration = "q"; 
let isRestMode = false;

// UI 按鈕綁定
document.querySelectorAll('.dur-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        selectedDuration = e.target.getAttribute('data-dur');
    });
});

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

// 為音符加入音名與指法
function applyModifiers(note, data) {
    if (data.duration === "hd") note.addModifier(new Dot());
    if (!data.isRest) {
        const pitchName = data.pitch.charAt(0).toUpperCase();
        const nameAnno = new Annotation(pitchName).setVerticalJustification(Annotation.VerticalJustify.BOTTOM);
        note.addModifier(nameAnno);
        
        if (data.fingering && data.fingering !== 'none') {
            const fingerAnno = new Annotation(data.fingering).setVerticalJustification(Annotation.VerticalJustify.TOP);
            note.addModifier(fingerAnno);
        }

        if (isColorMode) {
            const color = colorMap[pitchName.toLowerCase()] || "#000000";
            note.setStyle({ fillStyle: color, strokeStyle: color });
        }
    }
}

// 核心渲染邏輯 (4小節一行 + 自動分組)
function renderScore() {
    div.innerHTML = "";
    const clef = document.getElementById("clef-select").value;
    const isGrand = clef === "grand";
    const timeSig = document.getElementById("time-select").value;
    const timeBeats = parseInt(timeSig.split('/')[0]); 

    // 1. 將輸入嘅音符，按節拍分拆入「小節 (Measures)」
    let measures = [];
    let currentMeasure = [];
    let currentBeats = 0;

    scoreData.forEach((data) => {
        let beatValue = data.duration === 'w' ? 4 : data.duration === 'hd' ? 3 : data.duration === 'h' ? 2 : data.duration === 'q' ? 1 : 0.5;
        if (currentBeats + beatValue > timeBeats) {
            measures.push(currentMeasure);
            currentMeasure = [];
            currentBeats = 0;
        }
        currentMeasure.push(data);
        currentBeats += beatValue;
        if (Math.round(currentBeats * 100) >= timeBeats * 100) {
            measures.push(currentMeasure);
            currentMeasure = [];
            currentBeats = 0;
        }
    });
    if (currentMeasure.length > 0) measures.push(currentMeasure);
    if (measures.length === 0) measures.push([]);

    // 2. 將小節分為每行 4 個 (4 bars per line)
    let lines = [];
    for (let i = 0; i < measures.length; i += 4) {
        lines.push(measures.slice(i, i + 4));
    }

    // 3. 設定畫布總大小
    const canvasWidth = 1000;
    const lineSpacing = isGrand ? 250 : 160;
    const canvasHeight = Math.max(250, lines.length * lineSpacing + 50);
    
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(canvasWidth, canvasHeight);
    const context = renderer.getContext();

    // 4. 逐行畫出五線譜
    lines.forEach((lineMeasures, lineIndex) => {
        let startY = lineIndex * lineSpacing + 20;
        let lineX = 10;
        
        lineMeasures.forEach((measureData, mIndex) => {
            let isFirstInLine = (mIndex === 0);
            let isFirstMeasure = (lineIndex === 0 && mIndex === 0);
            
            // 首小節較闊預留位畀譜號，其餘均分
            let mW = isFirstInLine ? 280 : 230;
            let mX = isFirstInLine ? lineX : lineX + 280 + (mIndex - 1) * 230;
            
            let stave = new Stave(mX, startY, mW);
            if (isFirstInLine) stave.addClef(isGrand ? "treble" : clef);
            if (isFirstMeasure) stave.addTimeSignature(timeSig);
            stave.setContext(context).draw();
            
            let staveBass;
            if (isGrand) {
                staveBass = new Stave(mX, startY + 110, mW);
                if (isFirstInLine) staveBass.addClef("bass");
                if (isFirstMeasure) staveBass.addTimeSignature(timeSig);
                staveBass.setContext(context).draw();
                
                if (isFirstInLine) {
                    new StaveConnector(stave, staveBass).setType(StaveConnector.type.BRACE).setContext(context).draw();
                    new StaveConnector(stave, staveBass).setType(StaveConnector.type.SINGLE_LEFT).setContext(context).draw();
                }
                new StaveConnector(stave, staveBass).setType(StaveConnector.type.SINGLE_RIGHT).setContext(context).draw();
            }

            if (measureData.length === 0) return;

            let vexNotes = [];
            let bassVexNotes = [];

            // 產生音符
            measureData.forEach(data => {
                let vexDur = data.duration === "hd" ? "h" : data.duration;
                if (isGrand) {
                    let octave = parseInt(data.pitch.split('/')[1]);
                    let isTreble = octave >= 4;
                    let tNote = new StaveNote({ keys: isTreble && !data.isRest ? [data.pitch] : ["b/4"], duration: vexDur + (isTreble && !data.isRest ? "" : "r"), clef: "treble", auto_stem: true });
                    let bNote = new StaveNote({ keys: !isTreble && !data.isRest ? [data.pitch] : ["d/3"], duration: vexDur + (!isTreble && !data.isRest ? "" : "r"), clef: "bass", auto_stem: true });
                    
                    if (isTreble) { applyModifiers(tNote, data); bNote.setStyle({fillStyle: "transparent", strokeStyle: "transparent"}); } 
                    else { applyModifiers(bNote, data); tNote.setStyle({fillStyle: "transparent", strokeStyle: "transparent"}); }
                    vexNotes.push(tNote);
                    bassVexNotes.push(bNote);
                } else {
                    let keys = data.isRest ? [(clef === "bass" ? "d/3" : "b/4")] : [data.pitch];
                    let note = new StaveNote({ keys: keys, duration: vexDur + (data.isRest ? "r" : ""), clef: clef, auto_stem: true });
                    applyModifiers(note, data);
                    vexNotes.push(note);
                }
            });

            // 排版並畫出音符 (使用 Voice 系統避免大譜表崩潰)
            let voiceTreble = new Voice({num_beats: timeBeats, beat_value: 4}).setMode(Voice.Mode.SOFT);
            voiceTreble.addTickables(vexNotes);
            let voices = [voiceTreble];
            
            let voiceBass;
            if (isGrand) {
                voiceBass = new Voice({num_beats: timeBeats, beat_value: 4}).setMode(Voice.Mode.SOFT);
                voiceBass.addTickables(bassVexNotes);
                voices.push(voiceBass);
            }
            
            new Formatter().joinVoices(voices).format(voices, mW - 40);
            voiceTreble.draw(context, stave);
            if (isGrand) voiceBass.draw(context, staveBass);

            // 智能 8 分音符連線 (Beaming)
            let beamsTreble = Beam.generateBeams(vexNotes);
            beamsTreble.forEach(b => b.setContext(context).draw());
            
            if (isGrand) {
                let beamsBass = Beam.generateBeams(bassVexNotes);
                beamsBass.forEach(b => b.setContext(context).draw());
            }
        });
    });
}

// 點擊琴鍵輸入音符
document.querySelectorAll('.note-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        let basePitch = e.target.getAttribute('data-note'); 
        const clef = document.getElementById("clef-select").value;
        const fingering = document.getElementById('fingering-select').value;
        
        if (clef === "bass") {
            const parts = basePitch.split('/');
            basePitch = `${parts[0]}/${parseInt(parts[1]) - 2}`;
        }
        scoreData.push({ pitch: basePitch, duration: selectedDuration, isRest: isRestMode, fingering: fingering });
        renderScore();

        if (!isRestMode) {
            await Tone.start();
            const synth = new Tone.Synth({ volume: 15 }).toDestination();
            synth.triggerAttackRelease(basePitch.replace('/', '').toUpperCase(), "8n");
        }
    });
});

document.getElementById('clef-select').addEventListener('change', renderScore);
document.getElementById('time-select').addEventListener('change', renderScore);
document.getElementById('undo-btn').addEventListener('click', () => { scoreData.pop(); renderScore(); });
document.getElementById('clear-btn').addEventListener('click', () => { scoreData = []; renderScore(); });

// 播放全曲
document.getElementById('play-all-btn').addEventListener('click', async () => {
    await Tone.start();
    const synth = new Tone.Synth({ volume: 15 }).toDestination();
    let now = Tone.now();
    scoreData.forEach(data => {
        let toneDur = data.duration === "w" ? "1n" : data.duration === "hd" ? "2n." : data.duration === "h" ? "2n" : data.duration === "q" ? "4n" : "8n";
        let addTime = data.duration === "w" ? 2 : data.duration === "hd" ? 1.5 : data.duration === "h" ? 1 : data.duration === "8" ? 0.25 : 0.5;
        if (!data.isRest) synth.triggerAttackRelease(data.pitch.replace('/', '').toUpperCase(), toneDur, now);
        now += addTime;
    });
});

// 安全匯出圖片方法 (彈出視窗)
document.getElementById('export-btn').addEventListener('click', () => {
    const svgElement = document.querySelector("#score-canvas svg");
    if (!svgElement) { alert("沒有樂譜可以匯出！"); return; }
    
    const title = document.getElementById("song-title").value;
    const xml = new XMLSerializer().serializeToString(svgElement);
    const svg64 = btoa(unescape(encodeURIComponent(xml)));
    const img = new Image();
    
    img.onload = function() {
        const canvas = document.createElement("canvas");
        canvas.width = img.width + 60;
        canvas.height = img.height + 120; // 預留更多標題空間
        const ctx = canvas.getContext("2d");
        
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.font = "bold 32px sans-serif";
        ctx.fillText(title, canvas.width / 2, 60);

        ctx.drawImage(img, 30, 90);

        // 將畫布轉為 Base64 圖片並顯示喺彈出視窗
        const dataUrl = canvas.toDataURL("image/png");
        document.getElementById('export-image-result').src = dataUrl;
        document.getElementById('export-modal').style.display = 'flex';
    };
    img.src = 'data:image/svg+xml;base64,' + svg64;
});

// 關閉匯出視窗
document.getElementById('close-modal-btn').addEventListener('click', () => {
    document.getElementById('export-modal').style.display = 'none';
});

renderScore();
