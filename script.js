const { Renderer, Stave, StaveNote, Formatter, Dot, Annotation, StaveConnector, Voice, Beam, Accidental } = Vex.Flow;

let tracks = { treble: [], bass: [] };
let currentTrack = "treble";
let editingIndex = -1;

const colorMap = { "c": "#FF0000", "d": "#FFA500", "e": "#E6E600", "f": "#00FF00", "g": "#ADD8E6", "a": "#0000FF", "b": "#800080" };
const scoreWrapper = document.getElementById("score-wrapper");

let globalSynth = null; 
function getSynth() {
    if (!globalSynth) {
        globalSynth = new Tone.PolySynth(Tone.Synth, { volume: 8 }).toDestination();
    }
    return globalSynth;
}

let isColorMode = true;
let selectedDuration = "q"; 
let isRestMode = false;

document.getElementById('song-title').addEventListener('input', function() {
    let printTitles = document.querySelectorAll('.print-title');
    printTitles.forEach(t => t.innerText = this.value);
});

// --- UI 綁定 ---
document.querySelectorAll('.dur-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        selectedDuration = this.getAttribute('data-dur');
    });
});

document.getElementById('rest-btn').addEventListener('click', function() {
    isRestMode = !isRestMode;
    this.classList.toggle('active');
});

document.getElementById("toggle-color").addEventListener("click", function() {
    isColorMode = !isColorMode;
    this.innerText = isColorMode ? "🎨 彩色: 開" : "🎨 彩色: 關";
    this.classList.toggle("highlight");
    renderScore();
});

function updateClefUI() {
    const clefValue = document.getElementById('clef-select').value;
    const trackSelect = document.getElementById('track-select');
    const grandStaffContainer = document.getElementById('grand-staff-target');
    
    if (clefValue === 'grand') {
        grandStaffContainer.style.display = 'flex';
        trackSelect.disabled = false;
        currentTrack = trackSelect.value;
    } else {
        grandStaffContainer.style.display = 'none';
        trackSelect.disabled = true;
        currentTrack = clefValue === 'treble' ? 'treble' : 'bass';
    }
    editingIndex = -1; 
    updateEditStatus(); 
    renderScore();
}

document.getElementById('clef-select').addEventListener('change', updateClefUI);

document.getElementById('track-select').addEventListener('change', function() {
    currentTrack = this.value;
    editingIndex = -1; updateEditStatus();
});

document.getElementById('lines-per-page').addEventListener('change', () => renderScore());
document.getElementById('time-select').addEventListener('change', () => renderScore());

// --- ✏️ 雙重修改機制 ---
function updateEditStatus() {
    const status = document.getElementById("edit-status");
    const cancelBtn = document.getElementById("cancel-edit-btn");
    if (editingIndex === -1) {
        status.innerText = "✨ 點選音符或按箭嘴修改";
        status.style.color = "#333";
        cancelBtn.style.display = "none";
    } else {
        let tName = currentTrack === 'treble' ? '高音' : '低音';
        status.innerText = `✏️ 修改 (${tName} 第 ${editingIndex + 1} 音)`;
        status.style.color = "#007aff";
        cancelBtn.style.display = "inline-block";
    }
    renderScore();
}

document.getElementById('edit-prev').addEventListener('click', () => {
    let trackData = tracks[currentTrack];
    if (trackData.length === 0) return;
    if (editingIndex === -1) editingIndex = trackData.length - 1;
    else if (editingIndex > 0) editingIndex--;
    updateEditStatus();
});

document.getElementById('edit-next').addEventListener('click', () => {
    let trackData = tracks[currentTrack];
    if (trackData.length === 0 || editingIndex === -1) return;
    if (editingIndex < trackData.length - 1) editingIndex++;
    else editingIndex = -1;
    updateEditStatus();
});

document.getElementById('cancel-edit-btn').addEventListener('click', () => {
    editingIndex = -1; updateEditStatus();
});

scoreWrapper.addEventListener('click', (e) => {
    let current = e.target;
    while (current && current !== scoreWrapper) {
        if (current.id && current.id.startsWith('vf-')) {
            let parts = current.id.split('-'); 
            if (parts.length === 3 && !isNaN(parseInt(parts[2]))) {
                currentTrack = parts[1];
                if (document.getElementById('clef-select').value === 'grand') {
                    document.getElementById('track-select').value = currentTrack;
                }
                editingIndex = parseInt(parts[2]);
                updateEditStatus();
            }
            return;
        }
        current = current.parentNode;
    }
});

