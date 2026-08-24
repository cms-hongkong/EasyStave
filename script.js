const { Renderer, Stave, StaveNote, Formatter, Dot, Annotation, StaveConnector, Voice, Beam } = Vex.Flow;

let scoreData = []; 
const colorMap = { "c": "#FF0000", "d": "#FFA500", "e": "#E6E600", "f": "#00FF00", "g": "#ADD8E6", "a": "#0000FF", "b": "#800080" };
const scoreWrapper = document.getElementById("score-wrapper");

let isColorMode = true;
let selectedDuration = "q"; 
let isRestMode = false;

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
    e.target.innerText = isRestMode ? "✔️ 休止符" : "❌ 休止符";
});

document.getElementById("toggle-color").addEventListener("click", function() {
    isColorMode = !isColorMode;
    this.innerText = isColorMode ? "🎨 彩色: 開" : "🎨 彩色: 關";
    this.classList.toggle("highlight");
    renderScore();
});

document.getElementById('clef-select').addEventListener('change', (e) => {
    document.getElementById('grand-staff-target').style.display = (e.target.value === 'grand') ? 'flex' : 'none';
    renderScore();
});
document.getElementById('lines-per-page').addEventListener('change', () => renderScore());
document.getElementById('time-select').addEventListener('change', () => renderScore());

function applyModifiers(note, pitches, fingerings, isRest) {
    if (note.getDuration().includes("d")) note.addModifier(new Dot(), 0);
    
    if (!isRest) {
        pitches.forEach((p, idx) => {
            const pitchName = p.charAt(0).toUpperCase();
            // 移除咗引致死機嘅 setFont()，恢復使用穩定預設字體
            const nameAnno = new Annotation(pitchName).setVerticalJustification(Annotation.VerticalJustify.BOTTOM);
            note.addModifier(nameAnno, idx);
            
            if (fingerings[idx] && fingerings[idx] !== 'none') {
                const fingerAnno = new Annotation(fingerings[idx]).setVerticalJustification(Annotation.VerticalJustify.TOP);
                note.addModifier(fingerAnno, idx);
            }

            if (isColorMode) {
                const color = colorMap[pitchName.toLowerCase()] || "#000000";
                note.setKeyStyle(idx, { fillStyle: color, strokeStyle: color });
            }
        });
    }
}

