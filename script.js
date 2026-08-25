const { Renderer, Stave, StaveNote, Formatter, Dot, Annotation, StaveConnector, Voice, Beam } = Vex.Flow;

let scoreData = []; 
const colorMap = { "c": "#FF0000", "d": "#FFA500", "e": "#E6E600", "f": "#00FF00", "g": "#ADD8E6", "a": "#0000FF", "b": "#800080" };
const scoreWrapper = document.getElementById("score-wrapper");
let currentSynth = null; 

let isColorMode = true;
let selectedDuration = "q"; 
let isRestMode = false;
let editingIndex = -1; 

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
    e.target.innerText = isRestMode ? "✔️ 休止" : "❌ 休止";
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

// --- ✏️ 編輯模式控制 ---
function updateEditStatus() {
    const status = document.getElementById("edit-status");
    if (editingIndex === -1) {
        status.innerText = "新增模式";
        status.style.color = "black";
    } else {
        status.innerText = `✏️ 修改第 ${editingIndex + 1} 音`;
        status.style.color = "#007aff";
    }
    renderScore();
}
document.getElementById('edit-prev').addEventListener('click', () => {
    if (scoreData.length === 0) return;
    if (editingIndex === -1) editingIndex = scoreData.length - 1;
    else if (editingIndex > 0) editingIndex--;
    updateEditStatus();
});
document.getElementById('edit-next').addEventListener('click', () => {
    if (scoreData.length === 0 || editingIndex === -1) return;
    if (editingIndex < scoreData.length - 1) editingIndex++;
    else editingIndex = -1;
    updateEditStatus();
});

// --- 附加樣式 (🚨 完美修復音符柄 Stem 唔見咗嘅 Bug) ---
function applyModifiers(note, pitches, fingerings, isRest, isEditing) {
    if (note.getDuration().includes("d")) note.addModifier(new Dot(), 0);
    
    if (isEditing) {
        const editAnno = new Annotation("✏️").setFont("sans-serif", 18).setVerticalJustification(Annotation.VerticalJustify.TOP);
        note.addModifier(editAnno, 0);
    }

    if (!isRest) {
        // 先將成個音符 (包括 Stem 柄) 設定為第一個音嘅顏色
        if (isColorMode) {
            const firstPitchName = pitches[0].charAt(0).toUpperCase();
            const baseColor = colorMap[firstPitchName.toLowerCase()] || "#000000";
            note.setStyle({ fillStyle: baseColor, strokeStyle: baseColor });
        }

        pitches.forEach((p, idx) => {
            const pitchName = p.charAt(0).toUpperCase();
            const nameAnno = new Annotation(pitchName).setFont("sans-serif", 14, "bold").setVerticalJustification(Annotation.VerticalJustify.BOTTOM);
            note.addModifier(nameAnno, idx);
            if (fingerings[idx] && fingerings[idx] !== 'none') {
                const fingerAnno = new Annotation(fingerings[idx]).setFont("sans-serif", 14, "bold").setVerticalJustification(Annotation.VerticalJustify.TOP);
                note.addModifier(fingerAnno, idx);
            }
            
            // 再針對和弦內唔同嘅音頭 (Notehead) 逐粒上色
            if (isColorMode) {
                const color = colorMap[pitchName.toLowerCase()] || "#000000";
                note.setKeyStyle(idx, { fillStyle: color, strokeStyle: color });
            }
        });
    }
}