function applyModifiers(note, data, isEditing) {
    if (data.duration.includes("d")) {
        note.addModifier(new Dot(), 0);
    }
    
    if (isEditing) {
        note.addModifier(new Annotation("✏️").setFont("sans-serif", 18).setVerticalJustification(Annotation.VerticalJustify.TOP), 0);
        note.setStyle({ fillStyle: '#007aff', strokeStyle: '#007aff' });
    } else if (isColorMode && !data.isRest) {
        const baseColor = colorMap[data.pitches[0].charAt(0).toLowerCase()] || "#000000";
        note.setStyle({ fillStyle: baseColor, strokeStyle: baseColor });
    }

    if (!data.isRest) {
        data.pitches.forEach((p, idx) => {
            const pitchName = p.charAt(0).toUpperCase();
            if (data.accs && data.accs[idx] && data.accs[idx] !== "") {
                note.addModifier(new Accidental(data.accs[idx]), idx);
            }
            const nameAnno = new Annotation(pitchName).setFont("sans-serif", 14, "bold").setVerticalJustification(Annotation.VerticalJustify.BOTTOM);
            note.addModifier(nameAnno, idx);
            if (data.fingerings && data.fingerings[idx] && data.fingerings[idx] !== 'none') {
                const fingerAnno = new Annotation(data.fingerings[idx]).setFont("sans-serif", 14, "bold").setVerticalJustification(Annotation.VerticalJustify.TOP);
                note.addModifier(fingerAnno, idx);
            }
            if (isColorMode && !isEditing) {
                const color = colorMap[pitchName.toLowerCase()] || "#000000";
                note.setKeyStyle(idx, { fillStyle: color, strokeStyle: color });
            }
        });
    }
}

function getBeatValue(dur) {
    return dur === 'w' ? 4 : dur === 'hd' ? 3 : dur === 'h' ? 2 : dur === 'qd' ? 1.5 : dur === 'q' ? 1 : 0.5;
}

function buildMeasures(trackData, timeBeats) {
    let measures = [];
    let currentM = [];
    let beats = 0;
    trackData.forEach((d, i) => {
        let v = getBeatValue(d.duration);
        if (beats + v > timeBeats + 0.001) { measures.push(currentM); currentM = []; beats = 0; }
        currentM.push({...d, globalIdx: i});
        beats += v;
        if (beats >= timeBeats - 0.001) { measures.push(currentM); currentM = []; beats = 0; }
    });
    if (currentM.length > 0) measures.push(currentM);
    return measures;
}

function getRestKey(clef) {
    return clef === 'bass' ? "d/3" : "b/4";
}