// 核心渲染 (轉用穩定 SVG 引擎)
function renderScore() {
    const clef = document.getElementById("clef-select").value;
    const isGrand = clef === "grand";
    const timeSig = document.getElementById("time-select").value;
    const timeBeats = parseInt(timeSig.split('/')[0]); 
    const maxLinesPerPage = parseInt(document.getElementById('lines-per-page').value); 

    let measures = [];
    let currentMeasure = [];
    let currentBeats = 0;

    scoreData.forEach((data) => {
        let beatValue = data.duration === 'w' ? 4 : data.duration === 'hd' ? 3 : data.duration === 'h' ? 2 : data.duration === 'q' ? 1 : 0.5;
        if (currentBeats + beatValue > timeBeats + 0.001) {
            measures.push(currentMeasure);
            currentMeasure = [];
            currentBeats = 0;
        }
        currentMeasure.push(data);
        currentBeats += beatValue;
        if (currentBeats >= timeBeats - 0.001) {
            measures.push(currentMeasure);
            currentMeasure = [];
            currentBeats = 0;
        }
    });
    if (currentMeasure.length > 0) measures.push(currentMeasure);
    if (measures.length === 0) measures.push([]);

    let lines = [];
    for (let i = 0; i < measures.length; i += 4) {
        lines.push(measures.slice(i, i + 4));
    }

    let pages = [];
    for (let i = 0; i < lines.length; i += maxLinesPerPage) {
        pages.push(lines.slice(i, i + maxLinesPerPage));
    }

    // 終極大比例 1.7 倍 (令音符夠晒大粒)
    const SCALE = 1.7; 
    const measureWidths = [280, 220, 220, 220]; 
    const lineSpacing = isGrand ? 250 : 160;
    const topMargin = 40;

    scoreWrapper.innerHTML = "";

    pages.forEach((pageLines) => {
        const logicalWidth = 960;
        const logicalHeight = Math.max(200, pageLines.length * lineSpacing + topMargin + 40);

        let containerDiv = document.createElement("div");
        containerDiv.className = "score-page";
        scoreWrapper.appendChild(containerDiv);

        // 使用 SVG 避免 iOS Canvas 限制死機
        const renderer = new Renderer(containerDiv, Renderer.Backends.SVG);
        renderer.resize(logicalWidth * SCALE, logicalHeight * SCALE);
        const context = renderer.getContext();
        context.scale(SCALE, SCALE);

        pageLines.forEach((lineMeasures, lineIndex) => {
            let startY = lineIndex * lineSpacing + topMargin;
            let lineX = 10;
            
            lineMeasures.forEach((measureData, mIndex) => {
                let mW = measureWidths[mIndex] || 220;
                let mX = lineX;
                lineX += mW;
                
                let isFirstInLine = (mIndex === 0);
                let isFirstMeasure = (lineIndex === 0 && mIndex === 0);
                
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
                } else {
                    if (isFirstInLine) new StaveConnector(stave, stave).setType(StaveConnector.type.SINGLE_LEFT).setContext(context).draw();
                    new StaveConnector(stave, stave).setType(StaveConnector.type.SINGLE_RIGHT).setContext(context).draw();
                }

                if (measureData.length === 0) return;

                let vexNotes = [];
                let bassVexNotes = [];

                measureData.forEach(data => {
                    let vexDur = data.duration === "hd" ? "h" : data.duration;
                    
                    if (isGrand) {
                        let treblePitches = []; let trebleFingers = [];
                        let bassPitches = []; let bassFingers = [];

                        if (!data.isRest) {
                            data.pitches.forEach((p, idx) => {
                                let target = data.staffTargets[idx];
                                let isTreble = true;
                                if (target === 'treble') isTreble = true;
                                else if (target === 'bass') isTreble = false;
                                else {
                                    let oct = parseInt(p.split('/')[1]);
                                    isTreble = oct >= 4;
                                }
                                if (isTreble) { treblePitches.push(p); trebleFingers.push(data.fingerings[idx]); }
                                else { bassPitches.push(p); bassFingers.push(data.fingerings[idx]); }
                            });
                        }

                        let tDur = vexDur + (treblePitches.length === 0 ? "r" : "");
                        let bDur = vexDur + (bassPitches.length === 0 ? "r" : "");
                        if (treblePitches.length === 0) treblePitches = ["b/4"];
                        if (bassPitches.length === 0) bassPitches = ["d/3"];

                        let tNote = new StaveNote({ keys: treblePitches, duration: tDur, clef: "treble", auto_stem: true });
                        let bNote = new StaveNote({ keys: bassPitches, duration: bDur, clef: "bass", auto_stem: true });
                        
                        applyModifiers(tNote, treblePitches, trebleFingers, tDur.includes("r"));
                        applyModifiers(bNote, bassPitches, bassFingers, bDur.includes("r"));
                        
                        vexNotes.push(tNote);
                        bassVexNotes.push(bNote);
                    } else {
                        let keys = data.isRest ? [(clef === "bass" ? "d/3" : "b/4")] : data.pitches;
                        let note = new StaveNote({ keys: keys, duration: vexDur + (data.isRest ? "r" : ""), clef: clef, auto_stem: true });
                        applyModifiers(note, data.pitches, data.fingerings, data.isRest);
                        vexNotes.push(note);
                    }
                });

                let beamsTreble = Beam.generateBeams(vexNotes.filter(n => !n.isRest()));
                let beamsBass = isGrand ? Beam.generateBeams(bassVexNotes.filter(n => !n.isRest())) : [];

                if (isColorMode) {
                    beamsTreble.forEach(b => {
                        const firstPitch = b.notes[0].keys[0].charAt(0).toLowerCase();
                        const color = colorMap[firstPitch] || "#000000";
                        b.setStyle({ fillStyle: color, strokeStyle: color });
                    });
                    beamsBass.forEach(b => {
                        const firstPitch = b.notes[0].keys[0].charAt(0).toLowerCase();
                        const color = colorMap[firstPitch] || "#000000";
                        b.setStyle({ fillStyle: color, strokeStyle: color });
                    });
                }

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

                beamsTreble.forEach(b => b.setContext(context).draw());
                if (isGrand) beamsBass.forEach(b => b.setContext(context).draw());
            });
        });
    });
}

function shiftOctave(pitchStr, shiftVal) {
    let parts = pitchStr.split('/');
    let newOct = parseInt(parts[1]) + shiftVal;
    return `${parts[0]}/${newOct}`;
}

