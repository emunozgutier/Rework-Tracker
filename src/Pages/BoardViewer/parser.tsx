import { parseAllegroBRD } from './allegro/allegro-brd-parser';

export interface BoardData {
    dimensions: Array<{ x1: number; y1: number; x2: number; y2: number }>;
    elements: Array<{
        name: string;
        value: string;
        package: string;
        x: number;
        y: number;
        rot: string;
        mirror: boolean;
        angle: number;
        smds: Array<{ name: string; x: number; y: number; dx: number; dy: number; layer: number; rot?: string }>;
        pads: Array<{ name: string; x: number; y: number; drill: number; diameter: number }>;
        silks: Array<{ x1: number; y1: number; x2: number; y2: number; width: number; layer: number }>;
    }>;
    signals: Array<{
        name: string;
        wires: Array<{ x1: number; y1: number; x2: number; y2: number; width: number; layer: number }>;
        vias: Array<{ x: number; y: number; drill: number; diameter: number }>;
        polygons?: Array<{
            layer: number;
            width: number;
            vertices: Array<{ x: number; y: number }>;
        }>;
    }>;
    boundingBox: { minX: number; minY: number; maxX: number; maxY: number };
    format?: string;
    layerNames?: string[];
}

export function getCopperLayerNumber(idx: number, totalLayers: number): number {
    if (idx === 0) return 1; // TOP
    if (idx === totalLayers - 1) return 16; // BOTTOM
    return 2 + idx; // Inner layers: 2, 3, 4, ...
}

export function parseAllegro(buffer: ArrayBuffer): BoardData {
    const rawData = parseAllegroBRD(buffer);
    return adaptAllegroBoardData(rawData);
}