function renderScore() {
    const clef = document.getElementById("clef-select").value;
    const timeSig = document.getElementById("time-select").value || "4/4";
    const timeBeats = parseInt(timeSig.split('/')[0]) || 4; 
    const maxLinesPerPage = parseInt(document.getElementById('lines-per-page').value) || 5; 

    let measuresTreble = buildMeasures(tracks.treble, timeBeats);
    let measuresBass = buildMeasures(tracks.bass, timeBeats);
    
    let maxM = Math.max(measuresTreble.length, measuresBass.length, 1);
    let activeMeasures = [];
    
    for (let i = 0; i < maxM; i++) {
        if (clef === 'grand') activeMeasures.push({ treble: measuresTreble[i] || [], bass: measuresBass[i] || [] });
        else if (clef === 'treble') activeMeasures.push({ treble: measuresTreble[i] || [] });
        else activeMeasures.push({ bass: measuresBass[i] || [] });
    }

    let lines = [];
    for (let i = 0; i < activeMeasures.length; i += 4) { lines.push(activeMeasures.slice(i, i + 4)); }
    let pages = [];
    for (let i = 0; i < lines.length; i += maxLinesPerPage) { pages.push(lines.slice(i, i + maxLinesPerPage)); }

    const SCALE = 1.6; 
    // 🌟 保持拉闊咗嘅大譜表行距 (290)
    const lineSpacing = clef === 'grand' ? 290 : 150;
    const topMargin = 50;

    scoreWrapper.innerHTML = "";

    pages.forEach((pageLines, pageIndex) => {
        let maxLineWidth = 0;
        let lineLayouts = [];

        pageLines.forEach(lineGroup => {
            let currentLineWidth = 20;
            let mWidths = [];
            lineGroup.forEach((measureGroup, mIndex) => {
                let noteCount = Math.max((measureGroup.treble||[]).length, (measureGroup.bass||[]).length);
                let requiredWidth = Math.max(200, noteCount * 65 + (mIndex === 0 ? 60 : 0));
                mWidths.push(requiredWidth);
                currentLineWidth += requiredWidth;
            });
            lineLayouts.push(mWidths);
            if (currentLineWidth > maxLineWidth) maxLineWidth = currentLineWidth;
        });

        const logicalWidth = Math.max(850, maxLineWidth + 80); 
        const logicalHeight = Math.max(200, pageLines.length * lineSpacing + topMargin + 40);

        let containerDiv = document.createElement("div");
        containerDiv.className = "score-page";
        
        if (pageIndex === 0) {
            let titleDiv = document.createElement("div");
            titleDiv.className = "print-title";
            titleDiv.innerText = document.getElementById("song-title").value;
            containerDiv.appendChild(titleDiv);
        }
        
        scoreWrapper.appendChild(containerDiv);

        const renderer = new Renderer(containerDiv, Renderer.Backends.SVG);
        renderer.resize(logicalWidth * SCALE, logicalHeight * SCALE);
        const context = renderer.getContext();
        context.setViewBox(0, 0, logicalWidth, logicalHeight);

        pageLines.forEach((lineGroup, lineIndex) => {
            let startY = lineIndex * lineSpacing + topMargin;
            let lineX = 40; 
            let mWidths = lineLayouts[lineIndex];
            
            lineGroup.forEach((measureGroup, mIndex) => {
                let mW = mWidths[mIndex];
                let mX = lineX;
                lineX += mW;
                
                let isFirstInLine = (mIndex === 0);
                let isFirstMeasure = (lineIndex === 0 && mIndex === 0);
                
                let stave = new Stave(mX, startY, mW);
                if (isFirstInLine) stave.addClef(clef === 'grand' ? 'treble' : clef);
                if (isFirstMeasure) stave.addTimeSignature(timeSig);
                stave.setContext(context).draw();
                
                let staveBass;
                if (clef === 'grand') {
                    // 🌟 保持拉闊咗嘅大譜表上下距離 (150)
                    staveBass = new Stave(mX, startY + 150, mW);
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

                function processNotes(dataArr, clefName, trackName) {
                    let notes = [];
                    
                    if (!dataArr || dataArr.length === 0) {
                        let ghost = new StaveNote({ keys: [getRestKey(clefName)], duration: "wr", clef: clefName, auto_stem: false });
                        // 🚨 加返！將空白小節嘅全休止符推高一格掛喺第四線
                        ghost.setYShift(-10);
                        notes.push(ghost);
                        return notes;
                    }
                    
                    dataArr.forEach(d => {
                        let vexDur = d.duration.replace('d', ''); 
                        let keys = d.isRest ? [getRestKey(clefName)] : d.pitches;
                        
                        let note = new StaveNote({ 
                            keys: keys, 
                            duration: vexDur + (d.isRest ? "r" : ""), 
                            clef: clefName, 
                            auto_stem: !d.isRest 
                        });
                        
                        // 🚨 加返！將手動輸入嘅全休止符推高一格掛喺第四線
                        if (d.isRest && vexDur === 'w') {
                            note.setYShift(-10);
                        }
                        
                        note.setAttribute('id', `vf-${trackName}-${d.globalIdx}`);
                        note.setAttribute('class', 'vf-stavenote'); 
                        
                        let isEditing = (currentTrack === trackName && editingIndex === d.globalIdx);
                        applyModifiers(note, d, isEditing);
                        notes.push(note);
                    });
                    return notes;
                }

                let tNotes = [], bNotes = [];
                let voices = [];
                let beamsTreble = [], beamsBass = [];

                if (clef === 'grand' || clef === 'treble') {
                    tNotes = processNotes(measureGroup.treble, 'treble', 'treble');
                    voices.push(new Voice({num_beats: timeBeats, beat_value: 4}).setMode(Voice.Mode.SOFT).addTickables(tNotes));
                    beamsTreble = Beam.generateBeams(tNotes.filter(n => !n.isRest()));
                }
                
                if (clef === 'grand' || clef === 'bass') {
                    bNotes = processNotes(measureGroup.bass, 'bass', 'bass');
                    voices.push(new Voice({num_beats: timeBeats, beat_value: 4}).setMode(Voice.Mode.SOFT).addTickables(bNotes));
                    beamsBass = Beam.generateBeams(bNotes.filter(n => !n.isRest()));
                }

                if (isColorMode) {
                    beamsTreble.forEach(b => { const c = colorMap[b.notes[0].keys[0].charAt(0).toLowerCase()] || "#000"; b.setStyle({ fillStyle: c, strokeStyle: c }); });
                    beamsBass.forEach(b => { const c = colorMap[b.notes[0].keys[0].charAt(0).toLowerCase()] || "#000"; b.setStyle({ fillStyle: c, strokeStyle: c }); });
                }
                
                let formatter = new Formatter();
                voices.forEach(v => formatter.joinVoices([v]));
                formatter.format(voices, mW - 40);
                
                if (clef === 'grand' || clef === 'treble') { voices[0].draw(context, stave); beamsTreble.forEach(b => b.setContext(context).draw()); }
                if (clef === 'grand') { voices[1].draw(context, staveBass); beamsBass.forEach(b => b.setContext(context).draw()); }
                else if (clef === 'bass') { voices[0].draw(context, stave); beamsBass.forEach(b => b.setContext(context).draw()); }
            });
        });
    });
}

function processPitch(basePitch, shiftVal, acc) {
    let noteName = basePitch.split('/')[0];
    let oct = parseInt(basePitch.split('/')[1]) + shiftVal;
    if (acc === '#' || acc === 'b' || acc === 'n') noteName += acc;
    return `${noteName}/${oct}`;
}

function toTonePitch(pitchStr) {
    let note = pitchStr.split('/')[0];
    let oct = pitchStr.split('/')[1];
    let toneNote = note.charAt(0).toUpperCase() + note.slice(1) + oct;
    return toneNote.replace('n', ''); 
}

// --- 輸入與替換邏輯 ---
document.querySelectorAll('.note-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
        let rawPitch = this.getAttribute('data-note'); 
        const fingering = document.getElementById('fingering-select').value;
        const octaveShift = parseInt(document.getElementById('octave-select').value);
        const acc = document.querySelector('input[name="acc"]:checked').value;
        const isChordMode = document.getElementById('chord-mode').checked;
        
        let basePitch = processPitch(rawPitch, octaveShift, acc);
        let newData = { pitches: [basePitch], duration: selectedDuration, isRest: isRestMode, fingerings: [fingering], accs: [acc] };

        if (isChordMode && !isRestMode && tracks[currentTrack].length > 0) {
            let targetIdx = editingIndex !== -1 ? editingIndex : tracks[currentTrack].length - 1;
            let targetData = tracks[currentTrack][targetIdx];
            if (targetData.duration === selectedDuration && !targetData.isRest) {
                targetData.pitches.push(basePitch);
                targetData.fingerings.push(fingering);
                targetData.accs.push(acc);
                document.getElementById('chord-mode').checked = false; 
            } else { alert("⚠️ 疊加失敗：長度必須相同！"); return; }
        } else {
            if (editingIndex !== -1) {
                tracks[currentTrack][editingIndex] = newData;
                editingIndex = -1; 
                updateEditStatus();
            } else {
                tracks[currentTrack].push(newData);
            }
        }
        
        renderScore();

        if (!isRestMode) {
            await Tone.start();
            let synth = getSynth();
            synth.triggerAttackRelease(toTonePitch(basePitch), "8n");
        }
    });
});

