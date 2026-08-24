const { Renderer, Stave, StaveNote, Formatter, Dot, Annotation, StaveConnector, Voice, Beam } = Vex.Flow;

let scoreData = [];
const colorMap = { "c": "#FF0000", "d": "#FFA500", "e": "#E6E600", "f": "#00FF00", "g": "#ADD8E6", "a": "#0000FF", "b": "#800080" };
const div = document.getElementById("score-canvas");

let isColorMode = true;
let selectedDuration = "q"; 
let isRestMode = false;

// 綁定按鈕
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

// 當選擇譜號改變時，顯示或隱藏「大譜表目標」設定
document.getElementById('clef-select').addEventListener('change', (e) => {
    const isGrand = e.target.value === 'grand';
    document.getElementById('grand-staff-target').style.display = isGrand ? 'flex' : 'none';
    renderScore();
});

// 處理音名與指法顯示
function applyModifiers(note, data) {
    if (data.duration === "hd") note.addModifier(new Dot(), 0);
    
    if (!data.isRest) {
        const pitchName = data.pitch.charAt(0).toUpperCase();
        
        const nameAnno = new Annotation(pitchName).setFont("sans-serif", 14, "bold").setVerticalJustification(Annotation.VerticalJustify.BOTTOM);
        note.addModifier(nameAnno, 0);
        
        if (data.fingering && data.fingering !== 'none') {
            const fingerAnno = new Annotation(data.fingering).setFont("sans-serif", 14, "bold").setVerticalJustification(Annotation.VerticalJustify.TOP);
            note.addModifier(fingerAnno, 0);
        }

        if (isColorMode) {
            const color = colorMap[pitchName.toLowerCase()] || "#000000";
            note.setStyle({ fillStyle: color, strokeStyle: color });
        }
    }
}

