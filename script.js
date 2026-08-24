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
    renderScore(); // 重新渲染
});

// 加入音名與指法
function applyModifiers(note, data) {
    if (data.duration === "hd") note.addModifier(new Dot(), 0);
    
    if (!data.isRest) {
        const pitchName = data.pitch.charAt(0).toUpperCase();
        
        // 確保音名喺底部顯示
        const nameAnno = new Annotation(pitchName)
            .setFont("sans-serif", 14, "bold")
            .setVerticalJustification(Annotation.VerticalJustify.BOTTOM);
        note.addModifier(nameAnno, 0);
        
        // 確保指法喺頂部顯示
        if (data.fingering && data.fingering !== 'none') {
            const fingerAnno = new Annotation(data.fingering)
                .setFont("sans-serif", 14, "bold")
                .setVerticalJustification(Annotation.VerticalJustify.TOP);
            note.addModifier(fingerAnno, 0);
        }

        if (isColorMode) {
            const color = colorMap[pitchName.toLowerCase()] || "#000000";
            note.setStyle({ fillStyle: color, strokeStyle: color });
        }
    }
}

// 核心渲染引擎 (支援直接畫面顯示 或 Canvas高清匯出)
function renderScore(isExport = false) {
    const clef = document.getElementById("clef-select").value;
    const isGrand = clef === "grand";
    const timeSig = document.getElementById("time-select").value;
    const timeBeats = parseInt(timeSig.split('/')[0]); 

    // 1. 將音符嚴格分拆為「小節 (Measures)」
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
        if (Math.abs(currentBeats - timeBeats) < 0.01) {
            measures.push(currentMeasure);
            currentMeasure = [];
            currentBeats = 0;
        }
    });
    if (currentMeasure.length > 0) measures.push(currentMeasure);
    // 如果完全冇音符，只係預覽第一格，唔會無限生成空白小節
    if (measures.length === 0 && !isExport) measures.push([]);

    // 2. 嚴格 4 個小節一行
    let lines = [];
    for (let i = 0; i < measures.length; i += 4) {
        lines.push(measures.slice(i, i + 4));
    }

    // 3. 設定全局放大倍數 (1.3倍，更適合小朋友)
    const SCALE = 1.3;
    const measureWidths = [320, 240, 240, 240]; 
    const lineSpacing = isGrand ? 250 : 160;
    const startOffsetY = isExport ? 100 : 30; // 匯出時頂部留位寫歌名

    const canvasWidth = 1100; 
    const canvasHeight = Math.max(300, lines.length * lineSpacing + startOffsetY + 50);
    
    let renderer, context, targetCanvas;
    if (isExport) {
        targetCanvas = document.createElement("canvas");
        renderer = new Renderer(targetCanvas, Renderer.Backends.CANVAS);
    } else {
        div.innerHTML = "";
        renderer = new Renderer(div, Renderer.Backends.SVG);
    }

    renderer.resize(canvasWidth * SCALE, canvasHeight * SCALE);
    context = renderer.getContext();
    context.scale(SCALE, SCALE);

    // 匯出模式：畫白底及標題
    if (isExport) {
        const ctx2d = context.canvasContext || targetCanvas.getContext('2d');
        ctx2d.fillStyle = "#ffffff";
        ctx2d.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
        ctx2d.fillStyle = "#000000";
        ctx2d.textAlign = "center";
        ctx2d.font = "bold 32px sans-serif";
        ctx2d.fillText(document.getElementById("song-title").value, canvasWidth / 2, 60);
    }

    // 4. 逐行逐小節繪製
    lines.forEach((lineMeasures, lineIndex) => {
        let startY = lineIndex * lineSpacing + startOffsetY;
        let lineX = 20;
        
        lineMeasures.forEach((measureData, mIndex) => {
            let mW = measureWidths[mIndex] || 240;
            let mX = lineX;
            lineX += mW;
            
            let isFirstInLine = (mIndex === 0);
            let isFirstMeasure = (lineIndex === 0 && mIndex === 0);
            
            // 畫高音/主五線譜
            let stave = new Stave(mX, startY, mW);
            if (isFirstInLine) stave.addClef(isGrand ? "treble" : clef);
            if (isFirstMeasure) stave.addTimeSignature(timeSig);
            stave.setContext(context).draw();
            
            let staveBass;
            // 畫大譜表低音五線譜
            if (isGrand) {
                staveBass = new Stave(mX, startY + 100, mW);
                if (isFirstInLine) staveBass.addClef("bass");
                if (isFirstMeasure) staveBass.addTimeSignature(timeSig);
                staveBass.setContext(context).draw();
                
                if (isFirstInLine) {
                    new StaveConnector(stave, staveBass).setType(StaveConnector.type.BRACE).setContext(context).draw();
                    new StaveConnector(stave, staveBass).setType(StaveConnector.type.SINGLE_LEFT).setContext(context).draw();
                }
                new StaveConnector(stave, staveBass).setType(StaveConnector.type.SINGLE_RIGHT).setContext(context).draw();
            } else {
                if (isFirstInLine) new StaveConnector(stave, stave).setType(StaveConnector.type.SINGLE_LEFT).setContext(context).draw();
                new StaveConnector(stave, stave).setType(StaveConnector.type.SINGLE_RIGHT).setContext(context).draw();
            }

            if (measureData.length === 0) return;

            let vexNotes = [];
            let bassVexNotes = [];

            // 處理音符分配
            measureData.forEach(data => {
                let vexDur = data.duration === "hd" ? "h" : data.duration;
                if (isGrand) {
                    // 大譜表：C4或以上去高音，以下去低音。另一行放透明休止符對齊。
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

            // 聲部排版 (完美解決大譜表崩潰問題)
            let voices = [];
            let voiceTreble = new Voice({num_beats: timeBeats, beat_value: 4}).setMode(Voice.Mode.SOFT);
            voiceTreble.addTickables(vexNotes);
            voices.push(voiceTreble);
            
            let voiceBass;
            if (isGrand) {
                voiceBass = new Voice({num_beats: timeBeats, beat_value: 4}).setMode(Voice.Mode.SOFT);
                voiceBass.addTickables(bassVexNotes);
                voices.push(voiceBass);
            }
            
            new Formatter().joinVoices(voices).format(voices, mW - 40);
            voiceTreble.draw(context, stave);
            if (isGrand) voiceBass.draw(context, staveBass);

            // 智能產生 8 分音符連線
            let beamsTreble = Beam.generateBeams(vexNotes.filter(n => !n.isRest()));
            beamsTreble.forEach(b => b.setContext(context).draw());
            
            if (isGrand) {
                let beamsBass = Beam.generateBeams(bassVexNotes.filter(n => !n.isRest()));
                beamsBass.forEach(b => b.setContext(context).draw());
            }
        });
    });

    // 匯出模式：將畫好嘅高清 Canvas 轉為 Base64 並顯示喺彈出視窗
    if (isExport) {
        const dataUrl = targetCanvas.toDataURL("image/png");
        document.getElementById('export-image-result').src = dataUrl;
        document.getElementById('export-modal').style.display = 'flex';
    }
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

// UI 控制項事件
document.getElementById('clef-select').addEventListener('change', () => renderScore());
document.getElementById('time-select').addEventListener('change', () => renderScore());
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

// 觸發匯出圖片
document.getElementById('export-btn').addEventListener('click', () => {
    if (scoreData.length === 0) { alert("請先輸入音符！"); return; }
    renderScore(true); // 啟動隱藏嘅高清 Canvas 渲染引擎
});

document.getElementById('close-modal-btn').addEventListener('click', () => {
    document.getElementById('export-modal').style.display = 'none';
});

// 啟動時渲染一次空樂譜
renderScore();