document.getElementById('undo-btn').addEventListener('click', () => { tracks[currentTrack].pop(); editingIndex = -1; updateEditStatus(); });
document.getElementById('clear-btn').addEventListener('click', () => { tracks = {treble:[], bass:[]}; editingIndex = -1; updateEditStatus(); });

document.getElementById('play-all-btn').addEventListener('click', async () => {
    await Tone.start();
    let synth = getSynth();
    synth.releaseAll();
    Tone.Transport.cancel();
    
    let now = Tone.now();
    ['treble', 'bass'].forEach(trackName => {
        let tNow = now;
        tracks[trackName].forEach(data => {
            let toneDur = data.duration === "w" ? "1n" : data.duration === "hd" ? "2n." : data.duration === "h" ? "2n" : data.duration === "qd" ? "4n." : data.duration === "q" ? "4n" : "8n";
            let addTime = getBeatValue(data.duration) * 0.5; 
            if (!data.isRest) synth.triggerAttackRelease(data.pitches.map(p => toTonePitch(p)), toneDur, tNow);
            tNow += addTime;
        });
    });
});

document.getElementById('stop-btn').addEventListener('click', () => {
    if (globalSynth) { globalSynth.releaseAll(); }
});

document.getElementById('export-pdf-btn').addEventListener('click', () => { window.print(); });

updateClefUI();