function adaptAllegroBoardData(ripperData: any): BoardData {
    // 1. Map outline points to dimensions lines
    const dimensions: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    let outline = ripperData.outline || [];
    if (outline.length === 0) {
        const bounds = ripperData.bounds || { minX: 0, minY: 0, maxX: 100, maxY: 100 };
        outline = [
            { x: bounds.minX, y: bounds.minY },
            { x: bounds.maxX, y: bounds.minY },
            { x: bounds.maxX, y: bounds.maxY },
            { x: bounds.minX, y: bounds.maxY }
        ];
    }
    
    for (let i = 0; i < outline.length; i++) {
        const p1 = outline[i];
        const p2 = outline[(i + 1) % outline.length];
        dimensions.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    }

    // 2. Map parts to elements
    const elements: BoardData['elements'] = (ripperData.parts || []).map((part: any) => {
        const smds: any[] = [];
        const pads: any[] = [];
        const mirror = part.side === 'bottom';
        const angleDeg = part.angleDeg || 0;
        
        part.pins.forEach((pin: any) => {
            const side = pin.side || 'top';
            const layer = side === 'top' ? 1 : 16;
            
            // Map absolute pin position to local un-rotated, un-mirrored component space
            const dxAbs = pin.position.x - part.origin.x;
            const dyAbs = pin.position.y - part.origin.y;
            
            const rad = (angleDeg) * Math.PI / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            
            // Un-rotate
            let dxLocal = dxAbs * cos + dyAbs * sin;
            let dyLocal = -dxAbs * sin + dyAbs * cos;
            
            // Un-mirror
            if (mirror) {
                dxLocal = -dxLocal;
            }
            
            // Check if pad is through-hole or SMD
            // Through-hole pads have side='both'
            const isThru = pin.side === 'both';
            if (isThru) {
                pads.push({
                    name: pin.name || pin.number || '',
                    x: dxLocal,
                    y: dyLocal,
                    drill: pin.radius ? (pin.radius * 0.8) : 0.6,
                    diameter: pin.radius ? (pin.radius * 2) : 1.2
                });
            } else {
                // Determine SMD dims
                let dx = 1.0;
                let dy = 1.0;
                if (pin.padBounds) {
                    dx = pin.padBounds.maxX - pin.padBounds.minX;
                    dy = pin.padBounds.maxY - pin.padBounds.minY;
                } else if (pin.radius) {
                    dx = pin.radius * 2;
                    dy = pin.radius * 2;
                } else if (pin.padWidth && pin.padHeight) {
                    dx = pin.padWidth;
                    dy = pin.padHeight;
                }
                
                // Map local pad rotation if it differs from component rotation
                let rotStr: string | undefined = undefined;
                if (pin.padAngleDeg !== undefined) {
                    let localAngle = pin.padAngleDeg - angleDeg;
                    if (mirror) localAngle = -localAngle;
                    rotStr = `R${localAngle}`;
                }
                
                smds.push({
                    name: pin.name || pin.number || '',
                    x: dxLocal,
                    y: dyLocal,
                    dx,
                    dy,
                    layer,
                    rot: rotStr
                });
            }
        });

        return {
            name: part.name || '',
            value: part.meta?.value || '',
            package: part.meta?.package || '',
            x: part.origin.x,
            y: part.origin.y,
            rot: part.angleDeg ? `R${part.angleDeg}` : 'R0',
            mirror,
            angle: angleDeg,
            smds,
            pads,
            silks: []
        };
    });

    // Append global silkscreen paths under dummy components (separate top and bottom)
    if (ripperData.silkscreen && ripperData.silkscreen.length > 0) {
        const topSilks: any[] = [];
        const botSilks: any[] = [];
        ripperData.silkscreen.forEach((pathItem: any) => {
            const isBottom = pathItem.side === 'bottom';
            const layer = isBottom ? 22 : 21;
            const target = isBottom ? botSilks : topSilks;
            for (let i = 0; i < pathItem.points.length - 1; i++) {
                const p1 = pathItem.points[i];
                const p2 = pathItem.points[i + 1];
                target.push({
                    x1: p1.x,
                    y1: p1.y,
                    x2: p2.x,
                    y2: p2.y,
                    width: 0.15,
                    layer
                });
            }
        });
        
        if (topSilks.length > 0) {
            elements.push({
                name: '___GLOBAL_SILK_TOP___',
                value: '',
                package: '',
                x: 0,
                y: 0,
                rot: 'R0',
                mirror: false,
                angle: 0,
                smds: [],
                pads: [],
                silks: topSilks
            });
        }
        if (botSilks.length > 0) {
            elements.push({
                name: '___GLOBAL_SILK_BOT___',
                value: '',
                package: '',
                x: 0,
                y: 0,
                rot: 'R0',
                mirror: true,
                angle: 0,
                smds: [],
                pads: [],
                silks: botSilks
            });
        }
    }

    // 3. Map traces/nets to signals
    const signalsMap = new Map<string, { wires: any[], vias: any[], polygons: any[] }>();
    const totalLayers = (ripperData.layerNames || []).length || 2;
    
    (ripperData.traces || []).forEach((trace: any) => {
        const netName = trace.net || 'GND';
        if (!signalsMap.has(netName)) {
            signalsMap.set(netName, { wires: [], vias: [], polygons: [] });
        }
        const sigObj = signalsMap.get(netName)!;
        const layerNum = getCopperLayerNumber(trace.layer, totalLayers);
        sigObj.wires.push({
            x1: trace.start.x,
            y1: trace.start.y,
            x2: trace.end.x,
            y2: trace.end.y,
            width: trace.width || 0.2,
            layer: layerNum
        });
    });

    (ripperData.vias || []).forEach((via: any) => {
        const netName = via.net || 'GND';
        if (!signalsMap.has(netName)) {
            signalsMap.set(netName, { wires: [], vias: [], polygons: [] });
        }
        const sigObj = signalsMap.get(netName)!;
        sigObj.vias.push({
            x: via.position.x,
            y: via.position.y,
            drill: via.diameter ? (via.diameter / 1.6) : 0.6,
            diameter: via.diameter || 1.2
        });
    });

    (ripperData.surfaces || []).forEach((surf: any) => {
        const netName = surf.net || 'GND';
        if (!signalsMap.has(netName)) {
            signalsMap.set(netName, { wires: [], vias: [], polygons: [] });
        }
        const sigObj = signalsMap.get(netName)!;
        
        const vertices = (surf.polygon || []).map((p: any) => ({ x: p.x, y: p.y }));
        const layerNum = getCopperLayerNumber(surf.layer, totalLayers);
        sigObj.polygons.push({
            vertices,
            layer: layerNum,
            width: 0.2
        });
    });

    const signals = Array.from(signalsMap.entries()).map(([name, val]) => ({
        name,
        wires: val.wires,
        vias: val.vias,
        polygons: val.polygons
    }));

    // 4. Bounding Box
    const bounds = ripperData.bounds || { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const boundingBox = {
        minX: bounds.minX,
        minY: bounds.minY,
        maxX: bounds.maxX,
        maxY: bounds.maxY
    };

    return {
        dimensions,
        elements,
        signals,
        boundingBox,
        format: 'ALLEGRO_BRD',
        layerNames: ripperData.layerNames
    };
}

// Parser implementation: Eagle XML files
export function parseEagleXML(xmlDoc: Document): BoardData {
    const dimensions: any[] = [];
    const elements: any[] = [];
    const signals: any[] = [];
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const updateBBox = (x: number, y: number) => {
        if (isNaN(x) || isNaN(y)) return;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    };

    // 1. Build footprint packages dictionary
    const packagesMap: Record<string, any> = {};
    const libraries = xmlDoc.querySelectorAll('libraries > library');
    libraries.forEach(lib => {
        const libName = lib.getAttribute('name') || '';
        const packages = lib.querySelectorAll('packages > package');
        packages.forEach(pkg => {
            const pkgName = pkg.getAttribute('name') || '';
            const key = `${libName}::${pkgName}`;
            
            const smds = Array.from(pkg.querySelectorAll('smd')).map(s => ({
                name: s.getAttribute('name') || '',
                x: parseFloat(s.getAttribute('x') || '0'),
                y: parseFloat(s.getAttribute('y') || '0'),
                dx: parseFloat(s.getAttribute('dx') || '0'),
                dy: parseFloat(s.getAttribute('dy') || '0'),
                layer: parseInt(s.getAttribute('layer') || '1', 10),
                rot: s.getAttribute('rot') || ''
            }));
            
            const pads = Array.from(pkg.querySelectorAll('pad')).map(p => ({
                name: p.getAttribute('name') || '',
                x: parseFloat(p.getAttribute('x') || '0'),
                y: parseFloat(p.getAttribute('y') || '0'),
                drill: parseFloat(p.getAttribute('drill') || '0'),
                diameter: parseFloat(p.getAttribute('diameter') || '0') || (parseFloat(p.getAttribute('drill') || '0') * 1.6)
            }));
            
            const silks = Array.from(pkg.querySelectorAll('wire')).map(w => ({
                x1: parseFloat(w.getAttribute('x1') || '0'),
                y1: parseFloat(w.getAttribute('y1') || '0'),
                x2: parseFloat(w.getAttribute('x2') || '0'),
                y2: parseFloat(w.getAttribute('y2') || '0'),
                width: parseFloat(w.getAttribute('width') || '0.15'),
                layer: parseInt(w.getAttribute('layer') || '21', 10)
            }));
            
            packagesMap[key] = { smds, pads, silks };
            packagesMap[pkgName] = { smds, pads, silks };
        });
    });

    // 2. Parse board outline/dimensions (Layer 20)
    const outlineWires = xmlDoc.querySelectorAll('board > plain > wire[layer="20"]');
    outlineWires.forEach(w => {
        const x1 = parseFloat(w.getAttribute('x1') || '0');
        const y1 = parseFloat(w.getAttribute('y1') || '0');
        const x2 = parseFloat(w.getAttribute('x2') || '0');
        const y2 = parseFloat(w.getAttribute('y2') || '0');
        dimensions.push({ x1, y1, x2, y2 });
        updateBBox(x1, y1);
        updateBBox(x2, y2);
    });

    // 3. Parse components/elements
    const elementsList = xmlDoc.querySelectorAll('board > elements > element');
    elementsList.forEach(el => {
        const name = el.getAttribute('name') || '';
        const value = el.getAttribute('value') || '';
        const pkg = el.getAttribute('package') || '';
        const lib = el.getAttribute('library') || '';
        const x = parseFloat(el.getAttribute('x') || '0');
        const y = parseFloat(el.getAttribute('y') || '0');
        const rot = el.getAttribute('rot') || 'R0';
        
        const mirror = rot.includes('M');
        const angle = parseFloat(rot.replace(/^[a-zA-Z]/, '')) || 0;
        
        // Only expand the bounding box using component locations if there is no outline wire parsed
        if (minX === Infinity) {
            updateBBox(x, y);
        }

        const key = `${lib}::${pkg}`;
        const pkgDetails = packagesMap[key] || packagesMap[pkg] || { smds: [], pads: [], silks: [] };

        // Rotate and mirror component pads/SMDs/silks relative to the package origin
        const smds = pkgDetails.smds.map((smd: any) => ({
            ...smd,
            x: mirror ? -smd.x : smd.x,
            layer: mirror ? 16 : smd.layer
        }));

        const pads = pkgDetails.pads.map((pad: any) => ({
            ...pad,
            x: mirror ? -pad.x : pad.x
        }));

        const silks = pkgDetails.silks.map((silk: any) => ({
            ...silk,
            x1: mirror ? -silk.x1 : silk.x1,
            x2: mirror ? -silk.x2 : silk.x2,
            layer: mirror ? 22 : silk.layer // Bottom Silkscreen is layer 22
        }));

        elements.push({
            name,
            value,
            package: pkg,
            x,
            y,
            rot,
            mirror,
            angle,
            smds,
            pads,
            silks
        });
    });

    // 4. Parse signals/traces (vias, wires, and polygons)
    const signalsList = xmlDoc.querySelectorAll('board > signals > signal');
    signalsList.forEach(sig => {
        const name = sig.getAttribute('name') || '';
        const wires: any[] = [];
        const vias: any[] = [];
        const polygons: any[] = [];

        sig.querySelectorAll('wire').forEach(w => {
            const x1 = parseFloat(w.getAttribute('x1') || '0');
            const y1 = parseFloat(w.getAttribute('y1') || '0');
            const x2 = parseFloat(w.getAttribute('x2') || '0');
            const y2 = parseFloat(w.getAttribute('y2') || '0');
            const width = parseFloat(w.getAttribute('width') || '0.2');
            const layer = parseInt(w.getAttribute('layer') || '1', 10);
            
            wires.push({ x1, y1, x2, y2, width, layer });
            if (minX === Infinity) {
                updateBBox(x1, y1);
                updateBBox(x2, y2);
            }
        });

        sig.querySelectorAll('via').forEach(v => {
            const x = parseFloat(v.getAttribute('x') || '0');
            const y = parseFloat(v.getAttribute('y') || '0');
            const drill = parseFloat(v.getAttribute('drill') || '0.6');
            const diameter = parseFloat(v.getAttribute('diameter') || '0') || (drill * 1.6);
            
            vias.push({ x, y, drill, diameter });
            if (minX === Infinity) {
                updateBBox(x, y);
            }
        });

        sig.querySelectorAll('polygon').forEach(poly => {
            const layer = parseInt(poly.getAttribute('layer') || '1', 10);
            const width = parseFloat(poly.getAttribute('width') || '0.2');
            const vertices: Array<{ x: number; y: number }> = [];
            poly.querySelectorAll('vertex').forEach(v => {
                vertices.push({
                    x: parseFloat(v.getAttribute('x') || '0'),
                    y: parseFloat(v.getAttribute('y') || '0')
                });
            });
            if (vertices.length > 0) {
                polygons.push({ layer, width, vertices });
            }
        });

        signals.push({ name, wires, vias, polygons });
    });

    if (minX === Infinity) {
        minX = 0; minY = 0; maxX = 100; maxY = 100;
    }

    return {
        dimensions,
        elements,
        signals,
        boundingBox: { minX, minY, maxX, maxY },
        format: 'EAGLE'
    };
}

// Parser implementation: Binary fallback scanner
export function parseBinaryFallback(binaryContent: string): BoardData {
    // Limit scanning to first 50MB for performance safety on large files
    const scanLimit = 50 * 1024 * 1024;
    const contentToScan = binaryContent.length > scanLimit 
        ? binaryContent.slice(0, scanLimit) 
        : binaryContent;

    // Scan for standard designator labels
    const designatorRegex = /\b([URCDJQY]|TP|JP|CN|LED|F|FB|TP|MH|CONN)[0-9]{1,4}\b/g;
    const foundDesignators = new Set<string>();
    let match;
    while ((match = designatorRegex.exec(contentToScan)) !== null) {
        foundDesignators.add(match[0]);
        if (foundDesignators.size >= 1500) break; // Cap matching count
    }

    // Scan for common net name strings
    const netRegex = /\b(GND|VCC|VDD|3V3|5V|1V8|RESET|CLK|MISO|MOSI|SCK|CS|DDR_[A-Z0-9_]+|USB_[A-Z_]+)\b/g;
    const foundNets = new Set<string>();
    while ((match = netRegex.exec(contentToScan)) !== null) {
        foundNets.add(match[0]);
        if (foundNets.size >= 400) break; // Cap matching count
    }

    const designators = Array.from(foundDesignators).sort((a, b) => {
        const aPrefix = a.replace(/[0-9]/g, '');
        const bPrefix = b.replace(/[0-9]/g, '');
        if (aPrefix !== bPrefix) return aPrefix.localeCompare(bPrefix);
        return (parseInt(a.replace(/[^0-9]/g, ''), 10) || 0) - (parseInt(b.replace(/[^0-9]/g, ''), 10) || 0);
    });
    const nets = Array.from(foundNets).sort();
    if (nets.indexOf('GND') === -1) nets.unshift('GND');
    if (nets.indexOf('VCC') === -1) nets.push('VCC');

    // Layout dimensions representing a typical board outline
    const dimensions = [
        { x1: 0, y1: 0, x2: 240, y2: 0 },
        { x1: 240, y1: 0, x2: 240, y2: 130 },
        { x1: 240, y1: 130, x2: 0, y2: 130 },
        { x1: 0, y1: 130, x2: 0, y2: 0 }
    ];

    const elements: any[] = [];
    const signals: any[] = [];

    // Grid layout spacing logic
    const cols = 10;
    designators.forEach((name, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = 20 + col * 22;
        const y = 20 + row * 18;

        let pkg = '0603';
        let val = '';
        let smds: any[] = [];
        let pads: any[] = [];
        let silks: any[] = [];

        if (name.startsWith('U')) {
            pkg = 'SO-8';
            val = 'IC';
            // 8 pads
            for (let i = 0; i < 4; i++) {
                smds.push({ name: `${i + 1}`, x: -2, y: 1.5 - i * 1, dx: 1.2, dy: 0.5, layer: 1 });
                smds.push({ name: `${8 - i}`, x: 2, y: 1.5 - i * 1, dx: 1.2, dy: 0.5, layer: 1 });
            }
            silks = [
                { x1: -1.5, y1: 2.2, x2: 1.5, y2: 2.2, layer: 21 },
                { x1: 1.5, y1: 2.2, x2: 1.5, y2: -2.2, layer: 21 },
                { x1: 1.5, y1: -2.2, x2: -1.5, y2: -2.2, layer: 21 },
                { x1: -1.5, y1: -2.2, x2: -1.5, y2: 2.2, layer: 21 }
            ];
        } else if (name.startsWith('R') || name.startsWith('C') || name.startsWith('FB')) {
            pkg = '0603';
            val = name.startsWith('R') ? '10k' : '0.1uF';
            smds = [
                { name: '1', x: -0.85, y: 0, dx: 0.6, dy: 0.8, layer: 1 },
                { name: '2', x: 0.85, y: 0, dx: 0.6, dy: 0.8, layer: 1 }
            ];
            silks = [
                { x1: -1.2, y1: 0.6, x2: 1.2, y2: 0.6, layer: 21 },
                { x1: 1.2, y1: 0.6, x2: 1.2, y2: -0.6, layer: 21 },
                { x1: 1.2, y1: -0.6, x2: -1.2, y2: -0.6, layer: 21 },
                { x1: -1.2, y1: -0.6, x2: -1.2, y2: 0.6, layer: 21 }
            ];
        } else if (name.startsWith('LED')) {
            pkg = '0805_LED';
            val = 'Red';
            smds = [
                { name: 'A', x: -1.0, y: 0, dx: 0.8, dy: 1.0, layer: 1 },
                { name: 'C', x: 1.0, y: 0, dx: 0.8, dy: 1.0, layer: 1 }
            ];
            silks = [
                { x1: -1.5, y1: 0.8, x2: 1.5, y2: 0.8, layer: 21 },
                { x1: 1.5, y1: 0.8, x2: 1.5, y2: -0.8, layer: 21 },
                { x1: 1.5, y1: -0.8, x2: -1.5, y2: -0.8, layer: 21 },
                { x1: -1.5, y1: -0.8, x2: -1.5, y2: 0.8, layer: 21 }
            ];
        } else {
            pkg = 'PTH_2MM';
            val = 'Pad';
            pads = [{ name: '1', x: 0, y: 0, drill: 0.9, diameter: 1.8 }];
            silks = [
                { x1: -1.2, y1: 1.2, x2: 1.2, y2: 1.2, layer: 21 },
                { x1: 1.2, y1: 1.2, x2: 1.2, y2: -1.2, layer: 21 },
                { x1: 1.2, y1: -1.2, x2: -1.2, y2: -1.2, layer: 21 },
                { x1: -1.2, y1: -1.2, x2: -1.2, y2: 1.2, layer: 21 }
            ];
        }

        elements.push({
            name,
            value: val,
            package: pkg,
            x,
            y: y % 110, // wrap inside outline limits
            rot: 'R0',
            mirror: false,
            angle: 0,
            smds,
            pads,
            silks
        });
    });

    // Add simulated traces between grid elements connecting to nets
    nets.slice(0, 20).forEach((netName, nIdx) => {
        const wires: any[] = [];
        const connectionsCount = 3 + (nIdx % 4);
        
        for (let i = 0; i < connectionsCount; i++) {
            const elIdx = (nIdx * 5 + i * 8) % elements.length;
            const nextElIdx = (elIdx + 1) % elements.length;
            const el = elements[elIdx];
            const nextEl = elements[nextElIdx];
            if (el && nextEl) {
                wires.push({
                    x1: el.x,
                    y1: el.y,
                    x2: nextEl.x,
                    y2: nextEl.y,
                    width: 0.3,
                    layer: nIdx % 2 === 0 ? 1 : 16 // alternate layers
                });
            }
        }
        signals.push({ name: netName, wires, vias: [] });
    });

    return {
        dimensions,
        elements,
        signals,
        boundingBox: { minX: 0, minY: 0, maxX: 240, maxY: 130 },
        format: 'FALLBACK'
    };
}

export function getComponentCenterAndBounds(el: BoardData['elements'][number]) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    // 1. Process pads
    if (el.pads) {
        el.pads.forEach((pad) => {
            const r = pad.diameter / 2;
            minX = Math.min(minX, pad.x - r);
            maxX = Math.max(maxX, pad.x + r);
            minY = Math.min(minY, pad.y - r);
            maxY = Math.max(maxY, pad.y + r);
        });
    }

    // 2. Process SMDs
    if (el.smds) {
        el.smds.forEach((smd) => {
            const rx = smd.dx / 2;
            const ry = smd.dy / 2;
            minX = Math.min(minX, smd.x - rx);
            maxX = Math.max(maxX, smd.x + rx);
            minY = Math.min(minY, smd.y - ry);
            maxY = Math.max(maxY, smd.y + ry);
        });
    }

    // 3. Process silkscreen lines
    if (el.silks) {
        el.silks.forEach((silk) => {
            minX = Math.min(minX, silk.x1, silk.x2);
            maxX = Math.max(maxX, silk.x1, silk.x2);
            minY = Math.min(minY, silk.y1, silk.y2);
            maxY = Math.max(maxY, silk.y1, silk.y2);
        });
    }

    // Fallback if no elements define bounds
    let w = 0;
    let h = 0;
    let lx_center = 0;
    let ly_center = 0;

    if (minX === Infinity || maxX === -Infinity) {
        w = 2.0; // fallback default width in mm/board units
        h = 2.0;
        lx_center = 0;
        ly_center = 0;
    } else {
        // Add a minor margin around the component (e.g., 0.8 board units or 15% minimum)
        const padX = Math.max(0.6, (maxX - minX) * 0.15);
        const padY = Math.max(0.6, (maxY - minY) * 0.15);
        w = (maxX - minX) + padX * 2;
        h = (maxY - minY) + padY * 2;
        lx_center = (minX + maxX) / 2;
        ly_center = (minY + maxY) / 2;
    }

    // Map local center to rotated & mirrored relative coordinates
    const mx = el.mirror ? -lx_center : lx_center;
    const my = ly_center;

    const rad = (el.angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Re-rotate local center vector to get absolute delta relative to component origin
    const dxAbs = mx * cos - my * sin;
    const dyAbs = mx * sin + my * cos;

    const centerX = el.x + dxAbs;
    const centerY = el.y + dyAbs;

    return { centerX, centerY, width: w, height: h };
}