document.querySelectorAll('.note-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        let basePitch = e.target.getAttribute('data-note'); 
        const clef = document.getElementById("clef-select").value;
        const fingering = document.getElementById('fingering-select').value;
        const staffTarget = document.getElementById('staff-target-select').value; 
        const octaveShift = parseInt(document.getElementById('octave-select').value);
        const isChordMode = document.getElementById('chord-mode').checked;
        
        basePitch = shiftOctave(basePitch, octaveShift);

        if (isChordMode && scoreData.length > 0 && !isRestMode) {
            let lastData = scoreData[scoreData.length - 1];
            if (lastData.duration === selectedDuration && !lastData.isRest) {
                lastData.pitches.push(basePitch);
                lastData.staffTargets.push(staffTarget);
                lastData.fingerings.push(fingering);
            } else {
                alert("⚠️ 和弦疊加失敗：新音符必須與上一個音符的拍子長度相同！");
                return;
            }
        } else {
            scoreData.push({ 
                pitches: [basePitch], 
                duration: selectedDuration, 
                isRest: isRestMode, 
                fingerings: [fingering], 
                staffTargets: [staffTarget] 
            });
        }
        
        renderScore();

        if (!isRestMode) {
            await Tone.start();
            const synth = new Tone.Synth({ volume: 15 }).toDestination();
            synth.triggerAttackRelease(basePitch.replace('/', '').toUpperCase(), "8n");
        }
    });
});

document.getElementById('undo-btn').addEventListener('click', () => { scoreData.pop(); renderScore(); });
document.getElementById('clear-btn').addEventListener('click', () => { scoreData = []; renderScore(); });

document.getElementById('play-all-btn').addEventListener('click', async () => {
    await Tone.start();
    const synth = new Tone.PolySynth(Tone.Synth, { volume: 15 }).toDestination();
    let now = Tone.now();
    scoreData.forEach(data => {
        let toneDur = data.duration === "w" ? "1n" : data.duration === "hd" ? "2n." : data.duration === "h" ? "2n" : data.duration === "q" ? "4n" : "8n";
        let addTime = data.duration === "w" ? 2 : data.duration === "hd" ? 1.5 : data.duration === "h" ? 1 : data.duration === "8" ? 0.25 : 0.5;
        
        if (!data.isRest) {
            let tonePitches = data.pitches.map(p => p.replace('/', '').toUpperCase());
            synth.triggerAttackRelease(tonePitches, toneDur, now);
        }
        now += addTime;
    });
});

// 多頁 SVG 轉換匯出為單一長圖
document.getElementById('export-btn').addEventListener('click', () => {
    if (scoreData.length === 0) { alert("請先輸入音符！"); return; }
    
    const svgs = document.querySelectorAll(".score-page svg");
    if (svgs.length === 0) return;

    let totalHeight = 0;
    let maxWidth = 0;
    let images = [];
    let loadedCount = 0;
    const title = document.getElementById("song-title").value;

    svgs.forEach((svg) => {
        const xml = new XMLSerializer().serializeToString(svg);
        const svg64 = btoa(unescape(encodeURIComponent(xml)));
        const img = new Image();
        img.onload = () => {
            loadedCount++;
            if (loadedCount === svgs.length) {
                const canvas = document.createElement("canvas");
                canvas.width = maxWidth + 60; 
                canvas.height = totalHeight + 120; 
                const ctx = canvas.getContext("2d");
                
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                ctx.fillStyle = "#000000";
                ctx.textAlign = "center";
                ctx.font = "bold 34px sans-serif";
                ctx.fillText(title, canvas.width / 2, 60);

                let currentY = 90;
                images.forEach(obj => {
                    ctx.drawImage(obj.img, 30, currentY, obj.width, obj.height);
                    currentY += obj.height;
                });

                document.getElementById('export-image-result').src = canvas.toDataURL("image/png");
                document.getElementById('export-modal').style.display = 'flex';
            }
        };
        img.src = 'data:image/svg+xml;base64,' + svg64;
        images.push({ img: img, width: svg.clientWidth, height: svg.clientHeight });
        totalHeight += svg.clientHeight;
        if (svg.clientWidth > maxWidth) maxWidth = svg.clientWidth;
    });
});

document.getElementById('close-modal-btn').addEventListener('click', () => {
    document.getElementById('export-modal').style.display = 'none';
});

renderScore();