// --- 核心渲染引擎 ---
function renderScore(isExport = false) {
    const clef = document.getElementById("clef-select").value;
    const isGrand = clef === "grand";
    const timeSig = document.getElementById("time-select").value || "4/4";
    const timeBeats = parseInt(timeSig.split('/')[0]) || 4; 
    const maxLinesPerPage = parseInt(document.getElementById('lines-per-page').value) || 5; 

    let measures = [];
    let currentMeasure = [];
    let currentBeats = 0;
    
    scoreData.forEach((data, globalIdx) => {
        let beatValue = data.duration === 'w' ? 4 : data.duration === 'hd' ? 3 : data.duration === 'h' ? 2 : data.duration === 'qd' ? 1.5 : data.duration === 'q' ? 1 : 0.5;
        
        if (currentBeats + beatValue > timeBeats + 0.001) {
            measures.push(currentMeasure);
            currentMeasure = [];
            currentBeats = 0;
        }
        currentMeasure.push({ ...data, globalIdx: globalIdx });
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

    const SCALE = 1.6; 
    const lineSpacing = isGrand ? 250 : 150;
    const topMargin = 50;

    let targetContainer = isExport ? document.getElementById("hidden-export-container") : scoreWrapper;
    targetContainer.innerHTML = "";

    pages.forEach((pageLines, pageIndex) => {
        let maxLineWidth = 0;
        let lineLayouts = [];

        pageLines.forEach(lineMeasures => {
            let currentLineWidth = 20;
            let mWidths = [];
            lineMeasures.forEach((measureData, mIndex) => {
                // 🚨 修復錯位：大幅增加小節基礎闊度，保證大和弦唔會撞小節線
                let requiredWidth = Math.max(220, measureData.length * 60 + (mIndex === 0 ? 60 : 0));
                mWidths.push(requiredWidth);
                currentLineWidth += requiredWidth;
            });
            lineLayouts.push(mWidths);
            if (currentLineWidth > maxLineWidth) maxLineWidth = currentLineWidth;
        });

        const logicalWidth = Math.max(800, maxLineWidth + 50); 
        const logicalHeight = Math.max(200, pageLines.length * lineSpacing + topMargin + 40);

        let containerDiv = document.createElement("div");
        containerDiv.className = "score-page";
        
        if (pageIndex === 0 && (!isExport)) {
            let titleDiv = document.createElement("h1");
            titleDiv.innerText = document.getElementById("song-title").value;
            titleDiv.style.textAlign = "center";
            titleDiv.style.marginBottom = "20px";
            titleDiv.style.display = "none"; 
            containerDiv.appendChild(titleDiv);
        }
        targetContainer.appendChild(containerDiv);

        const backend = isExport ? Renderer.Backends.CANVAS : Renderer.Backends.SVG;
        const renderer = new Renderer(containerDiv, backend);
        renderer.resize(logicalWidth * SCALE, logicalHeight * SCALE);
        const context = renderer.getContext();
        
        if (isExport) {
            context.scale(SCALE, SCALE);
            const ctx2d = context.canvasContext || containerDiv.querySelector("canvas").getContext("2d");
            ctx2d.fillStyle = "#ffffff";
            ctx2d.fillRect(0, 0, logicalWidth * SCALE, logicalHeight * SCALE);
            if (pageIndex === 0) {
                ctx2d.fillStyle = "#000000";
                ctx2d.textAlign = "center";
                ctx2d.font = "bold 34px sans-serif";
                ctx2d.fillText(document.getElementById("song-title").value, logicalWidth / 2, 40);
            }
        } else {
            context.setViewBox(0, 0, logicalWidth, logicalHeight);
        }

        pageLines.forEach((lineMeasures, lineIndex) => {
            let startY = lineIndex * lineSpacing + topMargin + (isExport && pageIndex === 0 ? 30 : 0);
            let lineX = 10;
            let mWidths = lineLayouts[lineIndex];
            
            lineMeasures.forEach((measureData, mIndex) => {
                let mW = mWidths[mIndex];
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

                let vexNotes = [];
                let bassVexNotes = [];

                if (measureData.length === 0) {
                    let ghostNote = new StaveNote({ keys: ["b/4"], duration: "wr", clef: "treble" });
                    ghostNote.setStyle({ fillStyle: "transparent", strokeStyle: "transparent" });
                    vexNotes.push(ghostNote);
                    if (isGrand) {
                        let ghostBass = new StaveNote({ keys: ["d/3"], duration: "wr", clef: "bass" });
                        ghostBass.setStyle({ fillStyle: "transparent", strokeStyle: "transparent" });
                        bassVexNotes.push(ghostBass);
                    }
                } else {
                    measureData.forEach(data => {
                        let vexDur = data.duration === "hd" ? "h" : data.duration === "qd" ? "q" : data.duration;
                        let isCurrentlyEditing = (data.globalIdx === editingIndex);
                        
                        if (isGrand) {
                            let treblePitches = []; let trebleFingers = [];
                            let bassPitches = []; let bassFingers = [];

                            if (!data.isRest) {
                                data.pitches.forEach((p, idx) => {
                                    let target = data.staffTargets[idx];
                                    let isTreble = target === 'treble' ? true : target === 'bass' ? false : (parseInt(p.split('/')[1]) >= 4);
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
                            
                            applyModifiers(tNote, treblePitches, trebleFingers, tDur.includes("r"), isCurrentlyEditing);
                            applyModifiers(bNote, bassPitches, bassFingers, bDur.includes("r"), false);
                            
                            if (treblePitches[0] === "b/4" && tDur.includes("r")) tNote.setStyle({fillStyle: "transparent", strokeStyle: "transparent"});
                            if (bassPitches[0] === "d/3" && bDur.includes("r")) bNote.setStyle({fillStyle: "transparent", strokeStyle: "transparent"});

                            vexNotes.push(tNote);
                            bassVexNotes.push(bNote);
                        } else {
                            let keys = data.isRest ? [(clef === "bass" ? "d/3" : "b/4")] : data.pitches;
                            let note = new StaveNote({ keys: keys, duration: vexDur + (data.isRest ? "r" : ""), clef: clef, auto_stem: true });
                            applyModifiers(note, data.pitches, data.fingerings, data.isRest, isCurrentlyEditing);
                            vexNotes.push(note);
                        }
                    });
                }

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

// --- 輸入與替換邏輯 (🚨 加入防呆：自動取消和弦疊加) ---
document.querySelectorAll('.note-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        let basePitch = e.target.getAttribute('data-note'); 
        const clef = document.getElementById("clef-select").value;
        const fingering = document.getElementById('fingering-select').value;
        const staffTarget = document.getElementById('staff-target-select').value; 
        const octaveShift = parseInt(document.getElementById('octave-select').value);
        const chordCheckbox = document.getElementById('chord-mode');
        const isChordMode = chordCheckbox.checked;
        
        basePitch = shiftOctave(basePitch, octaveShift);
        
        let newData = { pitches: [basePitch], duration: selectedDuration, isRest: isRestMode, fingerings: [fingering], staffTargets: [staffTarget] };

        if (isChordMode && !isRestMode && scoreData.length > 0) {
            let targetIndex = editingIndex !== -1 ? editingIndex : scoreData.length - 1;
            let targetData = scoreData[targetIndex];
            if (targetData.duration === selectedDuration && !targetData.isRest) {
                targetData.pitches.push(basePitch);
                targetData.staffTargets.push(staffTarget);
                targetData.fingerings.push(fingering);
                
                // 🚨 防呆機制：加完一粒和弦音，自動取消勾選，防止誤建超級大和弦
                chordCheckbox.checked = false;
            } else {
                alert("⚠️ 和弦疊加失敗：新音符必須與上一個音符的拍子長度相同！");
                return;
            }
        } else {
            if (editingIndex !== -1) {
                scoreData[editingIndex] = newData;
                editingIndex++;
                if (editingIndex >= scoreData.length) editingIndex = -1;
                updateEditStatus();
            } else {
                scoreData.push(newData);
            }
        }
        
        renderScore();

        if (!isRestMode) {
            await Tone.start();
            if (currentSynth) currentSynth.dispose();
            currentSynth = new Tone.PolySynth(Tone.Synth, { volume: 15 }).toDestination();
            currentSynth.triggerAttackRelease(basePitch.replace('/', '').toUpperCase(), "8n");
        }
    });
});

document.getElementById('undo-btn').addEventListener('click', () => { scoreData.pop(); editingIndex = -1; updateEditStatus(); });
document.getElementById('clear-btn').addEventListener('click', () => { scoreData = []; editingIndex = -1; updateEditStatus(); });

// --- 播放與停止 ---
document.getElementById('play-all-btn').addEventListener('click', async () => {
    await Tone.start();
    if (currentSynth) currentSynth.dispose();
    currentSynth = new Tone.PolySynth(Tone.Synth, { volume: 15 }).toDestination();
    
    let now = Tone.now();
    scoreData.forEach(data => {
        let toneDur = data.duration === "w" ? "1n" : data.duration === "hd" ? "2n." : data.duration === "h" ? "2n" : data.duration === "qd" ? "4n." : data.duration === "q" ? "4n" : "8n";
        let addTime = data.duration === "w" ? 2 : data.duration === "hd" ? 1.5 : data.duration === "h" ? 1 : data.duration === "qd" ? 0.75 : data.duration === "q" ? 0.5 : 0.25;
        
        if (!data.isRest) {
            let tonePitches = data.pitches.map(p => p.replace('/', '').toUpperCase());
            currentSynth.triggerAttackRelease(tonePitches, toneDur, now);
        }
        now += addTime;
    });
});

document.getElementById('stop-btn').addEventListener('click', () => {
    if (currentSynth) {
        currentSynth.releaseAll();
        currentSynth.dispose();
        currentSynth = null;
    }
});

// --- 匯出功能 ---
document.getElementById('export-pdf-btn').addEventListener('click', () => { window.print(); });

document.getElementById('export-btn').addEventListener('click', () => {
    if (scoreData.length === 0) { alert("請先輸入音符！"); return; }
    
    renderScore(true);
    
    setTimeout(() => {
        const canvases = document.querySelectorAll("#hidden-export-container canvas");
        if (canvases.length === 0) return;

        let totalHeight = 0;
        let maxWidth = 0;

        canvases.forEach(c => {
            totalHeight += c.height;
            if (c.width > maxWidth) maxWidth = c.width;
        });

        const finalCanvas = document.createElement("canvas");
        finalCanvas.width = maxWidth; 
        finalCanvas.height = totalHeight; 
        const ctx = finalCanvas.getContext("2d");
        
        let currentY = 0;
        canvases.forEach(c => {
            ctx.drawImage(c, 0, currentY);
            currentY += c.height;
        });

        document.getElementById('export-image-result').src = finalCanvas.toDataURL("image/png");
        document.getElementById('export-modal').style.display = 'flex';
    }, 500); 
});

document.getElementById('close-modal-btn').addEventListener('click', () => {
    document.getElementById('export-modal').style.display = 'none';
});

renderScore();