// 核心渲染引擎
function renderScore(isExport = false) {
    const clef = document.getElementById("clef-select").value;
    const isGrand = clef === "grand";
    const timeSig = document.getElementById("time-select").value;
    const timeBeats = parseInt(timeSig.split('/')[0]); 

    // 1. 精確計算節拍，完美分拆小節 (修正浮點數誤差)
    let measures = [];
    let currentMeasure = [];
    let currentBeats = 0;

    scoreData.forEach((data) => {
        let beatValue = data.duration === 'w' ? 4 : data.duration === 'hd' ? 3 : data.duration === 'h' ? 2 : data.duration === 'q' ? 1 : 0.5;
        
        // 如果加上呢個音符會爆滿，先推出現有小節
        if (currentBeats + beatValue > timeBeats + 0.001) {
            measures.push(currentMeasure);
            currentMeasure = [];
            currentBeats = 0;
        }
        
        currentMeasure.push(data);
        currentBeats += beatValue;
        
        // 如果剛好滿，立刻截斷為一個小節
        if (currentBeats >= timeBeats - 0.001) {
            measures.push(currentMeasure);
            currentMeasure = [];
            currentBeats = 0;
        }
    });
    
    if (currentMeasure.length > 0) measures.push(currentMeasure);
    if (measures.length === 0 && !isExport) measures.push([]);

    // 2. 設定 4 小節一行
    let lines = [];
    for (let i = 0; i < measures.length; i += 4) {
        lines.push(measures.slice(i, i + 4));
    }

    const SCALE = 1.3;
    const measureWidths = [320, 240, 240, 240]; 
    const lineSpacing = isGrand ? 250 : 160;
    const startOffsetY = isExport ? 100 : 30; 

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

    if (isExport) {
        const ctx2d = context.canvasContext || targetCanvas.getContext('2d');
        ctx2d.fillStyle = "#ffffff";
        ctx2d.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
        ctx2d.fillStyle = "#000000";
        ctx2d.textAlign = "center";
        ctx2d.font = "bold 32px sans-serif";
        ctx2d.fillText(document.getElementById("song-title").value, canvasWidth / 2, 60);
    }

    // 3. 逐行繪製
    lines.forEach((lineMeasures, lineIndex) => {
        let startY = lineIndex * lineSpacing + startOffsetY;
        let lineX = 20;
        
        lineMeasures.forEach((measureData, mIndex) => {
            let mW = measureWidths[mIndex] || 240;
            let mX = lineX;
            lineX += mW;
            
            let isFirstInLine = (mIndex === 0);
            let isFirstMeasure = (lineIndex === 0 && mIndex === 0);
            
            // 畫五線譜框線
            let stave = new Stave(mX, startY, mW);
            if (isFirstInLine) stave.addClef(isGrand ? "treble" : clef);
            if (isFirstMeasure) stave.addTimeSignature(timeSig);
            stave.setContext(context).draw();
            
            let staveBass;
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

            // 生成音符資料
            measureData.forEach(data => {
                let vexDur = data.duration === "hd" ? "h" : data.duration;
                if (isGrand) {
                    // 大譜表自訂高低音判斷邏輯
                    let isTreble = true;
                    if (data.staffTarget === 'treble') {
                        isTreble = true;
                    } else if (data.staffTarget === 'bass') {
                        isTreble = false;
                    } else {
                        // 自動判斷
                        let octave = parseInt(data.pitch.split('/')[1]);
                        isTreble = octave >= 4;
                    }
                    
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

            // ★ 修正重點：必須在 Draw 之前產生 Beams，系統先識得收埋多餘嘅符尾！
            let beamsTreble = Beam.generateBeams(vexNotes.filter(n => !n.isRest()));
            let beamsBass = isGrand ? Beam.generateBeams(bassVexNotes.filter(n => !n.isRest())) : [];

            // 處理 Voice 排版
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
            
            // 繪製音符
            voiceTreble.draw(context, stave);
            if (isGrand) voiceBass.draw(context, staveBass);

            // 繪製彩色連線
            if (isColorMode) {
                beamsTreble.forEach(b => {
                    const firstNotePitch = b.notes[0].keys[0].charAt(0).toLowerCase();
                    const color = colorMap[firstNotePitch] || "#000000";
                    b.setStyle({ fillStyle: color, strokeStyle: color });
                });
                beamsBass.forEach(b => {
                    const firstNotePitch = b.notes[0].keys[0].charAt(0).toLowerCase();
                    const color = colorMap[firstNotePitch] || "#000000";
                    b.setStyle({ fillStyle: color, strokeStyle: color });
                });
            }

            beamsTreble.forEach(b => b.setContext(context).draw());
            if (isGrand) beamsBass.forEach(b => b.setContext(context).draw());
        });
    });

    if (isExport) {
        const dataUrl = targetCanvas.toDataURL("image/png");
        document.getElementById('export-image-result').src = dataUrl;
        document.getElementById('export-modal').style.display = 'flex';
    }
}

// 點擊輸入
document.querySelectorAll('.note-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        let basePitch = e.target.getAttribute('data-note'); 
        const clef = document.getElementById("clef-select").value;
        const fingering = document.getElementById('fingering-select').value;
        const staffTarget = document.getElementById('staff-target-select').value; // 取得目標譜號
        
        if (clef === "bass") {
            const parts = basePitch.split('/');
            basePitch = `${parts[0]}/${parseInt(parts[1]) - 2}`;
        }

        scoreData.push({ pitch: basePitch, duration: selectedDuration, isRest: isRestMode, fingering: fingering, staffTarget: staffTarget });
        renderScore();

        if (!isRestMode) {
            await Tone.start();
            const synth = new Tone.Synth({ volume: 15 }).toDestination();
            synth.triggerAttackRelease(basePitch.replace('/', '').toUpperCase(), "8n");
        }
    });
});

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

document.getElementById('export-btn').addEventListener('click', () => {
    if (scoreData.length === 0) { alert("請先輸入音符！"); return; }
    renderScore(true);
});

document.getElementById('close-modal-btn').addEventListener('click', () => {
    document.getElementById('export-modal').style.display = 'none';
});

renderScore();
